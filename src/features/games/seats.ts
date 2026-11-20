import schedule from "./library/decision-days.json" with { type: "json" };

// Decision day: the one moment each week when every held decision goes out. The schedule is written in code
// (library/decision-days.json), never in the database: each day's seats are recorded on its row when it goes out, so a
// later change here never rewrites a past week. Days are plain "YYYY-MM-DD" strings in the schedule's own zone.

export interface DecisionSchedule {
  /** The first decision day, or null while the ritual is off (nothing names a decision day). */
  firstDay: string | null;
  /** 0 is Sunday, 5 is Friday. */
  weekday: number;
  /** The hour on the clock in `zone`. */
  hour: number;
  zone: string;
  startSeats: number;
  maxSeats: number;
  growsEveryMonths: number;
}

export interface DecisionDayMoment {
  /** The day, in the schedule's zone. */
  day: string;
  /** The instant it goes out. */
  at: Date;
  seats: number;
}

export const decisionSchedule: DecisionSchedule = schedule;

const DAY_MS = 86_400_000;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parts(day: string): [number, number, number] {
  const [year = 0, month = 0, date = 0] = day.split("-").map(Number);
  return [year, month, date];
}

function utcOf(day: string): number {
  const [year, month, date] = parts(day);
  return Date.UTC(year, month - 1, date);
}

function dayOf(utc: number): string {
  return new Date(utc).toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  return dayOf(utcOf(day) + days * DAY_MS);
}

/** `day` plus whole months; a date past the end of its month is clamped to the month's last day. */
export function addMonths(day: string, months: number): string {
  const [year, month, date] = parts(day);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index % 12;
  const last = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clamped = Math.min(date, last);
  return dayOf(Date.UTC(targetYear, targetMonth, clamped));
}

/** "Friday 27 November": a decision day's own date in its own zone, for the words people read. */
export function dayWords(day: string): string {
  const [, month, date] = parts(day);
  const weekday = new Date(utcOf(day)).getUTCDay();
  return `${WEEKDAYS[weekday] ?? ""} ${String(date)} ${MONTHS[month - 1] ?? ""}`;
}

/** How far `zone` is ahead of UTC at an instant, in milliseconds. */
function offsetAt(instant: number, zone: string): number {
  const shown = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const get = (type: string): number => Number(shown.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant the clock in `zone` reads `hour`:00 on `day`. Noon in New York is never in a clock change. */
function momentOf(day: string, s: DecisionSchedule): Date {
  const wall = utcOf(day) + s.hour * 3_600_000;
  let instant = wall - offsetAt(wall, s.zone);
  instant = wall - offsetAt(instant, s.zone);
  return new Date(instant);
}

/** The calendar day of an instant on the clock in `zone`. */
function dayInZone(instant: Date, zone: string): string {
  return dayOf(instant.getTime() + offsetAt(instant.getTime(), zone));
}

function onWeekday(day: string, s: DecisionSchedule): boolean {
  return new Date(utcOf(day)).getUTCDay() === s.weekday;
}

/** The first decision day on or after `day`. */
function firstDecisionDayOnOrAfter(day: string, s: DecisionSchedule): string {
  let current = day;
  while (!onWeekday(current, s)) current = addDays(current, 1);
  return current;
}

/**
 * How many times the seats have grown on `day`: step n starts on the first decision day on or after the first day
 * plus n times `growsEveryMonths` calendar months.
 */
function stepOf(day: string, firstDay: string, s: DecisionSchedule): number {
  let step = 0;
  for (;;) {
    const next = firstDecisionDayOnOrAfter(addMonths(firstDay, (step + 1) * s.growsEveryMonths), s);
    if (next > day) return step;
    step += 1;
  }
}

/**
 * The seats `day` has: the start, grown by half again at each step, rounded half up once from the exact value and never
 * above the most. 0 for a day before the first decision day, and while the schedule is off.
 */
export function seatsOn(day: string, s: DecisionSchedule = decisionSchedule): number {
  if (s.firstDay === null || day < s.firstDay) return 0;
  const step = stepOf(day, s.firstDay, s);
  // start × 3ⁿ / 2ⁿ in whole numbers, rounded half up once; past the cap the number is not needed.
  if (step >= 40) return s.maxSeats;
  const rounded = Math.floor((2 * s.startSeats * 3 ** step + 2 ** step) / (2 * 2 ** step));
  return Math.min(rounded, s.maxSeats);
}

/**
 * The first decision day whose moment is strictly after `after`: a decision at 11:59 goes out at noon that day, one at
 * 12:00 goes out the next week. Null while the schedule is off. Whether that day has already gone out is for the caller
 * to know.
 */
export function nextDecisionDay(
  after: Date,
  s: DecisionSchedule = decisionSchedule,
): DecisionDayMoment | null {
  if (s.firstDay === null) return null;
  let day = firstDecisionDayOnOrAfter(dayInZone(after, s.zone), s);
  if (day < s.firstDay) day = s.firstDay;
  for (;;) {
    const at = momentOf(day, s);
    if (at.getTime() > after.getTime()) return { day, at, seats: seatsOn(day, s) };
    day = addDays(day, 7);
  }
}

/**
 * Every decision day whose moment is at or before `now`, oldest first: what the release looks at, so a day missed (a
 * cron that failed) still goes out. Empty while the schedule is off.
 */
export function decisionDaysDue(now: Date, s: DecisionSchedule = decisionSchedule): DecisionDayMoment[] {
  if (s.firstDay === null) return [];
  const due: DecisionDayMoment[] = [];
  let day = firstDecisionDayOnOrAfter(s.firstDay, s);
  for (;;) {
    const at = momentOf(day, s);
    if (at.getTime() > now.getTime()) return due;
    due.push({ day, at, seats: seatsOn(day, s) });
    day = addDays(day, 7);
  }
}
