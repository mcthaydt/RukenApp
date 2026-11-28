import { describe, expect, it } from "vitest";
import { testPlayPullId } from "../../../src/features/games/test-play.ts";

describe("testPlayPullId", () => {
  const none = { pendingPullId: null, livePullId: null, newestPullId: null };

  it("a draft tries its newest copy, and a draft with no files has nothing", () => {
    expect(testPlayPullId({ ...none, state: "draft", newestPullId: "p1" })).toBe("p1");
    expect(testPlayPullId({ ...none, state: "draft" })).toBeNull();
  });

  it("a game sent back tries its newest copy", () => {
    expect(testPlayPullId({ ...none, state: "sent_back", newestPullId: "p2" })).toBe("p2");
  });

  it("a waiting game tries the copy that waits, not a newer one", () => {
    expect(testPlayPullId({ ...none, state: "waiting", pendingPullId: "p1", newestPullId: "p2" })).toBe("p1");
  });

  it("a live game with a new copy waiting tries the new copy, not the live one", () => {
    expect(
      testPlayPullId({ state: "live", pendingPullId: "new", livePullId: "old", newestPullId: "new" }),
    ).toBe("new");
  });

  it("a live game with nothing new, or only a video or rating waiting, tries its live copy", () => {
    // Before launch its own page shows Wishlist where Play goes, its maker's too, so test play is the maker's way in.
    expect(
      testPlayPullId({ state: "live", pendingPullId: null, livePullId: "old", newestPullId: "old" }),
    ).toBe("old");
    expect(
      testPlayPullId({ state: "live", pendingPullId: "old", livePullId: "old", newestPullId: "old" }),
    ).toBe("old");
  });

  it("a game taken off, taken down or thrown away is never test-played", () => {
    for (const state of ["taken_off", "taken_down", "thrown_away"] as const) {
      expect(testPlayPullId({ state, pendingPullId: "p1", livePullId: null, newestPullId: "p1" })).toBeNull();
    }
  });
});
