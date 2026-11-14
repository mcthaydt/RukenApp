import { Temporal } from "@js-temporal/polyfill";
import { CALENDAR_ZONE } from "../../lib/clock.ts";

/**
 * A ledger period: one calendar month in America/Chicago, written `YYYY-MM`. The format sorts in time order as a
 * plain string, which the payout id and the remainder tie-breaks rely on.
 */
export type Period = string & { readonly __brand: "Period" };

const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isPeriod(text: string): text is Period {
  return PERIOD_PATTERN.test(text);
}

export function parsePeriod(text: string): Period {
  if (!isPeriod(text)) throw new RangeError(`"${text}" is not a YYYY-MM period`);
  return text;
}

/** The period `months` months after `period` (negative goes back). */
export function addMonths(period: Period, months: number): Period {
  const [yearText, monthText] = period.split("-");
  const monthIndex = Number(yearText) * 12 + (Number(monthText) - 1) + months;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return parsePeriod(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
}

/**
 * The Chicago month an instant falls in. A payment at 23:59 on 30 November in Chicago is November's, although it is
 * already December in UTC, so the month is always read through `CALENDAR_ZONE`.
 */
export function periodOf(epochMs: number): Period {
  const { year, month } = Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(CALENDAR_ZONE);
  return parsePeriod(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
}
