import { Temporal } from "@js-temporal/polyfill";
import type { Clock } from "../../src/lib/clock.ts";

function toInstant(at: Temporal.Instant | string): Temporal.Instant {
  return typeof at === "string" ? Temporal.Instant.from(at) : at;
}

/** Whole milliseconds; TestClock's resolution is 1 ms. */
function toMilliseconds(by: Temporal.DurationLike | number): number {
  const ms = typeof by === "number" ? by : Temporal.Duration.from(by).total({ unit: "millisecond" });
  if (!Number.isFinite(ms) || ms < 0) {
    throw new RangeError(`TestClock.advance needs a finite, non-negative duration; got ${String(ms)} ms`);
  }
  return Math.floor(ms);
}

/**
 * A clock tests can set. Time moves only through `advance` and `set`, and never backwards, so a
 * test that needs "15 days later" says so and nothing else changes the time under it.
 */
export class TestClock implements Clock {
  #now: Temporal.Instant;

  constructor(start: Temporal.Instant | string) {
    this.#now = toInstant(start);
  }

  now(): Temporal.Instant {
    return this.#now;
  }

  epochMs(): number {
    return this.#now.epochMilliseconds;
  }

  set(at: Temporal.Instant | string): void {
    const target = toInstant(at);
    if (Temporal.Instant.compare(target, this.#now) < 0) {
      throw new RangeError(
        `TestClock never moves backwards: ${this.#now.toString()} -> ${target.toString()}`,
      );
    }
    this.#now = target;
  }

  advance(by: Temporal.DurationLike | number): void {
    this.#now = this.#now.add({ milliseconds: toMilliseconds(by) });
  }
}
