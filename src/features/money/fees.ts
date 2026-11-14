import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import {
  feeMicroCents,
  placeFee,
  reportTimeMs,
  type FeePlace,
  type FeeRow,
  type KnownIds,
} from "./fee-rows.ts";
import { lockLedger, postEntry, postingPeriod, postingPeriodForMonth, type MoneyTx } from "./journal.ts";
import { centsRoundedUp } from "./major-units.ts";
import { feeParts, postPaymentFee, releaseKey } from "./payment-posting.ts";
import { parsePeriod, type Period } from "./period.ts";

/**
 * Taking Stripe's other fees (Billing, Tax) off the top. `fee-report.ts` keeps every row of Stripe's report; this reads
 * the ones not yet placed, works out where each belongs with the pure `placeFee`, and posts what a payment's fee takes
 * from the two halves. It is the only place a report row becomes a journal entry.
 */

export interface FeeDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
}

/** How many report rows the run placed as each kind, and how many it could not place or read. */
export interface FeeCounts {
  readonly payment: number;
  readonly payout: number;
  readonly counted: number;
  readonly credit: number;
  readonly returned: number;
  readonly unplaced: number;
  readonly unreadable: number;
}

/**
 * A row that cannot be placed is looked at again by every run for this long after its report was stored, in case its
 * payment is posted late. Stripe's report runs four days behind, so two months is far more than enough.
 */
const LOOK_AT_AGAIN_FOR_MS = 62 * 24 * 60 * 60 * 1000;

/**
 * Places every report row not yet placed, in the order the reports were asked for and then by row, each in a
 * transaction of its own. A row that cannot be read, or names nothing known, writes nothing and is counted here: staff
 * are shown both. Everything else gets a `FeePosting` row, so it is never looked at again, and a payment's fee also
 * gets its entry.
 */
export async function postFeeRows(deps: FeeDeps): Promise<FeeCounts> {
  const nowMs = deps.clock.epochMs();
  const rows = await deps.db.stripeFeeRow.findMany({
    where: {
      posting: null,
      run: { state: "stored", storedAt: { gte: new Date(nowMs - LOOK_AT_AGAIN_FOR_MS) } },
    },
    orderBy: [{ run: { intervalStart: "asc" } }, { rowNumber: "asc" }],
  });
  const known = await knownIds(deps.db);
  const counts = { payment: 0, payout: 0, counted: 0, credit: 0, returned: 0, unplaced: 0, unreadable: 0 };
  for (const row of rows) {
    const place = placeFee(row, known);
    counts[place.kind] += 1;
    if (place.kind === "unplaced" || place.kind === "unreadable") continue;
    await deps.db.$transaction((tx) => placeRow(tx, row, place, nowMs));
  }
  return counts;
}

/** What a row can be placed against, read from what has been posted so far. */
async function knownIds(db: PrismaClient): Promise<KnownIds> {
  const postings = await db.paymentPosting.findMany({
    select: {
      stripeInvoiceId: true,
      stripeChargeId: true,
      stripePaymentIntentId: true,
      balanceTransactionId: true,
    },
  });
  const reversals = await db.stripeReversal.findMany({ select: { balanceTransactionIds: true } });
  const payments = new Map<string, string>();
  for (const posting of postings) {
    payments.set(posting.stripeInvoiceId, posting.stripeInvoiceId);
    payments.set(posting.stripeChargeId, posting.stripeInvoiceId);
    if (posting.stripePaymentIntentId !== null) {
      payments.set(posting.stripePaymentIntentId, posting.stripeInvoiceId);
    }
  }
  return {
    payments,
    // Payouts and bank accounts are filled in when their tables exist (the payout branch).
    payouts: new Map(),
    // A fee already read from a payment's own balance transaction, a refund's or a dispute's is the same fee.
    counted: new Set([
      ...postings.map((posting) => posting.balanceTransactionId),
      ...reversals.flatMap((reversal) => reversal.balanceTransactionIds),
    ]),
  };
}

type PlacedKind = Exclude<FeePlace, { kind: "unplaced" | "unreadable" }>;

/** What placing a row uses of a transaction. */
type FeeTx = MoneyTx & Pick<PrismaClient, "feePosting" | "membershipPayment" | "paymentPosting">;

/** A stored report row, as read back. */
type StoredRow = FeeRow & { readonly id: string };

