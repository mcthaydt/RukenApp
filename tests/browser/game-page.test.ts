import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, payAsNewMember, signInAs, signUpInItsOwnContext } from "./support/account.ts";
import {
  addPlays,
  changeGame,
  givePage,
  giveStaffRole,
  putGameWhereStaffLeaveIt,
} from "./support/database.ts";
import { addGame, gameWhere } from "./support/game.ts";
import { expectFrame, pipRed, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// A game's page (spec 3): the clip, the facts a person needs before pressing Play, and what Play will cost them.

let game: Awaited<ReturnType<typeof addGame>>;
let free: Awaited<ReturnType<typeof addGame>>;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(120_000);
  game = await addGame(browser, request);
  free = await addGame(browser, request, { free: true });
});
test.beforeEach(forgetRateLimits);

const noSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("a game's page shows its clip, its name, its line, its rating and Play", async ({ page }, testInfo) => {
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(game.name);
  await expect(page.getByText("Climb. Fall. Climb again.")).toBeVisible();
  await expect(page.locator(".chip")).toHaveText("12+");
  await expect(page.getByText("Real-looking fighting, or scary bits.")).toBeVisible();
  await expect(
    page.getByText(/^Plays on this (phone|tablet|computer)\. Nothing to install\.$/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Play" })).toHaveAttribute("href", `/g/${game.slug}/play`);
  await expect(page.getByText("Members play every game. $9.99 a month.")).toBeVisible();
  await expect(page.getByText("Tax is added where it applies.")).toBeVisible();
  await expect(page).toHaveTitle(`${game.name} · Ruken`);
  await expect(page.getByRole("button", { name: "Watch the upright video" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Watch the wide video" })).toBeVisible();
  expect(await noSideways(page)).toBe(true);
  await showTheOwner(page, testInfo, "a game's page");
});

test("the clip's address answers anyone, as video", async ({ page }) => {
  // The clip is on its own address, which a visitor with no account reaches: the browser decodes it as a video.
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await expectFrame(page.locator(".clipbox video"));
});

test("pressing a tile shows that clip, and pressing the clip opens it with sound", async ({ page }) => {
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  const box = page.locator(".clipbox video");
  const upright = page.getByRole("button", { name: "Watch the upright video" });
  const wide = page.getByRole("button", { name: "Watch the wide video" });
  await upright.click();
  await expect(upright).toHaveAttribute("aria-pressed", "true");
  const uprightSrc = await box.getAttribute("src");
  await wide.click();
  await expect(wide).toHaveAttribute("aria-pressed", "true");
  await expect(upright).toHaveAttribute("aria-pressed", "false");
  expect(await box.getAttribute("src")).not.toBe(uprightSrc);

  await page.getByRole("button", { name: "Watch the video full size" }).click();
  const full = page.locator("dialog.viewer video");
  await expect(full).toHaveAttribute("controls", "");
  expect(await full.evaluate((video: HTMLVideoElement) => video.muted)).toBe(false);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog.viewer")).not.toHaveAttribute("open", "");
});

test("the cost line is said to each person in their own words", async ({ page, browser }) => {
  // Three people sign in one after another, which WebKit does slowly.
  test.slow();
  await page.goto(`/g/${free.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Free to play. No account needed.")).toBeVisible();

  await signInAs(page, game.maker);
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("This is your game. Playing it here doesn't count toward its play time."),
  ).toBeVisible();

  const staff = await signUpInItsOwnContext(browser);
  await giveStaffRole(staff, "curator");
  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  const staffPage = await context.newPage();
  await signInAs(staffPage, staff);
  await staffPage.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await expect(
    staffPage.getByText("You can play this to check it. It doesn't count toward its play time."),
  ).toBeVisible();
  await context.close();
});

test("a member reads that Play is included, and has no Join", async ({ page }) => {
  await payAsNewMember(page);
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Included with your membership.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Join" })).toHaveCount(0);
});

test("Join is beside the price for someone who is not a member, and only for them", async ({ page }) => {
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Join" })).toHaveAttribute(
    "href",
    `/join?next=${encodeURIComponent(`/g/${game.slug}`)}`,
  );
  await page.goto(`/g/${free.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Join" })).toHaveCount(0);
});

test("the sitting line waits for 20 plays", async ({ page, browser, request }) => {
  const own = await addGame(browser, request);
  await addPlays(own.slug, 19, 12);
  await page.goto(`/g/${own.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/^Most people play/)).toHaveCount(0);
  await addPlays(own.slug, 1, 12);
  await page.reload();
  await expect(page.getByText("Most people play about 12 minutes at a time.")).toBeVisible();
});

test("the maker is shown when they have a page, with their other games", async ({
  page,
  browser,
  request,
}, testInfo) => {
  const first = await addGame(browser, request);
  await givePage(first.maker, { name: "Snek", oneLine: "I make small games." });
  // A second live game by the same maker, from rows.
  const second = await gameWhere(page, { state: "live" });
  await changeGame(second.slug, {});
  await moveGameTo(second.slug, first.makerUserId);

  await page.goto(`/g/${first.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Made by")).toBeVisible();
  await expect(page.getByText("I make small games.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "More from Snek" })).toBeVisible();
  await expect(page.locator(".more a")).toHaveCount(1);
  await expect(page.locator(".more a")).toHaveAttribute("href", `/g/${second.slug}`);
  await showTheOwner(page, testInfo, "a game's page, with its maker and their other games");
});

test("a maker with no page is not shown", async ({ page }) => {
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Made by")).toHaveCount(0);
  await expect(page.getByText(/^More from/)).toHaveCount(0);
});

test("landing on a game's page remembers its maker's link", async ({ page }) => {
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  const cookie = (await page.context().cookies()).find((one) => one.name === "rk_arrival");
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
});

test("Play and every tile are reached by the keyboard, with focus showing", async ({ page }) => {
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  const wanted = [
    "Watch the video full size",
    "Watch the upright video",
    "Watch the wide video",
    "Play",
    "Share",
  ];
  const seen = new Set<string>();
  // A browser may spend a press or two on the address bar or a link before the page's own controls.
  for (let step = 0; step < 14 && seen.size < wanted.length; step += 1) {
    await page.keyboard.press("Tab");
    const visit = await page.evaluate(() => {
      const now = document.activeElement;
      if (now === null || now === document.body) return null;
      return {
        name: now.getAttribute("aria-label") ?? now.textContent.trim(),
        outline: getComputedStyle(now).outlineStyle,
      };
    });
    if (visit === null) continue;
    expect(visit.outline).not.toBe("none");
    if (wanted.includes(visit.name)) seen.add(visit.name);
  }
  expect([...seen].sort()).toEqual([...wanted].sort());
});

test("with no script the clip's own controls are not under the name", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://localhost:4173", javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  const clip = await page.locator(".clipbox video").boundingBox();
  const name = await page.locator(".heroname").boundingBox();
  if (clip === null || name === null) throw new Error("the clip or the name has no box");
  expect(name.y).toBeGreaterThanOrEqual(clip.y + clip.height - 1);
  await context.close();
});

test("Play is on the first screen, whatever the window", async ({ page }) => {
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await expect(page.getByRole("link", { name: "Play" })).toBeInViewport();
});

test("a game that is not there is a missing page with a way back", async ({ page }) => {
  const answer = await page.goto("/g/no-such-game");
  expect(answer?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toBeVisible();
});

test("a game is not at its address until it is accepted", async ({ page }) => {
  const waiting = await gameWhere(page, { state: "waiting" });
  expect((await page.goto(`/g/${waiting.slug}`, { waitUntil: "domcontentloaded" }))?.status()).toBe(404);
  await putGameWhereStaffLeaveIt(waiting.slug, { state: "live" });
  expect((await page.goto(`/g/${waiting.slug}`, { waitUntil: "domcontentloaded" }))?.status()).toBe(200);
});

test("the device line names a tablet that says it is a computer", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: "http://localhost:4173",
    hasTouch: true,
    viewport: { width: 820, height: 1180 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  });
  const page = await context.newPage();
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Plays on this tablet. Nothing to install.")).toBeVisible();
  await context.close();
});

test("Share gives the link", async ({ page }) => {
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByText(/^(Link copied\.|Copy the address from the bar at the top\.)$/)).toBeVisible();
});

test("nothing on the page is red, and nothing scrolls sideways", async ({ page }) => {
  await page.goto(`/g/${game.slug}`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  expect(await pipRed(page)).toEqual([]);
  expect(await noSideways(page)).toBe(true);
});

/** Puts a game under another maker's account, as a setup: both are then that maker's games. */
async function moveGameTo(slug: string, makerUserId: string): Promise<void> {
  await changeGame(slug, { makerUserId });
}
