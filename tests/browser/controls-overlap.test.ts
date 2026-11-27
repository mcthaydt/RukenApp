import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { CONSENTED_STATE, consented } from "./support/consent.ts";
import { followById, givePage, likeById, personWithPage, userIdOf } from "./support/database.ts";
import { gameWhere } from "./support/game.ts";
import { asInstalled } from "./support/installed.ts";
import { atLaunch, beforeLaunch } from "./support/launch.ts";
import { wordsHaveSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// No two buttons or links ever sit on top of each other, on any screen, upright or sideways, before launch (Wishlist)
// and after (Play). The owner, 2026-11-27, of a phone held sideways where the bar's buttons sat on the clip's like count
// and its Share: "these are overlapping, why didn't reviewer catch this?" Nothing checked it, so this does, at the
// small phone, a common phone and the small phone held sideways (opened from the Home Screen, where it works sideways).
// A press anywhere on a clip opens its game: that whole-clip link is under everything on purpose, and is left out, as is
// any button drawn wholly on a bigger one that is its backdrop, and what scrolls under the floating bar on a page that
// scrolls (a person scrolls it clear; fits-the-screen.test.ts holds the screens that must not scroll). The
// friends' faces on a clip are a picture, not a control, and float behind the buttons (the owner, 2026-11-27), so they
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

let live: { slug: string; name: string };

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  await forgetRateLimits();
  const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
  try {
    live = await gameWhere(await context.newPage(), { state: "live" });
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

/** Each pair of buttons or links on screen whose boxes cross, named by their words. */
function overlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const name = (thing: Element) =>
      (thing.getAttribute("aria-label") ?? thing.textContent.trim().replaceAll(/\s+/g, " ")) ||
      (thing.getAttribute("class") ?? "");
    /** Whether it stays put on the window (the bar, the top bar): it or a box around it is fixed. */
    const floats = (thing: Element): boolean => {
      for (let at: Element | null = thing; at !== null; at = at.parentElement)
        if (getComputedStyle(at).position === "fixed") return true;
      return false;
    };
    /**
     * Whether it moves under what floats as the screen scrolls, so a person scrolls it clear: it is inside a box that
     * scrolls freely. The feed snaps a whole clip to the window, so a clip's buttons never move clear: they count.
     */
    const scrolls = (thing: Element): boolean => {
      for (let at = thing.parentElement; at !== null; at = at.parentElement) {
        const style = getComputedStyle(at);
        const free =
          style.overflowY === "auto" || style.overflowY === "scroll" || at === document.scrollingElement;
        if (free && at.scrollHeight > at.clientHeight + 1) return style.scrollSnapType === "none";
      }
      return false;
    };
    const controls = [
      ...document.querySelectorAll("a, button, input, select, textarea, summary, [role='button']"),
    ]
      .filter((thing) => thing.closest("[aria-hidden='true'], [inert]") === null)
      .filter((thing) => thing.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
      .map((thing) => {
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
        return { thing, left, top, right, bottom, floats: floats(thing), scrolls: scrolls(thing) };
      })
      .filter((one) => one.right - one.left > 1 && one.bottom - one.top > 1);
    const found: string[] = [];
    for (const [at, one] of controls.entries())
      for (const other of controls.slice(at + 1)) {
        if (one.thing.contains(other.thing) || other.thing.contains(one.thing)) continue;
        // A button drawn wholly on a bigger one that is its backdrop (Back on the game page's video, which opens the
        // video full size) hides nothing of either.
        const inside = (small: typeof one, big: typeof one) =>
          small.left >= big.left &&
          small.right <= big.right &&
          small.top >= big.top &&
          small.bottom <= big.bottom;
        if (inside(one, other) || inside(other, one)) continue;
        // A page that scrolls under the floating bar: the person scrolls what is under it clear.
        if ((one.floats && other.scrolls) || (other.floats && one.scrolls)) continue;
        const wide = Math.min(one.right, other.right) - Math.max(one.left, other.left);
        const tall = Math.min(one.bottom, other.bottom) - Math.max(one.top, other.top);
        if (wide > 1 && tall > 1) found.push(`${name(one.thing)} / ${name(other.thing)}`);
      }
    return found;
  });
}

/** Each button whose words run past its own edges. */
function spilling(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("button, a.button")]
      .filter((thing) => thing.closest("[aria-hidden='true'], [inert]") === null && thing.checkVisibility())
      .filter((thing) => thing.scrollWidth > thing.clientWidth + 1)
      .map((thing) => thing.textContent.trim()),
  );
}

async function expectNothingOverlaps(page: Page, paths: readonly string[], when: string): Promise<void> {
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const path of paths) {
      await page.goto(path);
      await pageHasSettled(page);
      await wordsHaveSettled(page);
      const where = `${path} at ${size.name}, ${when}`;
      // Soft, so one run lists every screen and size that fails, not only the first.
      expect.soft(await overlaps(page), where).toEqual([]);
      expect.soft(await spilling(page), where).toEqual([]);
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
    const paths = [...SIGNED_OUT, `/g/${live.slug}`];
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
  const paths = [...SIGNED_IN, `/g/${live.slug}`, `/${handle}`];
  await expectNothingOverlaps(page, paths, "after launch");
  await beforeLaunch(context);
  await expectNothingOverlaps(page, paths, "before launch");
  await atLaunch(context);
});
