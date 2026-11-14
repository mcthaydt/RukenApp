import type { Period } from "./period.ts";
import { poolContributions, type Payment, type PoolContribution } from "./pool-share.ts";
import { requireNonNegative, withoutZeroLines, type PostingLine } from "./posting.ts";

/**
 * Posting for a payment. Pure, like the rest of `posting.ts`; the service around it records the fact and writes the
 * entries in one transaction.
 *
 * Accounts used here and in `reversal-posting.ts`:
 *
 * - `platform:stripe_clearing`: Ruken's money at Stripe;
 * - `platform:processor_fees`: fees Ruken carries alone (the card fee is posted here; what is left to split already
 *   leaves it out);
 * - `platform:tax_payable`: tax Stripe collected;
 * - `platform:revenue:premium`: Ruken's half;
 * - `premium:deferred`: the months of a yearly payment that have not come yet;
 * - `pool:premium:<period>`: the makers' half for a month, until it is shared out.
 */

/** One month's part of a payment's makers' half. */
export type Release = PoolContribution;

/** What a fee that arrives after its payment takes from each side. */
export interface FeeParts {
  /** What each month's pool gives up; months that give up nothing are left out. */
  readonly months: readonly Release[];
  /** What Ruken's half gives up. */
  readonly ruken: bigint;
}

/**
 * A payment (monthly or yearly), with every fee known when it is posted. The makers' half `C` comes from
 * `poolContributions`:
 *
 * - cash: what Stripe will pay out, `gross − fees`; the fees are an expense;
 * - the tax Stripe collected is held apart;
 * - the first month's part goes straight into that month's pool;
 * - for a yearly payment the other eleven parts wait in `premium:deferred` until their months open (`postRelease`);
 * - Ruken keeps the rest of the price: `gross − tax − C`.
 *
 * When the fees are more than what is left, the pool gets nothing and Ruken carries the loss.
 */
export function postPaymentPaid(payment: Payment): PostingLine[] {
  requireNonNegative(payment.gross, payment.tax, payment.fees);
  if (payment.tax > payment.gross) throw new RangeError("Tax can't be more than what the member paid");

  const [first, ...later] = poolContributions(payment);
  if (first === undefined) throw new Error("A payment always pays for at least one month");
  const deferred = later.reduce((total, part) => total + part.amount, 0n);
  const makersHalf = first.amount + deferred;

  return withoutZeroLines([
    { account: "platform:stripe_clearing", amount: payment.gross - payment.fees },
    { account: "platform:processor_fees", amount: payment.fees },
    { account: "platform:tax_payable", amount: -payment.tax },
    { account: `pool:premium:${first.period}`, amount: -first.amount },
    { account: "premium:deferred", amount: -deferred },
    { account: "platform:revenue:premium", amount: -(payment.gross - payment.tax - makersHalf) },
  ]);
}

/**
 * The parts of a yearly payment that wait in `premium:deferred`: one per month after the first, each released when
 * its month opens. A monthly payment has none. The parts always add up to the deferred line `postPaymentPaid` wrote,
 * because both come from `poolContributions`.
 */
export function releases(payment: Payment): Release[] {
  return poolContributions(payment).slice(1);
}

/** One month's part moving from the deferred balance into that month's pool. */
export function postRelease(release: Release): PostingLine[] {
  if (release.amount <= 0n) throw new RangeError("A release must move a positive amount");
  return [
    { account: "premium:deferred", amount: release.amount },
    { account: `pool:premium:${release.period}`, amount: -release.amount },
  ];
}

/** The idempotency key of one release entry: a repeat for the same invoice and month is ignored. */
export function releaseKey(stripeInvoiceId: string, period: Period): string {
  return `release:${stripeInvoiceId}:${period}`;
}

/**
 * How a fee that arrives after its payment is shared. `payment.fees` is what was already taken; `fee` is one more,
 * in whole cents, above zero. Each month gives up exactly what it would have given up had the fee been known when the
 * payment was posted, and Ruken gives up the rest, so the two always add up to the fee.
 */
export function feeParts(payment: Payment, fee: bigint): FeeParts {
  if (fee <= 0n) throw new RangeError("A later fee must be more than zero");
  const before = poolContributions(payment);
  const after = poolContributions({ ...payment, fees: payment.fees + fee });
  const months = before
    .map((part, index) => ({ period: part.period, amount: part.amount - (after[index]?.amount ?? 0n) }))
    .filter((month) => month.amount !== 0n);
  const fromMakers = months.reduce((total, month) => total + month.amount, 0n);
  return { months, ruken: fee - fromMakers };
}

/**
 * The entry for a later fee: Stripe's cash goes down by the whole fee, each month's pool gives up its part, and
 * Ruken's half gives up the rest. `accountFor` says where a month's part comes from: `premium:deferred` for a month
 * not yet released, and that month's pool otherwise. Two months with the same account make one line.
 */
export function postPaymentFee(parts: FeeParts, accountFor: (period: Period) => string): PostingLine[] {
  const fromAccounts = new Map<string, bigint>();
  for (const month of parts.months) {
    const account = accountFor(month.period);
    fromAccounts.set(account, (fromAccounts.get(account) ?? 0n) + month.amount);
  }
  const fee = parts.months.reduce((total, month) => total + month.amount, parts.ruken);
  return withoutZeroLines([
    { account: "platform:stripe_clearing", amount: -fee },
    ...[...fromAccounts].map(([account, amount]) => ({ account, amount })),
    { account: "platform:revenue:premium", amount: parts.ruken },
  ]);
}
