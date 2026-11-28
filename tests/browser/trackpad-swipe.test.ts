import { expect, test, type CDPSession, type Locator, type Page } from "@playwright/test";
import { WHEEL_REST } from "../../src/features/feed/tabs.ts";
import { addGame } from "./support/game.ts";
import { oneMove, watchMoves } from "./support/moves.ts";
import { pageHasSettled } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Two fingers swiped sideways on a computer's trackpad go between Fresh and Followed, as a finger does on a phone (the
// owner, 2026-11-27: "swiping left/right on the trackpad does not switch tabs like on mobile"). A trackpad sends a swipe
// as a run of wheel moves that goes on coasting after the fingers lift, so the journey sends that whole run, and checks
// it moves one tab, slides once, adds one page to history, and lets none of its sideways moves through to the browser,
// whose own Back and Forward they would be. Each move is filmed frame by frame.

// Two live games, so the feed has a next clip to scroll to.
test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  await addGame(browser, request);
  await forgetRateLimits();
  await addGame(browser, request);
});
test.beforeEach(forgetRateLimits);

const tab = (page: Page, name: "Fresh" | "Followed" | "Your turn") =>
  page.getByRole("navigation", { name: "Feeds" }).getByRole("link", { name });

/** The sizes of a trackpad swipe's wheel moves, as a browser reports them: the push, then the long coast to a stop. */
const SWIPE = [12, 30, 45, 50, 40, 30, 22, 16, 12, 9, 7, 5, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1];

/**
 * Whether this browser can send a real wheel move. Playwright's phone (Safari's engine as on an iPhone) cannot ("Mouse
 * wheel is not supported in mobile WebKit"), so there the journey hands the page the same wheel moves as events of its
 * own, which reach the feed's listener exactly as a trackpad's do in Safari on a Mac, but scroll nothing.
 */
const realWheel = (page: Page) => page.context().browser()?.browserType().name() !== "webkit";

/**
 * A computer's trackpad, sending wheel moves through the browser's own input with the stamps a trackpad gives them. A
 * trackpad's moves are stamped by the system as the fingers move, so a busy page never splits one swipe. Moves sent one
 * call at a time are stamped as each call lands, and a busy moment (700 ms once in CI, run 46051556495; 209 to 330 ms
 * in #431's review) opened a gap past the wheel's rest inside a swipe, so the feed rightly took it as two swipes and
 * moved two tabs; or closed a gap between a scroll and the next swipe, which the feed rightly took as one gesture. So
 * the moves of one gesture come 8 ms apart, as a trackpad's do, and each new gesture comes after a rest.
 */
type Pad = { cdp: CDPSession; at: number; x: number; y: number };
const pads = new WeakMap<Page, Pad>();

/** How long the fingers rest between gestures, in seconds: longer than the feed's wheel rest. */
const REST = (2 * WHEEL_REST) / 1000;

async function padOf(page: Page): Promise<Pad> {
  let pad = pads.get(page);
  if (pad === undefined) {
    const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
    pad = { cdp: await page.context().newCDPSession(page), at: 0, x: width / 2, y: height / 2 };
    pads.set(page, pad);
  }
  return pad;
}

/** Lifts the fingers: the next move starts a new gesture. */
function rest(pad: Pad): void {
  pad.at = Math.max(Date.now() / 1000, pad.at + REST);
}

/** Sends the next move of the gesture under way, 8 ms after the last. */
function move(pad: Pad, dx: number, dy: number): Promise<unknown> {
  pad.at += 0.008;
  return pad.cdp.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: pad.x,
    y: pad.y,
    deltaX: dx,
    deltaY: dy,
    timestamp: pad.at,
  });
}

/** One wheel move under the pointer, as a gesture of its own. */
async function wheel(page: Page, dx: number, dy: number): Promise<void> {
  if (realWheel(page)) {
    const pad = await padOf(page);
    rest(pad);
    await move(pad, dx, dy);
    return;
  }
  await page.evaluate(
    ([deltaX, deltaY]) => {
      const { x, y } = (window as unknown as { pointer?: { x: number; y: number } }).pointer ?? {
        x: innerWidth / 2,
        y: innerHeight / 2,
      };
      const target = document.elementFromPoint(x, y) ?? document.body;
      target.dispatchEvent(new WheelEvent("wheel", { deltaX, deltaY, bubbles: true, cancelable: true }));
    },
    [dx, dy] as [number, number],
  );
}

