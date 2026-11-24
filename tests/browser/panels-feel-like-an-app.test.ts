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

/**
 * Whether the site's own style sheets declare `property: value` for this element. The held-finger menu
 * (`-webkit-touch-callout`) and a picture's drag (`-webkit-user-drag`) are Safari's own: a browser that lacks one drops
 * it when it reads the sheet, so its computed style says nothing. So the sheets are read as the site sent them.
 */
async function declares(page: Page, selector: string, property: string, value: string): Promise<boolean> {
  return await page.evaluate(
    async ({ selector, property, value }) => {
      const element = document.querySelector(selector);
      if (element === null) throw new Error(`no ${selector}`);
      const sheets = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
      const texts = await Promise.all(sheets.map(async (sheet) => await (await fetch(sheet.href)).text()));
      texts.push(...[...document.querySelectorAll("style")].map((style) => style.textContent));
      const wanted = new RegExp(`(^|[;\\s])${property}\\s*:\\s*${value}\\s*(;|$)`);
      for (const text of texts) {
        const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, "");
        for (const rule of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
          const [, rawSelector = "", body = ""] = rule;
          if (!wanted.test(body.trim())) continue;
          try {
            if (element.matches(rawSelector.trim())) return true;
          } catch {
            // Not a selector this browser reads, such as an @-rule's own words.
          }
        }
      }
      return false;
    },
    { selector, property, value },
  );
}

/** What the browser will do with a finger on the page and on one element of it. */
async function touchRules(page: Page, selector: string) {
  const computed = await page.evaluate((selector) => {
    const page = getComputedStyle(document.documentElement);
    const panel = document.querySelector(selector);
    if (panel === null) throw new Error(`no ${selector}`);
    const look = getComputedStyle(panel);
    return {
      pageOverflow: page.overflow,
      pageBounce: page.overscrollBehaviorY,
      panelBounce: look.overscrollBehaviorY,
      gestures: look.touchAction,
      select: look.userSelect,
      pressFlash: look.getPropertyValue("-webkit-tap-highlight-color"),
    };
  }, selector);
  return { ...computed, noHoldMenu: await declares(page, selector, "-webkit-touch-callout", "none") };
}

test("a swipe on the feed moves only the feed: the page behind never scrolls, bounces or zooms", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  const rules = await touchRules(page, "main.feed");
  // The page behind the feed cannot scroll, so a phone's address bar showing or hiding never lets it slide under the
  // swipe, and it never bounces or pulls to refresh at the first or last game. The feed itself does not bounce either.
  expect(rules.pageOverflow).toBe("hidden");
  expect(rules.pageBounce).toBe("none");
  expect(rules.panelBounce).toBe("none");
  // Up and down only: no pinch and no double-tap zoom.
  expect(rules.gestures).toBe("pan-y");
});

test("holding a finger on the feed selects nothing, flashes nothing and opens no menu", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  const rules = await touchRules(page, "main.feed");
  expect(rules.select).toBe("none");
  expect(rules.noHoldMenu).toBe(true);
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
  expect(rules.noHoldMenu).toBe(true);
  expect(rules.pressFlash).toBe("rgba(0, 0, 0, 0)");
});

test("every screen feels like an app: no grey flash, no double-tap zoom, no bounce, no held menus on links and pictures", async ({
  page,
}) => {
  await page.goto("/help/get-your-game-on-ruken");
  await pageHasSettled(page);
  // A picture and a button of the site's own kind, so the screen has one of each whatever it shows on this device.
  await page.evaluate(() => {
    const main = document.querySelector("main");
    main?.appendChild(document.createElement("img"));
    main?.appendChild(document.createElement("button"));
  });
  const rules = await page.evaluate(() => {
    const look = (selector: string) => {
      const element = document.querySelector(selector);
      if (element === null) throw new Error(`no ${selector} on ${location.pathname}`);
      return getComputedStyle(element);
    };
    const html = look("html");
    return {
      pageOverflow: html.overflow,
      viewOverflow: look("body").overflowY,
      pageBounce: html.overscrollBehaviorY,
      gestures: html.touchAction,
      pressFlash: html.getPropertyValue("-webkit-tap-highlight-color"),
      buttonSelect: look("main button").userSelect,
      linkSelect: look("main p a").userSelect,
      wordsSelect: look("main p").userSelect,
    };
  });
  // A reading screen still scrolls, inside its own view (the body; the page around it never scrolls, so it works like
  // an app's one window: fits-the-screen.test.ts), and a pinch still zooms it; a double tap does not.
  expect(rules.pageOverflow).toBe("hidden");
  expect(rules.viewOverflow).toBe("auto");
  await page.evaluate(() => {
    document.body.scrollTo(0, 200);
  });
  await expect.poll(() => page.evaluate(() => document.body.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(rules.gestures).toBe("manipulation");
  expect(rules.pageBounce).toBe("none");
  expect(rules.pressFlash).toBe("rgba(0, 0, 0, 0)");
  // A button is pressed, never selected; a held link or picture opens no menu, and a picture is never dragged.
  expect(rules.buttonSelect).toBe("none");
  expect(await declares(page, "main p a", "-webkit-touch-callout", "none")).toBe(true);
  expect(await declares(page, "main img", "-webkit-touch-callout", "none")).toBe(true);
  expect(await declares(page, "main img", "-webkit-user-drag", "none")).toBe(true);
  // Its words, links among them, can still be selected and copied.
  expect(rules.wordsSelect).not.toBe("none");
  expect(rules.linkSelect).not.toBe("none");
});
