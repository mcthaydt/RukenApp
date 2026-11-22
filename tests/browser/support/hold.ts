import { expect, type Page } from "@playwright/test";

/**
 * Holds the next screen back from coming alive, so a journey can act on it first, for as long as it needs. The screen's
 * own start script waits for `release`: the page is passed on with that script told to wait inside the page, so nothing
 * depends on which script requests the browser lets a route see. Holding the script requests did not hold in Safari's
 * engine: after the first page, its script requests never reached the route (run 45041123880), and the screen came
 * alive unheld. `release` fails if the screen it was given was not held.
 */
export async function holdNextScreen(page: Page): Promise<{ release: () => Promise<void> }> {
  const waitHere = ".then(async (kit) => {";
  let held = false;
  await page.route(
    (address) => !held && !address.pathname.startsWith("/_app/"),
    async (route) => {
      if (held || !route.request().isNavigationRequest()) {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      const html = await response.text();
      expect(html, "the screen has a start script to hold").toContain(waitHere);
      held = true;
      await route.fulfill({
        response,
        body: html.replace(waitHere, `${waitHere} await new Promise((go) => { window.__letItStart = go; });`),
      });
    },
  );
  return {
    async release() {
      await page.waitForFunction(() => "__letItStart" in window, undefined, { timeout: 15_000 });
      await page.evaluate(() => {
        (window as unknown as { __letItStart: () => void }).__letItStart();
      });
      await page.unrouteAll({ behavior: "wait" });
    },
  };
}
