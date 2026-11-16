import { describe, expect, it } from "vitest";
import { playedWords } from "../../../src/features/admin/admin.ts";

// What the check page says of the staff member's own play of the waiting files: "You've played it for 2 minutes."

describe("playedWords", () => {
  it.each([
    [0, "You haven't played it yet."],
    [59, "You've played it for less than a minute."],
    [60, "You've played it for 1 minute."],
    [119, "You've played it for 1 minute."],
    [120, "You've played it for 2 minutes."],
    [3_600, "You've played it for 60 minutes."],
  ])("%d seconds says %s", (seconds, words) => {
    expect(playedWords(seconds)).toBe(words);
  });
});
