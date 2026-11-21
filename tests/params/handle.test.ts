import { describe, expect, it } from "vitest";
import { HANDLE_MAX } from "../../src/features/pages/handle.ts";
import { match } from "../../src/params/handle.ts";

// A maker's page is at `/<handle>`: the matcher lets through only a word with a maker's address shape (H1).

describe("the maker's address", () => {
  it.each(["night-owl", "a1b", "maker", "a".repeat(HANDLE_MAX)])("matches %s", (word) => {
    expect(match(word)).toBe(true);
  });

  // The words Ruken keeps still have the shape; the router gives them to their own screens, which are fixed paths.
  it.each(["make", "join"])("matches the shape of %s", (word) => {
    expect(match(word)).toBe(true);
  });

  it.each([
    "",
    "ab",
    "Night",
    "night.owl",
    "robots.txt",
    "-owl",
    "owl-",
    "night--owl",
    "büro",
    "a".repeat(HANDLE_MAX + 1),
  ])("does not match %j", (word) => {
    expect(match(word)).toBe(false);
  });
});
