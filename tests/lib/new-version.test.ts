import { describe, expect, it } from "vitest";
import { loadsAgainOnReturn, movesAsPageLoad } from "../../src/lib/new-version.ts";

describe("loadsAgainOnReturn", () => {
  it("loads the feed's tabs again", () => {
    for (const route of ["/", "/followed", "/your-turn"]) expect(loadsAgainOnReturn(route)).toBe(true);
  });

  it("leaves every other screen as it is", () => {
    for (const route of [
      "/g/[game]",
      "/g/[game]/play",
      "/me",
      "/search",
      "/make/[game]/[question=question]",
      null,
    ])
      expect(loadsAgainOnReturn(route)).toBe(false);
  });
});

describe("movesAsPageLoad", () => {
  const here = "https://ruken.io";
  const move = { willUnload: false, type: "link", to: new URL("https://ruken.io/me"), here };

  it("makes a move inside the app a page load once a newer version is out", () => {
    expect(movesAsPageLoad(true, move)).toBe(true);
    expect(movesAsPageLoad(true, { ...move, type: "goto" })).toBe(true);
  });

  it("leaves moves alone while this is the newest version", () => {
    expect(movesAsPageLoad(false, move)).toBe(false);
  });

  it("leaves Back, a page load already under way and other sites alone", () => {
    expect(movesAsPageLoad(true, { ...move, type: "popstate" })).toBe(false);
    expect(movesAsPageLoad(true, { ...move, willUnload: true })).toBe(false);
    expect(movesAsPageLoad(true, { ...move, to: new URL("https://example.com/") })).toBe(false);
    expect(movesAsPageLoad(true, { ...move, to: null })).toBe(false);
  });
});
