import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signInAs, signUp } from "./support/account.ts";
import { CONSENTED_STATE, consented } from "./support/consent.ts";
import {
  fillAnswers,
  followById,
  givePage,
  likeById,
  personWithPage,
  putGameWhereStaffLeaveIt,
  userIdOf,
} from "./support/database.ts";
import { addDraft, addGame, giveRealClips } from "./support/game.ts";
import { asInstalled } from "./support/installed.ts";
import { atLaunch, beforeLaunch } from "./support/launch.ts";
import { wordsHaveSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// No two buttons or links ever sit on top of each other, on any screen, upright or sideways, before launch (Wishlist)
// and after (Play). The owner, 2026-11-27, of a phone held sideways where the bar's buttons sat on the clip's like count
// and its Share: "these are overlapping, why didn't reviewer catch this?" Nothing checked it, so this does, at the
// small phone, a common phone and the small phone held sideways (opened from the Home Screen, where it works sideways).
// A press anywhere on a clip opens its game: that whole-clip link is under everything on purpose, and is left out, as is
// the plus to follow a maker, a badge on their picture. The game page's button that opens its video full size starts
// below Back, so the two are checked like any other pair. Nothing else is: a tip over the friends' faces counts too, and a button wholly on top of another
// counts, and so does a page that scrolls, on its first screen, since that is what a person sees. The feed is checked on
// a clip whose maker has a page with a long name, the tallest column of buttons there is. The friends' faces on a clip are a picture, not a control, and float behind the buttons (the owner, 2026-11-27), so they
// are not counted either. Nothing here is made to be kept: the journeys that make, change and delete things are their
// own.

const SIZES = [
  { name: "320 by 568", width: 320, height: 568 },
  { name: "375 by 667", width: 375, height: 667 },
  { name: "667 by 375, sideways", width: 667, height: 375 },
] as const;

/** Every screen a person reaches with no game or page of their own, signed out and signed in. */
const SIGNED_OUT = [
  "/",
  "/followed",
  "/your-turn",
  "/search",
  "/about",
  "/privacy",
  "/terms",
  "/cookies",
  "/help",
];
const SIGNED_IN = [
  "/",
  "/followed",
  "/your-turn",
  "/search",
  "/me",
  "/me/saved",
  "/me/reposts",
  "/settings/feed",
];

let live: Awaited<ReturnType<typeof addGame>>;
/** The maker's page, with two live games: a full row of cards, their names, Play and Wishlist, above the bar. */
let makerHandle = "";

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  // A live game whose maker has a page, so its clip carries the maker's picture, name and plus at the top of the column.
  live = await addGame(browser, request);
  makerHandle = (
    await givePage(live.maker, { name: "Night Owl Games Studio", oneLine: "I make small, hard games." })
  ).handle;
  // A second live game of the same maker's, made signed in as them in a browser of its own.
  await forgetRateLimits();
  const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
  try {
    const page = await context.newPage();
    await signInAs(page, live.maker.number, live.maker.password);
    const { slug } = await addDraft(page);
    await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
    await giveRealClips(page, slug);
    await putGameWhereStaffLeaveIt(slug, { state: "live" });
  } finally {
    await context.close();
  }
});
test.beforeEach(async ({ page }) => {
  // The sizes are set here, so one engine is enough besides Safari's: the iPhone and the iPad's Chrome.
  test.skip(test.info().project.name === "computer", "the sizes are phones'");
  await forgetRateLimits();
  await asInstalled(page);
});

