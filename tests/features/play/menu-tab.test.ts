import { describe, expect, it } from "vitest";
import {
  dragSpot,
  FIRST_PLACE,
  heightRange,
  isDrag,
  readPlace,
  tabByKey,
  tabRest,
  TAB_HEIGHT,
  TAB_WIDTH,
} from "../../../src/features/play/menu-tab.ts";

const window = { windowWidth: 400, windowHeight: 800, insets: { top: 40, bottom: 30 } };

describe("tabRest", () => {
  it("rests against the left edge when let go in the left half, at the height it was let go", () => {
    expect(tabRest({ ...window, centreX: 150, top: 400 })).toEqual({ side: "left", height: 0.5 });
  });
  it("rests against the right edge when let go in the right half", () => {
    expect(tabRest({ ...window, centreX: 250, top: 400 })).toEqual({ side: "right", height: 0.5 });
  });
  it("takes the middle as the right, so a tab never has no side", () => {
    expect(tabRest({ ...window, centreX: 200, top: 100 }).side).toBe("right");
  });
  it("stays clear of the top and bottom insets", () => {
    expect(tabRest({ ...window, centreX: 10, top: 0 }).height).toBeCloseTo(40 / 800);
    expect(tabRest({ ...window, centreX: 10, top: 790 }).height).toBeCloseTo((800 - 30 - TAB_HEIGHT) / 800);
  });
});

describe("dragSpot", () => {
  it("follows the finger inside the window", () => {
    expect(dragSpot({ ...window, left: 120, top: 300 })).toEqual({ left: 120, top: 300 });
  });
  it("never goes past the left, right, top or bottom edge", () => {
    expect(dragSpot({ ...window, left: -500, top: -500 })).toEqual({ left: 0, top: 40 });
    expect(dragSpot({ ...window, left: 5000, top: 5000 })).toEqual({
      left: 400 - TAB_WIDTH,
      top: 800 - 30 - TAB_HEIGHT,
    });
  });
  it("stays at the top-left in a window too small for the tab", () => {
    expect(
      dragSpot({ windowWidth: 20, windowHeight: 50, insets: { top: 10, bottom: 10 }, left: 9, top: 9 }),
    ).toEqual({ left: 0, top: 10 });
  });
});

describe("isDrag", () => {
  it("is a press under 8px and a drag over it", () => {
    expect(isDrag(3, 4)).toBe(false);
    expect(isDrag(8, 0)).toBe(false);
    expect(isDrag(6, 6)).toBe(true);
  });
});

describe("tabByKey", () => {
  const range = heightRange(800, { top: 40, bottom: 30 });
  it("moves to a side with left and right", () => {
    expect(tabByKey({ side: "left", height: 0.4 }, "ArrowRight", range)).toEqual({
      side: "right",
      height: 0.4,
    });
    expect(tabByKey({ side: "right", height: 0.4 }, "ArrowLeft", range)).toEqual({
      side: "left",
      height: 0.4,
    });
  });
  it("moves a tenth of the window with up and down", () => {
    expect(tabByKey({ side: "left", height: 0.4 }, "ArrowUp", range)?.height).toBeCloseTo(0.3);
    expect(tabByKey({ side: "left", height: 0.4 }, "ArrowDown", range)?.height).toBeCloseTo(0.5);
  });
  it("stops at the top and the bottom", () => {
    expect(tabByKey({ side: "left", height: range.least }, "ArrowUp", range)?.height).toBe(range.least);
    expect(tabByKey({ side: "left", height: range.most }, "ArrowDown", range)?.height).toBe(range.most);
  });
  it("leaves every other key alone", () => {
    expect(tabByKey(FIRST_PLACE, "a", range)).toBeNull();
  });
});

describe("readPlace", () => {
  it("reads what the tab wrote", () => {
    expect(readPlace('{"side":"right","height":0.6}')).toEqual({ side: "right", height: 0.6 });
  });
  it.each([
    null,
    "",
    "nope",
    "[]",
    "null",
    '{"side":"top","height":0.5}',
    '{"side":"left","height":2}',
    '{"side":"left"}',
  ])("ignores %s", (stored) => {
    expect(readPlace(stored)).toBeNull();
  });
});
