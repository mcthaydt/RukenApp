import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { rgb, token } from "../../support/look-tokens.ts";
import { fillBirthDate, freshNumber, JOURNEY_PASSWORD, nationalOf, yearsAgo } from "./account.ts";

// Helpers for the journeys that check the look (tests/browser/look.test.ts). CI checks values (a colour, a
// size, a font, a request), not taste. A screenshot is attached for a person to look at; nothing compares it.

/**
 * What a computed `font-family` must start with: exactly this family, first. Chromium writes the family in
 * quotes (`"Young Serif", Georgia, ...`) and WebKit drops them (`Young Serif, Georgia, ...`), so the quotes are
 * optional; the name and its place at the front of the list are as strict as before.
 */
export function startsWithFamily(family: string): RegExp {
  // "Ruken Digits" may lead the display face: it draws only the digits 0 to 9, so no "1" reads as an "I" (spec 15.2).
  return new RegExp(`^("?Ruken Digits"?, )?"?${family}"?(,|$)`);
}

/**
 * Every card screen that a journey reaches without making an account, and how. Each `open` ends by waiting
 * for the screen's heading, so the checks that follow see the finished page.
 */
export const CARD_SCREENS: { name: string; open(page: Page): Promise<void> }[] = [
  {
    name: "sign up",
    open: async (page) => {
      await page.goto("/sign-up");
      await expect(page.getByRole("heading", { name: "Join Ruken", exact: true })).toBeVisible();
    },
  },
  {
    name: "sign in",
    open: async (page) => {
      await page.goto("/sign-in");
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    },
  },
  {
    name: "forgot password",
    open: async (page) => {
      await page.goto("/forgot-password");
      await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
    },
  },
  {
    // The second screen: any number gets it, so it needs no account.
    name: "forgot password, the code",
    open: async (page) => {
      await page.goto("/forgot-password");
      await page.getByLabel("Phone number").fill(nationalOf(freshNumber()));
      await page.getByRole("button", { name: "Text me a code" }).click();
      await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    },
  },
  {
    // The second screen of sign-up, for a number that has no account: the code is the one the stand-in kept.
    name: "sign up, the code",
    open: async (page) => {
      await page.goto("/sign-up");
      await page.getByLabel("Phone number").fill(nationalOf(freshNumber()));
      await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
      await fillBirthDate(page, yearsAgo(30));
      await page.getByRole("button", { name: "Text me a code" }).click();
      await expect(page.getByRole("heading", { name: "We texted you a code" })).toBeVisible();
    },
  },
  {
    // Signed out, where its one button is the ink "Continue" and nothing on it is red.
    name: "the paywall card",
    open: async (page) => {
      await page.goto("/join");
      await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
    },
  },
  {
    // Needs no account: a maker reads it before they agree to it.
    name: "the maker agreement",
    open: async (page) => {
      await page.goto("/legal/maker-agreement");
      await expect(page.getByRole("heading", { name: "Maker agreement" })).toBeVisible();
    },
  },
  {
    // Needs no account: a maker reads it before they have a GitHub.
    name: "the GitHub how-to",
    open: async (page) => {
      await page.goto("/help/github");
      await expect(page.getByRole("heading", { name: "Put your game on GitHub" })).toBeVisible();
    },
  },
  {
    // Needs no account: a maker reads it before she records anything.
    name: "the record-your-screen how-to",
    open: async (page) => {
      await page.goto("/help/record-screen");
      await expect(page.getByRole("heading", { level: 1, name: "Record your screen" })).toBeVisible();
    },
  },
  {
    name: "a missing page",
    open: async (page) => {
      await page.goto("/no-such-page");
      await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
    },
  },
];

/**
 * Waits until the words have stopped moving by themselves: every entrance has finished (a line rises 28px into place
 * over 460ms, each a little after the one before) and the fonts are in (words in the display face change height when it
 * arrives). Endless animations (the drifting circles) never finish and are left out. It waits on these events and never
 * on a time. A journey that measures only words, and sits on a screen whose videos are stand-ins that never load, waits
 * for this alone.
 */
export async function wordsHaveSettled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        // An animation that is cancelled (its element left the page, or its style changed) rejects `finished` with an
        // AbortError; a cancelled entrance has stopped moving as much as a finished one, so that is also "settled".
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    await document.fonts.ready;
  });
}

/**
 * Waits until the page has stopped moving by itself, so two boxes measured one after the other are measured in the same
 * layout: the words have settled (`wordsHaveSettled`) and every video has its size (a tile without one is another
 * height). It waits on these events and never on a time.
 */
export async function layoutHasSettled(page: Page): Promise<void> {
  await wordsHaveSettled(page);
  await page.evaluate(async () => {
    await Promise.all(
      [...document.querySelectorAll<HTMLVideoElement>("video[src]")].map((video) =>
        video.readyState >= 1
          ? Promise.resolve()
          : new Promise<void>((done) => {
              video.addEventListener("loadedmetadata", () => {
                done();
              });
              video.addEventListener("error", () => {
                done();
              });
            }),
      ),
    );
  });
}

export type Box = { x: number; y: number; width: number; height: number };

/** Where a thing is on the page. Throws, saying so, when it is not there to measure. */
export async function boxOf(thing: Locator): Promise<Box> {
  const box = await thing.boundingBox();
  if (box === null) throw new Error("there is nothing on the page to measure");
  return box;
}

