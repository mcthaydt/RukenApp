import { Temporal } from "@js-temporal/polyfill";

/** What domain code receives instead of reading wall time. It has no zone. */
export interface Clock {
  now(): Temporal.Instant;
  epochMs(): number;
}

/**
 * The only module allowed to read wall time. Everything else is handed a Clock, so a test can
 * set the time and a bug can be replayed.
 */
export const systemClock: Clock = {
  now: () => Temporal.Now.instant(),
  epochMs: () => Date.now(),
};

/**
 * The zone of Ruken's calendar: every "today" in the product is an America/Chicago day. Domain code
 * names the zone through this constant and turns instants into days with `chicagoDayOf`, so the day
 * boundaries are worked out in one place.
 */
export const CALENDAR_ZONE = "America/Chicago";

/** The Chicago calendar day (`YYYY-MM-DD`) that an instant falls on. */
export function chicagoDayOf(epochMs: number): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO(CALENDAR_ZONE)
    .toPlainDate()
    .toString();
}
