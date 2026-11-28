import { expect, test, type Page } from "@playwright/test";
import { signInAs, signUp } from "./support/account.ts";
import { CONSENTED_STATE, NOT_CONSENTED } from "./support/consent.ts";
import { givePage } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { boxOf, showTheOwner, wordsHaveSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { asInstalled } from "./support/installed.ts";

// Some of these journeys turn a phone sideways, which in a browser tab asks for the phone upright; they look at Ruken
// opened from the Home Screen, where it works sideways (fits-the-screen.test.ts holds the tab).
test.beforeEach(({ page }) => asInstalled(page));

// A phone held sideways (the owner, 2026-11-14: "mobile landscape" is first class; 2026-11-22: "things aren't
// appropriately sized there"). Three phones: the small iPhone, a common iPhone and the biggest one, each on its side.
// On every screen the bar stands along the right edge, the screen keeps clear of it, nothing scrolls sideways and
// headings are a phone's size. A step of adding a game has no bar (the owner's card, 2026-11-22).
const PHONES = [
  { name: "a small iPhone", viewport: { width: 667, height: 375 } },
  { name: "an iPhone", viewport: { width: 844, height: 390 } },
  { name: "a big iPhone", viewport: { width: 932, height: 430 } },
] as const;

const bar = (page: Page) => page.getByRole("navigation", { name: "Ruken" });

let game: Awaited<ReturnType<typeof addGame>>;
let handle: string;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  game = await addGame(browser, request);
  handle = (
    await givePage(game.maker, {
      name: "Night Owl",
      oneLine: "I make small, hard games.",
      links: [{ title: "My shop", url: "https://example.com/shop" }],
    })
  ).handle;
});
test.beforeEach(async () => {
  // The window is set by each test, so one engine is enough besides Safari's: the iPhone and the iPad's Chrome.
  test.skip(test.info().project.name === "computer", "a computer has no sideways");
  await forgetRateLimits();
});

/** The bar is a column along the right edge, in the middle of the window's height, and wholly in the window. */
async function expectBarOnTheRight(page: Page): Promise<{ x: number }> {
  await expect(bar(page)).toBeVisible();
  const window = page.viewportSize() ?? { width: 0, height: 0 };
  const box = await boxOf(bar(page));
  expect(box.x + box.width).toBeLessThanOrEqual(window.width);
  expect(box.x + box.width).toBeGreaterThanOrEqual(window.width - 24);
  expect(box.height).toBeGreaterThan(box.width);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(window.height);
  expect(Math.abs(box.y + box.height / 2 - window.height / 2)).toBeLessThanOrEqual(2);
  return { x: box.x };
}

/** Nothing scrolls sideways, and every heading is at most the phone's 36px. */
async function expectPhoneSized(page: Page): Promise<void> {
  expect(
    await page.evaluate(() =>
      [document.documentElement, document.body].every((box) => box.scrollWidth <= box.clientWidth),
    ),
  ).toBe(true);
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll("h1")].map((heading) => parseFloat(getComputedStyle(heading).fontSize)),
  );
  for (const size of sizes) expect(size).toBeLessThanOrEqual(36);
}

/** No part of `selector` reaches under the bar, whichever way the page is scrolled. */
async function expectClearOfTheBar(page: Page, selector: string, barX: number): Promise<void> {
  const rights = await page.evaluate(
    (wanted) => [...document.querySelectorAll(wanted)].map((part) => part.getBoundingClientRect().right),
    selector,
  );
  expect(rights.length, selector).toBeGreaterThan(0);
  for (const right of rights) expect(right, selector).toBeLessThanOrEqual(barX);
}

