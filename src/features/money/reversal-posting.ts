import { lrr, pct } from "./arithmetic.ts";
import type { Period } from "./period.ts";
import type { Release } from "./payment-posting.ts";
import { requireNonNegative, withoutZeroLines, type PostingLine } from "./posting.ts";
import { CHARGEBACK_COST_MAKERS_SHARE_BPS } from "./rules.ts";

/**
 * Refunds and chargebacks. When a member disputes a payment and Stripe takes the money back (or Ruken refunds it):
 *
 * 1. Cash: Stripe took the disputed amount and its dispute fee, less any fee it returned.
 * 2. The payment is undone, scaled by amount / gross for a partial dispute: the tax, Ruken's revenue and the fees go
 *    back, and so does the makers' share. That share went two ways: the first month straight into a pool, the rest
 *    into `premium:deferred` to be released month by month. What is still deferred is cancelled first (the latest
 *    months first, see `cancelledMonths`); only what already reached a pool comes out of the pool month that is open
 *    now. A closed month is never reopened, so the open month carries it, and a month that goes negative carries
 *    forward.
 * 3. What Stripe kept (the fees and the dispute fee, less any fee returned) is shared half and half: the makers'
 *    half, rounded up, also out of the open pool month (the makers of a pool are only known when it is shared out),
 *    and Ruken's half as a processor fee.
 *
 * A won dispute reverses the opened entry, keeping any fee Stripe does not give back (`postChargebackWon`). A lost
 * one posts nothing more: the opened entry already says the money is gone.
 */

export interface Chargeback {
  /**
   * The payment's own lines and every later fee's lines, read back from the ledger. Several lines for one account
   * are added up, so a chargeback also undoes the later fees in proportion.
   */
  readonly paymentLines: readonly PostingLine[];
  /** What the member paid, tax included, in cents. */
  readonly paymentGross: bigint;
  /** What the member disputed, in cents; at most the payment's gross. */
  readonly amount: bigint;
  /** Stripe's dispute fee. */
  readonly disputeFee: bigint;
  /** Any fee Stripe gave back with the dispute. */
  readonly feeReturned: bigint;
  /** What of this payment's makers' share still waits in `premium:deferred` (its months not released yet). */
  readonly deferredLeft: bigint;
  /** The pool month that is open now. */
  readonly openPool: Period;
}

/** A refund is a chargeback with no dispute fee. */
export type Refund = Omit<Chargeback, "disputeFee">;

const CASH_ACCOUNT = "platform:stripe_clearing";
const DEFERRED_ACCOUNT = "premium:deferred";
const POOL_PREFIX = "pool:premium:";
/** Stands for the makers' share while the payment's lines are scaled; never posted. */
const POOL_SHARE = "pool-share";

function isPoolShareLine(line: PostingLine): boolean {
  return line.account === DEFERRED_ACCOUNT || line.account.startsWith(POOL_PREFIX);
}

/** Several lines for one account become one, in the order the accounts first appear. */
function addedUpByAccount(lines: readonly PostingLine[]): PostingLine[] {
  const totals = new Map<string, bigint>();
  for (const line of lines) totals.set(line.account, (totals.get(line.account) ?? 0n) + line.amount);
  return withoutZeroLines([...totals].map(([account, amount]) => ({ account, amount })));
}

export function postChargebackOpened(chargeback: Chargeback): PostingLine[] {
  const { paymentGross, amount, disputeFee, feeReturned, deferredLeft, openPool } = chargeback;
  requireNonNegative(paymentGross, amount, disputeFee, feeReturned, deferredLeft);
  if (paymentGross === 0n) throw new RangeError("A chargeback needs a payment that took money");
  if (amount > paymentGross) throw new RangeError("A chargeback can't be for more than the payment");
  const paymentLines = addedUpByAccount(chargeback.paymentLines);
  const deferredAtPayment = -paymentLines
    .filter((line) => line.account === DEFERRED_ACCOUNT)
    .reduce((total, line) => total + line.amount, 0n);
  if (deferredLeft > deferredAtPayment) {
    throw new RangeError("A payment can't have more deferred than its payment put there");
  }

  // The makers' share is one amount, however it was placed, so it is scaled as one line: the first month's part and
  // the deferred part together, in the place of the first of them.
  const makersShare = paymentLines.filter(isPoolShareLine).reduce((total, line) => total + line.amount, 0n);
  const firstPoolLine = paymentLines.findIndex(isPoolShareLine);
  const merged = paymentLines.flatMap((line, index) => {
    if (!isPoolShareLine(line)) return [line];
    return index === firstPoolLine ? [{ account: POOL_SHARE, amount: makersShare }] : [];
  });

  const cash: PostingLine = { account: CASH_ACCOUNT, amount: -(amount + disputeFee - feeReturned) };
  const reversed = reversePaymentLines(merged, amount, paymentGross).flatMap((line) => {
    if (line.account !== POOL_SHARE) return [line];
    // The deferred months are cancelled first; the rest comes out of the open pool month.
    const fromDeferred = line.amount < deferredLeft ? line.amount : deferredLeft;
    return [
      { account: DEFERRED_ACCOUNT, amount: fromDeferred },
      { account: `${POOL_PREFIX}${openPool}`, amount: line.amount - fromDeferred },
    ];
  });

  // What Stripe kept: whatever the cash line and the reversal leave unbalanced.
  const kept = -[cash, ...reversed].reduce((total, line) => total + line.amount, 0n);
  if (kept < 0n) throw new RangeError("Stripe can't return more fees than it kept");
  const makersPart = pct(kept, CHARGEBACK_COST_MAKERS_SHARE_BPS);

  return withoutZeroLines([
    cash,
    ...reversed,
    { account: `${POOL_PREFIX}${openPool}`, amount: makersPart },
    { account: "platform:processor_fees", amount: kept - makersPart },
  ]);
}

