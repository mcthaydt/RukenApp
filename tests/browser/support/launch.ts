import type { BrowserContext } from "@playwright/test";
import { TEST_LAUNCH_COOKIE } from "../../../src/features/launch/now.ts";

// The journeys' site is open whatever the date (see src/features/launch/now.ts). These two make one browser see
// the site the day before launch, and back again.

/** The journeys' site, as playwright.config.ts starts it. */
const SITE = "http://localhost:4173";

/** From now on this browser's requests see the day before launch: Wishlist where Play would be. */
export async function beforeLaunch(context: BrowserContext): Promise<void> {
  await context.addCookies([{ name: TEST_LAUNCH_COOKIE, value: "before", url: SITE }]);
}

/** This browser sees the site as it is from 11:00 on launch day: Play. */
export async function atLaunch(context: BrowserContext): Promise<void> {
  await context.clearCookies({ name: TEST_LAUNCH_COOKIE });
}