for (const phone of PHONES) {
  test.describe(`on ${phone.name} held sideways`, () => {
    test.use({ viewport: phone.viewport });

    test("the feed: the clip fills the window, its words take a corner, Play beside the name", async ({
      page,
    }, testInfo) => {
      await page.goto("/");
      // The first clip, whichever game it is: other journeys add games to the same feed.
      const clip = page.locator("section[data-slug]").first();
      await expect(clip).toBeVisible();
      const { x } = await expectBarOnTheRight(page);
      await expectClearOfTheBar(page, "section[data-slug]:first-of-type .band", x);
      // Share stands at the foot of a column of round buttons just left of the bar, clear of it: under the bar there is
      // no room for them (the owner, 2026-11-27, of the bar sitting on Like and Share: "these are overlapping").
      const rail = await boxOf(bar(page));
      const share = await boxOf(clip.getByRole("button", { name: "Share" }));
      const like = await boxOf(clip.getByRole("button", { name: "Like" }));
      expect(share.x + share.width).toBeLessThanOrEqual(rail.x);
      expect(share.x + share.width).toBeGreaterThanOrEqual(rail.x - 24);
      expect(Math.abs(like.x - share.x)).toBeLessThanOrEqual(2);
      expect(share.y + share.height).toBeLessThanOrEqual(phone.viewport.height);
      // The words sit at the foot and take at most half the window's height, so the clip shows above them.
      const band = await boxOf(clip.locator(".band"));
      const window = page.viewportSize() ?? { width: 0, height: 0 };
      expect(band.height).toBeLessThanOrEqual(window.height / 2);
      expect(band.y + band.height).toBeLessThanOrEqual(window.height);
      // Play is on the same row as the game's name.
      const play = await boxOf(clip.getByRole("link", { name: "Play", exact: true }));
      const name = await boxOf(clip.getByRole("heading", { level: 2 }));
      expect(play.x).toBeGreaterThan(name.x);
      expect(play.y).toBeLessThan(name.y + name.height);
      await showTheOwner(page, testInfo, `the feed, ${phone.name} sideways`);
    });

    test("a game's page and a maker's page keep clear of the bar, with Play in the first screen", async ({
      page,
    }, testInfo) => {
      await page.goto(`/g/${game.slug}`);
      await wordsHaveSettled(page);
      let { x } = await expectBarOnTheRight(page);
      await expectPhoneSized(page);
      await expectClearOfTheBar(page, "main.gamepage .cell", x);
      const play = await boxOf(page.locator(".playtile").getByRole("link", { name: "Play", exact: true }));
      expect(play.y + play.height).toBeLessThanOrEqual(phone.viewport.height);
      await showTheOwner(page, testInfo, `a game's page, ${phone.name} sideways`);

      await page.goto(`/${handle}`);
      await wordsHaveSettled(page);
      ({ x } = await expectBarOnTheRight(page));
      await expectPhoneSized(page);
      await expectClearOfTheBar(page, "main.makerpage > *", x);
      await showTheOwner(page, testInfo, `a maker's page, ${phone.name} sideways`);
    });

    test("the card screens: the bar, a phone's sizes, and a form beside its heading", async ({
      page,
    }, testInfo) => {
      for (const path of [
        "/help",
        "/help/get-your-game-on-ruken",
        "/help/how-the-feed-works",
        "/cookies",
        "/privacy",
        "/terms",
        "/join",
        "/legal/maker-agreement",
        "/sign-up",
        "/forgot-password",
        "/sign-in",
      ]) {
        await page.goto(path);
        await wordsHaveSettled(page);
        const { x } = await expectBarOnTheRight(page);
        await expectPhoneSized(page);
        await expectClearOfTheBar(page, "header, main", x);
        await showTheOwner(page, testInfo, `${path}, ${phone.name} sideways`);
      }
      // Sign in has its form to the right of its heading, starting level with it, not under it.
      const heading = await boxOf(page.getByRole("heading", { name: "Sign in", level: 1 }));
      const form = await boxOf(page.locator("main.card > form"));
      expect(form.x).toBeGreaterThan(heading.x + heading.width / 2);
      expect(Math.abs(form.y - heading.y)).toBeLessThanOrEqual(16);
    });

    test("a maker's places have the bar and keep clear of it; the steps of adding a game have none", async ({
      page,
    }, testInfo) => {
      await signInAs(page, game.maker.number, game.maker.password);
      for (const path of [
        "/make",
        `/make/${game.slug}`,
        `/make/${game.slug}/take-off`,
        "/make/page",
        "/make/page/links",
        "/me",
        "/me/password",
        "/me/computers",
        "/me/delete",
      ]) {
        await page.goto(path);
        await wordsHaveSettled(page);
        const { x } = await expectBarOnTheRight(page);
        await expectPhoneSized(page);
        await expectClearOfTheBar(page, "main", x);
        await showTheOwner(page, testInfo, `${path}, ${phone.name} sideways`);
      }
      for (const path of [
        `/make/${game.slug}/name`,
        "/make/page/name",
        `/g/${game.slug}/play`,
        `/make/${game.slug}/play`,
      ]) {
        await page.goto(path);
        await expect(page.locator("main, iframe").first()).toBeAttached();
        await expect(bar(page), path).toHaveCount(0);
        await expectPhoneSized(page);
      }
    });

    test("a step's Back and Save stand at the right edge, and its question, hint and links are all beside them", async ({
      page,
    }, testInfo) => {
      // Slice 2 design round 3, note 3: a row of buttons pinned across the foot hid a step's hint until she scrolled.
      await signInAs(page, game.maker.number, game.maker.password);
      for (const path of [
        "/make/new",
        `/make/${game.slug}/name`,
        `/make/${game.slug}/files`,
        `/make/${game.slug}/wide`,
        `/make/${game.slug}/age`,
        `/make/${game.slug}/websites`,
        "/make/page/name",
        "/make/page/links/add",
      ]) {
        await page.goto(path);
        await wordsHaveSettled(page);
        await expect(bar(page), path).toHaveCount(0);
        await expectPhoneSized(page);
        const acts = await boxOf(page.locator(".screen .acts"));
        expect(acts.x + acts.width, path).toBeLessThanOrEqual(phone.viewport.width);
        expect(acts.x, path).toBeGreaterThan(phone.viewport.width / 2);
        expect(acts.y, path).toBeGreaterThanOrEqual(0);
        expect(acts.y + acts.height, path).toBeLessThanOrEqual(phone.viewport.height);
        const rights = await page.evaluate(() =>
          [...document.querySelectorAll(".screen main :is(h1, p, a, label, input, textarea, video, img)")]
            .filter((part) => !part.closest(".acts") && part.getClientRects().length > 0)
            .map((part) => part.getBoundingClientRect().right),
        );
        expect(rights.length, path).toBeGreaterThan(0);
        for (const right of rights) expect(right, path).toBeLessThanOrEqual(acts.x);
        await showTheOwner(page, testInfo, `${path}, ${phone.name} sideways`);
      }
      // A maker with no page yet is asked its address first: a step, so no bar there either.
      await page.context().clearCookies();
      await page.context().addCookies(CONSENTED_STATE.cookies);
      await signUp(page);
      await page.goto("/make/page");
      await expect(page.getByRole("heading", { name: "Pick your page's address" })).toBeVisible();
      await expect(bar(page)).toHaveCount(0);
    });
  });
}

