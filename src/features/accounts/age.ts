import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";

export interface BirthDate {
  year: number;
  month: number;
  day: number;
}

export type AgeCheck =
  { kind: "invalid" } | { kind: "under13" } | { kind: "minor" | "adult"; adultOn: string };

export function ageCheck(date: BirthDate, clock: Clock): AgeCheck {
  throw new Error(`not built yet (${String(date.year)} ${String(clock.epochMs())})`);
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

export function setBirthDate(
  db: PrismaClient,
  clock: Clock,
  input: { userId: string; date: BirthDate },
): Promise<{ minor: boolean }> {
  throw new Error(`not built yet (${typeof db} ${String(clock.epochMs())} ${input.userId})`);
}
