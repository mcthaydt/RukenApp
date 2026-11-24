import type { Page } from "@playwright/test";

/**
 * Makes the page believe it was opened from the Home Screen, as an installed app (display-mode standalone).
 *
 * A phone held sideways in a browser tab is asked to turn upright (src/lib/turn-upright.svelte); opened from the Home
 * Screen it works sideways. Playwright always opens a tab, and neither engine lets a journey switch the display mode,
 * so the journeys that look at the sideways screens answer the page's one question, matchMedia("(display-mode:
 * standalone)"), as an installed app's browser would. Every other media query is the browser's own.
 */
export async function asInstalled(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const own = window.matchMedia.bind(window);
    window.matchMedia = (query: string): MediaQueryList => {
      if (!/display-mode:\s*standalone/.test(query)) return own(query);
      const installed = Object.create(own(query)) as MediaQueryList;
      Object.defineProperty(installed, "matches", { value: true });
      return installed;
    };
  });
}
