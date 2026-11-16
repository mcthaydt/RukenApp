import { describe, expect, it } from "vitest";
import {
  acceptAnywayWords,
  mustAskBeforeAccepting,
  playedWords,
  playersPlayedWords,
} from "../../../src/features/admin/admin.ts";

// What the check page says of the staff member's own play of the waiting files: "You've played it for 2 minutes."

describe("playedWords", () => {
  it.each([
    [0, "You haven't played it yet. Press inside the game to start."],
    [59, "You've played it for less than a minute."],
    [60, "You've played it for 1 minute."],
    [119, "You've played it for 1 minute."],
    [120, "You've played it for 2 minutes."],
    [3_600, "You've played it for 60 minutes."],
  ])("%d seconds says %s", (seconds, words) => {
    expect(playedWords(seconds)).toBe(words);
  });
});

// What an update's check page says of members' play of the game that is live (audit R-3 b): how a person sees that
// play time is recorded, until slice 5 gives it a home.

describe("playersPlayedWords", () => {
  it.each([
    [0, "Players haven't played it yet."],
    [59, "Players have played it for less than a minute."],
    [60, "Players have played it for 1 minute."],
    [120, "Players have played it for 2 minutes."],
  ])("%d seconds says %s", (seconds, words) => {
    expect(playersPlayedWords(seconds)).toBe(words);
  });
});

// Accept on a game nobody has played asks once (spec 11.1: staff play it; the Owner chose to ask, not to forbid).

describe("mustAskBeforeAccepting", () => {
  it.each([
    [0, false, true],
    // Said "anyway" already: never asked twice.
    [0, true, false],
    // Played at all: nothing to ask.
    [1, false, false],
    [600, false, false],
    [600, true, false],
  ])("%d seconds played, confirmed %s: asks %s", (seconds, confirmed, asks) => {
    expect(mustAskBeforeAccepting(seconds, confirmed)).toBe(asks);
  });
});

describe("acceptAnywayWords", () => {
  it("names the game and asks the question", () => {
    expect(acceptAnywayWords("Tiny game")).toBe(
      "You haven't played Tiny game yet. Press Back to play it, or press Accept it anyway.",
    );
  });
});
