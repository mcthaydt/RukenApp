import { Temporal } from "@js-temporal/polyfill";
import { chicagoDayOf, type Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";

/**
 * Age at sign-up. Ruken is for 13 and up. The birth date is used once and never stored: the only
 * fact kept is the date of the 18th birthday (`User.adultOn`), as an ISO `YYYY-MM-DD` string here.
 * Every date is a calendar day in America/Chicago, the product's time zone, so a birthday starts at
 * Chicago midnight whatever the server's zone.
 */

export interface BirthDate {
  year: number;
  month: number;
  day: number;
}

export type AgeCheck =
  | { kind: "invalid" }
  /** No date is returned: nothing about an under-13 visitor may be stored. */
  | { kind: "under13" }
  | { kind: "minor" | "adult"; adultOn: string };

function todayInChicago(clock: Clock): Temporal.PlainDate {
  return Temporal.PlainDate.from(chicagoDayOf(clock.epochMs()));
}

/**
 * The day someone born on `birth` turns `years` old. A 29 February birthday falls on 1 March in
 * a year without one (the common legal reading). Temporal's default would pick 28 February, so
 * the case is handled by hand.
 */
function birthdayAt(birth: Temporal.PlainDate, years: number): Temporal.PlainDate {
  const year = birth.year + years;
  if (
    birth.month === 2 &&
    birth.day === 29 &&
    !Temporal.PlainDate.from({ year, month: 1, day: 1 }).inLeapYear
  ) {
    return Temporal.PlainDate.from({ year, month: 3, day: 1 });
  }
  return Temporal.PlainDate.from({ year, month: birth.month, day: birth.day });
}

/** Sorts a birth date into what sign-up does with it. A date that does not exist, or is after today, is `invalid`. */
export function ageCheck(date: BirthDate, clock: Clock): AgeCheck {
  let birth: Temporal.PlainDate;
  try {
    // `reject` refuses 30 February or month 13 instead of quietly moving them to a real day.
    birth = Temporal.PlainDate.from(date, { overflow: "reject" });
  } catch {
    return { kind: "invalid" };
  }
  const today = todayInChicago(clock);
  if (Temporal.PlainDate.compare(birth, today) > 0) return { kind: "invalid" };
  if (Temporal.PlainDate.compare(today, birthdayAt(birth, 13)) < 0) return { kind: "under13" };
  const adultOn = birthdayAt(birth, 18);
  return {
    kind: Temporal.PlainDate.compare(today, adultOn) < 0 ? "minor" : "adult",
    adultOn: adultOn.toString(),
  };
}

export type AgeErrorCode = "INVALID_DATE" | "AGE_NOT_ALLOWED" | "AGE_ALREADY_SET";

export class AgeError extends Error {
  override readonly name = "AgeError";
  readonly code: AgeErrorCode;

  constructor(code: AgeErrorCode) {
    super(code);
    this.code = code;
  }
}

/**
 * Answers the age question for an account. Stores the 18th birthday once and never the birth date.
 * Under 13 writes nothing. The write only matches a row whose `adultOn` is still null, so two
 * answers sent at once cannot both land: the second one is `AGE_ALREADY_SET`.
 */
export async function setBirthDate(
  db: PrismaClient,
  clock: Clock,
  input: { userId: string; date: BirthDate },
): Promise<{ minor: boolean }> {
  const age = ageCheck(input.date, clock);
  if (age.kind === "invalid") throw new AgeError("INVALID_DATE");
  if (age.kind === "under13") throw new AgeError("AGE_NOT_ALLOWED");

  // A DATE column: Prisma reads and writes it as UTC midnight of that day.
  const written = await db.user.updateMany({
    where: { id: input.userId, adultOn: null },
    data: { adultOn: new Date(`${age.adultOn}T00:00:00Z`) },
  });
  if (written.count === 0) throw new AgeError("AGE_ALREADY_SET");
  return { minor: age.kind === "minor" };
}
