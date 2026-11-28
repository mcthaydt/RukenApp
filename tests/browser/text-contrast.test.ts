import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { pageHasSettled, signInAs, signUp } from "./support/account.ts";
import { givePage } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { asInstalled } from "./support/installed.ts";
import { atLaunch, beforeLaunch } from "./support/launch.ts";
import { wordsHaveSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Every word on every screen is easy to read: each line of text meets WCAG AA contrast against what is drawn behind it,
// 4.5 to 1, or 3 to 1 for large text (24px, or 18.66px and bold). The owner, 2026-11-28, on an iPad: a game's name and
// line in Search's results were dark teal on a teal card, all but invisible ("Are you fr?"). A class name the result
// borrowed from Your games painted Your games' dark words on it, and nothing measured colour, so it shipped.
//
// What is behind a word is read from what the browser stacks under its middle, top to bottom, until something opaque:
// each colour on the way is blended in. Words over a picture (a video, an image, a gradient, frosted glass over a moving
// clip) have no one colour behind them and are left out; the feed's words over clips carry their own shadow and glass
// for that (the owner, 2026-11-27), and words on glass are glass.test.ts's to check (faint over a white clip). A
// disabled button is left out too, as WCAG leaves it out. Pages that scroll are checked from top to foot. Each screen
// is read signed out, as a player with nothing of their own and as a maker with a live game, before launch and after.

const SIZES = [
  { name: "320 by 568", width: 320, height: 568 },
  { name: "375 by 667", width: 375, height: 667 },
  { name: "667 by 375, sideways", width: 667, height: 375 },
  // The owner's iPad held sideways, where Search's unreadable card was seen.
  { name: "tablet, 1133 by 744", width: 1133, height: 744 },
] as const;

let live: Awaited<ReturnType<typeof addGame>>;
let makersPage: string;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  // A live game whose maker has a page: it shows in Search, in the feed, on its own page and in the maker's Your games.
  live = await addGame(browser, request);
  makersPage = (await givePage(live.maker, { name: "Night Owl Games", oneLine: "I make small, hard games." }))
    .handle;
});
test.beforeEach(async ({ page }) => {
  // The sizes are set here, so one engine is enough: Safari's, which the owner's iPad and iPhone draw with.
  test.skip(test.info().project.name !== "phone", "the sizes are set here; Safari's engine draws them");
  await forgetRateLimits();
  // From the Home Screen, so a phone held sideways shows its screens (in a browser tab it asks to be turned upright).
  await asInstalled(page);
  // Words measured where they come to rest: the about page's words fade in as they scroll into view, timed by a script
  // the page's own animations do not list, and with less motion asked for they are simply there.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** Search for something no game or maker is called, so Search says it found nothing. */
const NOTHING_FOUND = "/search?q=zzzzqqqq";

const signedOut = () => [
  "/",
  "/followed",
  "/your-turn",
  "/search",
  `/search?q=${encodeURIComponent(live.name)}`,
  NOTHING_FOUND,
  `/g/${live.slug}`,
  `/${makersPage}`,
  "/about",
  "/help",
  "/help/get-your-game-on-ruken",
  "/help/github",
  "/help/how-the-feed-works",
  "/help/record-screen",
  "/privacy",
  "/terms",
  "/cookies",
  "/legal/maker-agreement",
  "/sign-in",
  "/sign-up",
  "/join",
  "/forgot-password",
  "/goodbye",
  "/no-such-page-here",
];
/** What anyone signed in can open, with or without games of their own. */
const signedIn = () => [
  "/",
  "/followed",
  "/your-turn",
  "/your-turn/stopped",
  "/search",
  `/search?q=${encodeURIComponent(live.name)}`,
  NOTHING_FOUND,
  `/g/${live.slug}`,
  `/${makersPage}`,
  "/make",
  "/make/new",
  "/me",
  "/me/saved",
  "/me/reposts",
  "/me/computers",
  "/me/password",
  "/me/link",
  "/me/delete",
  "/settings/feed",
  "/no-such-page-here",
];
/** A maker's own screens besides: their game's page in Your games, and their page's editor. A game's play screen is
 * its frame, with no words of Ruken's, so it is left out. */
const makersOwn = () => [`/make/${live.slug}`, "/make/page", "/make/page/links"];

/** Each line of words on screen that is too faint against what is behind it, with its numbers, and how many were read. */
function faintWords(page: Page): Promise<{ faint: string[]; read: number }> {
  return page.evaluate(() => {
    // A one-pixel canvas does the blending, so every colour form the browser gives back (rgb, oklch, color-mix) is read
    // the same way it is drawn.
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const pen = canvas.getContext("2d", { willReadFrequently: true });
    if (pen === null) throw new Error("no 2d canvas");
    const paint = (layers: { colour: string; alpha: number }[]): [number, number, number] => {
      pen.globalAlpha = 1;
      pen.fillStyle = "#ffffff"; // a page with nothing painted is white
      pen.fillRect(0, 0, 1, 1);
      for (const layer of layers) {
        pen.globalAlpha = layer.alpha;
        pen.fillStyle = "#000000";
        pen.fillStyle = layer.colour;
        pen.fillRect(0, 0, 1, 1);
      }
      const [red = 0, green = 0, blue = 0] = pen.getImageData(0, 0, 1, 1).data;
      return [red, green, blue];
    };
    const alphaOf = (colour: string): number => {
      pen.clearRect(0, 0, 1, 1);
      pen.globalAlpha = 1;
      pen.fillStyle = "#000000";
      pen.fillStyle = colour;
      pen.fillRect(0, 0, 1, 1);
      return (pen.getImageData(0, 0, 1, 1).data[3] ?? 0) / 255;
    };
    const opacityOf = (thing: Element): number => {
      let opacity = 1;
      for (let at: Element | null = thing; at !== null; at = at.parentElement)
        opacity *= Number(getComputedStyle(at).opacity);
      return opacity;
    };
    const luminance = ([red, green, blue]: [number, number, number]): number => {
      const linear = (channel: number) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
    };
    const hex = (rgb: [number, number, number]) =>
      `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;

    /** What is drawn behind a point, top to bottom from `holder`, or null when it is a picture with no one colour. */
    const behind = (holder: Element, x: number, y: number): { colour: string; alpha: number }[] | null => {
      const stack = document.elementsFromPoint(x, y);
      const from = stack.findIndex((thing) => thing === holder || holder.contains(thing));
      // The words are not what is on top there: something covers them, or a view that scrolls has cut them off.
      if (from === -1) return null;
      const layers: { colour: string; alpha: number }[] = [];
      for (const thing of stack.slice(from)) {
        if (thing.matches("img, video, canvas, iframe, picture, svg image")) return null;
        const style = getComputedStyle(thing);
        // Safari's engine names frosted glass with its own prefix.
        const glass = [style.backdropFilter, style.getPropertyValue("-webkit-backdrop-filter")].some(
          (filter) => filter !== "none" && filter !== "",
        );
        if (style.backgroundImage !== "none" || glass) return null;
        const alpha = alphaOf(style.backgroundColor) * opacityOf(thing);
        if (alpha === 0) continue;
        layers.push({ colour: style.backgroundColor, alpha });
        if (alpha >= 0.999) return layers.reverse();
      }
      // Under everything is the page's own colour: the root's, or else the body's, which the browser paints over the
      // whole window, even below a short body, where a point finds no body to stack.
      const root = getComputedStyle(document.documentElement).backgroundColor;
      const page = alphaOf(root) > 0 ? root : getComputedStyle(document.body).backgroundColor;
      layers.push({ colour: page, alpha: alphaOf(page) });
      return layers.reverse();
    };

    const found: string[] = [];
    let read = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const words = node.textContent?.trim() ?? "";
      const holder = node.parentElement;
      if (words === "" || holder === null) continue;
      if (
        holder.closest("script, style, noscript, template, option, :disabled, [aria-disabled='true']") !==
        null
      )
        continue;
      if (!holder.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      // The first line of the words that is on screen.
      const line = [...range.getClientRects()].find(
        (box) =>
          box.width > 1 &&
          box.height > 1 &&
          box.bottom > 0 &&
          box.top < innerHeight &&
          box.right > 0 &&
          box.left < innerWidth,
      );
      if (line === undefined) continue;
      const x = Math.min(Math.max(line.left + line.width / 2, 0), innerWidth - 1);
      const y = Math.min(Math.max(line.top + line.height / 2, 0), innerHeight - 1);
      const layers = behind(holder, x, y);
      if (layers === null) continue;
      const style = getComputedStyle(holder);
      const ink = style.webkitTextFillColor === "" ? style.color : style.webkitTextFillColor;
      const inkAlpha = alphaOf(ink) * opacityOf(holder);
      // Words filled with a picture (a gradient clipped to the letters) have no one colour.
      if (inkAlpha === 0) continue;
      read += 1;
      const back = paint(layers);
      const front = paint([...layers, { colour: ink, alpha: inkAlpha }]);
      const [light, dark] = [luminance(back), luminance(front)].sort((a, b) => b - a) as [number, number];
      const ratio = (light + 0.05) / (dark + 0.05);
      const size = Number.parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      const needed = large ? 3 : 4.5;
      if (ratio < needed)
        found.push(
          `"${words.replaceAll(/\s+/g, " ").slice(0, 40)}" is ${ratio.toFixed(2)}:1, needs ${String(needed)}:1 (${hex(front)} on ${hex(back)})`,
        );
    }
    return { faint: found, read };
  });
}

async function expectEveryWordReadable(page: Page, paths: readonly string[], when: string): Promise<void> {
  for (const path of paths) {
    await page.goto(path);
    await pageHasSettled(page);
    await wordsHaveSettled(page);
    const faint = new Set<string>();
    let read = 0;
    // A page that scrolls is read a screen at a time, from top to foot.
    const foot = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const step = Math.max(1, Math.floor((page.viewportSize()?.height ?? 568) * 0.75));
    for (let at = 0; ; at += step) {
      await page.evaluate(
        (y) => {
          scrollTo(0, y);
        },
        Math.min(at, foot),
      );
      await wordsHaveSettled(page);
      const looked = await faintWords(page);
      read += looked.read;
      for (const one of looked.faint) faint.add(one);
      if (at >= foot) break;
    }
    // A check that reads no words passes anything, so every screen must have had words measured.
    expect.soft(read, `${path}, ${when}: words measured`).toBeGreaterThan(0);
    // Soft, so one run lists every screen that fails, not only the first.
    expect.soft([...faint], `${path}, ${when}`).toEqual([]);
  }
}

/** Each screen read after launch (Play) and the day before (Wishlist), and the browser left at launch. */
async function beforeAndAfterLaunch(
  page: Page,
  context: BrowserContext,
  paths: readonly string[],
  who: string,
): Promise<void> {
  await expectEveryWordReadable(page, paths, `${who}, after launch`);
  await beforeLaunch(context);
  await expectEveryWordReadable(page, paths, `${who}, before launch`);
  await atLaunch(context);
}

for (const size of SIZES) {
  test.describe(`at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("signed out, every word on every screen is easy to read, before launch and after", async ({
      page,
      context,
    }) => {
      test.setTimeout(360_000);
      await beforeAndAfterLaunch(page, context, signedOut(), "signed out");
    });

    test("signed in as a player with nothing of their own, every word is easy to read, before launch and after", async ({
      page,
      context,
    }) => {
      test.setTimeout(360_000);
      await signUp(page);
      await beforeAndAfterLaunch(page, context, signedIn(), "a player");
    });

    test("signed in as a maker with a live game, every word is easy to read, before launch and after", async ({
      page,
      context,
    }) => {
      test.setTimeout(360_000);
      await signInAs(page, live.maker.number, live.maker.password);
      await pageHasSettled(page);
      await beforeAndAfterLaunch(page, context, [...signedIn(), ...makersOwn()], "a maker");
    });
  });
}
