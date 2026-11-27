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
  it("are Fresh then Followed, each with its own address", () => {
    expect(TABS.map((tab) => [tab.name, tab.href])).toEqual([
      ["Fresh", "/"],
      ["Followed", "/followed"],
    ]);
  });

  it("step to the next and the one before, and stop at either end", () => {
    expect(tabFrom("fresh", 1)?.key).toBe("followed");
    expect(tabFrom("followed", -1)?.key).toBe("fresh");
    expect(tabFrom("fresh", -1)).toBeNull();
    expect(tabFrom("followed", 1)).toBeNull();
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

  it("with no rest between, a turn back the other way is still the same swipe", () => {
    expect(wheel([...trackpadSwipe(1), ...trackpadSwipe(-1)]).steps).toEqual([1]);
  });

  it("too short, or up and down to the next clip, is not a tab change", () => {
    expect(wheel([[SWIPE_DISTANCE - 1, 0]]).steps).toEqual([]);
    expect(wheel(trackpadSwipe(1).map(([dx]) => [dx / 2, dx * 2])).steps).toEqual([]);
    expect(wheel(Array.from({ length: 30 }, () => [0, 40])).steps).toEqual([]);
  });

  it("that starts up and down stays a scroll, even if it drifts sideways later", () => {
    const down: [number, number][] = Array.from({ length: 10 }, () => [0, 40]);
    const drift: [number, number][] = Array.from({ length: 10 }, () => [30, 0]);
    expect(wheel([...down, ...drift]).steps).toEqual([]);
  });
});
