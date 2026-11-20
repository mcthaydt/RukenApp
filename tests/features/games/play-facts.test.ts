import { describe, expect, it } from "vitest";
import { medianMs, playersWords, sittingWords } from "../../../src/features/games/play-facts.ts";

const MIN = 60_000;

describe("medianMs", () => {
  it("takes the middle of an odd list, in any order", () => {
    expect(medianMs([5, 1, 3])).toBe(3);
  });
  it("takes the point halfway between the two middle ones of an even list", () => {
    expect(medianMs([4, 1, 2, 10])).toBe(3);
  });
  it("is zero for no plays", () => {
    expect(medianMs([])).toBe(0);
  });
});

describe("sittingWords", () => {
  it.each([
    [90_000, "a minute or two"],
    [119_999, "a minute or two"],
    [120_000, "about 2 minutes"],
    [12 * MIN + 20_000, "about 12 minutes"],
    [15 * MIN, "about 15 minutes"],
    [16 * MIN, "about 15 minutes"],
    [37 * MIN, "about 35 minutes"],
    [60 * MIN, "about an hour"],
    [61 * MIN, "about an hour"],
    [80 * MIN, "about 1½ hours"],
    [105 * MIN, "about 2 hours"],
    [150 * MIN, "about 2½ hours"],
  ])("%i ms reads %s", (ms, words) => {
    expect(sittingWords(ms)).toBe(words);
  });
});

describe("playersWords", () => {
  it("says one person and many people", () => {
    expect(playersWords(1)).toBe("1 person played it this week.");
    expect(playersWords(214)).toBe("214 people played it this week.");
  });
});
