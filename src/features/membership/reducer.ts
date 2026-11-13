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

/** Statuses after which the subscription takes no more money. `paused` only follows a trial, which Ruken never offers. */
const ENDED_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
  "unpaid",
  "canceled",
  "incomplete_expired",
  "paused",
]);

/**
 * The next membership row, or null when the snapshot must change nothing:
 *
 * - `incomplete`: the first payment hasn't gone through yet, so there is nothing to mirror.
 * - A snapshot of another subscription than the row's, while the row's own subscription is still
 *   running: a stale event for an old subscription.
 * - A snapshot that ends some other subscription, after the row has ended: also stale.
 *
 * A snapshot of a new subscription after the row has ended is the member joining again: it replaces
 * the subscription, plan and period. (The caller keeps `createdAt`, so "Since March" stays the first
 * time they joined.)
 *
 * `observedAtMs` is when the change was seen (the event's time). It stamps `pastDueSince` at the
 * first failure of a run; later failures keep the first stamp, so the seven days aren't restarted.
 */
export function reduceMembership(
  previous: MembershipRow | null,
  snapshot: SubscriptionSnapshot,
  observedAtMs: number,
): MembershipRow | null {
  if (snapshot.status === "incomplete") return null;
  const ends = ENDED_STATUSES.has(snapshot.status);

  const sameSubscription = previous?.stripeSubscriptionId === snapshot.id;
  if (previous !== null && !sameSubscription) {
    if (previous.state !== "ended" || ends) return null;
    // Joining again: nothing of the old subscription's failures carries over.
    return reduceMembership(null, snapshot, observedAtMs);
  }

  const common = {
    stripeSubscriptionId: snapshot.id,
    plan: snapshot.plan,
    currentPeriodEndMs: snapshot.currentPeriodEndMs,
    cancelAtMs: snapshot.cancelAtPeriodEnd ? snapshot.currentPeriodEndMs : snapshot.cancelAtMs,
  };

  if (ends) {
    // pastDueSince stays as it was, so the row still says when the failures began.
    return { ...common, state: "ended", pastDueSince: previous?.pastDueSince ?? null };
  }

  if (snapshot.status === "past_due") {
    return { ...common, state: "past_due", pastDueSince: previous?.pastDueSince ?? observedAtMs };
  }

  // active (or trialing, which can't happen without trials and reads the same): a payment went
  // through, so any run of failures is over.
  return { ...common, state: snapshot.cancelAtPeriodEnd ? "canceling" : "active", pastDueSince: null };
}