/** Puts the pointer at `x`, `y`, where the next wheel moves land. */
async function pointAt(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
  if (realWheel(page)) Object.assign(await padOf(page), { x, y });
  await page.evaluate(([px, py]) => ((window as unknown as { pointer: object }).pointer = { x: px, y: py }), [
    x,
    y,
  ] as [number, number]);
}

/** The page's own wheel moves for a whole swipe, in one call, so nothing can come between them. */
const SWIPE_IN_PAGE = ([sizes, side, press]: [number[], number, string | null]) => {
  if (press !== null) document.querySelector<HTMLElement>(press)?.click();
  const { x, y } = (window as unknown as { pointer?: { x: number; y: number } }).pointer ?? {
    x: innerWidth / 2,
    y: innerHeight / 2,
  };
  for (const size of sizes) {
    const target = document.elementFromPoint(x, y) ?? document.body;
    target.dispatchEvent(new WheelEvent("wheel", { deltaX: side * size, bubbles: true, cancelable: true }));
  }
};

/** A two-finger swipe on the trackpad, under the pointer: the fingers go left (`"left"`) or right. */
async function trackpadSwipe(page: Page, way: "left" | "right"): Promise<void> {
  // The fingers going left scroll the page to the right: the wheel moves are the other way from the fingers.
  const sign = way === "left" ? 1 : -1;
  if (realWheel(page)) {
    const pad = await padOf(page);
    rest(pad);
    for (const size of SWIPE) await move(pad, sign * size, 0);
    return;
  }
  // The page's own events are stamped when the page makes them, so on the phone the whole swipe goes in one call.
  await page.evaluate(SWIPE_IN_PAGE, [SWIPE, sign, null] as [number[], number, string | null]);
}

/**
 * Several gestures one after another with no rest between: each comes while the one before still coasts, as when a
 * person swipes again before the trackpad has gone still. Each move is `[dx, dy]` as the wheel reports it.
 */
async function gesturesWithNoRest(page: Page, moves: [number, number][]): Promise<void> {
  if (realWheel(page)) {
    const pad = await padOf(page);
    rest(pad);
    for (const [dx, dy] of moves) await move(pad, dx, dy);
    return;
  }
  await page.evaluate((all) => {
    const { x, y } = (window as unknown as { pointer?: { x: number; y: number } }).pointer ?? {
      x: innerWidth / 2,
      y: innerHeight / 2,
    };
    for (const [deltaX, deltaY] of all) {
      const target = document.elementFromPoint(x, y) ?? document.body;
      target.dispatchEvent(new WheelEvent("wheel", { deltaX, deltaY, bubbles: true, cancelable: true }));
    }
  }, moves);
}

/** A swipe's wheel moves: the fingers going left (`"left"`, the page scrolling right) or right. */
const swipeMoves = (way: "left" | "right"): [number, number][] =>
  SWIPE.map((size) => [way === "left" ? size : -size, 0]);

/**
 * Presses `button` and swipes the fingers to the left at once, with no wait between. With a real wheel the press and
 * the push of the swipe go to the browser together, and the swipe's coast comes once `gone` says the press has done its
 * work, still as one gesture. On the phone the press and the whole swipe go in one call.
 */
async function pressAndSwipe(
  page: Page,
  button: Locator,
  selector: string,
  gone: () => Promise<void>,
): Promise<void> {
  if (!realWheel(page)) {
    await page.evaluate(SWIPE_IN_PAGE, [SWIPE, 1, selector] as [number[], number, string | null]);
    await gone();
    return;
  }
  const box = await button.boundingBox();
  if (box === null) throw new Error("The button has no box.");
  const pad = await padOf(page);
  rest(pad);
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2, button: "left", clickCount: 1 } as const;
  const push = SWIPE.slice(0, 5);
  const coast = SWIPE.slice(5);
  await Promise.all([
    pad.cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...at, timestamp: pad.at }),
    pad.cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...at, timestamp: pad.at }),
    ...push.map((size) => move(pad, size, 0)),
  ]);
  await gone();
  for (const size of coast) await move(pad, size, 0);
}

/** Every sideways wheel move the browser was left to act on, counted once the page has answered it. */
async function watchWheel(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const count = { sideways: 0, passed: 0, upDown: 0, upDownStopped: 0, overPanel: 0, passedOverPanel: 0 };
    (window as unknown as { wheels: typeof count }).wheels = count;
    window.addEventListener(
      "wheel",
      (event) => {
        // Whether a panel is up (or still sliding away) as the move comes, read before the feed can act on it.
        const panel = document.querySelector("dialog[open]") !== null;
        // Read after every listener on the way has had its turn.
        setTimeout(() => {
          if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            count.sideways += 1;
            if (!event.defaultPrevented) count.passed += 1;
            if (panel) count.overPanel += 1;
            if (panel && !event.defaultPrevented) count.passedOverPanel += 1;
          } else {
            count.upDown += 1;
            if (event.defaultPrevented) count.upDownStopped += 1;
          }
        });
      },
      { passive: true },
    );
  });
}

