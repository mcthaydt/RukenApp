import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { TestClock } from "./test-clock.ts";

const START = "2026-11-30T17:00:00Z";
const START_MS = 1_796_058_000_000;

describe("TestClock", () => {
  it("starts at the given instant, and epochMs agrees with now", () => {
    const clock = new TestClock(START);
    expect(clock.now().toString()).toBe(START);
    expect(clock.epochMs()).toBe(START_MS);
    expect(clock.epochMs()).toBe(clock.now().epochMilliseconds);
  });

  it("accepts a Temporal.Instant as the start", () => {
    expect(new TestClock(Temporal.Instant.from(START)).epochMs()).toBe(START_MS);
  });

  it("advances by milliseconds or by a Temporal duration", () => {
    const clock = new TestClock(START);
    clock.advance(30);
    expect(clock.epochMs()).toBe(START_MS + 30);
    clock.advance({ minutes: 1 });
    expect(clock.now().toString()).toBe("2026-11-30T17:01:00.03Z");
  });

  it("set moves forward", () => {
    const clock = new TestClock(START);
    clock.set("2026-11-30T17:00:05Z");
    expect(clock.now().toString()).toBe("2026-11-30T17:00:05Z");
  });

  it("set never moves backwards", () => {
    const clock = new TestClock(START);
    expect(() => {
      clock.set("2026-11-30T16:59:59Z");
    }).toThrow(RangeError);
    expect(clock.now().toString()).toBe(START);
  });

  it("rejects a negative advance", () => {
    const clock = new TestClock(START);
    expect(() => {
      clock.advance(-1);
    }).toThrow(RangeError);
  });
});
