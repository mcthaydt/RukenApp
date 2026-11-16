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
import { endMembershipOf, sessionsOf, userIdOf } from "./support/database.ts";
import { addGame, expectTheGameLoaded, takeOffAsItsMaker, TINY_GAME } from "./support/game.ts";
import { pipRed, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Playing a game, `/g/<game>/play` (design 5.2, 5.7, 8): the game fills the window in its own frame, on its own address,
// with one strip above it holding the way back. Someone who may not play gets the price card instead. The games here
// are sent the way a maker sends one, so their files are really in the bucket; each project makes them once and its
// journeys share them, since none of these journeys changes a game. They are 2048, a real game; the tiny game, which
// writes down what it can see of the page around it, is only the one that checks the game learns nothing.

test.beforeEach(forgetRateLimits);

type Game = Awaited<ReturnType<typeof addGame>>;
let paid: Game;
let free: Game;
let computerOnly: Game;
let probe: Game;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  paid = await addGame(browser);
  free = await addGame(browser, { free: true });
  computerOnly = await addGame(browser, { free: true, playsOn: "computer_only" });
  probe = await addGame(browser, { repo: TINY_GAME });
});

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

test("2048 can be played: the arrow keys move its tiles", async ({ page }) => {
  await page.goto(`/g/${free.slug}/play`);
  await expectTheGameLoaded(page);
  const game = page.frameLocator("iframe.frame");
  const tiles = game.locator(".tile-container");
  await expect(game.locator(".tile")).not.toHaveCount(0);
  const before = await tiles.innerHTML();
  // Pressing the board puts the game in focus, as a person's first tap does; then each key is the game's.
  await game.locator(".game-container").click();
  for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) await page.keyboard.press(key);
  await expect.poll(() => tiles.innerHTML()).not.toBe(before);
});

test("a game taken off Ruken is not at its address, and a member's game stops loading", async ({
  page,
  browser,
}) => {
  // Its own game, since it is taken off.
  test.setTimeout(120_000);
  const game = await addGame(browser);
  await payAsNewMember(page);
  await page.goto(`/g/${game.slug}/play`);
  await expectTheGameLoaded(page);
  const frameUrl = (await page.locator("iframe.frame").getAttribute("src")) ?? "";

  await takeOffAsItsMaker(browser, game);

  // The pass the member already holds opens nothing now, and neither address is there.
  // Asked from a browser of its own: only a browser knows that *.localhost is this machine, and a new one has nothing
  // kept from the frame's first load.
  const fresh = await browser.newContext();
  try {
    expect((await (await fresh.newPage()).goto(`${frameUrl}index.html`))?.status()).toBe(404);
  } finally {
    await fresh.close();
  }
  expect((await page.request.get(`/g/${game.slug}/play`)).status()).toBe(404);
  expect((await page.request.get(`/g/${game.slug}`)).status()).toBe(404);
});

test("pointing at Play starts nothing: a play starts only when Play is pressed", async ({
  page,
  browser,
}) => {
  // Its own game, so no other journey's plays are counted with it.
  test.setTimeout(90_000);
  const game = await addGame(browser, { free: true });
  await page.goto(`/g/${game.slug}`);
  const play = page.getByRole("link", { name: "Play" });
  await play.hover();
  await play.dispatchEvent("touchstart");
  // Give a preload every chance to have been sent and answered before the count is read.
  await page.waitForLoadState("networkidle");
  expect(await sessionsOf(game.slug)).toEqual([]);
});

test("the game sees nothing about the player", async ({ page }) => {
  const member = await payAsNewMember(page);
  await page.goto(`/g/${probe.slug}/play`);
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
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

test("the Ruken menu: the tab on the edge opens it, Back to game closes it, Exit game asks first", async ({
  page,
}, testInfo) => {
  await page.goto(`/g/${free.slug}/play`);
  await expectTheGameLoaded(page);
  // The cover has gone once the game loaded.
  await expect(page.getByRole("heading", { name: `Getting ${free.name} ready.` })).toHaveCount(0);
  const tab = page.getByRole("button", { name: "Ruken menu" });
  await expect(tab).toHaveAttribute("aria-expanded", "false");
  const box = await tab.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  // On the right edge, 48 by 56, its middle halfway down.
  expect(box?.width).toBe(48);
  expect(box?.height).toBe(56);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBe(width);
  await showTheOwner(page, testInfo, "the play screen, the edge tab at rest");

  await tab.click();
  const menu = page.getByRole("dialog", { name: "Ruken menu" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("heading", { name: free.name })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Back to game" })).toBeFocused();
  await expect(menu.getByText("Connected")).toBeVisible();
  await showTheOwner(page, testInfo, "the play screen, the Ruken menu open");
  await menu.getByRole("button", { name: "Back to game" }).click();
  await expect(menu).toBeHidden();

  // Escape is Back to game too.
  await tab.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await tab.click();
  await menu.getByRole("button", { name: "Exit game" }).click();
  const question = page.getByRole("dialog", { name: `Exit ${free.name}?` });
  await expect(question).toBeVisible();
  await expect(question.getByText("You'll go back to the game page.")).toBeVisible();
  await showTheOwner(page, testInfo, "the play screen, the exit question");
  await question.getByRole("button", { name: "Stay in game" }).click();
  await expect(question).toBeHidden();
  await expect(menu).toBeHidden();
  await expect(page.locator("iframe.frame")).toHaveCount(1);

  await tab.click();
  await menu.getByRole("button", { name: "Exit game" }).click();
  await question.getByRole("link", { name: "Exit game" }).click();
  await expect(page).toHaveURL(`/g/${free.slug}`);
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("the edge tab can be moved to the other edge, and stays there next time", async ({ page }) => {
  await page.goto(`/g/${free.slug}/play`);
  await expectTheGameLoaded(page);
  const tab = page.getByRole("button", { name: "Ruken menu" });
  await tab.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(tab).toHaveAttribute("data-edge", "left");
  expect((await tab.boundingBox())?.x).toBe(0);
  await page.reload();
  await expectTheGameLoaded(page);
  await expect(page.getByRole("button", { name: "Ruken menu" })).toHaveAttribute("data-edge", "left");
  // Moving it never opens the menu.
  await expect(page.getByRole("dialog", { name: "Ruken menu" })).toBeHidden();
});

test("while the game loads, a cover says so and has a way back", async ({ page }) => {
  // Hold the game's own page back, so the cover is seen.
  await page.route(/g-[^.]+\.localhost:8788/, () => undefined);
  await page.goto(`/g/${free.slug}/play`);
  await expect(page.getByRole("heading", { name: `Getting ${free.name} ready.` })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Loading the game" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go back" })).toHaveAttribute("href", `/g/${free.slug}`);
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
