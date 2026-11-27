import { describe, expect, it } from "vitest";
import { backToFeed, clipMoves, grownGame, isFeed, moveBetween, noteMove } from "../../src/lib/page-moves.ts";

// Moving between pages slides sideways, like an app. Between the bar's three places (Home, Your games, You) the new
// page comes from the side its place is on; elsewhere a new page comes in from the right and Back takes it out the
// way it came. A move inside the maker's questions is the maker area's own step, and a move to the same page is none.
describe("moveBetween", () => {
  it.each([
    ["/", "/make", "on"],
    ["/", "/me", "on"],
    ["/make", "/me", "on"],
    ["/me", "/make", "back"],
    ["/me", "/", "back"],
    ["/make", "/", "back"],
    ["/me/password", "/make", "back"],
    ["/g/floor-fifty", "/me", "on"],
  ] as const)("from %j to %j goes %j, by the bar's order", (from, to, move) => {
    expect(moveBetween(from, to, false)).toBe(move);
  });

  it("goes on to a page that is not the top of a place", () => {
    expect(moveBetween("/", "/g/floor-fifty", false)).toBe("on");
    expect(moveBetween("/me", "/me/password", false)).toBe("on");
    expect(moveBetween("/sign-in", "/sign-up", false)).toBe("on");
  });

  it("goes back to the top of the place it is in, and home is always back", () => {
    expect(moveBetween("/me/password", "/me", false)).toBe("back");
    expect(moveBetween("/g/floor-fifty", "/", false)).toBe("back");
    expect(moveBetween("/sign-in", "/", false)).toBe("back");
  });

  it("goes back with the browser's Back, whatever the pages", () => {
    expect(moveBetween("/", "/g/floor-fifty", true)).toBe("back");
    expect(moveBetween("/me", "/make", true)).toBe("back");
  });

  it("leaves a move inside the maker's area to that area's own step", () => {
    expect(moveBetween("/make", "/make/new", false)).toBeNull();
    expect(moveBetween("/make/floor-fifty/name", "/make", false)).toBeNull();
  });

  it("does not move for the same page", () => {
    expect(moveBetween("/me", "/me", false)).toBeNull();
    expect(moveBetween("/sign-up", "/sign-up", false)).toBeNull();
  });

  it("does not take a path that only starts with a place's letters for that place", () => {
    expect(moveBetween("/", "/mekong", false)).toBe("on");
    expect(moveBetween("/mekong", "/make", false)).toBe("on");
  });
});

describe("grownGame", () => {
  it("names the game whose clip moves between the feed and that game's page, either way", () => {
    expect(grownGame("/", "/g/tiny")).toBe("tiny");
    expect(grownGame("/g/tiny", "/")).toBe("tiny");
    // Followed is the feed's other tab: its clips grow into a game's page and back the same way.
    expect(grownGame("/followed", "/g/tiny")).toBe("tiny");
    expect(grownGame("/g/tiny", "/followed")).toBe("tiny");
  });

  it("names none for any other move, the play screen and a maker's page included", () => {
    expect(grownGame("/", "/g/tiny/play")).toBeNull();
    expect(grownGame("/g/tiny/play", "/")).toBeNull();
    expect(grownGame("/", "/night")).toBeNull();
    expect(grownGame("/make", "/g/tiny")).toBeNull();
    expect(grownGame("/g/tiny", "/g/other")).toBeNull();
  });
});

describe("clipMoves, back to the feed", () => {
  it("shrinks the clip only with Back, and only for the game opened from the feed", () => {
    noteMove("tiny", "/g/tiny");
    expect(clipMoves("tiny", true, true)).toBe(true);
    expect(clipMoves("tiny", true, false)).toBe(false);
    expect(clipMoves("other", true, true)).toBe(false);
  });

  it("forgets the game once the person is on the feed again, so a game page opened another way slides back", () => {
    noteMove("tiny", "/g/tiny");
    noteMove(null, "/");
    expect(clipMoves("tiny", true, true)).toBe(false);
  });

  it("keeps the game through moves that are not to the feed, such as the play screen and back", () => {
    noteMove("tiny", "/g/tiny");
    noteMove(null, "/g/tiny/play");
    noteMove(null, "/g/tiny");
    expect(clipMoves("tiny", true, true)).toBe(true);
    noteMove(null, "/");
  });
});

describe("backToFeed", () => {
  it("is Back only on the game's page opened straight from the feed", () => {
    noteMove(null, "/");
    noteMove("tiny", "/g/tiny");
    expect(backToFeed("tiny")).toBe(true);
    expect(backToFeed("other")).toBe(false);
  });

  it("is Back again after the play screen and Back, but not once another page was opened on top", () => {
    noteMove(null, "/");
    noteMove("tiny", "/g/tiny");
    noteMove(null, "/g/tiny/play");
    noteMove(null, "/g/tiny", -1);
    expect(backToFeed("tiny")).toBe(true);
    noteMove(null, "/g/tiny/play");
    noteMove(null, "/g/tiny");
    expect(backToFeed("tiny")).toBe(false);
  });

  it("is a plain link once the person has been on the feed again", () => {
    noteMove("tiny", "/g/tiny");
    noteMove(null, "/", -1);
    expect(backToFeed("tiny")).toBe(false);
  });
});

describe("isFeed", () => {
  it("is both of the feed's tabs, and nothing else", () => {
    expect(isFeed("/")).toBe(true);
    expect(isFeed("/followed")).toBe(true);
    expect(isFeed("/search")).toBe(false);
    expect(isFeed("/g/tiny")).toBe(false);
  });
});
