import { devices, expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { changeGame, givePage } from "./support/database.ts";
import { addGame, gameWhere } from "./support/game.ts";
import { boxOf, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { consented } from "./support/consent.ts";
import { asInstalled } from "./support/installed.ts";

// The feed's top bar (the owner, 2026-11-22: "search icon on the right; For You | Following in the middle", renamed
// Fresh and Followed on 2026-11-27): the two tabs, and Search, which finds live games and their makers as a person
// types.

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
  fresh: page.getByRole("navigation", { name: "Feeds" }).getByRole("link", { name: "Fresh" }),
  followed: page.getByRole("navigation", { name: "Feeds" }).getByRole("link", { name: "Followed" }),
  search: page.getByRole("link", { name: "Search", exact: true }),
});

test("the feed's top bar holds Fresh, Followed and Search, clear of the sound button", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const bar = topBar(page);
  await expect(bar.fresh).toHaveAttribute("aria-current", "page");
  await expect(bar.followed).not.toHaveAttribute("aria-current", "page");
  await expect(bar.search).toBeVisible();

  // The pill sits in the middle, Search at the right edge, and the speaker in the top left: none of them overlap.
  const window = page.viewportSize() ?? { width: 0, height: 0 };
  const tabs = await boxOf(bar.tabs);
  const search = await boxOf(bar.search);
  const sound = await boxOf(page.getByRole("button", { name: "Sound" }));
  expect(Math.abs(tabs.x + tabs.width / 2 - window.width / 2)).toBeLessThan(2);
  expect(search.x + search.width).toBeGreaterThan(window.width - 120);
  expect(sound.x + sound.width).toBeLessThanOrEqual(tabs.x);
  expect(tabs.x + tabs.width).toBeLessThanOrEqual(search.x);
  expect(search.width).toBeGreaterThanOrEqual(48);
  expect((await boxOf(bar.fresh)).height).toBeGreaterThanOrEqual(48);
  expect((await boxOf(bar.followed)).height).toBeGreaterThanOrEqual(48);
  // The bar of places at the bottom is well under it.
  const places = await boxOf(page.getByRole("navigation", { name: "Ruken" }));
  expect(places.y).toBeGreaterThan(tabs.y + tabs.height);
  await showTheOwner(page, testInfo, "feed-top-bar");
});

/** Where the middles of the speaker, the pill of tabs and Search sit, top to bottom, in the window's pixels. */
async function middlesOf(page: Page): Promise<number[]> {
  const bar = topBar(page);
  const boxes = [
    await boxOf(page.getByRole("button", { name: "Sound" })),
    await boxOf(bar.tabs),
    await boxOf(bar.search),
  ];
  return boxes.map((box) => box.y + box.height / 2);
}

/** Checks the top bar lines up as one row: the same middle, nothing overlapping, the pill in the middle, 48px to press. */
async function barLinesUp(page: Page): Promise<void> {
  const bar = topBar(page);
  const window = page.viewportSize() ?? { width: 0, height: 0 };
  const sound = await boxOf(page.getByRole("button", { name: "Sound" }));
  const tabs = await boxOf(bar.tabs);
  const search = await boxOf(bar.search);
  const middles = await middlesOf(page);
  expect(Math.max(...middles) - Math.min(...middles), `middles ${middles.join(", ")}`).toBeLessThanOrEqual(1);
  expect(sound.x).toBeGreaterThanOrEqual(0);
  expect(sound.x + sound.width).toBeLessThanOrEqual(tabs.x);
  expect(tabs.x + tabs.width).toBeLessThanOrEqual(search.x);
  expect(search.x + search.width).toBeLessThanOrEqual(window.width);
  expect(Math.abs(tabs.x + tabs.width / 2 - window.width / 2)).toBeLessThan(2);
  for (const box of [sound, search, await boxOf(bar.fresh), await boxOf(bar.followed)]) {
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
  }
}

// The owner, 2026-11-27, from an Android phone: "Why is the top bar not aligned". The speaker sat in each clip, so it
// moved with the feed while the bar stood still, and the pill was 2px taller than the round buttons beside it.
test("the speaker, the tabs and Search line up as one bar that stays put while the feed moves", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await barLinesUp(page);
  const before = await middlesOf(page);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("section[data-slug]").nth(1)).toHaveAttribute("data-current", "true");
  expect(await middlesOf(page)).toEqual(before);
});

// Android Chrome's common widths, as Chrome's own engine draws them, with touch, down to the narrowest phone the bar
// must hold (320 wide).
for (const device of ["Galaxy S9+", "Galaxy S8", "Pixel 7"] as const) {
  test(`the top bar lines up on Android Chrome (${device})`, async ({ browser, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Android's Chrome is Chrome's engine; the phone project's Safari is not",
    );
    const context = await browser.newContext({
      ...devices[device],
      ...consented,
      baseURL: "http://localhost:4173",
    });
    try {
      const page = await context.newPage();
      await page.goto("/");
      await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
      await barLinesUp(page);
    } finally {
      await context.close();
    }
  });
}

