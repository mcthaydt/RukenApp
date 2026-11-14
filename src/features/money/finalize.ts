import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { placeFee, reportTimeMs } from "./fee-rows.ts";
import { lockLedger } from "./journal.ts";
import { parsePeriod, periodOf, type Period } from "./period.ts";
import { finalAt, latestPeriodDue } from "./periods.ts";
import { sharePool } from "./pool-run.ts";
import { writeStatements } from "./statements.ts";

/**
 * Making a month final. At midnight starting the 10th of the next month in Chicago, a closed month's pool is shared,
 * every maker's statement is written, and the month moves from closed to final, after which the database takes no more
 * entries for it. A fact that arrives later is posted into the month that is open, so a final month's statements never
 * move. Everything happens in one transaction, so a failure undoes all of it and the next run starts from the same place.
 *
 * Not carried from the old code: the earnings unlock, the two-day draft and its comparison, the notifications, and
 * drafting the payout run (the payout branch adds that back).
 */

export interface FinalizeDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
}

/** One transaction covers a whole month's sharing and statements: generous, and bounded. */
const TRANSACTION_TIMEOUT_MS = 120_000;

/**
 * Makes `period` final and answers the makers a statement was written for. Refuses before `finalAt(period)`; answers
 * `final: false` for a month already final; refuses while an earlier month is not final (a statement carries what the
 * maker was owed from before, so months go in order); and refuses while Stripe's report holds a fee that reached Ruken's
 * balance in this month and cannot be read, because that fee would not come off the top and Ruken's half would pay it.
 */
export async function finalizePeriod(
  deps: FinalizeDeps,
  period: Period,
): Promise<{ final: boolean; makers: string[] }> {
  const nowMs = deps.clock.epochMs();
  if (nowMs < finalAt(period)) {
    throw new RangeError(
      `Period ${period} cannot become final before ${new Date(finalAt(period)).toISOString()}`,
    );
  }
  const row = await deps.db.ledgerPeriod.findUnique({ where: { period } });
  if (row?.state === "final") return { final: false, makers: [] };
  const earlier = await deps.db.ledgerPeriod.findFirst({
    where: { period: { lt: period }, state: { not: "final" } },
    orderBy: { period: "asc" },
  });
  if (earlier !== null) {
    throw new Error(
      `Period ${period} cannot become final while ${earlier.period} is not final; make it final first`,
    );
  }
  await refuseWhileAFeeCannotBeRead(deps.db, period);

  return deps.db.$transaction(
    async (tx) => {
      await lockLedger(tx);
      await sharePool(tx, period, nowMs);
      const { makers } = await writeStatements(tx, period, nowMs);
      // Only a closed month moves: the daily job closes it first.
      const { count } = await tx.ledgerPeriod.updateMany({
        where: { period, state: "closed" },
        data: { state: "final", finalAt: new Date(nowMs) },
      });
      if (count !== 1) throw new Error(`Period ${period} is not closed, so it cannot become final`);
      return { final: true, makers };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

/**
 * A report row that is not read and not placed is kept and shown to staff. One that cannot be read at all (an amount
 * that is not a number, a currency that is not US dollars, a time that is not a time) stops the month it belongs to from
 * becoming final, and a row whose time cannot be read has no month, so it stops every month, until a change to the code
 * can read it. A fee Stripe's credits paid, one it gave back, and one that names nothing known do not: they are readable.
 */
async function refuseWhileAFeeCannotBeRead(db: PrismaClient, period: Period): Promise<void> {
  const nothingKnown = {
    payments: new Map<string, string>(),
    payouts: new Map<string, string>(),
    counted: new Set<string>(),
  };
  const unplaced = await db.stripeFeeRow.findMany({ where: { posting: null, run: { state: "stored" } } });
  for (const row of unplaced) {
    if (placeFee(row, nothingKnown).kind !== "unreadable") continue;
    const reachedBalanceAt = reportTimeMs(row.balanceTransactionAt);
    if (reachedBalanceAt === null || periodOf(reachedBalanceAt) === period) {
      throw new Error(`Stripe sent a fee this code cannot read, so ${period} is not made final`);
    }
  }
}

/**
 * Every month that is due and not final, oldest first. It stops at the first that fails (the error goes to the caller),
 * and answers the months it made final.
 */
export async function finalizeDuePeriods(deps: FinalizeDeps): Promise<Period[]> {
  const latest = latestPeriodDue(deps.clock.epochMs(), finalAt);
  const due = await deps.db.ledgerPeriod.findMany({
    where: { period: { lte: latest }, state: { not: "final" } },
    orderBy: { period: "asc" },
    select: { period: true },
  });
  const made: Period[] = [];
  for (const { period } of due) {
    if ((await finalizePeriod(deps, parsePeriod(period))).final) made.push(parsePeriod(period));
  }
  return made;
}
