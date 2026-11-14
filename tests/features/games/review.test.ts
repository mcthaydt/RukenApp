import { describe, expect, it } from "vitest";
import { stateWords } from "../../../src/features/games/review.ts";

// A game's state in the maker's plain words (design 5.4): one case per line.

describe("stateWords", () => {
  it("says a draft has not been sent", () => {
    expect(stateWords({ state: "draft", stateReason: null, hasPending: false })).toBe("Not sent yet");
  });

  it("says a game waiting for its first yes is waiting for review", () => {
    expect(stateWords({ state: "waiting", stateReason: null, hasPending: true })).toBe("Waiting for review");
  });

  it("says a live game is live", () => {
    expect(stateWords({ state: "live", stateReason: null, hasPending: false })).toBe("Live");
  });

  it("says a live game's update is waiting, while its old files stay live", () => {
    expect(stateWords({ state: "live", stateReason: null, hasPending: true })).toBe(
      "Live. Your update is waiting for review",
    );
  });

  it("says a live game's update was sent back, and why", () => {
    expect(stateWords({ state: "live", stateReason: "The clip is sideways.", hasPending: false })).toBe(
      "Live. Your update was sent back: The clip is sideways.",
    );
  });

  it("says a new update waiting wins over an old reason", () => {
    expect(stateWords({ state: "live", stateReason: "Old reason.", hasPending: true })).toBe(
      "Live. Your update is waiting for review",
    );
  });

  it("says a game that was sent back, and why", () => {
    expect(stateWords({ state: "sent_back", stateReason: "Fix the sound.", hasPending: false })).toBe(
      "Sent back: Fix the sound.",
    );
  });

  it("says the maker took a game off Ruken themselves", () => {
    expect(stateWords({ state: "taken_off", stateReason: null, hasPending: false })).toBe(
      "Off Ruken. You took it off.",
    );
  });

  it("says a game staff took down, and why", () => {
    expect(stateWords({ state: "taken_down", stateReason: "It broke a rule.", hasPending: false })).toBe(
      "Taken down: It broke a rule.",
    );
  });
});
