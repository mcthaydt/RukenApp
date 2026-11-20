import { describe, expect, it } from "vitest";
import { ratingLine, ratingWords, websitesWords } from "../../../src/features/games/games.ts";

// The small facts a game is laid out with on Check and send (spec 5b): who it is for, and which other
// websites it uses, in the words a maker reads.

describe("ratingWords", () => {
  it.each([
    ["age_3", "3+"],
    ["age_7", "7+"],
    ["age_12", "12+"],
    ["age_16", "16+"],
  ] as const)("writes %s as %s", (rating, words) => {
    expect(ratingWords(rating, [])).toBe(words);
  });

  it("names an 18+ game's marks, in one fixed order whatever order they were kept in", () => {
    expect(ratingWords("age_18", ["gore"])).toBe("18+ · Gore");
    expect(ratingWords("age_18", ["drugs", "sex_or_nudity"])).toBe("18+ · Sex or nudity, Drugs");
  });

  it("says 18+ alone for None of these, and for an 18+ game with no marks yet", () => {
    expect(ratingWords("age_18", ["none"])).toBe("18+");
    expect(ratingWords("age_18", [])).toBe("18+");
  });

  it("says nothing for a game that has not been asked yet", () => {
    expect(ratingWords(null, [])).toBeNull();
  });
});

describe("websitesWords", () => {
  it("says a game runs on its own when it names no website", () => {
    expect(websitesWords([])).toBe("Uses no other websites");
  });

  it("names every website the game uses", () => {
    expect(websitesWords(["api.example.com"])).toBe("Uses api.example.com");
    expect(websitesWords(["api.example.com", "cdn.example.net"])).toBe(
      "Uses api.example.com, cdn.example.net",
    );
  });
});

describe("ratingLine", () => {
  it.each([
    ["age_3", "Fine for anyone."],
    ["age_7", "Cartoon fighting, or a little scary."],
    ["age_12", "Real-looking fighting, or scary bits."],
    ["age_16", "More violence or strong words."],
    ["age_18", "Only for adults."],
  ] as const)("says %s as its plain line", (rating, line) => {
    expect(ratingLine(rating)).toBe(line);
  });
});
