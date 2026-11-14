import { describe, expect, it } from "vitest";
import { countedMs } from "../../../src/features/play/time.ts";

describe("countedMs", () => {
  it("counts the server's time between attentive beats", () => {
    expect(
      countedMs(0, [
        { atMs: 15_000, attentive: true },
        { atMs: 30_000, attentive: true },
      ]),
    ).toBe(30_000);
  });

  it("counts nothing for a beat that says the person looked away, and starts again after it", () => {
    expect(
      countedMs(0, [
        { atMs: 15_000, attentive: false },
        { atMs: 30_000, attentive: true },
      ]),
    ).toBe(15_000);
  });

  // Review Focus 7: two lost beats are forgiven, and no more.
  it("forgives two lost beats and no more", () => {
    expect(countedMs(0, [{ atMs: 45_000, attentive: true }])).toBe(45_000);
    expect(countedMs(0, [{ atMs: 600_000, attentive: true }])).toBe(45_000);
  });

  it("never counts more than the clock saw, however many beats arrive", () => {
    const flood = Array.from({ length: 100 }, (_, i) => ({ atMs: 100 * (i + 1), attentive: true }));
    expect(countedMs(0, flood)).toBe(10_000);
  });

  // Review Focus 15.
  it("counts nothing with no beats", () => {
    expect(countedMs(0, [])).toBe(0);
  });

  it("puts the beats in time order first", () => {
    expect(
      countedMs(0, [
        { atMs: 30_000, attentive: true },
        { atMs: 15_000, attentive: true },
      ]),
    ).toBe(30_000);
  });
});
