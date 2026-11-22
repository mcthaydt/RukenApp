import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every name Ruken gives a cookie or a browser-kept value is listed on the privacy page, so a new one cannot quietly
// go live without the page saying so. Ruken's own names all start "rk_"; the one that does not is checked by name.

const SRC = join(import.meta.dirname, "../../../src");
const PRIVACY_PAGE = readFileSync(join(SRC, "routes/privacy/+page.svelte"), "utf8");

/** Names in the code that never reach a browser on the real site, and why. */
const NOT_ON_THE_REAL_SITE: Record<string, string> = {
  // Stripe's own key prefixes (sk_live_, rk_live_), named in an error message about a wrong setting.
  rk_live_: "a Stripe key prefix",
  rk_test_: "a Stripe key prefix",
  // Only a test machine with LAUNCH_TEST_SWITCH on reads it (launch/now.ts); the real site refuses to start with it.
  rk_test_launch: "test machines only",
  // better-auth's other cookies, renamed in auth.ts. The cookie cache is off, so none of these is ever set.
  rk_session_data: "better-auth's cookie cache, which is off",
  rk_account_data: "better-auth's cookie cache, which is off",
  rk_dont_remember: "better-auth's 'don't remember me', which sign-in never asks for",
};

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|svelte)$/.test(name) ? [path] : [];
  });
}

function namesInCode(): string[] {
  const names = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    for (const match of readFileSync(file, "utf8").matchAll(/\brk_[a-z_]+/g)) names.add(match[0]);
  }
  return [...names].sort();
}

describe("the privacy page's cookie list", () => {
  it("finds the names it looks for, so an empty search cannot pass", () => {
    expect(namesInCode()).toContain("rk_session");
    expect(namesInCode()).toContain("rk_arrival");
  });

  it("names every rk_ cookie and browser-kept value the real site uses", () => {
    const missing = namesInCode().filter(
      (name) => !(name in NOT_ON_THE_REAL_SITE) && !PRIVACY_PAGE.includes(`<strong>${name}</strong>`),
    );
    expect(missing).toEqual([]);
  });

  it("names the maker area's thrown-away cookie", () => {
    const makePage = readFileSync(join(SRC, "routes/make/+page.server.ts"), "utf8");
    expect(makePage).toContain('const THROWN_AWAY = "thrown-away";');
    expect(PRIVACY_PAGE).toContain("<strong>thrown-away</strong>");
  });
});
