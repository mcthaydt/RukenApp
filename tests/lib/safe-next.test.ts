import { describe, expect, it } from "vitest";
import { safeNextPath } from "../../src/lib/safe-next.ts";

// `next` comes from the URL, so anyone can craft it. Only a path on our own origin may pass; anything
// else sends the person to the home page and never off the site.
describe("safeNextPath", () => {
  it.each(["/", "/me", "/join?plan=monthly", "/me?from=join#top"])(
    "keeps the same-origin path %j",
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    null,
    undefined,
    "",
    "me",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "https://evil.example/me",
    "javascript:alert(1)",
    "/me\n/evil",
    "/me\t",
    "/me/\u0000",
    " /me",
  ])("sends %j home instead", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });
});
