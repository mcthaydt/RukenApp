import { expect, test, type CDPSession, type Locator, type Page } from "@playwright/test";
import { addGame } from "./support/game.ts";
import { pageHasSettled } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Back from a game's page to the feed, then at once a trackpad or mouse-wheel scroll (the review of the owner's Galaxy
// fix, 2026-11-28: a finger no longer lands on the pictures Chrome draws while Back slides, but a wheel still did, and
// the scroll moved nothing). The wheel goes through the browser's own input (Chrome's DevTools), as a real one does.
// It runs once, in the computer piece, which is Chrome.

/** Enough games for a clip above and below the one opened, whatever order the feed shows them in. */
const GAMES = 3;

test.beforeAll(async ({ browser, request }, testInfo) => {
  test.skip(testInfo.project.name !== "computer", "this journey runs once, in the computer piece");
  test.setTimeout(400_000);
  for (let made = 0; made < GAMES; made++) {
    await forgetRateLimits();
    await addGame(browser, request);
  }
});
test.beforeEach(forgetRateLimits);

/** Six notches of the wheel, down (to the next clip) or up (to the one before). */
async function wheel(page: Page, cdp: CDPSession, way: "down" | "up"): Promise<void> {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  for (let notch = 0; notch < 6; notch++) {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: Math.round(width / 2),
      y: Math.round(height / 2),
      deltaX: 0,
      deltaY: way === "down" ? 120 : -120,
    });
  }
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
  await on.locator("a.gamelink").click();
  await expect(page).toHaveURL(/\/g\//);
  await expect(page.getByRole("link", { name: "Back to the feed" })).toBeVisible();
  await expect.poll(() => slideRunning(page)).toBe(false);
  if (back === "browser") await page.goBack({ waitUntil: "commit" });
  else await page.getByRole("link", { name: "Back to the feed" }).click();
  // The wheel turns while Back still slides the feed in.
  await expect
    .poll(async () => (await slideRunning(page)) && (await page.locator("main.feed").count()) > 0, {
      intervals: [10],
    })
    .toBe(true);
}

for (const back of ["browser", "arrow"] as const) {
  for (const way of ["down", "up"] as const) {
    test(`a wheel scroll ${way} made as Back (${back}) slides in moves the feed one clip, once`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const cdp = await page.context().newCDPSession(page);
      await page.goto("/");
      await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
      const clips = page.locator("main.feed section[data-slug]");
      await expect.poll(() => clips.count()).toBeGreaterThanOrEqual(GAMES);
      for (let round = 1; round <= 4; round++) {
        const want = await clips.nth(way === "down" ? 3 : 1).getAttribute("data-slug");
        await outAndBack(page, clips, back);
        await wheel(page, cdp, way);
        await expect(page).toHaveURL("/");
        await expect(
          page.locator("main.feed section[data-current=true]"),
          `round ${String(round)}`,
        ).toHaveAttribute("data-slug", want ?? "");
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
