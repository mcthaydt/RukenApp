import { describe, expect, it } from "vitest";
import {
  SWIPE_DISTANCE,
  TABS,
  WHEEL_REST,
  WHEEL_STILL,
  stepOfSwipe,
  stepOfWheel,
  tabFrom,
  type WheelSwipe,
} from "../../../src/features/feed/tabs.ts";

describe("the feed's tabs", () => {
  it("are Fresh, Followed then Your turn, each with its own address", () => {
    expect(TABS.map((tab) => [tab.name, tab.href])).toEqual([
      ["Fresh", "/"],
      ["Followed", "/followed"],
      ["Your turn", "/your-turn"],
    ]);
  });

  it("step to the next and the one before, and stop at either end", () => {
    expect(tabFrom("fresh", 1)?.key).toBe("followed");
    expect(tabFrom("followed", -1)?.key).toBe("fresh");
    expect(tabFrom("fresh", -1)).toBeNull();
    expect(tabFrom("followed", 1)?.key).toBe("your-turn");
    expect(tabFrom("your-turn", -1)?.key).toBe("followed");
    expect(tabFrom("your-turn", 1)).toBeNull();
  });
});

describe("a swipe", () => {
  it("to the left brings the next tab, and to the right the one before", () => {
    expect(stepOfSwipe(-SWIPE_DISTANCE, 0)).toBe(1);
    expect(stepOfSwipe(SWIPE_DISTANCE + 40, 10)).toBe(-1);
  });

  it("too short, or more up and down than sideways, is not a tab change", () => {
    expect(stepOfSwipe(-(SWIPE_DISTANCE - 1), 0)).toBeNull();
    expect(stepOfSwipe(-100, 60)).toBeNull();
    expect(stepOfSwipe(0, -300)).toBeNull();
  });
});

/** Feeds a run of wheel moves, `gap` milliseconds apart from `from`, and gives every step they asked for. */
function wheel(
  moves: [number, number][],
  { from = 1000, gap = 16, swipe = WHEEL_STILL }: { from?: number; gap?: number; swipe?: WheelSwipe } = {},
): { steps: (1 | -1)[]; swipe: WheelSwipe; at: number } {
  const steps: (1 | -1)[] = [];
  let at = from;
  for (const [dx, dy] of moves) {
    const result = stepOfWheel(swipe, dx, dy, at);
    swipe = result.swipe;
    if (result.step !== null) steps.push(result.step);
    at += gap;
  }
  return { steps, swipe, at: at - gap };
}

/** A two-finger swipe on a trackpad as a browser reports it: a push of wheel moves, then the long coast to a stop. */
const trackpadSwipe = (way: 1 | -1): [number, number][] =>
  [12, 30, 45, 50, 40, 30, 22, 16, 12, 9, 7, 5, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1].map((dx) => [way * dx, 1]);

describe("a trackpad swipe", () => {
  it("to the left (the page scrolled right) brings the next tab, and to the right the one before", () => {
    expect(wheel(trackpadSwipe(1)).steps).toEqual([1]);
    expect(wheel(trackpadSwipe(-1)).steps).toEqual([-1]);
  });

  it("steps one tab only, however long it coasts after the fingers lift", () => {
    const coast: [number, number][] = Array.from({ length: 120 }, () => [3, 0]);
    expect(wheel([...trackpadSwipe(1), ...coast]).steps).toEqual([1]);
  });

  it("after a rest, a second swipe steps again", () => {
    const first = wheel(trackpadSwipe(1));
    const second = wheel(trackpadSwipe(-1), { from: first.at + WHEEL_REST + 1, swipe: first.swipe });
    expect(second.steps).toEqual([-1]);
  });

  it("with no rest between, a turn back the other way is a swipe of its own", () => {
    expect(wheel([...trackpadSwipe(1), ...trackpadSwipe(-1)]).steps).toEqual([1, -1]);
  });

  it("a second swipe the same way while the first still coasts steps again", () => {
    const coast: [number, number][] = Array.from({ length: 60 }, () => [1, 0]);
    expect(wheel([...trackpadSwipe(1), ...coast, ...trackpadSwipe(1)]).steps).toEqual([1, 1]);
  });

  it("a sideways swipe while a scroll up or down still coasts steps", () => {
    const scroll: [number, number][] = [10, 30, 50, 60, 45, 30, 20, 12, 8, 5, 3, 2, 1].map((dy) => [0, dy]);
    expect(wheel([...scroll, ...trackpadSwipe(1)]).steps).toEqual([1]);
  });

  it("a coast that slows unevenly, or comes held back by a busy moment, steps only once", () => {
    const moves = trackpadSwipe(1).map(([dx, dy], index) => ({ dx, dy, at: 1000 + 16 * index }));
    const stepsOf = (run: { dx: number; dy: number; at: number }[]): number[] => {
      let swipe = WHEEL_STILL;
      const steps: number[] = [];
      for (const { dx, dy, at } of run) {
        const result = stepOfWheel(swipe, dx, dy, at);
        swipe = result.swipe;
        if (result.step !== null) steps.push(result.step);
      }
      return steps;
    };
    // A busy page hands on the moves it held back all at once with one stamp, at the coast's start and at its end.
    for (const [from, to] of [
      [6, 12],
      [12, 20],
    ] as const) {
      const late = moves.map((move, index) =>
        index >= from && index < to ? { ...move, at: moves[to]?.at ?? 0 } : move,
      );
      expect(stepsOf(late), `held back from ${String(from)} to ${String(to)}`).toEqual([1]);
      // Or summed into one move.
      const held = moves.slice(from, to);
      const summed = {
        dx: held.reduce((sum, move) => sum + move.dx, 0),
        dy: held.reduce((sum, move) => sum + move.dy, 0),
        at: held.at(-1)?.at ?? 0,
      };
      expect(
        stepsOf([...moves.slice(0, from), summed, ...moves.slice(to)]),
        `summed ${String(from)}`,
      ).toEqual([1]);
    }
    const wobbly: [number, number][] = [
      12, 30, 45, 50, 40, 32, 34, 25, 26, 18, 19, 12, 13, 8, 9, 5, 6, 3, 4, 2, 2, 1,
    ].map((dx) => [dx, 0]);
    expect(wheel(wobbly).steps).toEqual([1]);
  });

  it("too short, or up and down to the next clip, is not a tab change", () => {
    expect(wheel([[SWIPE_DISTANCE - 1, 0]]).steps).toEqual([]);
    expect(wheel(trackpadSwipe(1).map(([dx]) => [dx / 2, dx * 2])).steps).toEqual([]);
    expect(wheel(Array.from({ length: 30 }, () => [0, 40])).steps).toEqual([]);
  });

  it("that starts up and down stays a scroll, even if it drifts a little sideways later", () => {
    const down: [number, number][] = Array.from({ length: 10 }, () => [0, 40]);
    const drift: [number, number][] = Array.from({ length: 10 }, () => [5, 20]);
    expect(wheel([...down, ...drift]).steps).toEqual([]);
  });
});
