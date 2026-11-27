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

/** A two-finger swipe on the trackpad, over the middle of the screen: the fingers go left (`"left"`) or right. */
async function trackpadSwipe(page: Page, way: "left" | "right"): Promise<void> {
  // The fingers going left scroll the page to the right: the wheel moves are the other way from the fingers.
  const sign = way === "left" ? 1 : -1;
  for (const size of SWIPE) await page.mouse.wheel(sign * size, 0);
}

/** Every sideways wheel move the browser was left to act on, counted once the page has answered it. */
async function watchWheel(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const count = { sideways: 0, passed: 0, upDown: 0, upDownStopped: 0 };
    (window as unknown as { wheels: typeof count }).wheels = count;
    window.addEventListener(
      "wheel",
      (event) => {
        // Read after every listener on the way has had its turn.
        setTimeout(() => {
          if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            count.sideways += 1;
            if (!event.defaultPrevented) count.passed += 1;
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
          wheels: { sideways: number; passed: number; upDown: number; upDownStopped: number };
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
  await page.mouse.move(width / 2, height / 2);
  const onFresh = () => expect(tab(page, "Fresh")).toHaveAttribute("aria-current", "page");
  const onFollowed = () => expect(tab(page, "Followed")).toHaveAttribute("aria-current", "page");

  // Up and down on the trackpad still scrolls the clips, and never changes the tab.
  const first = page.locator("main.feed section").first();
  await expect(first).toHaveAttribute("data-current", "true");
  await page.mouse.wheel(0, height);
  await expect(first).toHaveAttribute("data-current", "false");
  await page.mouse.wheel(0, -height);
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
    .toEqual({ sideways: 3 * SWIPE.length, passed: 0, upDown: expect.any(Number), upDownStopped: 0 });
});
