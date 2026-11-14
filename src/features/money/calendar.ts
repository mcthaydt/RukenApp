import { Temporal } from "@js-temporal/polyfill";
import { CALENDAR_ZONE } from "../../lib/clock.ts";
import { addMonths, type Period } from "./period.ts";
import {
  ANSWER_BUSINESS_DAYS,
  CLOSE_DAY_OF_MONTH,
  FINAL_DAY_OF_MONTH,
  PAYOUT_DAY_OF_MONTH,
  QUESTION_WINDOW_DAYS,
} from "./rules.ts";

/**
 * The money calendar: which day a month closes, is made final and is paid, and the business-day arithmetic for
 * payouts and questions.
 *
 * Almost everything here works on plain calendar days written `YYYY-MM-DD`, with no time and no zone: the money only
 * ever needs the America/Chicago date, and plain days keep these functions pure and easy to test. `startOfDayMs` is
 * the one place that turns a day back into an instant.
 */

/** A calendar day, `YYYY-MM-DD`. Plain strings sort in time order, so `<` and `>` compare days. */
export type DateText = string;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Returns the text if it is a real calendar day (February 29 only in leap years), else throws. */
export function parseDate(text: string): DateText {
  const match = DATE_PATTERN.exec(text);
  if (match === null) throw new RangeError(`"${text}" is not a YYYY-MM-DD day`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`"${text}" is not a real calendar day`);
  }
  return text;
}

function parts(date: DateText): { year: number; month: number; day: number } {
  const [year, month, day] = parseDate(date).split("-").map(Number) as [number, number, number];
  return { year, month, day };
}

function format(year: number, month: number, day: number): DateText {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Days since 1970-01-01 for a calendar day (the "days from civil" algorithm). Working in whole
 * days avoids every time-zone and daylight-saving question that `Date` would bring.
 */
function toEpochDays(date: DateText): number {
  const { year, month, day } = parts(date);
  const shiftedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function fromEpochDays(epochDays: number): DateText {
  const shifted = epochDays + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) /
      365,
  );
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return format(year, month, day);
}

/** 0 for Sunday through 6 for Saturday. */
export function dayOfWeek(date: DateText): number {
  // 1970-01-01 was a Thursday (4).
  return (((toEpochDays(date) + 4) % 7) + 7) % 7;
}

/** The day `count` days after `date` (before it when negative). */
export function addDays(date: DateText, count: number): DateText {
  return fromEpochDays(toEpochDays(date) + count);
}

const SUNDAY = 0;
const MONDAY = 1;
const THURSDAY = 4;
const SATURDAY = 6;

/** The `n`th (1-based) given weekday of a month, for example the third Monday of January. */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): DateText {
  const firstOfMonth = format(year, month, 1);
  const offset = (weekday - dayOfWeek(firstOfMonth) + 7) % 7;
  return format(year, month, 1 + offset + 7 * (n - 1));
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): DateText {
  const lastDay = daysInMonth(year, month);
  const back = (dayOfWeek(format(year, month, lastDay)) - weekday + 7) % 7;
  return format(year, month, lastDay - back);
}

/** A holiday on a Saturday is observed on the Friday before, one on a Sunday on the Monday after. */
function observed(holiday: DateText): DateText {
  const weekday = dayOfWeek(holiday);
  if (weekday === SATURDAY) return addDays(holiday, -1);
  if (weekday === SUNDAY) return addDays(holiday, 1);
  return holiday;
}

/** The observed dates of the holidays that fall in `year` (New Year's Day of the next year may land on Dec 31). */
function observedHolidays(year: number): DateText[] {
  return [
    observed(format(year, 1, 1)), // New Year's Day
    nthWeekdayOfMonth(year, 1, MONDAY, 3), // Martin Luther King Jr. Day
    nthWeekdayOfMonth(year, 2, MONDAY, 3), // Washington's Birthday
    lastWeekdayOfMonth(year, 5, MONDAY), // Memorial Day
    observed(format(year, 6, 19)), // Juneteenth
    observed(format(year, 7, 4)), // Independence Day
    nthWeekdayOfMonth(year, 9, MONDAY, 1), // Labor Day
    nthWeekdayOfMonth(year, 10, MONDAY, 2), // Columbus Day
    observed(format(year, 11, 11)), // Veterans Day
    nthWeekdayOfMonth(year, 11, THURSDAY, 4), // Thanksgiving
    observed(format(year, 12, 25)), // Christmas Day
  ];
}

/**
 * True on an observed US federal holiday. Computed from the rules, so it is right for
 * any year; the tests pin 2026 to 2028 against dates written out by hand.
 */
export function isUsFederalHoliday(date: DateText): boolean {
  const { year } = parts(date);
  // Next year's New Year's Day can be observed on Dec 31 of this one.
  return observedHolidays(year).includes(date) || observedHolidays(year + 1).includes(date);
}

/** Monday to Friday, and not an observed US federal holiday. */
export function isBusinessDay(date: DateText): boolean {
  const weekday = dayOfWeek(date);
  return weekday !== SATURDAY && weekday !== SUNDAY && !isUsFederalHoliday(date);
}

/** `date` itself if it is a business day, otherwise the next one. */
export function nextBusinessDay(date: DateText): DateText {
  let day = date;
  while (!isBusinessDay(day)) day = addDays(day, 1);
  return day;
}

/**
 * The day that is `count` business days after `date`. The start day itself is not counted, so a
 * Saturday plus 1 is the Monday. A count of 0 returns `date` unchanged.
 */
export function addBusinessDays(date: DateText, count: number): DateText {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`addBusinessDays needs a whole, non-negative count, got ${String(count)}`);
  }
  let day = date;
  let remaining = count;
  while (remaining > 0) {
    day = addDays(day, 1);
    if (isBusinessDay(day)) remaining -= 1;
  }
  return day;
}

/** The given day of the month after `period`. */
function dayOfNextMonth(period: Period, day: number): DateText {
  return `${addMonths(period, 1)}-${String(day).padStart(2, "0")}`;
}

/** The day `period` closes (at midnight in Chicago): the 8th of the next month. */
export function closeDate(period: Period): DateText {
  return dayOfNextMonth(period, CLOSE_DAY_OF_MONTH);
}

/** The day `period`'s statements are made final: the 10th of the next month. */
export function finalDate(period: Period): DateText {
  return dayOfNextMonth(period, FINAL_DAY_OF_MONTH);
}

/** The day `period`'s payouts go out: the 15th of the next month, or the next business day. */
export function payoutDate(period: Period): DateText {
  return nextBusinessDay(dayOfNextMonth(period, PAYOUT_DAY_OF_MONTH));
}

/** The last day a maker can question a line of a statement made final on `finalOn`. */
export function questionWindowEnds(finalOn: DateText): DateText {
  return addDays(finalOn, QUESTION_WINDOW_DAYS);
}

/** The day Ruken must answer a question asked on `askedOn`. */
export function answerBy(askedOn: DateText): DateText {
  return addBusinessDays(askedOn, ANSWER_BUSINESS_DAYS);
}

/**
 * The instant a Chicago day begins: its own midnight. It is 06:00 UTC in winter and 05:00 UTC in summer, and a day is
 * 23 or 25 hours long when the clocks change, so a day's end is always the next day's `startOfDayMs`, never "+ 24 hours".
 */
export function startOfDayMs(date: DateText): number {
  return Temporal.PlainDate.from(parseDate(date)).toZonedDateTime(CALENDAR_ZONE).epochMilliseconds;
}
