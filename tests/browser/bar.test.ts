import { expect, test, type Page } from "@playwright/test";
import { addGame } from "./support/game.ts";
import { boxOf, showTheOwner, wordsHaveSettled } from "./support/look.ts";
import { givePage } from "./support/database.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The bar (spec 5.2): Home and You, on the feed, a game's page and a maker's page, and nowhere else.

let game: Awaited<ReturnType<typeof addGame>>;
let handle: string;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  game = await addGame(browser, request);
  handle = (await givePage(game.maker, { name: "Night Owl", oneLine: "I make small, hard games." })).handle;
});
test.beforeEach(forgetRateLimits);

const bar = (page: Page) => page.getByRole("navigation", { name: "Ruken" });

/** The bar is Home then You, each a big plain link; `home` says whether Home is the screen a person is on. */
async function expectTheBar(page: Page, options: { home: boolean }): Promise<void> {
  await expect(bar(page)).toBeVisible();
  const home = bar(page).getByRole("link", { name: "Home" });
  const you = bar(page).getByRole("link", { name: "You" });
  await expect(home).toHaveAttribute("href", "/");
  await expect(you).toHaveAttribute("href", "/me");
  if (options.home) await expect(home).toHaveAttribute("aria-current", "page");
  else await expect(home).not.toHaveAttribute("aria-current", /.*/);
  await expect(you).not.toHaveAttribute("aria-current", /.*/);
  for (const link of [home, you]) expect((await boxOf(link)).height).toBeGreaterThanOrEqual(48);
}

test("the feed has the bar, with Home marked", async ({ page }) => {
  await page.goto("/");
  await expectTheBar(page, { home: true });
});

test("a game's page has the bar, a way back to the feed, and nothing hidden under it", async ({
  page,
}, testInfo) => {
  await page.goto(`/g/${game.slug}`);
  await expectTheBar(page, { home: false });
  await expect(page.getByRole("link", { name: "Back to the feed" })).toHaveAttribute("href", "/");
  await wordsHaveSettled(page);
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  const barBox = await boxOf(bar(page));
  const lastBottom = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("main .cell")];
    return Math.max(...cells.map((cell) => cell.getBoundingClientRect().bottom));
  });
  expect(lastBottom).toBeLessThanOrEqual(barBox.y);
  await showTheOwner(page, testInfo, "a game's page with the bar");
});

test("a maker's page has the bar, and nothing hidden under it", async ({ page }, testInfo) => {
  await page.goto(`/${handle}`);
  await expectTheBar(page, { home: false });
  await wordsHaveSettled(page);
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  const barBox = await boxOf(bar(page));
  const lastBottom = await page.evaluate(() => {
    const parts = [...document.querySelectorAll("main > *")];
    return Math.max(...parts.map((part) => part.getBoundingClientRect().bottom));
  });
  expect(lastBottom).toBeLessThanOrEqual(barBox.y);
  await showTheOwner(page, testInfo, "a maker's page with the bar");
});

test("Home goes to the feed, and You to sign in when nobody is signed in", async ({ page }) => {
  await page.goto(`/g/${game.slug}`);
  await bar(page).getByRole("link", { name: "You" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto(`/g/${game.slug}`);
  await bar(page).getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL("/");
});

for (const path of [
  () => `/g/${game.slug}/play`,
  () => "/sign-in",
  () => "/join",
  () => "/g/no-such-game",
  () => "/nobody-has-this-address",
]) {
  test(`${path.toString().replace(/\(\) => /, "")}: no bar`, async ({ page }) => {
    await page.goto(path());
    await expect(page.locator("main, h1").first()).toBeAttached();
    await expect(bar(page)).toHaveCount(0);
  });
}
