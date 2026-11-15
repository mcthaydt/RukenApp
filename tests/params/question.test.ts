import { describe, expect, it } from "vitest";
import { match } from "../../src/params/question.ts";

// The address of a game's question, `/make/<game>/<question>`, matches only the nine words a question is asked by
// (spec 8), so `check`, `agreement` and `throw-away` stay the routes of their own and a made-up word is a 404.

describe("the question address", () => {
  it.each(["name", "line", "files", "plays-on", "upright", "wide", "age", "marks", "websites"])(
    "matches %s",
    (word) => {
      expect(match(word)).toBe(true);
    },
  );

  it.each(["check", "agreement", "throw-away", "new", "github", "", "Name", "line/", "nope"])(
    "does not match %j",
    (word) => {
      expect(match(word)).toBe(false);
    },
  );
});