for (const phone of PHONES) {
  test.describe(`on ${phone.name} held sideways, before a yes to cookies`, () => {
    test.use({ viewport: phone.viewport, storageState: NOT_CONSENTED });

    test("the cookie card sits at the foot, wholly in the window and clear of the bar", async ({
      page,
    }, testInfo) => {
      for (const path of ["/", "/help"]) {
        await page.goto(path);
        const card = page.getByRole("complementary").filter({ has: page.locator("#consent-title") });
        await expect(card, path).toBeVisible();
        const { x } = await expectBarOnTheRight(page);
        const box = await boxOf(card);
        expect(box.x, path).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, path).toBeLessThanOrEqual(x);
        expect(box.y + box.height, path).toBeLessThanOrEqual(phone.viewport.height);
        expect(phone.viewport.height - (box.y + box.height), path).toBeLessThanOrEqual(24);
        await showTheOwner(page, testInfo, `the cookie card on ${path}, ${phone.name} sideways`);
      }
    });

    test("a step never has the cookie card over Back and Save: it asks for the yes on a screen of its own", async ({
      page,
    }, testInfo) => {
      // A maker signed in on another visit, and this browser has not answered cookies since.
      await page.context().addCookies(CONSENTED_STATE.cookies);
      await signInAs(page, game.maker.number, game.maker.password);
      await page.context().clearCookies({ name: "rk_consent" });
      await page.goto(`/make/${game.slug}/name`);
      await expect(page.getByRole("heading", { name: "Cookies?", level: 1 })).toBeVisible();
      await expect(
        page.getByRole("complementary").filter({ has: page.locator("#consent-title") }),
      ).toHaveCount(0);
      await expect(page.locator(".screen .acts")).toHaveCount(0);
      await showTheOwner(page, testInfo, `a step before a yes to cookies, ${phone.name} sideways`);
    });
  });
}