/** A one-finger touch from one point to another, as a quick swipe; false where the browser has no touch at all. */
async function swipe(page: Page, from: [number, number], to: [number, number]): Promise<boolean> {
  return page.evaluate(
    ([x0, y0, x1, y1]) => {
      if (typeof Touch === "undefined") return false;
      const target = document.elementFromPoint(x0, y0) ?? document.body;
      const finger = (clientX: number, clientY: number) => new Touch({ identifier: 1, target, clientX, clientY });
      const begun = finger(x0, y0);
      target.dispatchEvent(new TouchEvent("touchstart", { touches: [begun], changedTouches: [begun], bubbles: true }));
      const ended = finger(x1, y1);
      target.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [ended], bubbles: true }));
      return true;
    },
    [...from, ...to] as [number, number, number, number],
  );
}

// The owner, 2026-11-27: "Swiping left and right should go between fresh, followed, and your turn".
test("swiping sideways goes between Fresh and Followed, and a swipe up and down never does", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  const middle = height / 2;
  test.skip(!(await swipe(page, [width / 2, middle], [width / 2, middle])), "this browser has no touch");

  // Mostly up and down, or too short: still Fresh.
  await swipe(page, [width / 2, middle + 150], [width / 2 - 70, middle - 150]);
  await swipe(page, [width / 2, middle], [width / 2 - 40, middle]);
  await expect(topBar(page).fresh).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL("/");

  // To the left brings the tab on the right, as turning a page does; past the last tab nothing happens.
  await swipe(page, [width * 0.8, middle], [width * 0.2, middle]);
  await expect(page).toHaveURL("/followed");
  await expect(topBar(page).followed).toHaveAttribute("aria-current", "page");
  await pageHasSettled(page);
  await swipe(page, [width * 0.8, middle], [width * 0.2, middle]);
  await swipe(page, [width * 0.2, middle], [width * 0.8, middle]);
  await expect(page).toHaveURL("/");
  await expect(topBar(page).fresh).toHaveAttribute("aria-current", "page");
});

test("a gamepad's shoulder buttons go between Fresh and Followed", async ({ page }) => {
  // One standard gamepad, its buttons set by the journey (no browser lets a test plug a real one in).
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { id: "journey pad", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons };
    Object.assign(window, { journeyPad: pad });
    navigator.getGamepads = () => [pad as unknown as Gamepad];
  });
  const press = (button: number, down: boolean) =>
    page.evaluate(
      ([index, pressed]) => {
        const pad = (window as unknown as { journeyPad: { buttons: { pressed: boolean }[] } }).journeyPad;
        const button = pad.buttons[index];
        if (button !== undefined) button.pressed = pressed;
      },
      [button, down] as [number, boolean],
    );
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await page.bringToFront();

  await press(5, true);
  await expect(page).toHaveURL("/followed");
  await pageHasSettled(page);
  // Still held as Followed opens: that press is spent, so it never steps on past the tab it brought the person to.
  await press(5, false);
  await press(4, true);
  await expect(page).toHaveURL("/");
  await expect(topBar(page).fresh).toHaveAttribute("aria-current", "page");
  await press(4, false);
});

