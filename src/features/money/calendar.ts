// The money calendar (stub: red step).
import type { Period } from "./period.ts";

export type DateText = string;

export function parseDate(text: string): DateText {
  throw new Error(`not built yet: parseDate ${text}`);
}

export function dayOfWeek(date: DateText): number {
  throw new Error(`not built yet: dayOfWeek ${date}`);
}

export function addDays(date: DateText, count: number): DateText {
  throw new Error(`not built yet: addDays ${date} ${String(count)}`);
}

export function isUsFederalHoliday(date: DateText): boolean {
  throw new Error(`not built yet: isUsFederalHoliday ${date}`);
}

export function isBusinessDay(date: DateText): boolean {
  throw new Error(`not built yet: isBusinessDay ${date}`);
}

export function nextBusinessDay(date: DateText): DateText {
  throw new Error(`not built yet: nextBusinessDay ${date}`);
}

export function addBusinessDays(date: DateText, count: number): DateText {
  throw new Error(`not built yet: addBusinessDays ${date} ${String(count)}`);
}

export function closeDate(period: Period): DateText {
  throw new Error(`not built yet: closeDate ${period}`);
}

export function finalDate(period: Period): DateText {
  throw new Error(`not built yet: finalDate ${period}`);
}

export function payoutDate(period: Period): DateText {
  throw new Error(`not built yet: payoutDate ${period}`);
}

export function questionWindowEnds(finalOn: DateText): DateText {
  throw new Error(`not built yet: questionWindowEnds ${finalOn}`);
}

export function answerBy(askedOn: DateText): DateText {
  throw new Error(`not built yet: answerBy ${askedOn}`);
}

export function startOfDayMs(date: DateText): number {
  throw new Error(`not built yet: startOfDayMs ${date}`);
}
