import { describe, expect, it } from "vitest";
import { waitedWords } from "../../../src/features/admin/admin.ts";

// How long a game has waited, in the words the list says it ("Waiting 2 hours"): whole numbers, rounded down, and never
// "Waiting 0 minutes". It starts with a capital because it ends a line of dots on a card, and reads as a short sentence.

const SENT = new Date("2026-11-15T12:00:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("waitedWords", () => {
  it.each([
    [0, "Waiting 1 minute"],
    [59_999, "Waiting 1 minute"],
    [2 * MINUTE, "Waiting 2 minutes"],
    [59 * MINUTE, "Waiting 59 minutes"],
    [60 * MINUTE, "Waiting 1 hour"],
    [2 * HOUR + 59 * MINUTE, "Waiting 2 hours"],
    [47 * HOUR, "Waiting 47 hours"],
    [48 * HOUR, "Waiting 2 days"],
    [3 * 24 * HOUR + 23 * HOUR, "Waiting 3 days"],
  ])("%d ms is %s", (ms, words) => {
    expect(waitedWords(SENT, SENT.getTime() + ms)).toBe(words);
  });

  it("never goes below one minute, even for a game sent a moment ahead of the clock", () => {
    expect(waitedWords(SENT, SENT.getTime() - 5_000)).toBe("Waiting 1 minute");
  });
});
