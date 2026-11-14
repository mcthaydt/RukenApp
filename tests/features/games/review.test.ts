import { describe, expect, it } from "vitest";
import {
  beforeSendWords,
  listWords,
  nextStepWords,
  stateParts,
  stateWords,
} from "../../../src/features/games/review.ts";

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

// The game's own page shows the state and staff's reason apart (review F9), so a reason is never set as a headline.
describe("stateParts", () => {
  const parts = (
    state: Parameters<typeof stateParts>[0]["state"],
    stateReason: string | null,
    hasPending = false,
  ) => stateParts({ state, stateReason, hasPending });

  it("gives a headline and no reason for the states that have none", () => {
    expect(parts("draft", null)).toEqual({ headline: "Not sent yet", reason: null });
    expect(parts("waiting", null, true)).toEqual({ headline: "Waiting for review", reason: null });
    expect(parts("live", null)).toEqual({ headline: "Live", reason: null });
    expect(parts("taken_off", null)).toEqual({ headline: "Off Ruken. You took it off.", reason: null });
  });

  it("gives staff's reason apart from the headline", () => {
    expect(parts("sent_back", "Fix the sound.")).toEqual({ headline: "Sent back", reason: "Fix the sound." });
    expect(parts("taken_down", "It broke a rule.")).toEqual({
      headline: "Taken down",
      reason: "It broke a rule.",
    });
    expect(parts("live", "The clip is sideways.")).toEqual({
      headline: "Live. Your update was sent back",
      reason: "The clip is sideways.",
    });
  });

  it("says a live game's update is waiting, with no old reason", () => {
    expect(parts("live", "Old reason.", true)).toEqual({
      headline: "Live. Your update is waiting for review",
      reason: null,
    });
  });

  it("is what stateWords says in one line", () => {
    expect(stateWords({ state: "sent_back", stateReason: "Fix the sound.", hasPending: false })).toBe(
      "Sent back: Fix the sound.",
    );
  });
});

// The second line of each game in Your games: where it stands and what to do, never staff's whole reason (review F11).
describe("listWords", () => {
  const base = { stateReason: null, hasPending: false, filesProblem: false, bothVideos: false };

  it("tells a draft its next step", () => {
    expect(listWords({ ...base, state: "draft" })).toBe("Not sent yet. Add your videos.");
    expect(listWords({ ...base, state: "draft", filesProblem: true })).toBe(
      "Not sent yet. Fix your game's files.",
    );
    expect(listWords({ ...base, state: "draft", bothVideos: true })).toBe(
      "Not sent yet. Send it for review.",
    );
  });

  it("points a game that was sent back at its page, without the reason", () => {
    expect(listWords({ ...base, state: "sent_back", stateReason: "A long reason from staff." })).toBe(
      "Sent back. See what to fix.",
    );
    expect(listWords({ ...base, state: "live", stateReason: "A long reason from staff." })).toBe(
      "Live. Your update was sent back. See what to fix.",
    );
  });

  it("keeps the plain words for the rest", () => {
    expect(listWords({ ...base, state: "waiting", hasPending: true })).toBe("Waiting for review");
    expect(listWords({ ...base, state: "live" })).toBe("Live");
    expect(listWords({ ...base, state: "live", hasPending: true })).toBe(
      "Live. Your update is waiting for review",
    );
    expect(listWords({ ...base, state: "taken_off" })).toBe("Off Ruken. You took it off.");
    expect(listWords({ ...base, state: "taken_down", stateReason: "It broke a rule." })).toBe(
      "Taken down. See why.",
    );
  });
});

// The one line under a game's state on its own page that says the next step (review F8).
describe("nextStepWords", () => {
  const base = { stateReason: null, hasPending: false, filesProblem: false, upright: false, wide: false };

  it("says what a draft still needs, one thing at a time", () => {
    expect(nextStepWords({ ...base, state: "draft" })).toBe("Add your two videos, then send it for review.");
    expect(nextStepWords({ ...base, state: "draft", upright: true })).toBe(
      "Add your wide video, then send it for review.",
    );
    expect(nextStepWords({ ...base, state: "draft", wide: true })).toBe(
      "Add your upright video, then send it for review.",
    );
    expect(nextStepWords({ ...base, state: "draft", upright: true, wide: true })).toBe(
      "Everything's here. Send it for review.",
    );
  });

  it("puts the files first when they were refused", () => {
    expect(nextStepWords({ ...base, state: "draft", filesProblem: true, upright: true, wide: true })).toBe(
      "Fix your game's files on GitHub, then copy it again.",
    );
  });

  it("tells a game that was sent back to fix it and send it again", () => {
    expect(
      nextStepWords({ ...base, state: "sent_back", stateReason: "Fix it.", upright: true, wide: true }),
    ).toBe("Fix it, then send it again.");
  });

  it("tells a waiting game that it is being looked at", () => {
    expect(nextStepWords({ ...base, state: "waiting", hasPending: true, upright: true, wide: true })).toBe(
      "We're looking at it. Come back here to see when it's live.",
    );
  });

  it("tells a live game that players can find it, unless its update was sent back", () => {
    expect(nextStepWords({ ...base, state: "live" })).toBe("Players can find it on Ruken.");
    expect(nextStepWords({ ...base, state: "live", hasPending: true })).toBe("Players can find it on Ruken.");
    expect(nextStepWords({ ...base, state: "live", stateReason: "Fix it." })).toBe(
      "Fix it, then send your newest version for review.",
    );
  });

  it("has no next step for a game that is off Ruken", () => {
    expect(nextStepWords({ ...base, state: "taken_off" })).toBeNull();
    expect(nextStepWords({ ...base, state: "taken_down", stateReason: "It broke a rule." })).toBeNull();
  });
});

// A refused send names everything still missing in one sentence (review F6).
describe("beforeSendWords", () => {
  const none = { files: false, upright: false, wide: false, agreement: false };

  it("says nothing when nothing is missing", () => {
    expect(beforeSendWords(none)).toBeNull();
  });

  it("names one thing", () => {
    expect(beforeSendWords({ ...none, agreement: true })).toBe("Before you send it: tick the box.");
  });

  it("names two things with an and", () => {
    expect(beforeSendWords({ ...none, wide: true, agreement: true })).toBe(
      "Before you send it: add the wide video and tick the box.",
    );
  });

  it("names three or four in the order a maker works down the page", () => {
    expect(beforeSendWords({ ...none, upright: true, wide: true, agreement: true })).toBe(
      "Before you send it: add the upright video, add the wide video, and tick the box.",
    );
    expect(beforeSendWords({ files: true, upright: true, wide: true, agreement: true })).toBe(
      "Before you send it: copy your game from GitHub, add the upright video, add the wide video, and tick the box.",
    );
  });
});
