import { describe, expect, it } from "vitest";
import { playedWords } from "../../../src/features/admin/admin.ts";

describe("playedWords", () => {
  it.each([
    [0, "Played so far: nothing counted yet."],
    [59, "Played so far: less than a minute counted."],
    [60, "Played so far: 1 minute counted."],
    [119, "Played so far: 1 minute counted."],
    [120, "Played so far: 2 minutes counted."],
    [3_600, "Played so far: 60 minutes counted."],
  ])("%d seconds says %s", (seconds, words) => {
    expect(playedWords(seconds)).toBe(words);
  });
});
