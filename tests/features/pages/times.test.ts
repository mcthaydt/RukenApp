import { describe, expect, it } from "vitest";
import { timesWords, linksWords } from "../../../src/features/pages/times.ts";

describe("timesWords", () => {
  it.each([
    [0, "0 times"],
    [1, "1 time"],
    [2, "2 times"],
    [12, "12 times"],
    [1204, "1,204 times"],
  ])("says %i as %j", (count, words) => {
    expect(timesWords(count)).toBe(words);
  });
});

describe("linksWords", () => {
  it.each([
    [0, "No links yet"],
    [1, "1 link"],
    [3, "3 links"],
  ])("says %i as %j", (count, words) => {
    expect(linksWords(count)).toBe(words);
  });
});
