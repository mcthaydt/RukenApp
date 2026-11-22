import { expect, test, type Page } from "@playwright/test";
import { changeGame, givePage } from "./support/database.ts";
import { addGame, gameWhere } from "./support/game.ts";
import { boxOf, showTheOwner, wordsHaveSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { rgb, token } from "../support/look-tokens.ts";

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
    const context = await browser.newContext({ baseURL: "http://localhost:4173" });
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
  const size = page.viewportSize();
  if (size === null) throw new Error("the window has a size");
  await page.setViewportSize({ width: size.height, height: size.width });
  await expect(video).toHaveAttribute("src", new RegExp(`/${other}-[0-9a-f]{16}\\.`));
  await page.setViewportSize(size);
  await expect(video).toHaveAttribute("src", new RegExp(`/${first}-[0-9a-f]{16}\\.`));

  // The band leads with the maker, then the game, then Play (D4). Each of the things in it is one link to one place.
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

  // Play is the Blue of every main button, white words, 48px tall at least, 12px corners; it is the only thing with words
  // to press that is not a link to a page (the Sound and Share marks are marks).
  await expect(play).toHaveCSS("background-color", rgb(token("--pay")));
  await expect(play).toHaveCSS("color", rgb(token("--chalk")));
  await expect(play).toHaveCSS("border-top-left-radius", "12px");
  expect((await boxOf(play)).height).toBeGreaterThanOrEqual(48);
  for (const button of await clip.getByRole("button").all()) {
    expect((await button.innerText()).trim()).toBe("");
    expect((await boxOf(button)).height).toBeGreaterThanOrEqual(48);
  }
  await wordsHaveSettled(page);
  await showTheOwner(page, testInfo, "the feed");
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
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBe(0);
  expect(
    await page.evaluate(() => {
      const main = document.querySelector("main");
      return main === null ? -1 : main.scrollWidth - main.clientWidth;
    }),
  ).toBe(0);
});

test("the band's chalk words read on a white clip: 4.5 to 1 or more", async ({ page }) => {
  await page.goto("/");
  const band = clipOf(page, withPage.slug).locator(".band");
  await expect(band).toBeAttached();
  // The band is frosted glass behind its words: what is behind is darkened by the filter, then under a thin tint. Put it
  // over white and measure the chalk on what that makes.
  const { tint, brightness, chalk } = await band.evaluate((element) => {
    const behind = getComputedStyle(element, "::before");
    const filter = behind.backdropFilter || behind.getPropertyValue("-webkit-backdrop-filter");
    return {
      tint: behind.backgroundColor,
      brightness: Number(/brightness\(([\d.]+)\)/.exec(filter)?.[1] ?? 1),
      chalk: getComputedStyle(element).color,
    };
  });
  const channels = (colour: string): number[] => (colour.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
  const linear = (value: number): number => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (rgbValues: number[]): number =>
    0.2126 * linear(rgbValues[0] ?? 0) +
    0.7152 * linear(rgbValues[1] ?? 0) +
    0.0722 * linear(rgbValues[2] ?? 0);
  const alpha = Number((tint.match(/[\d.]+/g) ?? [])[3] ?? 1);
  const overWhite = channels(tint).map((value) => value * alpha + 255 * brightness * (1 - alpha));
  const lighter = Math.max(luminance(overWhite), luminance(channels(chalk)));
  const darker = Math.min(luminance(overWhite), luminance(channels(chalk)));
  expect((lighter + 0.05) / (darker + 0.05)).toBeGreaterThanOrEqual(4.5);
});
