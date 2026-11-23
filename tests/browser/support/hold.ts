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
      // The route is taken away while the held screen is still waiting, before it starts, never as it starts. The
      // screen's first move once let go is to fetch the root error page's script, which no page sends ahead of time;
      // taken away in that moment, the route left that one request stopped for good, so the screen never came alive
      // (runs 45067364220 and 45069502901: the release, then the route taken away 40 to 60 ms later, and no request
      // for `nodes/1` ever answered). Playwright, turning the route off, forgets a request the browser stopped for it
      // but had not yet told it about. So: everything the held page asked for has arrived, the route goes, and only
      // then is the screen let go, with no route left for its requests to pass through.
      await page.waitForLoadState("load");
      await page.unrouteAll({ behavior: "wait" });
      await page.evaluate(() => {
        (window as unknown as { __letItStart: () => void }).__letItStart();
      });
    },
  };
}
