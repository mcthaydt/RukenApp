// What a payment puts into the makers' pool, month by month (stub: red step).
import type { Period } from "./period.ts";

/** How many months of membership each plan pays for. */
export const SERVICE_MONTHS = { monthly: 1, annual: 12 } as const;

export type Plan = keyof typeof SERVICE_MONTHS;

export interface Payment {
  readonly plan: Plan;
  readonly firstPeriod: Period;
  readonly gross: bigint;
  readonly tax: bigint;
  readonly fees: bigint;
}

export interface PoolContribution {
  readonly period: Period;
  readonly amount: bigint;
}

export function poolContributions(payment: Payment): PoolContribution[] {
  throw new Error(`not built yet: poolContributions ${payment.plan}`);
}
