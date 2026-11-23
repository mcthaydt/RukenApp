import { expect, test, type Page } from "@playwright/test";
import { addGame } from "./support/game.ts";
import { boxOf, showTheOwner, wordsHaveSettled } from "./support/look.ts";
import { givePage } from "./support/database.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { signInAs, signUp } from "./support/account.ts";

// The bar (spec 5.2): Home, Add a game in the middle and You, each a picture with its name for a screen reader, on every
// screen but the landing page, the play screen and the maker's step-by-step screens (the owner, 2026-11-22: icons, with
// room for more; the bar on all three of its places, like an app's tabs; "every page excluding the landing pages"; and,
// on a card, "Not on the question steps"). A phone held sideways has it along the right edge (sideways-phone.test.ts).

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

/** The bar is Home, Add a game, then You, each a big picture link with no words on it; `home` says whether Home is the
 * screen a person is on. */
async function expectTheBar(page: Page, options: { home: boolean }): Promise<void> {
  await expect(bar(page)).toBeVisible();
  const links = bar(page).getByRole("link");
  await expect(links).toHaveCount(3);
  const home = bar(page).getByRole("link", { name: "Home", exact: true });
  const add = bar(page).getByRole("link", { name: "Add a game", exact: true });
  const you = bar(page).getByRole("link", { name: "You", exact: true });
  await expect(links.nth(0)).toHaveAccessibleName("Home");
  await expect(links.nth(1)).toHaveAccessibleName("Add a game");
  await expect(links.nth(2)).toHaveAccessibleName("You");
  await expect(home).toHaveAttribute("href", "/");
  await expect(add).toHaveAttribute("href", "/make");
  await expect(you).toHaveAttribute("href", "/me");
  if (options.home) await expect(home).toHaveAttribute("aria-current", "page");
  else await expect(home).not.toHaveAttribute("aria-current", /.*/);
  await expect(add).not.toHaveAttribute("aria-current", /.*/);
  await expect(you).not.toHaveAttribute("aria-current", /.*/);
  for (const link of [home, add, you]) {
    // A picture, not a word: nothing written shows, and the picture is there.
    await expect(link).toHaveText("");
    await expect(link.locator("svg")).toBeVisible();
    const box = await boxOf(link);
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.width).toBeGreaterThanOrEqual(48);
  }
  // Add a game sits in the middle of the bar and is the one that stands out: the main button's blue.
  const barBox = await boxOf(bar(page));
  const addBox = await boxOf(add);
  expect(Math.abs(addBox.x + addBox.width / 2 - (barBox.x + barBox.width / 2))).toBeLessThanOrEqual(2);
  // The browser turns the main button's colour into the same form it reports for the button, so the two compare.
  const blue = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.background = "var(--pay)";
    document.body.appendChild(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  });
  await expect(add).toHaveCSS("background-color", blue);
}

test("the feed has the bar, with Home marked", async ({ page }, testInfo) => {
  await page.goto("/");
  await expectTheBar(page, { home: true });
  await showTheOwner(page, testInfo, "the feed with the bar");
});

test("a game's page has the bar, a way back to the feed, and nothing hidden under it", async ({
  page,
}, testInfo) => {
  await page.goto(`/g/${game.slug}`);
  await expectTheBar(page, { home: false });
  await expect(page.getByRole("link", { name: "← Back to the feed" })).toHaveAttribute("href", "/");
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

test("Home goes to the feed, and You and Add a game to sign in when nobody is signed in", async ({
  page,
}) => {
  await page.goto(`/g/${game.slug}`);
  await bar(page).getByRole("link", { name: "You", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto(`/g/${game.slug}`);
  await bar(page).getByRole("link", { name: "Add a game", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto(`/g/${game.slug}`);
  await bar(page).getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL("/");
});

test("signed in, Add a game in the middle of the bar opens Your games, by tap or by keyboard", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/");
  await bar(page).getByRole("link", { name: "Add a game", exact: true }).click();
  await expect(page).toHaveURL("/make");
  await expect(page.getByRole("heading", { name: "Your games" })).toBeVisible();

  // The keyboard alone gets there too, and the button shows it has the focus.
  await page.goto("/");
  const add = bar(page).getByRole("link", { name: "Add a game", exact: true });
  // Focus is put on it straight away: Safari's Tab skips links unless a person turns that on.
  await add.focus();
  await expect(add).toBeFocused();
  const outline = await add.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/make");
});

for (const path of [
  () => "/sign-in",
  () => "/join",
  () => "/help",
  () => "/help/how-the-feed-works",
  () => "/cookies",
  () => "/privacy",
  () => "/terms",
  () => "/g/no-such-game",
  () => "/nobody-has-this-address",
]) {
  test(`${path.toString().replace(/\(\) => /, "")}: the bar, so there is always a way to the three places`, async ({
    page,
  }) => {
    await page.goto(path());
    await expect(page.locator("main, h1").first()).toBeAttached();
    await expectTheBar(page, { home: false });
  });
}

test("no bar where the game or a step has the whole screen: playing, and each step of adding a game", async ({
  page,
}) => {
  await signInAs(page, game.maker.number, game.maker.password);
  for (const path of [
    `/g/${game.slug}/play`,
    `/make/${game.slug}/play`,
    "/make/new",
    `/make/${game.slug}/name`,
    "/make/page/name",
    "/make/page/links/add",
  ]) {
    await page.goto(path);
    await expect(page.locator("main, iframe").first()).toBeAttached();
    await expect(bar(page), path).toHaveCount(0);
  }
  // A game's own place in the maker's area is not a step, so the bar is there, over its own buttons.
  await page.goto(`/make/${game.slug}`);
  await expectTheBar(page, { home: false });
});

test("no bar on Your page while there is no page yet: it asks the address, a step", async ({ page }) => {
  await signUp(page);
  await page.goto("/make/page");
  await expect(page.getByRole("heading", { name: "Pick your page's address" })).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
});

test.describe("on an upright phone", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("a card that just fills the window, Help, and a maker's long screen end clear above the bar", async ({
    page,
  }) => {
    /** Scrolled to its end, every button and link of the screen, its whole tap box, is above the bar. */
    async function expectAllAboveTheBar(path: string): Promise<void> {
      await page.goto(path);
      await wordsHaveSettled(page);
      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      const barTop = (await boxOf(bar(page))).y;
      const bottoms = await page.evaluate(() =>
        [...document.querySelectorAll("main :is(a, button)")].map(
          (part) => part.getBoundingClientRect().bottom,
        ),
      );
      expect(bottoms.length, path).toBeGreaterThan(0);
      for (const bottom of bottoms) expect(bottom, path).toBeLessThanOrEqual(barTop);
    }
    await expectAllAboveTheBar("/join");
    await expectAllAboveTheBar("/help");
    await signInAs(page, game.maker.number, game.maker.password);
    await expectAllAboveTheBar("/make/page");
  });
});
