import type { PremiumState } from "../../lib/server/db.ts";

/**
 * Who is a member right now. This is the one rule every reader uses, so they never disagree. It reads
 * only the stored membership row, which the webhooks keep in step with Stripe.
 *
 * - `ended` (or no row): not a member.
 * - `active` and `canceling`: a member until the end of the paid period. Cancelling never takes
 *   away time that was paid for.
 * - `past_due`: a member while Stripe retries the payment, for seven days from the first failure,
 *   and never past the end of the paid period.
 */

/** How long a failing membership stays a member. */
export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** The fields of a stored `PremiumMembership` that decide access. */
export interface AccessFields {
  readonly state: PremiumState;
  readonly currentPeriodEnd: Date;
  readonly pastDueSince: Date | null;
}

/**
 * When a failing membership pauses if no payment goes through: seven days after the first failure,
 * or the period end if that is sooner. A row with no first failure recorded (it shouldn't happen:
 * the reducer always stamps one) keeps the period end, so a gap in the data never cuts access short.
 */
export function pastDuePausesAt(membership: AccessFields): Date {
  const periodEnd = membership.currentPeriodEnd.getTime();
  if (membership.pastDueSince === null) return new Date(periodEnd);
  return new Date(Math.min(membership.pastDueSince.getTime() + PAST_DUE_GRACE_MS, periodEnd));
}

/** Whether this membership makes its owner a member at `nowMs`. The end instant itself is already outside. */
export function premiumAccess(membership: AccessFields | null, nowMs: number): boolean {
  if (membership === null) return false;
  switch (membership.state) {
    case "ended":
      return false;
    case "active":
    case "canceling":
      return nowMs < membership.currentPeriodEnd.getTime();
    case "past_due":
      return nowMs < pastDuePausesAt(membership).getTime();
  }
}
