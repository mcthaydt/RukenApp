import { describe, expect, it } from "vitest";
import { tasteSentence } from "../../../src/features/feed/taste-words.ts";

// Your feed's top line comes from a fixed template over the person's top moods and genres (learned feed spec 6.2).

describe("the line at the top of Your feed", () => {
  it("says the feed is still learning when it knows nothing yet", () => {
    expect(tasteSentence([])).toBe("Play a few games and we'll learn what you like.");
    expect(tasteSentence(["other", "not-a-word"])).toBe("Play a few games and we'll learn what you like.");
  });

  it("names one, two or the first three moods and genres, in plain words", () => {
    expect(tasteSentence(["cosy"])).toBe("Lately you've been into cosy games.");
    expect(tasteSentence(["cosy", "puzzle"])).toBe("Lately you've been into cosy and puzzle games.");
    expect(tasteSentence(["spooky", "adventure", "racing_sports", "bold"])).toBe(
      "Lately you've been into spooky, adventure and racing and sports games.",
    );
  });
});
