import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { lockLedger, postEntry, postingPeriodForMonth } from "./journal.ts";
import { centsRoundedUp } from "./major-units.ts";
import { postRelease, releaseKey, releases } from "./payment-posting.ts";
import { addMonths, parsePeriod, periodOf, type Period } from "./period.ts";
import { cancelledMonths } from "./reversal-posting.ts";

/**
 * Releasing a yearly payment's months. A yearly payment puts its first month's part into that month's pool at once
 * and keeps the other eleven in `premium:deferred`. When each later month opens, that month's part moves into the
 * month's pool, so it goes only to the games members play that month.
 *
 * The daily job calls this, so a run that was missed is repaired by the next one: it looks at every month that has
 * opened and posts what is missing. Each release has its own key (`release:<invoice>:<month>`), so running twice posts
 * nothing twice. A release for a month that has closed goes into the open month's pool instead; a closed month is
 * never reopened.
 */

export interface ReleaseDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
}

/** Payments older than this have released everything, so the daily scan stops looking at them. */
const RELEASE_WINDOW_MS = 400 * 24 * 60 * 60 * 1000;

/** How many months a yearly payment sets aside: all but the first. */
const LATER_MONTHS = 11;

/** A yearly payment whose release could not be posted, and why in the error's own words. */
export interface ReleaseFailure {
  readonly stripeInvoiceId: string;
  readonly message: string;
}

/**
 * Posts every release that is due and not yet posted. Answers how many it posted, and (only when there were any) the
 * payments it could not release. One payment that fails never stops the others: its error is kept, the loop goes on
 * to the next payment, and the caller reports it. A payment that fails is tried again by the next run.
 */
export async function releaseDueMonths(
  deps: ReleaseDeps,
): Promise<{ released: number; failed?: readonly ReleaseFailure[] }> {
  const nowMs = deps.clock.epochMs();
  const currentMonth = periodOf(nowMs);
  const yearly = await deps.db.paymentPosting.findMany({
    where: { postedAt: { gte: new Date(nowMs - RELEASE_WINDOW_MS) }, payment: { plan: "annual" } },
    orderBy: { postedAt: "asc" },
    select: { stripeInvoiceId: true, firstPeriod: true },
  });
  let released = 0;
  const failed: ReleaseFailure[] = [];
  for (const { stripeInvoiceId, firstPeriod } of yearly) {
    try {
      for (let offset = 1; offset <= LATER_MONTHS; offset += 1) {
        // Months written `YYYY-MM` sort in time order, so a plain comparison finds the months that have opened.
        const month = addMonths(parsePeriod(firstPeriod), offset);
        if (month > currentMonth) break;
        if (await releaseMonth(deps.db, stripeInvoiceId, month, nowMs)) released += 1;
      }
    } catch (error) {
      failed.push({ stripeInvoiceId, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return failed.length === 0 ? { released } : { released, failed };
}

/**
 * Posts what is missing of one month's release: its part (worked out from every fee taken from the payment so far),
 * less what a refund or chargeback that stands cancelled from it, less what earlier releases of that month moved.
 * Usually that is the whole part, once, under `release:<invoice>:<month>`. A month released in part while a dispute
 * stood is topped up after the dispute is won, under `:2` (then `:3`). Nothing is ever taken back here: a fee that
 * comes after a month was released was taken from that month's pool by its own entry, and a reversal has its own.
 *
 * One transaction per release, under the ledger's lock, reading what it needs inside it: a fee or a dispute posted a
 * moment earlier is seen, and one being posted waits for this release to commit.
 */
async function releaseMonth(db: PrismaClient, stripeInvoiceId: string, month: Period, nowMs: number) {
  const baseKey = releaseKey(stripeInvoiceId, month);
  return db.$transaction(async (tx) => {
    await lockLedger(tx);
    const payment = await tx.membershipPayment.findUniqueOrThrow({ where: { stripeInvoiceId } });
    const posting = await tx.paymentPosting.findUniqueOrThrow({ where: { stripeInvoiceId } });
    const taken = await tx.feePosting.aggregate({
      where: { stripeInvoiceId, kind: "payment" },
      _sum: { microCents: true },
    });
    const parts = releases({
      plan: payment.plan,
      firstPeriod: parsePeriod(posting.firstPeriod),
      gross: payment.grossCents,
      tax: payment.taxCents,
      fees: payment.cardFeeCents + centsRoundedUp(taken._sum.microCents ?? 0n),
    });

    // What a refund or a chargeback that stands took out of the months set aside: its entries' lines on
    // `premium:deferred`, less what a won dispute gave back. It cancels the latest months first.
    const cancelledLines = await tx.journalLine.aggregate({
      where: {
        account: "premium:deferred",
        entry: { stripeInvoiceId, kind: { in: ["refund", "chargeback"] } },
      },
      _sum: { amount: true },
    });
    // A fee that came after a refund made the parts add up to less than the refund cancelled (the fee's own part of
    // those months was never set aside), so what a payment's months can lose stops at what they are worth.
    const worth = parts.reduce((total, release) => total + release.amount, 0n);
    const standing = cancelledLines._sum.amount ?? 0n;
    const cancelled = cancelledMonths(parts, standing < worth ? standing : worth);
    const part = parts.find((candidate) => candidate.period === month)?.amount ?? 0n;
    const target = part - (cancelled.get(month) ?? 0n);

    const earlier = await tx.journalEntry.findMany({
      where: { OR: [{ idempotencyKey: baseKey }, { idempotencyKey: { startsWith: `${baseKey}:` } }] },
      include: { lines: { where: { account: "premium:deferred" } } },
    });
    const alreadyReleased = earlier
      .flatMap((entry) => entry.lines)
      .reduce((total, line) => total + line.amount, 0n);
    const missing = target - alreadyReleased;
    if (missing <= 0n) return false;

    const period = await postingPeriodForMonth(tx, month, nowMs);
    await postEntry(tx, {
      key: earlier.length === 0 ? baseKey : `${baseKey}:${String(earlier.length + 1)}`,
      period,
      kind: "release",
      stripeInvoiceId,
      lines: postRelease({ period, amount: missing }),
    });
    return true;
  });
}
