import { Temporal } from "@js-temporal/polyfill";
import { chicagoDayOf } from "./clock.ts";

// A day in words for people to read: "Friday, November 27". Ruken's days are Chicago's (clock.ts).

/**
 * Writes a `YYYY-MM-DD` day as weekday, month and day, or answers null for text that is not a real day (`2026-02-30`,
 * `soon`). It formats that calendar day itself and never goes through an instant, so no server zone can move it to
 * the day before.
 */
export function longDay(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  try {
    // "reject" makes February 30th an error and not March 2nd.
    const date = Temporal.PlainDate.from(day, { overflow: "reject" });
    return date.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric" });
  } catch {
    return null;
  }
}

/** The Chicago day an instant falls on, in words. For the moments on `/me` that are shown as dates. */
export function longDate(at: Date): string {
  const words = longDay(chicagoDayOf(at.getTime()));
  // chicagoDayOf always writes a real day, so null cannot happen here.
  if (words === null) throw new Error(`not a day: ${at.toISOString()}`);
  return words;
}

/**
 * The Chicago day an instant falls on as day then month, "12 December": the short form a game's screens use, where the
 * year and the weekday say nothing a maker needs.
 */
export function dayAndMonth(at: Date): string {
  return Temporal.PlainDate.from(chicagoDayOf(at.getTime())).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
  });
}
