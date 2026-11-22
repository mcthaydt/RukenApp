import { describe, expect, test } from "vitest";
import { clampClip, currentOf, stepFor } from "../../../src/features/feed/current.ts";

describe("currentOf", () => {
  test("is the clip that fills 60% or more of the window", () => {
    expect(currentOf([0, 0.6, 0.4])).toBe(1);
    expect(currentOf([1, 0, 0])).toBe(0);
    expect(currentOf([0, 0, 0.95])).toBe(2);
  });

  test("is nobody's while two clips share the window and neither has 60%", () => {
    expect(currentOf([0.5, 0.5])).toBeNull();
    expect(currentOf([0.59, 0.41, 0])).toBeNull();
  });

  test("is exactly 60% in, just under it out", () => {
    expect(currentOf([0.4, 0.6])).toBe(1);
    expect(currentOf([0.41, 0.599])).toBeNull();
  });

  test("has no answer with no clips, or before the window has told anything", () => {
    expect(currentOf([])).toBeNull();
    expect(currentOf([undefined, undefined])).toBeNull();
  });

  test("skips a clip the window has not reported yet", () => {
    expect(currentOf([undefined, 0.8])).toBe(1);
  });
});

describe("stepFor", () => {
  test("moves down one for the arrow, Page Down and Space", () => {
    for (const key of ["ArrowDown", "PageDown", " "]) expect(stepFor(key, false)).toBe(1);
  });

  test("moves up one for the other arrow, Page Up and Shift with Space", () => {
    for (const key of ["ArrowUp", "PageUp"]) expect(stepFor(key, false)).toBe(-1);
    expect(stepFor(" ", true)).toBe(-1);
  });

  test("moves nowhere for any other key", () => {
    for (const key of ["a", "Enter", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"]) {
      expect(stepFor(key, false)).toBe(0);
    }
  });
});

describe("clampClip", () => {
  test("stays between the first clip and the last", () => {
    expect(clampClip(-1, 5)).toBe(0);
    expect(clampClip(2, 5)).toBe(2);
    expect(clampClip(5, 5)).toBe(4);
  });

  test("is the first with no clips at all", () => {
    expect(clampClip(3, 0)).toBe(0);
  });
});
