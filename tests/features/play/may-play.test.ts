import { describe, expect, it } from "vitest";
import { backFromPaywall, isPhone, playBasis } from "../../../src/features/play/may-play.ts";

const game = { freeToPlay: false, makerUserId: "maker" };
const viewer = { userId: "u", isStaff: false, isMember: false };

describe("playBasis", () => {
  it("sends a stranger and a non-member to the paywall", () => {
    expect(playBasis({ game, viewer: null })).toBeNull();
    expect(playBasis({ game, viewer })).toBeNull();
  });

  it("lets a member in, as a member", () => {
    expect(playBasis({ game, viewer: { ...viewer, isMember: true } })).toBe("member");
  });

  it("lets anyone into a free game, with no account", () => {
    expect(playBasis({ game: { ...game, freeToPlay: true }, viewer: null })).toBe("free_game");
  });

  // Design 6: a free game, staff and a maker's own game never count for pay, so a member's play of a free game must
  // not be recorded as a member's.
  it("never records a member's play of a free game as a member's", () => {
    expect(playBasis({ game: { ...game, freeToPlay: true }, viewer: { ...viewer, isMember: true } })).toBe(
      "free_game",
    );
  });

  it("records staff as staff, and a maker on their own game as that, member or not", () => {
    expect(playBasis({ game, viewer: { ...viewer, isStaff: true, isMember: true } })).toBe("staff");
    expect(playBasis({ game, viewer: { userId: "maker", isStaff: true, isMember: true } })).toBe("own_game");
    expect(playBasis({ game, viewer: { userId: "maker", isStaff: false, isMember: false } })).toBe(
      "own_game",
    );
  });

  it("puts staff before a free game: of the reasons that hold, the first of the four wins", () => {
    expect(playBasis({ game: { ...game, freeToPlay: true }, viewer: { ...viewer, isStaff: true } })).toBe(
      "staff",
    );
  });

  it("treats a maker as a stranger on someone else's game", () => {
    expect(playBasis({ game, viewer: { ...viewer, userId: "other-maker" } })).toBeNull();
  });
});

describe("isPhone", () => {
  it("knows a phone by what it says it is", () => {
    const pixel =
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
    const iphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    const desktop =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    expect(isPhone(pixel)).toBe(true);
    expect(isPhone(iphone)).toBe(true);
    expect(isPhone(desktop)).toBe(false);
    expect(isPhone(null)).toBe(false);
  });
});

describe("backFromPaywall", () => {
  it.each([
    ["/g/floor-fifty/play", "/g/floor-fifty"],
    ["/me", "/"],
    ["/g/x/play/beat", "/"],
    ["/g/UP/play", "/"],
    ["", "/"],
    ["//evil.example", "/"],
  ])("Not now from %j goes to %j", (next, back) => {
    expect(backFromPaywall(next)).toBe(back);
  });
});
