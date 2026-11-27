import { expect, test, type Page } from "@playwright/test";
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

const tab = (page: Page, name: "Fresh" | "Followed") =>
  page.getByRole("navigation", { name: "Feeds" }).getByRole("link", { name });

/** The sizes of a trackpad swipe's wheel moves, as a browser reports them: the push, then the long coast to a stop. */
const SWIPE = [12, 30, 45, 50, 40, 30, 22, 16, 12, 9, 7, 5, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1];

/**
 * Whether this browser can send a real wheel move. Playwright's phone (Safari's engine as on an iPhone) cannot ("Mouse
 * wheel is not supported in mobile WebKit"), so there the journey hands the page the same wheel moves as events of its
 * own, which reach the feed's listener exactly as a trackpad's do in Safari on a Mac, but scroll nothing.
 */
const realWheel = (page: Page) => page.context().browser()?.browserType().name() !== "webkit";

/** One wheel move under the pointer, which the journey keeps over the middle of the screen unless it says otherwise. */
async function wheel(page: Page, dx: number, dy: number): Promise<void> {
  if (realWheel(page)) {
    await page.mouse.wheel(dx, dy);
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
  await page.evaluate(([px, py]) => ((window as unknown as { pointer: object }).pointer = { x: px, y: py }), [
    x,
    y,
  ] as [number, number]);
}

/** A two-finger swipe on the trackpad, under the pointer: the fingers go left (`"left"`) or right. */
async function trackpadSwipe(page: Page, way: "left" | "right"): Promise<void> {
  // The fingers going left scroll the page to the right: the wheel moves are the other way from the fingers.
  const sign = way === "left" ? 1 : -1;
  if (realWheel(page)) {
    for (const size of SWIPE) await wheel(page, sign * size, 0);
    return;
  }
  // The page's own events are stamped when the page makes them, not when the fingers moved, as a trackpad's are. Sent
  // one call at a time, a busy moment in the page (700 ms once in CI, run 46051556495) put a gap past the wheel's rest
  // inside the swipe, so the feed rightly took it as two swipes and moved two tabs. So the whole swipe goes in one call.
  await page.evaluate(
    ([sizes, side]) => {
      const { x, y } = (window as unknown as { pointer?: { x: number; y: number } }).pointer ?? {
        x: innerWidth / 2,
        y: innerHeight / 2,
      };
      for (const size of sizes) {
        const target = document.elementFromPoint(x, y) ?? document.body;
        target.dispatchEvent(
          new WheelEvent("wheel", { deltaX: side * size, bubbles: true, cancelable: true }),
        );
      }
    },
    [SWIPE, sign] as [number[], number],
  );
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
  // does not change the tab once the panel has gone either.
  await pointAt(page, width / 2, height / 2);
  const closing = await wheels(page);
  await sheet.getByRole("button", { name: "Close" }).click();
  await trackpadSwipe(page, "left");
  await expect(sheet).toBeHidden();
  const after = await wheels(page);
  expect(after.overPanel, "some of the swipe came while the panel slid away").toBeGreaterThan(
    closing.overPanel,
  );
  expect(after.passed).toBe(closing.passed);
  await onFresh();
  await expect(page).toHaveURL("/");
  expect(await page.evaluate(() => history.length)).toBe(pages);
});
