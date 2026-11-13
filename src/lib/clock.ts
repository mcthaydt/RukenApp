import type { Temporal } from "@js-temporal/polyfill";

/** What domain code receives instead of reading wall time. It has no zone. */
export interface Clock {
  now(): Temporal.Instant;
  epochMs(): number;
}

/**
 * The zone of Ruken's calendar: every "today" in the product is an America/Chicago day. Domain code
 * names the zone through this constant and turns instants into days with `chicagoDayOf`, so the day
 * boundaries are worked out in one place.
 */
export const CALENDAR_ZONE = "America/Chicago";

/** The only module allowed to read wall time. */
export const systemClock: Clock = {
  now: () => {
    throw new Error("not built yet");
  },
  epochMs: () => {
    throw new Error("not built yet");
  },
};

/** The Chicago calendar day (`YYYY-MM-DD`) that an instant falls on. */
export function chicagoDayOf(epochMs: number): string {
  throw new Error(`not built yet (${String(epochMs)})`);
}
