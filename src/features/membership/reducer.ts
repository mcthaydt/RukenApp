// STUB (red push)
import type Stripe from "stripe";
import type { PremiumPlan } from "./plans.ts";

/**
 * The membership as a mirror of the Stripe subscription.
 *
 * A membership moves back and forth (`past_due` returns to `active` when a retry succeeds), so it
 * is not one of the ledger's forward-only state machines. Instead every webhook is treated as a
 * signal: the handler re-fetches the subscription from Stripe and calls `reduceMembership` with the
 * stored row and that fresh snapshot. Because the snapshot is always Stripe's newest state, events
 * that arrive late, twice or out of order all end at the same row.
 *
 * Times are milliseconds since the epoch; the caller converts to and from database dates.
 */

export type { PremiumPlan };
export type MembershipState = "active" | "past_due" | "canceling" | "ended";

/** What the reducer reads from a Stripe subscription (subscription.ts builds it). */
export interface SubscriptionSnapshot {
  readonly id: string;
  readonly status: Stripe.Subscription.Status;
  readonly plan: PremiumPlan;
  readonly cancelAtPeriodEnd: boolean;
  /** Stripe's `cancel_at`: a set time the subscription will end, if any. */
  readonly cancelAtMs: number | null;
  /** The end of the paid period. The current Stripe API keeps it on the subscription item. */
  readonly currentPeriodEndMs: number;
}

/** The fields of `PremiumMembership` the reducer decides. `userId` and `createdAt` never change here. */
export interface MembershipRow {
  readonly stripeSubscriptionId: string;
  readonly plan: PremiumPlan;
  readonly state: MembershipState;
  readonly currentPeriodEndMs: number;
  readonly cancelAtMs: number | null;
  /** When the current run of failed payments began; null while payments succeed. */
  readonly pastDueSince: number | null;
}

export function reduceMembership(
  previous: MembershipRow | null,
  snapshot: SubscriptionSnapshot,
  observedAtMs: number,
): MembershipRow | null {
  throw new Error(`not built yet ${typeof previous} ${typeof snapshot} ${typeof observedAtMs}`);
}