/**
 * How many lines a thing's words take. A thing made of several pieces of text (a name with a break allowed after each
 * slash) has a box for each piece, so the boxes are counted by where they sit up and down: pieces on one line share it.
 */
export function lineCount(thing: Locator): Promise<number> {
  return thing.evaluate((element) => {
    const words = document.createRange();
    words.selectNodeContents(element);
    return new Set([...words.getClientRects()].map((line) => Math.round(line.top))).size;
  });
}

/**
 * The words of a thing that a line break cuts in the middle: a word whose pieces sit on more than one line. A word that
 * moves down whole is fine; "Chang" over "e" is the fault. A word is whatever lies between spaces; a journey that lets a
 * word break at a slash (a repository's name) names the characters that bound a word, `"\\s/"`.
 */
export function brokenWords(thing: Locator, boundedBy = "\\s"): Promise<string[]> {
  return thing.evaluate((element, bounds) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const broken: string[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      for (const word of (node.textContent ?? "").matchAll(new RegExp(`[^${bounds}]+`, "g"))) {
        const range = document.createRange();
        range.setStart(node, word.index);
        range.setEnd(node, word.index + word[0].length);
        const lines = new Set([...range.getClientRects()].map((piece) => Math.round(piece.top)));
        if (lines.size > 1) broken.push(word[0]);
      }
    }
    return broken;
  }, boundedBy);
}

/**
 * Where each line of a thing's words starts, left to right, one number per line. A bounding box cannot show this: a
 * button's box starts at the card's edge even when its wrapped words are centred inside it, so the words are measured.
 */
export function lineStarts(thing: Locator): Promise<number[]> {
  return thing.evaluate((element) => {
    const words = document.createRange();
    words.selectNodeContents(element);
    return [...words.getClientRects()].map((line) => line.left);
  });
}

/** The text of every element whose background colour, text colour or any edge colour is the pip red. */
export function pipRed(page: Page): Promise<string[]> {
  const pip = rgb(token("--pip"));
  return page.evaluate((red) => {
    const properties = [
      "backgroundColor",
      "color",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
    ] as const;
    return [...document.querySelectorAll("body *")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return properties.some((property) => style[property] === red);
      })
      .map((element) => element.textContent.trim());
  }, pip);
}

/** The main buttons on a card: every button or link-button that is not the quiet, green, red or outline kind, and a
 * file picker's words when the picker is not the quiet one. */
export function filledButtons(page: Page): Locator {
  const notMain = ":not(.quiet):not(.safe):not(.danger):not(.outline)";
  return page.locator(
    `.card button${notMain}, .card a.button${notMain}, .card .file:not([data-quiet]) > span`,
  );
}

/**
 * The checks every card screen passes: one paper card, at most one main button, no red, and nothing that
 * scrolls sideways. A journey that has already made an account checks its screens with this instead of
 * making another account per screen. Red is for what can't be undone (spec 15.1): a screen that has such a button
 * names its words in `red`, and nothing else on it may be red.
 */
export async function expectOneCard(page: Page, options: { red?: string[] } = {}): Promise<void> {
  const card = page.locator("main.card");
  await expect(card).toHaveCount(1);
  await expect(card).toHaveCSS("background-color", rgb(token("--paper")));
  await expect(card).toHaveCSS("color", rgb(token("--ink")));
  await expect(card).toHaveCSS("border-top-left-radius", "20px");
  await expect(card).toHaveCSS("border-top-width", "0px");
  await expect(card).toHaveCSS("box-shadow", "none");
  await expect(card.getByRole("heading", { level: 1 })).toHaveCSS("font-size", "32px");
  expect(await filledButtons(page).count()).toBeLessThanOrEqual(1);
  expect(await pipRed(page)).toEqual(options.red ?? []);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
}

/**
 * Attaches a full-page screenshot to the journey as `look: <screen>`. Playwright runs each journey on a
 * phone and on a computer, so each screen gets both. It compares nothing: it is there for the Owner to look
 * at ("Screenshots on the board", Owner, 2026-11-13).
 */
export async function showTheOwner(page: Page, testInfo: TestInfo, screen: string): Promise<void> {
  // A draft's quick CI run turns the pictures off (LOOK_SHOTS=off) unless something visual changed: a full-page
  // picture on nine devices is slow, and nobody is looking at it yet. No journey checks the pictures.
  if (process.env.LOOK_SHOTS === "off") return;
  // The screen as it rests: the fonts are in and every entrance has finished, so the picture is not a half-faded one.
  await page.evaluate(async () => {
    await document.fonts.ready;
    // An animation that repeats for ever (the circles behind Live) never finishes, and is the screen at rest as it is.
    const ends = document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(ends.map((animation) => animation.finished));
  });
  await testInfo.attach(`look: ${screen}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

/** The five layouts the maker's screens are drawn in (spec 4). */
export type Layout = "phone" | "phone-sideways" | "tablet" | "tablet-sideways" | "computer";

/** Which of the five layouts this window gets. The same order as the stylesheet's queries. */
export function layoutOf(page: Page): Layout {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  if (width < 500) return "phone";
  if (height < 450) return "phone-sideways";
  if (height > width) return "tablet";
  if (width < 1200) return "tablet-sideways";
  return "computer";
}

/**
 * Waits until a video has drawn a frame: the browser has read its size, which it can only do from a file it can decode.
 * A video that is a few bytes of the right first letters shows a blank block and never passes this.
 */
export async function expectFrame(video: Locator): Promise<void> {
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.videoWidth))
    .toBeGreaterThan(0);
}
