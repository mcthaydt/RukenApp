import { describe, expect, it } from "vitest";
import { addressesReached, addressIsReached } from "../browser/support/changed-screens.ts";

// A draft walks only the screens its change reaches, and any doubt walks them all, so a screen is never skipped by
// accident. The walk's own journey is in tests/browser; this checks the choosing, which needs no browser.
describe("addressesReached", () => {
  it("places a page and its server file on the folder's address", () => {
    expect(
      addressesReached(["src/routes/me/delete/+page.svelte", "src/routes/me/delete/+page.server.ts"]),
    ).toEqual(["/me/delete"]);
  });

  it("lets a folder named in brackets stand for any word", () => {
    expect(addressesReached(["src/routes/make/[game]/[question=question]/+page.svelte"])).toEqual([
      "/make/*/*",
    ]);
  });

  it("places the front page on /", () => {
    expect(addressesReached(["src/routes/+page.svelte"])).toEqual(["/"]);
  });

  it("walks everything for a change it cannot place on a page", () => {
    expect(addressesReached(["src/lib/look.css"])).toBe("all");
    expect(addressesReached(["src/routes/me/+page.svelte", "src/lib/button.svelte"])).toBe("all");
    expect(addressesReached(["src/routes/+layout.svelte"])).toBe("all");
    expect(addressesReached(["src/routes/api/games/+server.ts"])).toBe("all");
  });

  it("walks everything when the walk's own helpers change", () => {
    expect(addressesReached(["tests/browser/support/screen-rules.ts"])).toBe("all");
    expect(addressesReached(["tests/fixtures/game.json"])).toBe("all");
  });

  it("ignores words and tests that no screen is made of", () => {
    expect(
      addressesReached([
        "docs/superpowers/progress.md",
        "tests/browser/pay.test.ts",
        "src/routes/me/+page.svelte",
      ]),
    ).toEqual(["/me"]);
  });

  it("walks everything when there is nothing to go on", () => {
    expect(addressesReached([])).toBe("all");
    expect(addressesReached(["README.md"])).toBe("all");
  });
});

describe("addressIsReached", () => {
  it("walks every screen when everything is reached", () => {
    expect(addressIsReached("/make/abc/check", "all")).toBe(true);
  });

  it("matches an address word for word, with * for any word", () => {
    expect(addressIsReached("/make/abc/check", ["/make/*/check"])).toBe(true);
    expect(addressIsReached("/make/abc/agreement", ["/make/*/check"])).toBe(false);
    expect(addressIsReached("/me", ["/me"])).toBe(true);
    expect(addressIsReached("/me/delete", ["/me"])).toBe(false);
    expect(addressIsReached("/", ["/"])).toBe(true);
  });

  it("does not let a game's own page reach the questions under it", () => {
    expect(addressIsReached("/make/abc/name", ["/make/*"])).toBe(false);
    expect(addressIsReached("/make/abc", ["/make/*"])).toBe(true);
  });
});
