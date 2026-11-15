import { describe, expect, it } from "vitest";
import { waitedWords } from "../../../src/features/admin/admin.ts";

// How long a game has waited, in the words the list says it ("waited 2 hours"): whole numbers, rounded down, and never
// "waited 0 minutes".

const SENT = new Date("2026-11-15T12:00:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("waitedWords", () => {
  it.each([
    [0, "waited 1 minute"],
    [59_999, "waited 1 minute"],
    [2 * MINUTE, "waited 2 minutes"],
    [59 * MINUTE, "waited 59 minutes"],
    [60 * MINUTE, "waited 1 hour"],
    [2 * HOUR + 59 * MINUTE, "waited 2 hours"],
    [47 * HOUR, "waited 47 hours"],
    [48 * HOUR, "waited 2 days"],
    [3 * 24 * HOUR + 23 * HOUR, "waited 3 days"],
  ])("%d ms is %s", (ms, words) => {
    expect(waitedWords(SENT, SENT.getTime() + ms)).toBe(words);
  });

  it("never goes below one minute, even for a game sent a moment ahead of the clock", () => {
    expect(waitedWords(SENT, SENT.getTime() - 5_000)).toBe("waited 1 minute");
  });
});