/** Each pair of buttons or links on screen whose boxes cross, and each floating tip or line over a button. */
function overlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const name = (thing: Element) =>
      (thing.getAttribute("aria-label") ?? thing.textContent.trim().replaceAll(/\s+/g, " ")) ||
      (thing.getAttribute("class") ?? "");
    /** The part of a thing that is drawn on screen. */
    const drawn = (thing: Element) => {
      const box = thing.getBoundingClientRect();
      // Only the part that is drawn: inside the window (a clip scrolled away is not on screen) and inside every box
      // around it that cuts off what runs past it (a view that scrolls inside itself ends above the bar).
      let left = Math.max(box.left, 0);
      let top = Math.max(box.top, 0);
      let right = Math.min(box.right, innerWidth);
      let bottom = Math.min(box.bottom, innerHeight);
      for (let around = thing.parentElement; around !== null; around = around.parentElement) {
        const style = getComputedStyle(around);
        if (style.overflowX === "visible" && style.overflowY === "visible") continue;
        const cut = around.getBoundingClientRect();
        left = Math.max(left, cut.left);
        top = Math.max(top, cut.top);
        right = Math.min(right, cut.right);
        bottom = Math.min(bottom, cut.bottom);
      }
      return { thing, left, top, right, bottom };
    };
    const controls = [
      ...document.querySelectorAll("a, button, input, select, textarea, summary, [role='button']"),
    ]
      .filter((thing) => thing.closest("[aria-hidden='true'], [inert]") === null)
      .filter((thing) => thing.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
      .map(drawn)
      .filter((one) => one.right - one.left > 1 && one.bottom - one.top > 1);
    // Anything else drawn floating over the screen that is not a button (a tip such as "Swipe up for more", a
    // "Got it." line, a problem's words): a positioned box painted with glass or a colour, holding no button. Over a
    // button it hides it as surely as another button would. The friends' faces are a picture behind the buttons.
    const overlays = [...document.querySelectorAll("body *")]
      .filter((thing) => {
        const style = getComputedStyle(thing);
        if (!["absolute", "fixed", "sticky"].includes(style.position)) return false;
        const painted =
          style.backdropFilter !== "none" ||
          (style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent");
        return (
          painted &&
          // The game page's video lies under its Back on purpose, and while it loads it is painted a colour (look.css,
          // `[data-loading]`): it is Back's backdrop, not a tip over it.
          !thing.matches(".gamepage .clipbox video") &&
          thing.querySelector("a, button, input, select, textarea, summary, [role='button']") === null &&
          thing.closest(
            "a, button, input, select, textarea, summary, [role='button'], [aria-hidden='true'], .friends",
          ) === null &&
          thing.checkVisibility({ visibilityProperty: true, opacityProperty: true })
        );
      })
      .map(drawn)
      .filter((one) => one.right - one.left > 1 && one.bottom - one.top > 1);
    // The friends' faces float behind the buttons, but a tip over them hides them as surely as it hides a button.
    const faces = [...document.querySelectorAll(".friends")]
      .filter((thing) => thing.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
      .map(drawn)
      .filter((one) => one.right - one.left > 1 && one.bottom - one.top > 1);
    const found: string[] = [];
    for (const overlay of overlays)
      for (const control of [...controls, ...faces]) {
        if (overlay.thing.contains(control.thing) || control.thing.contains(overlay.thing)) continue;
        // The game's name on the game page sits over its video, the backdrop that opens it full size, on purpose.
        if (control.thing.matches(".gamepage .clipopen")) continue;
        const wide = Math.min(overlay.right, control.right) - Math.max(overlay.left, control.left);
        const tall = Math.min(overlay.bottom, control.bottom) - Math.max(overlay.top, control.top);
        if (wide > 1 && tall > 1) found.push(`${name(overlay.thing)} / ${name(control.thing)}`);
      }
    for (const [at, one] of controls.entries())
      for (const other of controls.slice(at + 1)) {
        if (one.thing.contains(other.thing) || other.thing.contains(one.thing)) continue;
        // The plus to follow a maker is a badge on the bottom edge of their picture on a clip, the two drawn as one.
        const credit = one.thing.closest(".credit");
        if (credit !== null && credit === other.thing.closest(".credit")) continue;
        const wide = Math.min(one.right, other.right) - Math.max(one.left, other.left);
        const tall = Math.min(one.bottom, other.bottom) - Math.max(one.top, other.top);
        if (wide > 1 && tall > 1) found.push(`${name(one.thing)} / ${name(other.thing)}`);
      }
    return found;
  });
}

