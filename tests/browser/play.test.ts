import { expect, test, type Page } from "@playwright/test";
import {
  fillBirthDate,
  freshEmail,
  JOURNEY_PASSWORD,
  payAsNewMember,
  SITE_URL,
  standInPayButton,
  yearsAgo,
} from "./support/account.ts";
import { endMembershipOf, userIdOf } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { pipRed, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Playing a game, `/g/<game>/play` (design 5.2, 5.7, 8): the game fills the window in its own frame, on its own address,
// with one strip above it holding the way back. Someone who may not play gets the price card instead. The games here
// are sent the way a maker sends one, so their files are really in the bucket; each project makes them once and its
// journeys share them, since none of these journeys changes a game.

test.beforeEach(forgetRateLimits);

type Game = Awaited<ReturnType<typeof addGame>>;
let paid: Game;
let free: Game;
let computerOnly: Game;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  paid = await addGame(browser);
  free = await addGame(browser, { free: true });
  computerOnly = await addGame(browser, { free: true, playsOn: "computer_only" });
});

/** The game's own page has run its script: a second file loaded under the pass, so the pass reaches every file. */
async function expectTheGameLoaded(page: Page): Promise<void> {
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
}

/** True when the browser itself says it is a phone, as the site reads it. Playwright's iPads say so too. */
async function browserSaysPhone(page: Page): Promise<boolean> {
  return /Mobi|Android/.test(await page.evaluate(() => navigator.userAgent));
}

test("a member presses Play and the game loads, in a frame on another address", async ({
  page,
}, testInfo) => {
  await payAsNewMember(page);
  await page.goto(`/g/${paid.slug}`);
  await page.getByRole("link", { name: "Play" }).click();
  await expect(page).toHaveURL(`/g/${paid.slug}/play`);
  await expect(page).toHaveTitle(`${paid.name} · Ruken`);
  const frame = page.locator("iframe.frame");
  await expect(frame).toHaveAttribute("title", paid.name);
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock");
  await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(frame).toHaveAttribute(
    "src",
    new RegExp(`^http://g-${paid.publicId}\\.localhost:8788/[^/?#]+/$`),
  );
  await expectTheGameLoaded(page);
  await showTheOwner(page, testInfo, "a game being played");
});

test("the game sees nothing about the player", async ({ page }) => {
  const member = await payAsNewMember(page);
  await page.goto(`/g/${paid.slug}/play`);
  await expectTheGameLoaded(page);
  const seen = JSON.parse(
    (await page.frameLocator("iframe.frame").locator("#seen").textContent()) ?? "{}",
  ) as Record<string, string>;
  expect(seen).toMatchObject({ referrer: "", search: "", hash: "", name: "", cookie: "" });
  // The pass is in the game's own address: it must not name the player.
  const path = seen.path ?? "";
  expect(path).not.toContain(member.email);
  expect(path).not.toContain(encodeURIComponent(member.email));
  expect(path).not.toContain(await userIdOf(member.email));
  expect(await page.locator("iframe.frame").getAttribute("name")).toBeNull();
});

test("someone who has not paid gets the price card, and the files do not load", async ({ page }) => {
  // design 8
  await page.goto(`/g/${paid.slug}/play`);
  await expect(page).toHaveURL(`/join?next=%2Fg%2F${paid.slug}%2Fplay`);
  await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
  // Not now goes back to the game's page they came from.
  await expect(page.getByRole("link", { name: "Not now" })).toHaveAttribute("href", `/g/${paid.slug}`);
  // Without a pass, the game's own address serves nothing of it.
  const bare = await page.goto(`http://g-${paid.publicId}.localhost:8788/index.html`);
  expect(bare?.status()).toBe(403);
});

test("a stranger signs up, pays, and is in the game they tapped", async ({ page }) => {
  // design 8
  await page.goto(`/g/${paid.slug}`);
  await page.getByRole("link", { name: "Play" }).click();
  await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Email").fill(freshEmail());
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await fillBirthDate(page, yearsAgo(30));
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await standInPayButton(page).click();
  await expect(page).toHaveURL(`/g/${paid.slug}/play`);
  await expectTheGameLoaded(page);
});

test("anyone can play a free game without an account", async ({ page }) => {
  // design 8
  await page.goto(`/g/${free.slug}/play`);
  await expect(page).toHaveURL(`/g/${free.slug}/play`);
  await expectTheGameLoaded(page);
});

test("a member whose membership has ended gets the price card on reload", async ({ page }) => {
  const member = await payAsNewMember(page);
  await page.goto(`/g/${paid.slug}/play`);
  await expectTheGameLoaded(page);
  await endMembershipOf(member.email);
  await page.reload();
  await expect(page).toHaveURL(`/join?next=%2Fg%2F${paid.slug}%2Fplay`);
});

test("the way back is one link, and its line shows once", async ({ page }) => {
  await page.clock.install();
  await page.goto(`/g/${free.slug}/play`);
  const line = page.getByText("Tap ← to go back to the feed");
  await expect(line).toBeVisible();
  await page.clock.runFor(5_000);
  await expect(line).toHaveCount(0);
  await page.reload();
  await expectTheGameLoaded(page);
  await expect(line).toHaveCount(0);
  const back = page.getByRole("link", { name: "Back to the feed" });
  await expect(back).toHaveAttribute("href", `/g/${free.slug}`);
  const box = await back.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(48);
  expect(box?.height).toBeGreaterThanOrEqual(48);
  await back.click();
  await expect(page).toHaveURL(`/g/${free.slug}`);
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("a phone that opens a computer-only game's play address is sent to its page", async ({ page }) => {
  await page.goto(`/g/${computerOnly.slug}/play`);
  if (await browserSaysPhone(page)) {
    await expect(page).toHaveURL(`/g/${computerOnly.slug}`);
    await expect(page.getByText("This one needs a computer.")).toBeVisible();
  } else {
    await expect(page).toHaveURL(`/g/${computerOnly.slug}/play`);
    await expectTheGameLoaded(page);
  }
});

test("nothing on the play screen is red, and nothing scrolls sideways", async ({ page }) => {
  await page.goto(`/g/${free.slug}/play`);
  await expectTheGameLoaded(page);
  expect(await pipRed(page)).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
  // The game fills what the strip leaves: nothing of the page scrolls under it.
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight),
  ).toBe(true);
});

test("opening games too fast says so in plain words, with a way back", async ({ page }) => {
  // The site lets one address open 30 games a minute; the 31st is refused.
  for (let opened = 0; opened < 30; opened += 1) {
    const answer = await page.request.get(`${SITE_URL}/g/${free.slug}/play`);
    expect(answer.status(), `open ${String(opened + 1)}`).toBe(200);
  }
  const refused = await page.goto(`/g/${free.slug}/play`);
  expect(refused?.status()).toBe(429);
  await expect(page.getByRole("heading", { name: "You've opened a lot of games just now." })).toBeVisible();
  await expect(page.getByText("Try again in a minute.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveAttribute("href", "/");
});
