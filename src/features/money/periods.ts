import { Temporal } from "@js-temporal/polyfill";
import { CALENDAR_ZONE, type Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { closeDate, finalDate, startOfDayMs } from "./calendar.ts";
import { lockLedger } from "./journal.ts";
import { addMonths, parsePeriod, type Period } from "./period.ts";

/**
 * When a month closes and is made final, and the move from open to closed. A month closes at midnight starting the 8th
 * of the next month in Chicago, so a late fact (Stripe's Fees report can run four days behind) is still posted into
 * the month it belongs to until then; it is made final at midnight starting the 10th. The daily job runs once, in the
 * small hours, so each moment is reached by the first run on or after its day. `LedgerPeriod_forward_only` in the
 * database allows only open, then closed, then final, and is the one rule for the order.
 */

export interface PeriodDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
}

/** The instant `period` closes: midnight starting the 8th of the next month, in Chicago. */
export function closeAt(period: Period): number {
  return startOfDayMs(closeDate(period));
}

/** The instant `period` is made final: midnight starting the 10th of the next month, in Chicago. */
export function finalAt(period: Period): number {
  return startOfDayMs(finalDate(period));
}

/**
 * The latest month whose moment (`closeAt` or `finalAt`) is at or before `nowMs`. Both moments fall in the month after
 * the period, so it is last month's or the month before's.
 */
export function latestPeriodDue(nowMs: number, momentOf: (period: Period) => number): Period {
  const { year, month } = Temporal.Instant.fromEpochMilliseconds(nowMs).toZonedDateTimeISO(CALENDAR_ZONE);
  const thisMonth = parsePeriod(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
  const lastMonth = addMonths(thisMonth, -1);
  return momentOf(lastMonth) <= nowMs ? lastMonth : addMonths(thisMonth, -2);
}

/**
 * Moves `period` from open to closed, making its row first if nothing has posted into it yet. Answers `closed: false`
 * when it was already closed or final, so a second run does nothing. A month is never closed before its time: a fact
 * for it could still be on its way.
 *
 * It takes the ledger's lock, as everything that posts does, so a closing never lands in the middle of a posting.
 */
export async function closePeriod(deps: PeriodDeps, period: Period): Promise<{ closed: boolean }> {
  const nowMs = deps.clock.epochMs();
  if (nowMs < closeAt(period)) {
    throw new RangeError(`Period ${period} cannot close before ${new Date(closeAt(period)).toISOString()}`);
  }
  return deps.db.$transaction(async (tx) => {
    await lockLedger(tx);
    await tx.ledgerPeriod.upsert({ where: { period }, create: { period }, update: {} });
    // Only an open row matches, so a month already closed or final is left as it is.
    const { count } = await tx.ledgerPeriod.updateMany({
      where: { period, state: "open" },
      data: { state: "closed", closedAt: new Date(nowMs) },
    });
    return { closed: count === 1 };
  });
}

/**
 * What the daily job does: closes the latest month whose time has come (making its row if needed), and every older
 * month still open, oldest first. Answers the months it closed.
 */
export async function closeDuePeriods(deps: PeriodDeps): Promise<Period[]> {
  const latest = latestPeriodDue(deps.clock.epochMs(), closeAt);
  const stillOpen = await deps.db.ledgerPeriod.findMany({
    where: { state: "open", period: { lt: latest } },
    orderBy: { period: "asc" },
    select: { period: true },
  });
  const closed: Period[] = [];
  for (const period of [...stillOpen.map((row) => parsePeriod(row.period)), latest]) {
    if ((await closePeriod(deps, period)).closed) closed.push(period);
  }
  return closed;
}
