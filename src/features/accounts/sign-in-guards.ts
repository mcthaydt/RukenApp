import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { hashNumber } from "./phone.ts";
import {
  isSignInPaused,
  SIGN_IN_FAILURE_LIMIT,
  SIGN_IN_PAUSE_MS,
  SIGN_IN_WINDOW_MS,
} from "./sign-in-guard.ts";

// The SignInGuard table behind the sign-in pause. Rows are keyed by the number's keyed hash
// (sign-in-guard.ts), so a number with no account is kept the same way as one with an account.
//
// How one password sign-in uses it (sign-in-pause-plugin.ts):
// 1. reserveSignInAttempt, before the password is checked: counts the guess and says whether it may
//    go ahead. Counting first, in one statement, is what keeps the limit at ten when many requests
//    for one number arrive at once (from many client addresses, so no per-IP limit stops them).
//    Counting afterwards would let every request already in flight be checked, and requests that
//    read the count at the same moment would overwrite each other's +1.
// 2. Then, by the answer: a right password calls clearSignInFailures; a wrong one calls
//    recordWrongPassword, which starts the pause when the limit is reached; anything else (a body
//    better-auth refused, a server error) calls releaseSignInAttempt, because it was not a guess.

/** What every function here needs. `secret` is BETTER_AUTH_SECRET, the key for the number hash. */
export interface SignInGuards {
  db: PrismaClient;
  clock: Clock;
  secret: string;
}

/** Whether password sign-in is paused for this number at the clock's time. */
export async function isSignInPausedFor(guards: SignInGuards, number: string): Promise<boolean> {
  const row = await guards.db.signInGuard.findUnique({
    where: { numberHash: hashNumber(number, guards.secret) },
  });
  return isSignInPaused(row, new Date(guards.clock.epochMs()));
}

/**
 * Counts one guess for this number and says whether it may be checked. One SQL statement does the
 * whole step, so concurrent requests take turns on the row (Postgres applies `ON CONFLICT DO
 * UPDATE` to one row at a time) and no count is lost:
 * - no row yet: insert a count of 1 with the window starting now;
 * - paused: change nothing (the pause is not stretched);
 * - the window has ended (which a pause that has ended always has, since it was set inside its
 *   window): restart it at now with a count of 1 and no pause;
 * - otherwise: add one.
 * The guess may go ahead when the number is not paused and the new count is at most the limit.
 * Guesses past the limit are counted too; that changes nothing, because the window start stays put.
 */
export async function reserveSignInAttempt(
  guards: SignInGuards,
  number: string,
): Promise<{ allowed: boolean }> {
  const numberHash = hashNumber(number, guards.secret);
  const now = new Date(guards.clock.epochMs());
  const windowEndedBefore = new Date(now.getTime() - SIGN_IN_WINDOW_MS);
  const rows = await guards.db.$queryRaw<{ failures: number; pausedUntil: Date | null }[]>`
    INSERT INTO "SignInGuard" ("numberHash", failures, "windowStartedAt", "pausedUntil", "updatedAt")
    VALUES (${numberHash}, 1, ${now}, NULL, ${now})
    ON CONFLICT ("numberHash") DO UPDATE SET
      failures = CASE
        WHEN "SignInGuard"."pausedUntil" > ${now} THEN "SignInGuard".failures
        WHEN "SignInGuard"."windowStartedAt" <= ${windowEndedBefore} THEN 1
        ELSE "SignInGuard".failures + 1
      END,
      "windowStartedAt" = CASE
        WHEN "SignInGuard"."pausedUntil" > ${now} THEN "SignInGuard"."windowStartedAt"
        WHEN "SignInGuard"."windowStartedAt" <= ${windowEndedBefore} THEN ${now}
        ELSE "SignInGuard"."windowStartedAt"
      END,
      "pausedUntil" = CASE
        WHEN "SignInGuard"."pausedUntil" > ${now} THEN "SignInGuard"."pausedUntil"
        WHEN "SignInGuard"."windowStartedAt" <= ${windowEndedBefore} THEN NULL
        ELSE "SignInGuard"."pausedUntil"
      END,
      "updatedAt" = ${now}
    RETURNING failures, "pausedUntil"`;
  const row = rows[0];
  if (row === undefined) throw new Error("sign-in guard upsert returned no row");
  const paused = row.pausedUntil !== null && row.pausedUntil.getTime() > now.getTime();
  return { allowed: !paused && row.failures <= SIGN_IN_FAILURE_LIMIT };
}

/**
 * A reserved guess was a wrong password. When the count has reached the limit and no pause is set
 * yet, this starts the pause, and `pauseStarted` is true for exactly one caller (the update only
 * matches while `pausedUntil` is empty), so the notice mail goes out once.
 */
export async function recordWrongPassword(
  guards: SignInGuards,
  number: string,
): Promise<{ pauseStarted: boolean }> {
  const now = guards.clock.epochMs();
  const { count } = await guards.db.signInGuard.updateMany({
    where: {
      numberHash: hashNumber(number, guards.secret),
      pausedUntil: null,
      failures: { gte: SIGN_IN_FAILURE_LIMIT },
    },
    data: { pausedUntil: new Date(now + SIGN_IN_PAUSE_MS) },
  });
  return { pauseStarted: count > 0 };
}

/**
 * Gives back a reserved guess that was not a guess after all (better-auth refused the body, or the
 * request failed). The row's check needs a count of at least 1, so a count of 1 removes the row.
 * A paused row is left as it is. Each statement is atomic; the pair is not, which at worst leaves
 * one extra count.
 */
export async function releaseSignInAttempt(guards: SignInGuards, number: string): Promise<void> {
  const numberHash = hashNumber(number, guards.secret);
  const removed = await guards.db.signInGuard.deleteMany({
    where: { numberHash, pausedUntil: null, failures: 1 },
  });
  if (removed.count > 0) return;
  await guards.db.signInGuard.updateMany({
    where: { numberHash, pausedUntil: null, failures: { gt: 1 } },
    data: { failures: { decrement: 1 } },
  });
}

/** Forgets the guesses for this number and lifts any pause: after a correct password, and after a password reset. */
export async function clearSignInFailures(
  guards: Pick<SignInGuards, "db" | "secret">,
  number: string,
): Promise<void> {
  await guards.db.signInGuard.deleteMany({ where: { numberHash: hashNumber(number, guards.secret) } });
}