/** Each button whose words run past its own edges, or break a word across two lines inside it. */
function spilling(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button, a.button")].filter(
      (thing) => thing.closest("[aria-hidden='true'], [inert]") === null && thing.checkVisibility(),
    );
    const found: string[] = [];
    for (const button of buttons) {
      if (button.scrollWidth > button.clientWidth + 1)
        found.push(`${button.textContent.trim()} runs past its edges`);
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode())
        for (const word of (node.textContent ?? "").matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, word.index);
          range.setEnd(node, word.index + word[0].length);
          const lines = new Set([...range.getClientRects()].map((piece) => Math.round(piece.top)));
          if (lines.size > 1) found.push(`"${word[0]}" breaks across two lines`);
        }
    }
    return found;
  });
}

/** The feed brought to the game's clip, whose maker has a page; Followed shows it only to someone following them. */
async function onTheMakersClip(page: Page, path: string): Promise<void> {
  const clip = page.locator(`section[data-slug="${live.slug}"]`).first();
  if (path === "/followed" && (await clip.count()) === 0) return;
  await clip.scrollIntoViewIfNeeded();
  await expect(clip.locator(".credit")).toBeVisible();
  await page.waitForFunction(
    (slug) => document.querySelector(`section[data-slug="${slug}"]`)?.getAttribute("data-current") === "true",
    live.slug,
  );
}

async function expectNothingOverlaps(page: Page, paths: readonly string[], when: string): Promise<void> {
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const path of paths) {
      // The feed's first-open tips show again at each size: the note that they were seen is forgotten.
      await page.evaluate(() => {
        try {
          localStorage.removeItem("rk_seen_hints");
        } catch {
          // A blank page before the first screen has no storage, and nothing to forget.
        }
      });
      // A game's page is checked while its video is still loading, its worst moment: the video's file is held back.
      // Safari's engine stops answering the page while a video's file is held, so there the video loads as it would.
      const holdVideo = path.startsWith("/g/") && page.context().browser()?.browserType().name() !== "webkit";
      if (holdVideo) await page.route(/\.(?:webm|mp4|mov)(?:$|[?#])/, () => undefined);
      // A held video never lets the page finish loading, so the check starts once its words are there.
      await page.goto(path, holdVideo ? { waitUntil: "domcontentloaded" } : undefined);
      await pageHasSettled(page);
      if (holdVideo)
        await expect(
          page.locator(".gamepage .clipbox video[data-loading]"),
          `${path}'s video is still loading`,
        ).toHaveCount(1);
      await wordsHaveSettled(page);
      const where = `${path} at ${size.name}, ${when}`;
      if (path === "/" || path === "/followed") {
        // The feed's first screen as it opens, with its tips; then the clip with a maker, the tallest column.
        expect.soft(await overlaps(page), `${where}, first screen`).toEqual([]);
        await onTheMakersClip(page, path);
        await wordsHaveSettled(page);
      }
      // Soft, so one run lists every screen and size that fails, not only the first.
      expect.soft(await overlaps(page), where).toEqual([]);
      expect.soft(await spilling(page), where).toEqual([]);
      if (holdVideo) await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  }
}

test.describe("signed out", () => {
  test.use({ storageState: CONSENTED_STATE });

  test("no two buttons overlap on any screen, upright or sideways, before launch and after", async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);
    const paths = [...SIGNED_OUT, `/g/${live.slug}`, `/${makerHandle}`];
    await expectNothingOverlaps(page, paths, "after launch");
    await beforeLaunch(context);
    await expectNothingOverlaps(page, paths, "before launch");
    await atLaunch(context);
  });
});

test("signed in, with a friend's face on a clip, no two buttons overlap, before launch and after", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const account = await signUp(page);
  const { handle } = await givePage(account, { name: "Lu Looker", oneLine: "I play games." });
  const meId = await userIdOf(account.number);
  const friend = await personWithPage("Ivy Inline");
  await followById(meId, friend.id);
  await followById(friend.id, meId);
  await likeById(friend.id, live.slug, true);
  // Following the maker, so Followed shows the clip too.
  await followById(meId, live.makerUserId);
  const paths = [...SIGNED_IN, `/g/${live.slug}`, `/${handle}`, `/${makerHandle}`];
  await expectNothingOverlaps(page, paths, "after launch");
  await beforeLaunch(context);
  await expectNothingOverlaps(page, paths, "before launch");
  await atLaunch(context);
});