/**
 * A won dispute: the opened entry is undone. The cancelled months go back into `premium:deferred`, so their releases
 * go on; what came out of a pool month goes back into the pool month open now, since the earlier one may have closed.
 * The cash is what Stripe actually gave back (`reinstated`); any part of what it took that it keeps (usually the
 * dispute fee, on some pricing) is shared half and half as on opening: the makers' half, rounded up, out of the open
 * pool month.
 */
export function postChargebackWon(
  opened: readonly PostingLine[],
  openPool: Period,
  reinstated: bigint,
): PostingLine[] {
  const { reversal, notReturned } = reverseOpenedEntry(opened, reinstated);
  const makersPart = pct(notReturned, CHARGEBACK_COST_MAKERS_SHARE_BPS);
  return withoutZeroLines([
    ...reversal.map((line) => ({
      account: line.account.startsWith(POOL_PREFIX) ? `${POOL_PREFIX}${openPool}` : line.account,
      amount: line.amount,
    })),
    { account: `${POOL_PREFIX}${openPool}`, amount: makersPart },
    { account: "platform:processor_fees", amount: notReturned - makersPart },
  ]);
}

/**
 * A refund: a chargeback with no dispute fee. The refund goes back out of Stripe, each side gives back its part in
 * proportion, the months not yet released are cancelled first, and whatever fee Stripe does not return is shared as a
 * chargeback shares it.
 */
export function postRefund(refund: Refund): PostingLine[] {
  return postChargebackOpened({ ...refund, disputeFee: 0n });
}

/**
 * How much of each deferred month a chargeback cancelled: `cancelled` cents in all, the latest month first, the last
 * one reached in part. Months are released in order, so the months not yet released are always the latest ones, and
 * this needs only the amount the opened entry took from `premium:deferred` to say which months lost what. The release
 * job releases each month's part less what was cancelled from it.
 */
export function cancelledMonths(releases: readonly Release[], cancelled: bigint): Map<Period, bigint> {
  requireNonNegative(cancelled);
  const months = new Map<Period, bigint>();
  let left = cancelled;
  for (const release of [...releases].reverse()) {
    if (left === 0n) break;
    const part = left < release.amount ? left : release.amount;
    months.set(release.period, part);
    left -= part;
  }
  if (left > 0n) throw new RangeError("A chargeback can't cancel more than the payment deferred");
  return months;
}

/**
 * The opened entry with every line's sign turned, and its cash line replaced by what Stripe gave back (`reinstated`),
 * with how much of what Stripe took it kept (`notReturned`).
 */
export function reverseOpenedEntry(
  opened: readonly PostingLine[],
  reinstated: bigint,
): { reversal: PostingLine[]; notReturned: bigint } {
  requireNonNegative(reinstated);
  const cash = opened.find((line) => line.account === CASH_ACCOUNT);
  if (cash === undefined) throw new RangeError("An opened chargeback has a cash line");
  const takenOut = -cash.amount;
  if (reinstated > takenOut) throw new RangeError("Stripe can't give back more than the dispute took");
  const reversal = opened.map((line) => ({
    ...line,
    amount: line === cash ? reinstated : -line.amount,
  }));
  return { reversal, notReturned: takenOut - reinstated };
}

/**
 * A payment's non-cash lines with the opposite sign. For a partial chargeback each side of the payment is scaled by
 * amount / gross: the credits (what the payment gave out) and the debits (a processor fee) separately, each rounded
 * half up once and then shared back over its lines with largest-remainder rounding, so the lines keep the payment's
 * proportions and add up exactly.
 */
export function reversePaymentLines(
  paymentLines: readonly PostingLine[],
  amount: bigint,
  paymentGross: bigint,
): PostingLine[] {
  const nonCash = paymentLines.filter((line) => line.account !== CASH_ACCOUNT && line.amount !== 0n);
  const credits = scaleGroup(
    nonCash.filter((line) => line.amount < 0n),
    amount,
    paymentGross,
  );
  const debits = scaleGroup(
    nonCash.filter((line) => line.amount > 0n),
    amount,
    paymentGross,
  );
  // Keep the payment's line order, so the entry reads like the payment backwards.
  return nonCash.map((line) => {
    const scaled = credits.get(line) ?? debits.get(line) ?? 0n;
    return { ...line, amount: -scaled };
  });
}

/** Scales one side's lines (all the same sign) by amount / gross; returns each line's new amount. */
function scaleGroup(
  lines: readonly PostingLine[],
  amount: bigint,
  paymentGross: bigint,
): Map<PostingLine, bigint> {
  const scaledLines = new Map<PostingLine, bigint>();
  const [firstLine] = lines;
  if (firstLine === undefined) return scaledLines;
  const sign = firstLine.amount < 0n ? -1n : 1n;
  const total = lines.reduce((sum, line) => sum + line.amount * sign, 0n);
  // total × amount / gross, rounded half up.
  const scaledTotal = (total * amount * 2n + paymentGross) / (2n * paymentGross);
  const shares = lrr(
    scaledTotal,
    lines.map((line, index) => ({ key: String(index), weight: line.amount * sign })),
  );
  lines.forEach((line, index) => {
    scaledLines.set(line, (shares.get(String(index)) ?? 0n) * sign);
  });
  return scaledLines;
}
