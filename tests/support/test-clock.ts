import type { Temporal } from "@js-temporal/polyfill";
import type { Clock } from "../../src/lib/clock.ts";

/** A clock tests can set. Time moves only through `advance` and `set`, and never backwards. */
export class TestClock implements Clock {
  constructor(start: Temporal.Instant | string) {
    throw new Error(`not built yet (${String(start)})`);
  }

  now(): Temporal.Instant {
    throw new Error("not built yet");
  }

  epochMs(): number {
    throw new Error("not built yet");
  }

  set(at: Temporal.Instant | string): void {
    throw new Error(`not built yet (${String(at)})`);
  }

  advance(by: Temporal.DurationLike | number): void {
    throw new Error(`not built yet (${String(by)})`);
  }
}