async function placeRow(tx: FeeTx, row: StoredRow, place: PlacedKind, nowMs: number): Promise<void> {
  await lockLedger(tx);
  // A run that waited for the lock finds what the one before it placed.
  if ((await tx.feePosting.findUnique({ where: { feeRowId: row.id } })) !== null) return;
  const microCents = feeMicroCents(row);
  if (microCents === null) throw new Error(`Fee row ${row.id} was placed but cannot be read`);

  const stripeInvoiceId = place.kind === "payment" ? place.stripeInvoiceId : null;
  const takenBefore = stripeInvoiceId === null ? 0n : await microCentsTaken(tx, stripeInvoiceId);
  await tx.feePosting.create({
    data: {
      feeRowId: row.id,
      kind: place.kind,
      stripeInvoiceId,
      makerUserId: place.kind === "payout" ? place.makerUserId : null,
      microCents,
      postedAt: new Date(nowMs),
    },
  });
  if (stripeInvoiceId === null) return;

  // The fractions of a cent are added up for the payment and rounded up once, so what is taken is never less than what
  // Stripe charged and is more by less than a cent. This row takes the cents it adds to that rounded-up total.
  const cents = centsRoundedUp(takenBefore + microCents) - centsRoundedUp(takenBefore);
  if (cents > 0n) await postFeeEntry(tx, { row, stripeInvoiceId, cents, takenBefore, nowMs });
}

/** The fees already placed on a payment, in millionths of a cent. */
async function microCentsTaken(tx: FeeTx, stripeInvoiceId: string): Promise<bigint> {
  const { _sum } = await tx.feePosting.aggregate({
    where: { stripeInvoiceId, kind: "payment" },
    _sum: { microCents: true },
  });
  return _sum.microCents ?? 0n;
}

/**
 * The entry for a payment's later fee: each month's pool gives up the part it would have given up had the fee been
 * known when the payment was posted, and Ruken's half gives up the rest (`feeParts`).
 */
async function postFeeEntry(
  tx: FeeTx,
  input: { row: StoredRow; stripeInvoiceId: string; cents: bigint; takenBefore: bigint; nowMs: number },
): Promise<void> {
  const { row, stripeInvoiceId, cents, takenBefore, nowMs } = input;
  const payment = await tx.membershipPayment.findUniqueOrThrow({ where: { stripeInvoiceId } });
  const posting = await tx.paymentPosting.findUniqueOrThrow({ where: { stripeInvoiceId } });
  const firstPeriod = parsePeriod(posting.firstPeriod);
  const parts = feeParts(
    {
      plan: payment.plan,
      firstPeriod,
      gross: payment.grossCents,
      tax: payment.taxCents,
      // The card fee and every cent already taken for this payment: what the makers' half was last worked out from.
      fees: payment.cardFeeCents + centsRoundedUp(takenBefore),
    },
    cents,
  );

  // Where each month's part comes from, looked up first because the rule is not plain: a month not released yet (and
  // not the payment's first) still sits in `premium:deferred`; any other month's pool is the month's own while that is
  // open, and the open month's once it has closed.
  const accounts = new Map<Period, string>();
  for (const { period } of parts.months) {
    const waiting = period !== firstPeriod && !(await isReleased(tx, stripeInvoiceId, period));
    const pool = waiting ? null : await postingPeriodForMonth(tx, period, nowMs);
    accounts.set(period, pool === null ? "premium:deferred" : `pool:premium:${pool}`);
  }
  const at = reportTimeMs(row.incurredAt);
  if (at === null) throw new Error(`Fee row ${row.id} has a time that cannot be read`);
  await postEntry(tx, {
    key: `fee:${row.id}`,
    period: await postingPeriod(tx, at, nowMs),
    kind: "payment_fee",
    stripeInvoiceId,
    lines: postPaymentFee(parts, (period) => {
      const account = accounts.get(period);
      if (account === undefined) throw new Error(`No account was chosen for ${period}`);
      return account;
    }),
  });
}

/** Whether any part of a month has been released from `premium:deferred` into its pool. */
async function isReleased(tx: FeeTx, stripeInvoiceId: string, period: Period): Promise<boolean> {
  const key = releaseKey(stripeInvoiceId, period);
  return (await tx.journalEntry.count({ where: { idempotencyKey: { startsWith: key } } })) > 0;
}
