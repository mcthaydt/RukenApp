import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { givePage, makeFriends, sendInDatabase } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { asInstalled } from "./support/installed.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// A feed tab shows how things are when the person moves to it, not how they were when the page they came from opened
// (#447 reviews 1 and 2: a page of the next tab asked for ahead and kept showed a friend's send missing and a like
// undone). Each journey waits on the page it starts from for longer than any ask ahead would take, changes something,
// and then moves.

let game: Awaited<ReturnType<typeof addGame>>;
test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  game = await addGame(browser, request);
  await givePage(game.maker, { name: "Pat Maker", oneLine: "Small games." });
});
test.beforeEach(async ({ page }) => {
  await forgetRateLimits();
  await asInstalled(page);
});

const tabOf = (page: Page, name: RegExp | string) =>
  page.getByRole("navigation", { name: "Feeds" }).getByRole("link", { name });

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
