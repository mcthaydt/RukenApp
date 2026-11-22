import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled } from "./support/account.ts";
import { addGame, gameWhere } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The feed and a game being played are full-screen panels that work like an app on a phone (the owner, 2026-11-22: "the
// page scrolls when we swipe, it should scroll within the static panel", "holding the screen doesn't highlight the entire
// panel", "We should also not be able to zoom in to the panel"). A journey cannot make a real finger pan, pinch or hold
// in Safari's engine, so each check reads the rule the browser obeys for that gesture. A reading screen keeps its
// words selectable and a pinch still zooms it.

let free: Awaited<ReturnType<typeof addGame>>;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  await forgetRateLimits();
  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    await gameWhere(await context.newPage(), { state: "live" });
  } finally {
    await context.close();
  }
  free = await addGame(browser, request, { free: true });
});
test.beforeEach(forgetRateLimits);

/** What the browser will do with a finger on the page and on one element of it. */
async function touchRules(page: Page, selector: string) {
  return await page.evaluate((selector) => {
    const page = getComputedStyle(document.documentElement);
    const panel = document.querySelector(selector);
    if (panel === null) throw new Error(`no ${selector}`);
    const look = getComputedStyle(panel);
    return {
      pageOverflow: page.overflow,
      pageBounce: page.overscrollBehaviorY,
      gestures: look.touchAction,
      select: look.userSelect,
      holdMenu: look.getPropertyValue("-webkit-touch-callout") || "none",
      pressFlash: look.getPropertyValue("-webkit-tap-highlight-color") || "rgba(0, 0, 0, 0)",
    };
  }, selector);
}

test("a swipe on the feed moves only the feed: the page behind never scrolls, bounces or zooms", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  const rules = await touchRules(page, "main.feed");
  // The page behind the feed cannot scroll, so a phone's address bar showing or hiding never lets it slide under the
  // swipe, and it never bounces or pulls to refresh at the first or last game.
  expect(rules.pageOverflow).toBe("hidden");
  expect(rules.pageBounce).toBe("none");
  // Up and down only: no pinch and no double-tap zoom.
  expect(rules.gestures).toBe("pan-y");
});

test("holding a finger on the feed selects nothing, flashes nothing and opens no menu", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  const rules = await touchRules(page, "main.feed");
  expect(rules.select).toBe("none");
  expect(rules.holdMenu).toBe("none");
  expect(rules.pressFlash).toBe("rgba(0, 0, 0, 0)");
});

test("a game being played is a panel too: the page never scrolls or zooms and the Menu tab is never selected", async ({
  page,
}) => {
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  const rules = await touchRules(page, "main.playing");
  expect(rules.pageOverflow).toBe("hidden");
  expect(rules.pageBounce).toBe("none");
  // Both directions still pan, so a game that scrolls itself still can; only zooming is off.
  expect(rules.gestures).toBe("pan-x pan-y");
  expect(rules.select).toBe("none");
  expect(rules.holdMenu).toBe("none");
  expect(rules.pressFlash).toBe("rgba(0, 0, 0, 0)");
});

test("every screen feels like an app: no grey flash, no double-tap zoom, no bounce, no held menus on links and pictures", async ({
  page,
}) => {
  await page.goto("/help");
  const rules = await page.evaluate(() => {
    const look = (element: Element) => getComputedStyle(element);
    const html = look(document.documentElement);
    const link = look(document.querySelector("main a") as Element);
    const words = look(document.querySelector("main p") as Element);
    const picture = document.createElement("img");
    document.body.appendChild(picture);
    return {
      pageOverflow: html.overflow,
      pageBounce: html.overscrollBehaviorY,
      gestures: html.touchAction,
      pressFlash: html.getPropertyValue("-webkit-tap-highlight-color") || "rgba(0, 0, 0, 0)",
      linkSelect: link.userSelect,
      linkHoldMenu: link.getPropertyValue("-webkit-touch-callout") || "none",
      wordsSelect: words.userSelect,
      pictureDrag: look(picture).getPropertyValue("-webkit-user-drag") || "none",
    };
  });
  // A reading screen still scrolls, and a pinch still zooms it; a double tap does not.
  expect(rules.pageOverflow).toBe("visible");
  expect(rules.gestures).toBe("manipulation");
  expect(rules.pageBounce).toBe("none");
  expect(rules.pressFlash).toBe("rgba(0, 0, 0, 0)");
  expect(rules.linkSelect).toBe("none");
  expect(rules.linkHoldMenu).toBe("none");
  expect(rules.pictureDrag).toBe("none");
  // Its words can still be selected and copied.
  expect(rules.wordsSelect).not.toBe("none");
});
