import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { changeGame, givePage } from "./support/database.ts";
import { addGame, gameWhere } from "./support/game.ts";
import { boxOf, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { consented } from "./support/consent.ts";
import { asInstalled } from "./support/installed.ts";

// The feed's top bar (the owner, 2026-11-22: "search icon on the right; For You | Following in the middle"): the For you
// and Following tabs, and Search, which finds live games and their makers as a person types.

test.beforeEach(({ page }) => asInstalled(page));
test.beforeEach(forgetRateLimits);

let game: Awaited<ReturnType<typeof addGame>>;
let handle: string;
let adults: { slug: string; name: string };
/** A word only this run's games and maker have, so the shared database's other games never match. */
const WORD = `zq${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  game = await addGame(browser, request);
  await changeGame(game.slug, { name: `Café ${WORD} Rush` });
  ({ handle } = await givePage(game.maker, { name: `Owl ${WORD}`, oneLine: "I make small, hard games." }));
  await forgetRateLimits();
  const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
  try {
    adults = await gameWhere(await context.newPage(), { state: "live" });
  } finally {
    await context.close();
  }
  await changeGame(adults.slug, { name: `Night ${WORD} Club`, ageRating: "age_18", contentMarks: ["gore"] });
});

const topBar = (page: Page) => ({
  tabs: page.getByRole("navigation", { name: "Feeds" }),
  forYou: page.getByRole("navigation", { name: "Feeds" }).getByRole("link", { name: "For you" }),
  following: page.getByRole("navigation", { name: "Feeds" }).getByRole("link", { name: "Following" }),
  search: page.getByRole("link", { name: "Search", exact: true }),
});

test("the feed's top bar holds For you, Following and Search, clear of the sound button", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const bar = topBar(page);
  await expect(bar.forYou).toHaveAttribute("aria-current", "page");
  await expect(bar.following).not.toHaveAttribute("aria-current", "page");
  await expect(bar.search).toBeVisible();

  // The pill sits in the middle, Search at the right edge, and the speaker in the top left: none of them overlap.
  const window = page.viewportSize() ?? { width: 0, height: 0 };
  const tabs = await boxOf(bar.tabs);
  const search = await boxOf(bar.search);
  const sound = await boxOf(page.locator('section[data-current="true"] button.sound'));
  expect(Math.abs(tabs.x + tabs.width / 2 - window.width / 2)).toBeLessThan(2);
  expect(search.x + search.width).toBeGreaterThan(window.width - 120);
  expect(sound.x + sound.width).toBeLessThanOrEqual(tabs.x);
  expect(tabs.x + tabs.width).toBeLessThanOrEqual(search.x);
  expect(search.width).toBeGreaterThanOrEqual(44);
  expect((await boxOf(bar.following)).height).toBeGreaterThanOrEqual(44);
  // The bar of places at the bottom is well under it.
  const places = await boxOf(page.getByRole("navigation", { name: "Ruken" }));
  expect(places.y).toBeGreaterThan(tabs.y + tabs.height);
  await showTheOwner(page, testInfo, "feed-top-bar");
});

test("Following says to sign in, and signed in that the person follows nobody yet", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await pageHasSettled(page);
  await topBar(page).following.click();
  await expect(page).toHaveURL("/following");
  await expect(topBar(page).following).toHaveAttribute("aria-current", "page");
  // It is the feed's other tab: Home stays marked in the bar at the bottom.
  await expect(
    page.getByRole("navigation", { name: "Ruken" }).getByRole("link", { name: "Home" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Sign in to see games from makers you follow.")).toBeVisible();
  await showTheOwner(page, testInfo, "following-signed-out");
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Ffollowing$/);

  await signUp(page);
  await page.goto("/following");
  await expect(page.getByText("You don't follow anyone yet.")).toBeVisible();
  await showTheOwner(page, testInfo, "following-signed-in");
  await page.getByRole("link", { name: "See every game" }).click();
  await expect(page).toHaveURL("/");

  // For you on the Following tab goes back to the feed too.
  await page.goto("/following");
  await pageHasSettled(page);
  await topBar(page).forYou.click();
  await expect(page).toHaveURL("/");
  await expect(topBar(page).forYou).toHaveAttribute("aria-current", "page");
});

test("Search finds a live game and its maker as the person types, and never an 18+ game", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await pageHasSettled(page);
  await topBar(page).search.click();
  await expect(page).toHaveURL("/search");
  const field = page.getByRole("searchbox", { name: "Search games and makers" });
  await expect(field).toBeFocused();
  await expect(page.getByText("Find a game or a maker.")).toBeVisible();

  // No button: the results come a moment after the last key. Accents and case do not matter.
  await page.keyboard.type(`CAFE ${WORD.toUpperCase()}`);
  await expect(page).toHaveURL(`/search?q=${encodeURIComponent(`CAFE ${WORD.toUpperCase()}`)}`);
  const results = page.locator(".results");
  await expect(results.getByRole("link", { name: new RegExp(`Café ${WORD} Rush`) })).toBeVisible();
  await expect(field).toBeFocused();

  // The word alone finds the game, its maker by name, and not the 18+ game.
  await field.fill(WORD);
  await field.dispatchEvent("input");
  await expect(results.getByRole("link", { name: new RegExp(`Owl ${WORD}`) })).toBeVisible();
  await expect(results.getByRole("link", { name: new RegExp(`Café ${WORD} Rush`) })).toBeVisible();
  await expect(results.getByText(`Night ${WORD} Club`)).toHaveCount(0);
  await expect(results.getByRole("link")).toHaveCount(2);
  await showTheOwner(page, testInfo, "search-results");

  // A search replaces the last in the history: Back from a game it opens comes back here, and Back again to the feed.
  await results.getByRole("link", { name: new RegExp(`Café ${WORD} Rush`) }).click();
  await expect(page).toHaveURL(`/g/${game.slug}`);
  await page.goBack();
  await expect(page).toHaveURL(`/search?q=${WORD}`);
  await page.goBack();
  await expect(page).toHaveURL("/");
  // The feed has come back before the next address is opened (a move still going would cut it off).
  await expect(topBar(page).forYou).toHaveAttribute("aria-current", "page");
  await expect(page.locator("section[data-slug]").first()).toBeVisible();

  // A maker is found by their address too, @ or not, and opens their page.
  await page.goto(`/search?q=%40${handle}`);
  await page
    .locator(".results")
    .getByRole("link", { name: new RegExp(`Owl ${WORD}`) })
    .click();
  await expect(page).toHaveURL(`/${handle}`);
});

test("Search says when nothing matches, and Back goes to the feed", async ({ page }, testInfo) => {
  await page.goto(`/search?q=${WORD}nothing`);
  await expect(page.getByText(`Nothing found for “${WORD}nothing”.`)).toBeVisible();
  await showTheOwner(page, testInfo, "search-nothing");
  await pageHasSettled(page);
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL("/");
});

test("Search works with the keyboard alone, and without script", async ({ page, browser }) => {
  await page.goto("/");
  await pageHasSettled(page);
  // From the top: the bar of places first, then the feed's tabs and Search.
  const reached: string[] = [];
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press("Tab");
    reached.push(
      await page.evaluate(() => {
        const focused = document.activeElement;
        return focused === null ? "" : (focused.getAttribute("aria-label") ?? focused.textContent.trim());
      }),
    );
    if (reached.at(-1) === "Search") break;
  }
  expect(reached).toEqual(expect.arrayContaining(["For you", "Following", "Search"]));
  await expect(topBar(page).search).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/search");
  // The person types once the field shows its cursor.
  await expect(page.getByRole("searchbox", { name: "Search games and makers" })).toBeFocused();
  await page.keyboard.type(WORD);
  await expect(page).toHaveURL(`/search?q=${WORD}`);
  await expect(page.locator(".results a").first()).toBeVisible();
  await page.keyboard.press("Tab");
  // The first result after the field (Tab passes nothing else on the way).
  await expect(page.locator(".results a").first()).toBeFocused();

  // Without script the field is a plain form: Enter asks the page again with the search.
  const plain = await browser.newContext({
    ...consented,
    baseURL: "http://localhost:4173",
    javaScriptEnabled: false,
  });
  try {
    const noScript = await plain.newPage();
    await noScript.goto("/search");
    await noScript.getByRole("searchbox", { name: "Search games and makers" }).fill(WORD);
    await noScript.getByRole("searchbox", { name: "Search games and makers" }).press("Enter");
    await expect(noScript).toHaveURL(`/search?q=${WORD}`);
    await expect(noScript.getByRole("link", { name: new RegExp(`Café ${WORD} Rush`) })).toBeVisible();
  } finally {
    await plain.close();
  }
});

test("Search fits the window: only the results scroll, clear of the bar", async ({ page }) => {
  await page.goto(`/search?q=${WORD}`);
  await expect(page.locator(".results a").first()).toBeVisible();
  const field = await boxOf(page.getByRole("searchbox", { name: "Search games and makers" }));
  const results = await boxOf(page.locator(".results"));
  const places = await boxOf(page.getByRole("navigation", { name: "Ruken" }));
  const window = page.viewportSize() ?? { width: 0, height: 0 };
  expect(field.y).toBeGreaterThanOrEqual(0);
  expect(results.y).toBeGreaterThanOrEqual(field.y + field.height);
  // With the bar along the bottom the results end above it; on a phone held sideways it stands on the right and the
  // results keep left of it.
  if (places.width > places.height) expect(results.y + results.height).toBeLessThanOrEqual(places.y + 1);
  else expect(results.x + results.width).toBeLessThanOrEqual(places.x + 1);
  // The page itself never scrolls.
  expect(await page.evaluate(() => document.scrollingElement?.scrollHeight ?? 0)).toBeLessThanOrEqual(
    window.height,
  );

  // A phone held sideways (from the Home Screen): the bar stands along the right edge, and no result runs under it.
  await page.setViewportSize({ width: 667, height: 375 });
  const bar = page.getByRole("navigation", { name: "Ruken" });
  await expect.poll(async () => (await boxOf(bar)).height > (await boxOf(bar)).width).toBe(true);
  const rail = await boxOf(bar);
  const row = await boxOf(page.locator(".results a").first());
  expect(row.x + row.width).toBeLessThanOrEqual(rail.x);
});
