import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { givePage, makeFriends, sendInDatabase, sentTo } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { asInstalled } from "./support/installed.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The feed's tabs slide in at once from a page asked for ahead (the owner, 2026-11-28: "Instant slide done carefully";
// src/features/feed/kept.svelte.ts). That page says how things were when it was asked for, so a tab shows the person's
// own presses over it at once, and asks the site again quietly once it is in: a friend's send comes in, and the clip on
// screen stays where it is (#447 reviews 1 to 3). Each journey waits on the page it starts from for longer than an ask
// ahead takes, changes something, and then moves, by a press on the tab.

const MAKER = { name: "Pat Maker", oneLine: "Small games." };
let game: Awaited<ReturnType<typeof addGame>>;
let other: Awaited<ReturnType<typeof addGame>>;
test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  game = await addGame(browser, request);
  await givePage(game.maker, MAKER);
  await forgetRateLimits();
  other = await addGame(browser, request);
  await givePage(other.maker, { name: "Lee Maker", oneLine: "Big games." });
});
test.beforeEach(async ({ page }) => {
  await forgetRateLimits();
  await asInstalled(page);
});

const tabOf = (page: Page, name: RegExp | string) =>
  page.getByRole("navigation", { name: "Feeds" }).getByRole("link", { name });

/** A swipe that only sets off: one small sideways wheel move under the middle of the screen, short of a step. */
async function nudge(page: Page): Promise<void> {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  if (page.context().browser()?.browserType().name() !== "webkit") {
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(12, 0);
    return;
  }
  // Playwright's phone has no wheel: the page is handed the move itself, as the trackpad journeys do.
  await page.evaluate(() => {
    const target = document.elementFromPoint(innerWidth / 2, innerHeight / 2) ?? document.body;
    target.dispatchEvent(new WheelEvent("wheel", { deltaX: 12, bubbles: true, cancelable: true }));
  });
}

test("a game a friend sends while the person is on Followed shows on Your turn", async ({ page }) => {
  test.setTimeout(120_000);
  const me = await signUp(page);
  await makeFriends(me, game.maker);
  await page.goto("/followed");
  await pageHasSettled(page);
  await page.waitForTimeout(3000);
  await sendInDatabase(game.maker, me, game.slug);
  const yourTurn = tabOf(page, /^Your turn/);
  await yourTurn.click();
  await expect(page).toHaveURL("/your-turn");
  await expect(yourTurn).toHaveAttribute("aria-current", "page");
  await expect(page.locator("main.yourturn li").filter({ hasText: game.name })).toBeVisible();
});

