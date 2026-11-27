import { expect, test, type Page } from "@playwright/test";
import { changeGame, givePage } from "./support/database.ts";
import { addGame, gameWhere } from "./support/game.ts";
import { buttonColour, boxOf, showTheOwner, wordsHaveSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { rgb, token } from "../support/look-tokens.ts";
import { consented } from "./support/consent.ts";
import { asInstalled } from "./support/installed.ts";

// Some of these journeys turn a phone sideways, which in a browser tab asks for the phone upright; they look at Ruken
// opened from the Home Screen, where it works sideways (fits-the-screen.test.ts holds the tab).
test.beforeEach(({ page }) => asInstalled(page));

// The feed at / (spec 5.1): full-screen clips of games, one per swipe, each led by the person who made it.
// The journeys share one database, so the feed holds every game any journey made: each one finds its own game's clip by
// `data-slug` and asserts the order only in unit and database tests.

let withPage: Awaited<ReturnType<typeof addGame>>;
let withoutPage: { slug: string; name: string };
let pageOf: { handle: string };
let longName: { slug: string; name: string };

const MAKER = { name: "Night Owl", oneLine: "I make small, hard games." };

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  withPage = await addGame(browser, request);
  pageOf = await givePage(withPage.maker, MAKER);
  // Games from rows, each made by a new account in a context of its own (a signed-in context cannot sign up again).
  const liveGame = async (): Promise<{ slug: string; name: string }> => {
    await forgetRateLimits();
    const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
    try {
      return await gameWhere(await context.newPage(), { state: "live" });
    } finally {
      await context.close();
    }
  };
  withoutPage = await liveGame();
  longName = await liveGame();
  await changeGame(longName.slug, { name: "Abcdefghij".repeat(6) });
});
test.beforeEach(forgetRateLimits);

// The feed goes round, so a game can be on it more than once once a later page has come: the journeys look at its first.
const clipOf = (page: Page, slug: string) => page.locator(`section[data-slug="${slug}"]`).first();
const isUpright = (page: Page): boolean => {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  return height > width;
};

