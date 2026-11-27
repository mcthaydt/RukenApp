import { describe, expect, it } from "vitest";
import {
  MENU_HOLD_MS,
  REPEAT_AFTER_MS,
  REPEAT_EVERY_MS,
  pressesAt,
  type PadMemory,
  type PadPress,
  type PadReading,
} from "../../src/lib/gamepad.ts";

/** A pad in the standard layout with these buttons held and the left stick at `stick`. */
function pad(held: number[] = [], stick: [number, number] = [0, 0]): PadReading {
  return {
    buttons: Array.from({ length: 17 }, (_, index) => ({ pressed: held.includes(index) })),
    axes: [...stick, 0, 0],
  };
}

/** Holds `reading` from 0 ms to `until`, looking every 16 ms as a screen's frames do, and lists what counted. */
function hold(reading: PadReading, until: number): { at: number; press: PadPress }[] {
  let memory: PadMemory = {};
  let view: number | null = null;
  const counted: { at: number; press: PadPress }[] = [];
  for (let at = 0; at <= until; at += 16) {
    const read = pressesAt([reading], memory, view, at);
    memory = read.memory;
    view = read.viewSince;
    for (const press of read.presses) counted.push({ at, press });
  }
  return counted;
}

describe("pressesAt", () => {
  it.each([
    [0, "press"],
    [1, "back"],
    [4, "tabBack"],
    [5, "tabNext"],
    [12, "up"],
    [13, "down"],
    [14, "left"],
    [15, "right"],
    [16, "menu"],
  ] as const)("button %i counts as %j once when it goes down", (button, press) => {
    const counted = hold(pad([button]), 200);
    expect(counted).toEqual([{ at: 0, press }]);
  });

  it("does not count a button again while it stays down", () => {
    expect(hold(pad([0]), 3000)).toHaveLength(1);
  });

  it("repeats a held direction after a pause, then steadily, like a held key", () => {
    const times = hold(pad([13]), 1000).map((one) => one.at);
    expect(times[0]).toBe(0);
    expect(times[1]).toBeGreaterThanOrEqual(REPEAT_AFTER_MS);
    expect(times[1]).toBeLessThan(REPEAT_AFTER_MS + 16);
    for (let i = 2; i < times.length; i++) {
      const gap = (times[i] ?? 0) - (times[i - 1] ?? 0);
      expect(gap).toBeGreaterThanOrEqual(REPEAT_EVERY_MS);
      expect(gap).toBeLessThan(REPEAT_EVERY_MS + 16);
    }
  });

  it.each([
    [[0, -0.9], "up"],
    [[0, 0.9], "down"],
    [[-0.9, 0], "left"],
    [[0.9, 0], "right"],
  ] as const)("the left stick pushed to %j counts as %j", (stick, press) => {
    expect(hold(pad([], [stick[0], stick[1]]), 0)).toEqual([{ at: 0, press }]);
  });

  it("leaves a stick that leans less than half way alone", () => {
    expect(hold(pad([], [0.4, -0.4]), 1000)).toEqual([]);
  });

  it("counts View as the menu only once it has been held for a second, and only once", () => {
    const counted = hold(pad([8]), 3000);
    expect(counted).toHaveLength(1);
    expect(counted[0]?.press).toBe("menu");
    expect(counted[0]?.at).toBeGreaterThanOrEqual(MENU_HOLD_MS);
  });

  it("forgets a short press of View", () => {
    let memory: PadMemory = {};
    let view: number | null = null;
    for (const [at, reading] of [
      [0, pad([8])],
      [500, pad()],
      [600, pad([8])],
      [1200, pad([8])],
    ] as const) {
      const read = pressesAt([reading], memory, view, at);
      memory = read.memory;
      view = read.viewSince;
      expect(read.presses).toEqual([]);
    }
  });

  it("counts two pads as one", () => {
    const read = pressesAt([pad([0]), pad([1])], {}, null, 0);
    expect(read.presses.sort()).toEqual(["back", "press"]);
  });
});