test("a clip liked on Fresh shows liked on Followed", async ({ page }) => {
  test.setTimeout(120_000);
  const me = await signUp(page);
  await makeFriends(me, game.maker);
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await page.waitForTimeout(3000);
  const clip = page.locator(`section[data-slug="${game.slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  const kept = page.waitForResponse((answer) => answer.url().endsWith("/api/feed/marks"));
  await clip.getByRole("button", { name: "Like", exact: true }).click();
  expect((await kept).status()).toBe(200);
  await expect(clip.getByRole("button", { name: "Like", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const followed = tabOf(page, "Followed");
  await followed.click();
  await expect(followed).toHaveAttribute("aria-current", "page");
  const there = page.locator(`main section[data-slug="${game.slug}"]`).first();
  await expect(there.getByRole("button", { name: "Like", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("after a swipe that only set off, a follow made on Fresh shows on Followed", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page);
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await page.waitForTimeout(1500);
  await nudge(page);
  await page.waitForTimeout(3000);
  await expect(tabOf(page, "Fresh")).toHaveAttribute("aria-current", "page");
  const clip = page.locator(`section[data-slug="${game.slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  const badge = clip.getByRole("button", { name: `Follow ${MAKER.name}` });
  await badge.click();
  await expect(badge).toHaveAttribute("aria-pressed", "true");
  const followed = tabOf(page, "Followed");
  await followed.click();
  await expect(followed).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("You don't follow anyone yet.")).toHaveCount(0);
  await expect(page.locator(`main section[data-slug="${game.slug}"]`).first()).toBeAttached();
});

test("after a swipe that only set off, a game a friend sends shows on Your turn", async ({ page }) => {
  test.setTimeout(120_000);
  const me = await signUp(page);
  await makeFriends(me, game.maker);
  await page.goto("/followed");
  await pageHasSettled(page);
  await page.waitForTimeout(1500);
  await nudge(page);
  await page.waitForTimeout(3000);
  await expect(tabOf(page, "Followed")).toHaveAttribute("aria-current", "page");
  await sendInDatabase(game.maker, me, game.slug);
  const yourTurn = tabOf(page, /^Your turn/);
  await yourTurn.click();
  await expect(yourTurn).toHaveAttribute("aria-current", "page");
  await expect(page.locator("main.yourturn li").filter({ hasText: game.name })).toBeVisible();
});

test("a tab shown from a page asked for ahead takes in what is new without moving the clip on screen", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const me = await signUp(page);
  await makeFriends(me, game.maker);
  // Followed's page is asked for ahead while the person is on Fresh, with only the first maker's games in it. The page
  // sign-up lands on asks for it too, and that answer can reach the journey after the next page has been asked for
  // (PR #460, run 46132811948), so only an answer asked for by the page opened here counts.
  await page.goto("/", { waitUntil: "commit" });
  const ahead = page.waitForResponse((answer) => answer.url().includes("/followed/__data.json"));
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await ahead;
  // Then the person follows another maker, from another device, and the site's next answer for Followed comes slowly.
  await makeFriends(me, other.maker);
  let answers = 0;
  await page.route("**/followed/__data.json*", async (route) => {
    answers += 1;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.waitForTimeout(1500);
  const followed = tabOf(page, "Followed");
  await followed.click();
  // The tab is in at once, from the page asked for ahead: the first maker's game, and not yet the other's.
  await expect(followed).toHaveAttribute("aria-current", "page");
  const onScreen = page.locator('main section[data-current="true"]');
  await expect(onScreen).toHaveAttribute("data-slug", game.slug);
  await onScreen.evaluate((section) => ((section as HTMLElement & { seen?: true }).seen = true));
  await expect(page.locator(`main section[data-slug="${other.slug}"]`)).toHaveCount(0);
  // The site is asked again, and the other maker's game comes in after the clip on screen, which stays.
  // (A mouse resting on the tab may have the router ask once more for the page it points at.)
  await expect.poll(() => answers).toBeGreaterThanOrEqual(1);
  await expect(page.locator(`main section[data-slug="${other.slug}"]`).first()).toBeAttached({
    timeout: 10_000,
  });
  await expect(onScreen).toHaveAttribute("data-slug", game.slug);
  expect(await onScreen.evaluate((section) => (section as HTMLElement & { seen?: true }).seen)).toBe(true);
});

test("a game sent since Your turn's page was asked for is marked seen once it comes in, and its dot goes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const me = await signUp(page);
  await makeFriends(me, game.maker);
  // Your turn's page is asked for ahead from Followed, with nothing sent yet; then a friend sends a game. The feed that
  // sign-up lands on asks for it ahead too, so that page is left first and only this page's answer is waited for.
  await page.goto("about:blank");
  const ahead = page.waitForResponse((answer) => answer.url().includes("/your-turn/__data.json"));
  await page.goto("/followed");
  await pageHasSettled(page);
  await ahead;
  await page.waitForTimeout(1500);
  await sendInDatabase(game.maker, me, game.slug);
  await tabOf(page, /^Your turn/).click();
  await expect(page).toHaveURL("/your-turn");
  // The quiet refresh brings the game in, and the list on screen marks it seen.
  await expect(page.locator("main.yourturn li").filter({ hasText: game.name })).toBeVisible();
  await expect.poll(() => sentTo(me.number)).toEqual([{ game: game.slug, seen: true }]);
  await expect(tabOf(page, "Your turn, new games")).toHaveCount(0);
  // Back on the other tabs, from their pages asked for ahead or not, no dot.
  await tabOf(page, "Followed").click();
  await expect(tabOf(page, "Followed")).toHaveAttribute("aria-current", "page");
  await expect(tabOf(page, "Your turn, new games")).toHaveCount(0);
  await tabOf(page, "Fresh").click();
  await expect(tabOf(page, "Fresh")).toHaveAttribute("aria-current", "page");
  await expect(tabOf(page, "Your turn, new games")).toHaveCount(0);
});