const wheels = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          wheels: {
            sideways: number;
            passed: number;
            upDown: number;
            upDownStopped: number;
            overPanel: number;
            passedOverPanel: number;
          };
        }
      ).wheels,
  );

test("a two-finger swipe on a trackpad goes between Fresh and Followed, one tab a swipe", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await watchMoves(page);
  await watchWheel(page);
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await pageHasSettled(page);
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  await pointAt(page, width / 2, height / 2);
  const onFresh = () => expect(tab(page, "Fresh")).toHaveAttribute("aria-current", "page");
  const onFollowed = () => expect(tab(page, "Followed")).toHaveAttribute("aria-current", "page");

  // Up and down on the trackpad still scrolls the clips (where the browser can send a real wheel move), and never
  // changes the tab.
  const first = page.locator("main.feed section").first();
  await expect(first).toHaveAttribute("data-current", "true");
  await wheel(page, 0, height);
  if (realWheel(page)) await expect(first).toHaveAttribute("data-current", "false");
  await wheel(page, 0, -height);
  await expect(first).toHaveAttribute("data-current", "true");
  await expect(page).toHaveURL("/");
  await onFresh();

  // The fingers to the left bring Followed in, as a finger's swipe does on a phone: one slide, one page, one tab.
  await oneMove(
    page,
    testInfo,
    "1 trackpad swipe to Followed",
    () => trackpadSwipe(page, "left"),
    onFollowed,
    {
      slides: 1,
      pushes: 1,
    },
  );
  await expect(page).toHaveURL("/followed");
  // And back, after a rest.
  await oneMove(
    page,
    testInfo,
    "2 trackpad swipe back to Fresh",
    () => trackpadSwipe(page, "right"),
    onFresh,
    {
      slides: 1,
      pushes: 1,
    },
  );
  await expect(page).toHaveURL("/");
  // Past the first tab nothing happens: no slide, no page, and the browser does not go Back either.
  await oneMove(page, testInfo, "3 trackpad swipe past Fresh", () => trackpadSwipe(page, "right"), onFresh, {
    slides: 0,
    pushes: 0,
  });
  await expect(page).toHaveURL("/");

  // None of the sideways moves reached the browser as its own Back or Forward; every up and down one scrolled.
  await expect
    .poll(() => wheels(page))
    .toMatchObject({ sideways: 3 * SWIPE.length, passed: 0, upDown: expect.any(Number), upDownStopped: 0 });
});

