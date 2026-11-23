import { describe, expect, it } from "vitest";
import { moveBetween } from "../../src/lib/page-moves.ts";

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
