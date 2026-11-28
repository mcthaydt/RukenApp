import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Every cookie and browser-kept value Ruken sets is listed on the privacy page, so a new one cannot quietly go live
// without the page saying so. Two nets catch them: every "rk_" name in the code, and the name handed to every
// `cookies.set(` and `localStorage.setItem(` / `sessionStorage.setItem(` call, whatever its prefix.

const SRC = join(import.meta.dirname, "../../../src");
const PRIVACY_PAGE = readFileSync(join(SRC, "routes/privacy/+page.svelte"), "utf8");

/** Names in the code that never reach a browser on the real site, and why. */
const NOT_ON_THE_REAL_SITE: Record<string, string> = {
  // Stripe's own key prefixes (sk_live_, rk_live_), named in an error message about a wrong setting.
  rk_live_: "a Stripe key prefix",
  rk_test_: "a Stripe key prefix",
  // Only a test machine with LAUNCH_TEST_SWITCH on reads it (launch/now.ts); the real site refuses to start with it.
  rk_test_launch: "test machines only",
  // Only a test machine with PAGES_TEST_SWITCH on reads it (pages/editor-switch.ts); the real site refuses to start with it.
  rk_test_pages: "test machines only",
  // better-auth's other cookies, renamed in auth.ts. The cookie cache is off, so none of these is ever set.
  rk_session_data: "better-auth's cookie cache, which is off",
  rk_account_data: "better-auth's cookie cache, which is off",
  rk_dont_remember: "better-auth's 'don't remember me', which sign-in never asks for",
};

/**
 * Calls whose name is not written where they are made, and which cookie each one is. Anything else that cannot be
 * read to a name fails the check, so a new call of this kind has to be named here, and on the page.
 */
const PASSED_THROUGH: Record<string, string> = {
  // Copies better-auth's own Set-Cookie lines across: the session cookie, listed as rk_session.
  "features/accounts/cookies.ts name": "rk_session",
  // Clears the session cookie when a sign-up cannot finish.
  "features/accounts/forms.ts deps.cookies.sessionCookieName": "rk_session",
  // The device store keeps the browser-only values (rk_seen_hints, rk_menu_tab) by the key it is handed, and only after a yes.
  "features/consent/device-store.ts key": "rk_seen_hints",
};

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|svelte)$/.test(name) ? [path] : [];
  });
}

const FILES = sourceFiles(SRC).map((path) => ({
  name: relative(SRC, path).replaceAll("\\", "/"),
  text: readFileSync(path, "utf8"),
}));

/** Every `const NAME = "value"` in the code, so a call that names a constant can be read to its value. */
function constants(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of FILES) {
    for (const match of file.text.matchAll(/\bconst ([A-Z_][A-Z0-9_]*) = "([^"]+)"/g)) {
      found.set(`${file.name} ${match[1] ?? ""}`, match[2] ?? "");
      found.set(match[1] ?? "", match[2] ?? "");
    }
  }
  return found;
}

function rkNames(): string[] {
  const names = new Set<string>();
  for (const file of FILES) for (const match of file.text.matchAll(/\brk_[a-z_]+/g)) names.add(match[0]);
  return [...names].sort();
}

/** The name each set call is handed, read through constants; `?` marks one that cannot be read. */
function setNames(): { where: string; name: string }[] {
  const known = constants();
  const calls: { where: string; name: string }[] = [];
  for (const file of FILES) {
    for (const match of file.text.matchAll(
      /(?:cookies\.set|(?:local|session)Storage\.setItem)\(\s*([^,]+?)\s*,/g,
    )) {
      const argument = match[1] ?? "";
      const literal = /^["'`]([^"'`$]+)["'`]$/.exec(argument)?.[1];
      const name =
        literal ??
        PASSED_THROUGH[`${file.name} ${argument}`] ??
        known.get(`${file.name} ${argument}`) ??
        known.get(argument) ??
        `? ${argument}`;
      calls.push({ where: file.name, name });
    }
  }
  return calls;
}

const listed = (name: string) => PRIVACY_PAGE.includes(`<strong>${name}</strong>`);

describe("the privacy page's cookie list", () => {
  it("finds the names it looks for, so an empty search cannot pass", () => {
    expect(rkNames()).toContain("rk_session");
    expect(setNames().map((call) => call.name)).toEqual(
      expect.arrayContaining(["rk_arrival", "ruken_sign_up", "page-saved", "thrown-away", "rk_consent"]),
    );
  });

  it("names every rk_ cookie and browser-kept value the real site uses", () => {
    const missing = rkNames().filter((name) => !(name in NOT_ON_THE_REAL_SITE) && !listed(name));
    expect(missing).toEqual([]);
  });

  it("names the cookie or value behind every set call, whatever it is called", () => {
    const missing = setNames().filter((call) => !listed(call.name));
    expect(missing).toEqual([]);
  });
});
