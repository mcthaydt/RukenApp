import { expect, test, devices, type CDPSession, type Locator, type Page } from "@playwright/test";
import { addGame } from "./support/game.ts";
import { pageHasSettled } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Back from a game's page to the feed, then at once a swipe to the clip before (the owner, 2026-11-28, on a Galaxy:
// "the double feed swipe is back on restore from game page to feed", "i pressed back button, it happens every time",
// "it doesn't happen when I swipe up, only down"). While Back still slides, Chrome draws pictures of the pages over the
// page, and a finger that came down then landed on those pictures, so the swipe moved nothing and the next one moved.
//
// The journeys on a phone run Safari's engine, which takes no real finger from a test, and the swipe helper's touches
// (support/moves.ts) never scroll. So this journey runs Chrome's engine at a Galaxy's size and drags a real finger
// through the browser's own input (Chrome's DevTools), the way the owner's phone does. It runs once, in the phone piece.

const { userAgent, viewport, deviceScaleFactor, isMobile, hasTouch } = devices["Galaxy S24"];
test.use({ userAgent, viewport, deviceScaleFactor, isMobile, hasTouch, browserName: "chromium" });

/** Enough games for a clip above and below the one opened, whatever order the feed shows them in. */
const GAMES = 3;

test.beforeAll(async ({ browser, request }, testInfo) => {
  // One run is enough: the file is Chrome at a Galaxy's size whichever piece runs it.
  test.skip(testInfo.project.name !== "phone", "this journey runs once, in the phone piece");
  test.setTimeout(400_000);
  for (let made = 0; made < GAMES; made++) {
    await forgetRateLimits();
    await addGame(browser, request);
  }
});
test.beforeEach(forgetRateLimits);

/**
 * A finger dragged up or down the screen in eight moves, as a real touch the browser scrolls with. It goes past half the
 * screen, so it moves the feed on by its length and not only by its speed, and each move carries its own time, 16 ms
 * after the one before, so a slow machine sends the same swipe as a quick one.
 */
async function drag(page: Page, cdp: CDPSession, way: "down" | "up"): Promise<void> {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  const x = Math.round(width * 0.4);
  let y = Math.round(height * (way === "down" ? 0.15 : 0.85));
  const step = Math.round((height * 0.65) / 8) * (way === "down" ? 1 : -1);
  let timestamp = Date.now() / 1000;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }], timestamp });
  for (let move = 0; move < 8; move++) {
    y += step;
    timestamp += 0.016;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }], timestamp });
  }
  timestamp += 0.016;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp });
}

const slideRunning = (page: Page) =>
  page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          (one) =>
            (one.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition") === true,
        ).length > 0,
  );

/** Opens the game of the feed's third clip from its clip, and comes back with the browser's Back or the page's arrow. */
async function outAndBack(page: Page, clips: Locator, back: "browser" | "arrow"): Promise<void> {
  const on = clips.nth(2);
  await on.scrollIntoViewIfNeeded();
  await expect(on).toHaveAttribute("data-current", "true");
  await pageHasSettled(page);
  await on.locator("a.gamelink").tap();
  await expect(page).toHaveURL(/\/g\//);
  await expect(page.getByRole("link", { name: "Back to the feed" })).toBeVisible();
  await expect.poll(() => slideRunning(page)).toBe(false);
  if (back === "browser") await page.goBack({ waitUntil: "commit" });
  else await page.getByRole("link", { name: "Back to the feed" }).tap();
  // The swipe comes while Back still slides the feed in, as a quick thumb does.
  await expect
    .poll(async () => (await slideRunning(page)) && (await page.locator("main.feed").count()) > 0, {
      intervals: [10],
    })
    .toBe(true);
}

for (const back of ["browser", "arrow"] as const) {
  for (const way of ["down", "up"] as const) {
    test(`a swipe ${way} made as Back (${back}) slides in moves the feed one clip, once`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const cdp = await page.context().newCDPSession(page);
      await page.goto("/");
      await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
      const clips = page.locator("main.feed section[data-slug]");
      await expect.poll(() => clips.count()).toBeGreaterThanOrEqual(GAMES);
      // Four rounds: the owner saw it at random.
      for (let round = 1; round <= 4; round++) {
        const want = await clips.nth(way === "down" ? 1 : 3).getAttribute("data-slug");
        await outAndBack(page, clips, back);
        await drag(page, cdp, way);
        await expect(page).toHaveURL("/");
        await expect(
          page.locator("main.feed section[data-current=true]"),
          `round ${String(round)}`,
        ).toHaveAttribute("data-slug", want ?? "");
        // It comes to rest on that clip and stays there: no second move after the first.
        const atClip = () =>
          page.evaluate(() => {
            const feed = document.querySelector("main.feed");
            const on = feed?.querySelector("section[data-current=true]");
            return feed && on instanceof HTMLElement ? Math.round(feed.scrollTop - on.offsetTop) : null;
          });
        await expect
          .poll(atClip, { message: `round ${String(round)}: the feed comes to rest on the clip` })
          .toBe(0);
        await page.waitForTimeout(800);
        expect(await atClip(), `round ${String(round)}: the feed moved again after it came to rest`).toBe(0);
      }
    });
  }
}
