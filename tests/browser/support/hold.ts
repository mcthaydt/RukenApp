import { expect, type Page } from "@playwright/test";

/**
 * Holds the next screen back from coming alive, so a journey can act on it first, for as long as it needs. The screen's
 * own start script waits for `release`: the page is passed on with that script told to wait inside the page, so nothing
 * depends on which script requests the browser lets a route see. Holding the script requests did not hold in Safari's
 * engine: after the first page, its script requests never reached the route (run 45041123880), and the screen came
 * alive unheld. `release` fails if the screen it was given was not held, and if it lets it go and the screen does not
 * come alive, saying how far its start script got.
 */
export async function holdNextScreen(page: Page): Promise<{ release: () => Promise<void> }> {
  // Where the start script is told to wait, and the later steps it notes as it goes, so a screen that never comes alive
  // says where it stopped (join.test.ts:82 on main's run 45053784947: let go, and never came alive, with no error shown).
  const waitHere = ".then(async (kit) => {";
  const appHere = "const app = await import(";
  const startHere = "kit.start(app,";
  const note = (step: string): string => `window.__heldSteps.push(${JSON.stringify(step)});`;
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
      for (const place of [waitHere, appHere, startHere])
        expect(html, `the screen's start script has "${place}"`).toContain(place);
      held = true;
      const wait = [
        "window.__heldSteps = window.__heldSteps || [];",
        'window.addEventListener("error", (event) => { window.__heldSteps.push(`error: ${event.message}`); });',
        'window.addEventListener("unhandledrejection", (event) => { window.__heldSteps.push(`rejected: ${String(event.reason)}`); });',
        note("held"),
        "await new Promise((go) => { window.__letItStart = go; });",
        note("let go"),
      ].join(" ");
      await route.fulfill({
        response,
        body: html
          .replace(waitHere, `${waitHere} ${wait}`)
          .replace(appHere, `${note("loading the app")} ${appHere}`)
          .replace(startHere, `${note("starting the app")} ${startHere}`),
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
      // The screen has come alive once SvelteKit has started: its announcer is on the page.
      try {
        await expect(page.locator("#svelte-announcer")).toBeAttached();
      } catch (error) {
        const steps = await page
          .evaluate(() => (window as unknown as { __heldSteps?: string[] }).__heldSteps ?? [])
          .catch((reason: unknown) => [`could not read the steps: ${String(reason)}`]);
        throw new Error(`the held screen did not come alive; its start script got to: ${steps.join(", ")}`, {
          cause: error,
        });
      }
    },
  };
}
