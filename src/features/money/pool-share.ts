import { lrr } from "./arithmetic.ts";
import { addMonths, type Period } from "./period.ts";
import { requireNonNegative } from "./posting.ts";

/** How many months of membership each plan pays for. */
export const SERVICE_MONTHS = { monthly: 1, annual: 12 } as const;

export type Plan = keyof typeof SERVICE_MONTHS;

export interface Payment {
  readonly plan: Plan;
  /** The first month this payment covers. */
  readonly firstPeriod: Period;
  /** What the member paid, tax included, in cents. */
  readonly gross: bigint;
  /** Sales tax inside `gross`. */
  readonly tax: bigint;
  /** Every fee Stripe charged on this payment that is known so far: the card fee and the others, in whole cents. */
  readonly fees: bigint;
}

export interface PoolContribution {
  readonly period: Period;
  readonly amount: bigint;
}

/**
 * How one payment feeds the makers' pool.
 *
 * Tax and every fee come off the top; what is left is shared half and half, and the makers' half is rounded down, once
 * for the whole payment, so the odd cent stays with Ruken (Owner, 2026-11-14) and Ruken's half is never the smaller
 * one. What is left is never below zero. A yearly payment pays for twelve months, so its half is spread evenly over
 * them, and the cents left over from the even split go to the earliest months.
 *
 * Refunds and chargebacks are not handled here: they are separate facts that take money back out of the pool.
 */
export function poolContributions(payment: Payment): PoolContribution[] {
  const { gross, tax, fees } = payment;
  requireNonNegative(gross, tax, fees);
  const left = gross - tax - fees;
  const makersHalf = left > 0n ? left / 2n : 0n;

  const months: Period[] = [];
  for (let offset = 0; offset < SERVICE_MONTHS[payment.plan]; offset += 1) {
    months.push(addMonths(payment.firstPeriod, offset));
  }

  // Equal weights, keyed by period: lrr's tie-break by ascending key hands the leftover cents to the earliest months.
  const shares = lrr(
    makersHalf,
    months.map((period) => ({ key: period, weight: 1n })),
  );
  return months.map((period) => ({ period, amount: shares.get(period) ?? 0n }));
}

/**
 * How much of a payment's part of a month still counts toward a member's weight in the pool: the part times what was
 * not handed back over what was paid, rounded down to a whole cent. A refund, or a dispute that is open or was lost,
 * hands money back; a dispute that was won does not. Handing back all of it, or more, leaves nothing.
 */
export function keptWeight(part: bigint, gross: bigint, handedBack: bigint): bigint {
  throw new Error(`not built yet: keptWeight(${String(part)}, ${String(gross)}, ${String(handedBack)})`);
}
