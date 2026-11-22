// Nearly every journey signs in or plays, which waits for a yes to cookies (design: cookie consent). So a browser the
// journeys open starts out having said yes, with the one cookie the notice would set. The one journey about the notice,
// tests/browser/cookie-consent.test.ts, opens a browser that has not (`test.use({ storageState: NOT_CONSENTED })`).
// Playwright's own `page` and `request` get this from playwright.config.ts; a browser a journey opens itself with
// `browser.newContext(...)` takes `...consented` (they do not inherit it).
import type { BrowserContextOptions } from "@playwright/test";

type State = NonNullable<Exclude<BrowserContextOptions["storageState"], string>>;

/** The cookie the notice sets on "I agree", as the site on localhost sets it (no Secure on http). */
export const CONSENTED_STATE: State = {
  cookies: [
    {
      name: "rk_consent",
      value: "v1.2026-11-22",
      domain: "localhost",
      path: "/",
      expires: -1,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ],
  origins: [],
};

/** A browser that has said nothing. */
export const NOT_CONSENTED: State = { cookies: [], origins: [] };

export const consented = { storageState: CONSENTED_STATE } as const;