test("Followed says to sign in, and signed in that the person follows nobody yet", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await pageHasSettled(page);
  await topBar(page).followed.click();
  await expect(page).toHaveURL("/followed");
  await expect(topBar(page).followed).toHaveAttribute("aria-current", "page");
  // It is the feed's other tab: Home stays marked in the bar at the bottom.
  await expect(
    page.getByRole("navigation", { name: "Ruken" }).getByRole("link", { name: "Home" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Sign in to see games from makers you follow.")).toBeVisible();
  await showTheOwner(page, testInfo, "followed-signed-out");
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Ffollowed$/);

  await signUp(page);
  await page.goto("/followed");
  await expect(page.getByText("You don't follow anyone yet.")).toBeVisible();
  await showTheOwner(page, testInfo, "followed-signed-in");
  await page.getByRole("link", { name: "See every game" }).click();
  await expect(page).toHaveURL("/");

  // Fresh on the Followed tab goes back to the feed too.
  await page.goto("/followed");
  await pageHasSettled(page);
  await topBar(page).fresh.click();
  await expect(page).toHaveURL("/");
  await expect(topBar(page).fresh).toHaveAttribute("aria-current", "page");
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
  // The game shows a small picture of its clip's opening frame beside its name.
  const thumb = results.getByRole("link", { name: new RegExp(`Café ${WORD} Rush`) }).locator(".thumb");
  await expect(thumb).toBeVisible();
  expect((await boxOf(thumb)).width).toBe(64);
  await expect(thumb.locator("img")).toHaveAttribute("src", /^\/api\/still\/clips\/.+\?at=0&width=240$/);
  await showTheOwner(page, testInfo, "search-results");

  // A search replaces the last in the history: Back from a game it opens comes back here, and Back again to the feed.
  await results.getByRole("link", { name: new RegExp(`Café ${WORD} Rush`) }).click();
  await expect(page).toHaveURL(`/g/${game.slug}`);
  await page.goBack();
  await expect(page).toHaveURL(`/search?q=${WORD}`);
  await page.goBack();
  await expect(page).toHaveURL("/");
  // The feed has come back before the next address is opened (a move still going would cut it off).
  await expect(topBar(page).fresh).toHaveAttribute("aria-current", "page");
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
  expect(reached).toEqual(expect.arrayContaining(["Fresh", "Followed", "Search"]));
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

test("Followed plays the live games of the makers a person follows, and says when there are none", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  await signUp(page);
  const badge = (clip: ReturnType<Page["locator"]>) =>
    clip.getByRole("button", { name: `Follow Owl ${WORD}` });

  // Follow the maker with the plus on their clip in the feed.
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  const onFeed = page.locator(`section[data-slug="${game.slug}"]`).first();
  await onFeed.scrollIntoViewIfNeeded();
  await badge(onFeed).click();
  await expect(badge(onFeed)).toHaveAttribute("aria-pressed", "true");

  // Followed holds their game, played like the feed, with this tab marked, and nothing else.
  await page.goto("/");
  await pageHasSettled(page);
  await topBar(page).followed.click();
  await expect(page).toHaveURL("/followed");
  await expect(topBar(page).followed).toHaveAttribute("aria-current", "page");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  const clips = page.locator("section[data-slug]");
  await expect(clips).toHaveCount(1);
  const onTab = clips.first();
  await expect(onTab).toHaveAttribute("data-slug", game.slug);
  await expect(onTab.getByRole("link", { name: "Play" })).toBeVisible();
  // It ends after the last game: nothing waits to load past it.
  await expect(page.getByRole("progressbar", { name: "Loading more games" })).toHaveCount(0);
  await showTheOwner(page, testInfo, "followed-with-games");

  // A game opened from Followed comes back to Followed with the page's back arrow, on the clip that was left.
  await onTab.locator("a.gamelink").click();
  await expect(page).toHaveURL(`/g/${game.slug}`);
  await pageHasSettled(page);
  await page.getByRole("link", { name: "Back to the feed" }).click();
  await expect(page).toHaveURL("/followed");
  await expect(topBar(page).followed).toHaveAttribute("aria-current", "page");
  await expect(page.locator(`section[data-slug="${game.slug}"]`)).toHaveAttribute("data-current", "true");

  // Like, Save and Repost work on Followed's clips as on the feed's: made here, still there after a reload, and taken back.
  const marks = ["Like", "Save", "Repost"] as const;
  const markOf = (name: (typeof marks)[number]) =>
    page.locator(`section[data-slug="${game.slug}"]`).getByRole("button", { name, exact: true });
  const pressMark = async (name: (typeof marks)[number]) => {
    const kept = page.waitForResponse((answer) => answer.url().endsWith("/api/feed/marks"));
    await markOf(name).click();
    expect((await kept).status()).toBe(200);
  };
  for (const name of marks) {
    await expect(markOf(name)).toHaveAttribute("aria-pressed", "false");
    await pressMark(name);
    await expect(markOf(name)).toHaveAttribute("aria-pressed", "true");
  }
  await page.reload();
  await pageHasSettled(page);
  for (const name of marks) await expect(markOf(name)).toHaveAttribute("aria-pressed", "true");
  for (const name of marks) {
    await pressMark(name);
    await expect(markOf(name)).toHaveAttribute("aria-pressed", "false");
  }
  await page.reload();
  await pageHasSettled(page);
  for (const name of marks) await expect(markOf(name)).toHaveAttribute("aria-pressed", "false");

  // A maker with nothing a person may see here says so.
  await changeGame(game.slug, { ageRating: "age_18", contentMarks: ["gore"] });
  try {
    await page.reload();
    await expect(page.getByText("No games here yet.")).toBeVisible();
    await expect(page.getByText("The makers you follow have nothing to play right now.")).toBeVisible();
    await showTheOwner(page, testInfo, "followed-nothing-live");
  } finally {
    await changeGame(game.slug, { ageRating: "age_12", contentMarks: [] });
  }

  // Without script the check is a plain form, and it comes back to Followed, not to Fresh.
  const plain = await browser.newContext({
    storageState: await page.context().storageState(),
    javaScriptEnabled: false,
    baseURL: "http://localhost:4173",
  });
  try {
    const noScript = await plain.newPage();
    await noScript.goto("/followed");
    await badge(noScript.locator("section[data-slug]").first()).click();
    await expect(noScript).toHaveURL("/followed");
    await expect(noScript.getByText("You don't follow anyone yet.")).toBeVisible();
  } finally {
    await plain.close();
  }

  // Following again, then unfollowing with the check on the tab's own clip, empties it too.
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await onFeed.scrollIntoViewIfNeeded();
  await badge(onFeed).click();
  await expect(badge(onFeed)).toHaveAttribute("aria-pressed", "true");
  await page.goto("/followed");
  await page.reload();
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await badge(page.locator("section[data-slug]").first()).click();
  await expect(badge(page.locator("section[data-slug]").first())).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(page.getByText("You don't follow anyone yet.")).toBeVisible();
});