// With a panel up over the feed (Share, here), a sideways swipe neither changes the tab nor reaches the browser, whose
// own Back would leave the page behind the panel; and the same while the panel slides away after Close, when it is
// still up for a moment. A box inside a panel that scrolls sideways still scrolls: no panel has one today, so the
// journey puts one in, to hold the rule for the first that does.
test("a two-finger swipe over a panel, or one sliding away, stays on the page", async ({ page }) => {
  test.setTimeout(120_000);
  await watchMoves(page);
  await watchWheel(page);
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await pageHasSettled(page);
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  const onFresh = () => expect(tab(page, "Fresh")).toHaveAttribute("aria-current", "page");
  await onFresh();
  const pages = await page.evaluate(() => history.length);

  const sheet = page.getByRole("dialog", { name: "Share" });
  const openSheet = async () => {
    await page
      .locator("main.feed section[data-current='true']")
      .getByRole("button", { name: "Share" })
      .click();
    await expect(sheet).toBeVisible();
  };
  await openSheet();

  // Over the dim above the panel, and over the panel itself, both ways.
  const box = await sheet.boundingBox();
  if (box === null) throw new Error("The Share panel has no box.");
  await pointAt(page, width / 2, Math.max(4, box.y / 2));
  await trackpadSwipe(page, "left");
  await trackpadSwipe(page, "right");
  await pointAt(page, box.x + box.width / 2, box.y + Math.min(box.height / 2, 40));
  await trackpadSwipe(page, "left");
  await trackpadSwipe(page, "right");
  await expect.poll(() => wheels(page)).toMatchObject({ overPanel: 4 * SWIPE.length, passedOverPanel: 0 });

  // A box in the panel that scrolls sideways takes the move as its own scroll, and only once it is at its end does
  // the feed hold the move back from the browser.
  await page.evaluate(() => {
    const panel = document.querySelector("dialog[open]");
    const strip = document.createElement("div");
    strip.dataset.testid = "strip";
    strip.style.cssText = "overflow-x:auto;width:120px;height:40px";
    strip.innerHTML = '<div style="width:600px;height:40px"></div>';
    panel?.insertBefore(strip, panel.firstChild);
  });
  const strip = page.getByTestId("strip");
  const stripBox = await strip.boundingBox();
  if (stripBox === null) throw new Error("The strip has no box.");
  await pointAt(page, stripBox.x + stripBox.width / 2, stripBox.y + stripBox.height / 2);
  const before = await wheels(page);
  await wheel(page, 40, 0);
  await expect.poll(() => wheels(page)).toMatchObject({ passedOverPanel: before.passedOverPanel + 1 });
  if (realWheel(page)) await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await strip.evaluate((el) => (el.scrollLeft = el.scrollWidth));
  await wheel(page, 40, 0);
  await expect
    .poll(() => wheels(page))
    .toMatchObject({ overPanel: before.overPanel + 2, passedOverPanel: before.passedOverPanel + 1 });
  // And from its start, back towards it, is the feed's to hold too.
  await strip.evaluate((el) => (el.scrollLeft = 0));
  await wheel(page, -40, 0);
  await expect
    .poll(() => wheels(page))
    .toMatchObject({ overPanel: before.overPanel + 3, passedOverPanel: before.passedOverPanel + 1 });
  await strip.evaluate((el) => el.remove());

  // Close, and swipe at once, while the panel is still sliding away: still nothing reaches the browser, and the swipe
  // does not change the tab once the panel has gone either, though its coast goes on after (where the browser sends real
  // wheel moves).
  await pointAt(page, width / 2, height / 2);
  const closing = await wheels(page);
  await pressAndSwipe(page, sheet.getByRole("button", { name: "Close" }), "dialog[open] button.close", () =>
    expect(sheet).toBeHidden(),
  );
  const after = await wheels(page);
  expect(after.overPanel, "some of the swipe came while the panel slid away").toBeGreaterThan(
    closing.overPanel,
  );
  expect(after.passed).toBe(closing.passed);
  await onFresh();
  await expect(page).toHaveURL("/");
  expect(await page.evaluate(() => history.length)).toBe(pages);
});

// A trackpad goes on coasting for a second or two after the fingers lift, and a person often swipes again before it
// stops: after scrolling to a clip, to go back the other way, or on to the next tab. Each of those is a swipe of its
// own and moves one tab at once (the owner, 2026-11-28: "The horizontal swipe, at least on trackpad, is not
// responsive"), though the wheel never rests between them.
test("a swipe that comes while the last scroll or swipe still coasts moves at once", async ({ page }) => {
  test.setTimeout(120_000);
  await watchWheel(page);
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await pageHasSettled(page);
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  await pointAt(page, width / 2, height / 2);
  const pages = await page.evaluate(() => history.length);
  const on = (name: "Fresh" | "Followed" | "Your turn") =>
    expect(tab(page, name)).toHaveAttribute("aria-current", "page");
  await on("Fresh");

  // A scroll down to the next clip, coasting, then the fingers to the left: Followed.
  const scroll: [number, number][] = SWIPE.map((size) => [0, size]);
  await gesturesWithNoRest(page, [...scroll, ...swipeMoves("left")]);
  await on("Followed");
  await expect(page).toHaveURL("/followed");

  // To the right and straight back to the left: Fresh, then Followed again.
  await gesturesWithNoRest(page, [...swipeMoves("right"), ...swipeMoves("left")]);
  await on("Followed");
  await expect(page).toHaveURL("/followed");

  // Back to Fresh, then two swipes to the left, the second while the first coasts: Followed, then Your turn.
  await gesturesWithNoRest(page, swipeMoves("right"));
  await on("Fresh");
  await gesturesWithNoRest(page, [...swipeMoves("left"), ...swipeMoves("left")]);
  await on("Your turn");
  await expect(page).toHaveURL("/your-turn");

  // None of it reached the browser as its own Back or Forward, and the page never left the feed's tabs.
  await expect.poll(() => wheels(page)).toMatchObject({ sideways: 6 * SWIPE.length, passed: 0 });
  expect(await page.evaluate(() => history.length)).toBeGreaterThan(pages);
});
