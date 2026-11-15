import { describe, expect, it } from "vitest";
import { seenOf } from "../../../src/features/games/seen.ts";

// What staff looked at (audit S-1): a sign of the parts of a waiting game a person judges. It holds still while nothing
// they judge changes, and moves when any of it does, so a decision made on a page that went stale is refused.

const UPRIGHT = { shape: "upright" as const, key: "clips/a/upright-1.mp4" };
const WIDE = { shape: "wide" as const, key: "clips/a/wide-1.mp4" };

const GAME = {
  name: "Tiny game",
  oneLine: "A tiny game about tapping.",
  playsOn: "phone_and_computer" as const,
  ageRating: "age_18" as const,
  contentMarks: ["gore", "drugs"] as ("gore" | "drugs" | "sex_or_nudity" | "none")[],
  connectHosts: ["api.example.com"],
  pendingPullId: "pull-1",
  clips: [UPRIGHT, WIDE],
};

describe("seenOf", () => {
  it("is the same for the same game, however its marks and clips are listed", () => {
    const again = { ...GAME, contentMarks: [...GAME.contentMarks].reverse(), clips: [...GAME.clips].reverse() };
    expect(seenOf(again)).toBe(seenOf(GAME));
  });

  it("is a short plain string, not the game's words", () => {
    expect(seenOf(GAME)).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ["name", { name: "Another name" }],
    ["line", { oneLine: "Another line." }],
    ["where it plays", { playsOn: "computer_only" as const }],
    ["rating", { ageRating: "age_12" as const, contentMarks: [] }],
    ["marks", { contentMarks: ["gore"] as ("gore" | "drugs")[] }],
    ["websites", { connectHosts: [] }],
    ["files", { pendingPullId: "pull-2" }],
    ["the upright video", { clips: [{ ...UPRIGHT, key: "clips/a/upright-2.mp4" }, WIDE] }],
    ["the wide video", { clips: [UPRIGHT, { ...WIDE, key: "clips/a/wide-2.mp4" }] }],
    ["a video gone", { clips: [UPRIGHT] }],
  ])("moves when %s changes", (_what, change) => {
    expect(seenOf({ ...GAME, ...change })).not.toBe(seenOf(GAME));
  });

  it("does not run two different games together by their joins", () => {
    // The name and the line could only be told apart by where one ends: "ab" + "c" is not "a" + "bc".
    expect(seenOf({ ...GAME, name: "ab", oneLine: "c" })).not.toBe(seenOf({ ...GAME, name: "a", oneLine: "bc" }));
  });
});
