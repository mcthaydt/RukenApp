import { describe, expect, it } from "vitest";
import { normalizePath } from "../../../src/lib/files/safe-path.ts";

describe("normalizePath", () => {
  it("answers a plain path as it is", () => {
    expect(normalizePath("js/main.js")).toBe("js/main.js");
  });

  it("answers an empty path as empty: the game's own folder", () => {
    expect(normalizePath("")).toBe("");
  });

  it("decodes percent-escapes once", () => {
    expect(normalizePath("a%20b.js")).toBe("a b.js");
    // A second decode would turn this into a space; it must stay what one decode makes it.
    expect(normalizePath("a%2520b.js")).toBe("a%20b.js");
  });

  it("stores a name in its composed Unicode form", () => {
    expect(normalizePath("cafe%CC%81.png")).toBe("café.png");
  });

  // Review Focus 2: nothing may climb out of a game's folder, or name another file than it seems to.
  it.each(["../x", "a/../../x", "a//b", "a/./b", "a\\b", "%2e%2e/x", "a%2fb", "a%5cb", "a%00b", "%E0%A4%A"])(
    "refuses %j",
    (raw) => {
      expect(normalizePath(raw)).toBeNull();
    },
  );
});