test("Ruken opens straight into the feed, with the right clip for the screen", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Ruken - The Everyday Console");
  await expect(page.getByText("Coming soon")).toHaveCount(0);
  await expect(page.locator("main")).toHaveCount(1);
  // The clips are the feed's own: no wordmark above them, and the bar is not the wordmark.
  await expect(page.locator("header")).toHaveCount(0);

  const clip = clipOf(page, withPage.slug);
  await expect(clip).toBeAttached();
  await expect(clip).toHaveAttribute("aria-label", withPage.name);

  // The clip of the window's shape is the one shown, and turning the window changes it (D2).
  // A clip has an address once it is the one on screen or the next, so the game's own clip is brought to the screen.
  await clip.scrollIntoViewIfNeeded();
  const video = clip.locator("video");
  const first = isUpright(page) ? "upright" : "wide";
  const other = first === "upright" ? "wide" : "upright";
  await expect(video).toHaveAttribute("src", new RegExp(`/${first}-[0-9a-f]{16}\\.`));
  // Until its first frame comes, the clip shows its still: the same clip's opening frame, under the video.
  const clipKey = /(clips\/[^#]+)/.exec((await video.getAttribute("src")) ?? "")?.[1] ?? "no clip";
  await expect(video).toHaveAttribute("data-still", "");
  expect(await video.evaluate((node) => node.style.getPropertyValue("--still"))).toContain(
    `/api/still/${clipKey}?at=0&width=`,
  );
  const size = page.viewportSize();
  if (size === null) throw new Error("the window has a size");
  await page.setViewportSize({ width: size.height, height: size.width });
  await expect(video).toHaveAttribute("src", new RegExp(`/${other}-[0-9a-f]{16}\\.`));
  await page.setViewportSize(size);
  await expect(video).toHaveAttribute("src", new RegExp(`/${first}-[0-9a-f]{16}\\.`));

  // The maker is at the top of the column on the right; the band holds the game, then Play. Each is one link to one place.
  await clip.scrollIntoViewIfNeeded();
  const maker = clip.getByRole("link", { name: new RegExp(MAKER.name) });
  await expect(maker).toHaveAttribute("href", `/${pageOf.handle}`);
  const game = clip.getByRole("link", { name: new RegExp(withPage.name) });
  await expect(game).toHaveAttribute("href", `/g/${withPage.slug}`);
  await expect(game.getByRole("heading", { level: 2, name: withPage.name })).toBeVisible();
  // The link is words on the band, not a card of its own.
  await expect(game).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const play = clip.getByRole("link", { name: "Play", exact: true });
  await expect(play).toHaveAttribute("href", `/g/${withPage.slug}/play`);

  // Play is the Blue of every main button, white words, 48px tall at least, button corners; it is the only thing with words
  // to press that is not a link to a page (the Sound and Share marks are marks).
  await expect(play).toHaveCSS("background-color", await buttonColour(play, "--pay"));
  await expect(play).toHaveCSS("color", rgb(token("--chalk")));
  await expect(play).toHaveCSS("border-top-left-radius", token("--radius-button"));
  expect((await boxOf(play)).height).toBeGreaterThanOrEqual(48);
  for (const button of await clip.getByRole("button").all()) {
    expect((await button.innerText()).trim()).toBe("");
    expect((await boxOf(button)).height).toBeGreaterThanOrEqual(48);
  }
  await wordsHaveSettled(page);
  await showTheOwner(page, testInfo, "the feed");
});

test("turning the window while the next page is on its way keeps the same clip on screen", async ({
  page,
}) => {
  // The next page is held until the window has turned, so it comes in at the moment that once moved a person on: the
  // clip's offset in the turned window is past the last clip, where the waiting screen is.
  let asked: () => void = () => undefined;
  const nextPageAsked = new Promise<void>((resolve) => (asked = resolve));
  let letGo: () => void = () => undefined;
  const turned = new Promise<void>((resolve) => (letGo = resolve));
  await page.route("**/api/feed?**", async (route) => {
    asked();
    await turned;
    await route.continue();
  });
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  const clips = page.locator("section[data-slug]");
  const count = await clips.count();
  // The last clip of the first page: the feed asks for the next page as soon as a person is on it.
  const last = clips.nth(count - 1);
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveAttribute("data-current", "true");
  await nextPageAsked;

  const size = page.viewportSize();
  if (size === null) throw new Error("the window has a size");
  await page.setViewportSize({ width: size.height, height: size.width });
  // Two frames: the browser has handled the new size and worked out what is on screen before the page comes in.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  letGo();
  await expect.poll(() => clips.count()).toBeGreaterThan(count);
  await expect(last).toHaveAttribute("data-current", "true");
  const other = isUpright(page) ? "upright" : "wide";
  await expect(last.locator("video")).toHaveAttribute("src", new RegExp(`/${other}-[0-9a-f]{16}\\.`));
});

test("a maker with no page has no maker line; the game has its own", async ({ page }) => {
  await page.goto("/");
  const clip = clipOf(page, withoutPage.slug);
  await expect(clip).toBeAttached();
  const links = clip.getByRole("link");
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute("href", `/g/${withoutPage.slug}`);
  await expect(links.nth(1)).toHaveAttribute("href", `/g/${withoutPage.slug}/play`);
});

test("a game's name of 60 letters pushes nothing sideways", async ({ page }) => {
  await page.goto("/");
  await expect(clipOf(page, longName.slug)).toBeAttached();
  await wordsHaveSettled(page);
  expect(
    await page.evaluate(() =>
      Math.max(...[document.documentElement, document.body].map((box) => box.scrollWidth - box.clientWidth)),
    ),
  ).toBe(0);
  expect(
    await page.evaluate(() => {
      const main = document.querySelector("main");
      return main === null ? -1 : main.scrollWidth - main.clientWidth;
    }),
  ).toBe(0);
});
