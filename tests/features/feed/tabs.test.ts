import { describe, expect, it } from "vitest";
import { SWIPE_DISTANCE, TABS, stepOfSwipe, tabFrom } from "../../../src/features/feed/tabs.ts";

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
