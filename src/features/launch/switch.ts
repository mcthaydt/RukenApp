import { Temporal } from "@js-temporal/polyfill";
import { CALENDAR_ZONE } from "../../lib/clock.ts";

// The launch switch: the one moment Ruken opens, and the one question every screen and route asks about it.
// Nothing is stored or flipped at launch, so nothing can fail to flip: before this moment an accepted game shows
// "Wishlist", from it the same game shows Play.

/**
 * 11:00 on Monday 30 November 2026 in Chicago, as epoch milliseconds. It is worked out from the wall-clock time and
 * the zone, never written as a number, so the Chicago rule (standard time on that day, so 17:00 UTC) is the zone
 * database's and not ours.
 */
export const LAUNCH_MS: number = Temporal.ZonedDateTime.from({
  timeZone: CALENDAR_ZONE,
  year: 2026,
  month: 11,
  day: 30,
  hour: 11,
}).epochMilliseconds;

/** True from the launch minute on. The caller says what time it is: this never reads a clock. */
export function isOpen(nowMs: number): boolean {
  return nowMs >= LAUNCH_MS;
}

/** Where Play goes before launch, beside the Wishlist button. */
export const OPENS_WORDS = "Opens 30 November";
