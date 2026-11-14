import type { PremiumPlan, PremiumState, PrismaClient } from "../../lib/server/db.ts";
import type { AccessFields } from "./access.ts";
import type { SyncOutcome } from "./events.ts";
import { reduceMembership, type MembershipRow } from "./reducer.ts";
import type { PremiumStripe } from "./stripe-port.ts";

export type { SyncOutcome };

/**
 * Keeps `PremiumMembership` in step with the Stripe subscription.
 *
 * Every webhook about a subscription, and every change Ruken asks Stripe for (ending a
 * membership), ends here: read the subscription from Stripe, reduce it with the stored
 * row (`reduceMembership` in reducer.ts), store the result.
 *
 * Two deliveries for the same member can run at the same time (Stripe sends
 * `customer.subscription.updated` and `invoice.paid` together). A per-member lock makes them take
 * turns, and the subscription is read from Stripe *inside* the lock, so whichever goes second reads
 * the newer state and writes it last. Without that, an older read could overwrite a newer one.
 */

export interface SyncDeps {
  readonly db: PrismaClient;
  readonly stripe: Pick<PremiumStripe, "subscription">;
}

/** Holding the lock includes one Stripe read, so give the transaction more than Prisma's 5 s default. */
const SYNC_TIMEOUT_MS = 20_000;

/**
 * Brings the member's row up to date with one subscription. `observedAtMs` is when the change was
 * seen (the event's time, or now for Ruken's own calls); it stamps the first failed payment.
 */
export async function syncMembership(
  deps: SyncDeps,
  subscriptionId: string,
  observedAtMs: number,
): Promise<SyncOutcome> {
  const first = await deps.stripe.subscription(subscriptionId);
  const userId = first.userId;
  if (!first.premium || userId === null) return "not_premium";
  // Checked before the lock and the upsert: `PremiumMembership.userId` references `User`, so another
  // site's member (a shared Stripe test mode) would fail on every try for ever. A deleted account
  // stays as a tombstone, so a real member's events still pass.
  if ((await deps.db.user.count({ where: { id: userId } })) === 0) return "not_this_stack";

  return deps.db.$transaction(
    async (tx) => {
      await lockMembership(tx, userId);
      const snapshot = await deps.stripe.subscription(subscriptionId);
      const stored = await tx.premiumMembership.findUnique({ where: { userId } });
      const next = reduceMembership(stored === null ? null : reducerRow(stored), snapshot, observedAtMs);

      if (next === null) {
        const anotherIsRunning =
          stored !== null &&
          stored.state !== "ended" &&
          stored.stripeSubscriptionId !== snapshot.id &&
          (snapshot.status === "active" || snapshot.status === "trialing" || snapshot.status === "past_due");
        return anotherIsRunning ? "second_subscription" : "ignored";
      }

      const data = {
        stripeSubscriptionId: next.stripeSubscriptionId,
        plan: next.plan,
        state: next.state,
        currentPeriodEnd: new Date(next.currentPeriodEndMs),
        cancelAt: next.cancelAtMs === null ? null : new Date(next.cancelAtMs),
        pastDueSince: next.pastDueSince === null ? null : new Date(next.pastDueSince),
      };
      // One row per member. A rejoin overwrites the subscription and keeps `createdAt`, so
      // "Since March" stays the first time they joined.
      await tx.premiumMembership.upsert({ where: { userId }, create: { userId, ...data }, update: data });
      return "updated";
    },
    { timeout: SYNC_TIMEOUT_MS },
  );
}

/**
 * Takes the member's lock for the rest of the transaction. Everything that writes a member's row
 * takes it, so two deliveries for one member take turns.
 *
 * A transaction-scoped advisory lock, keyed by the member: it is released at commit, and unlike a
 * row lock it doesn't hold up anything else that touches the user.
 */
export async function lockMembership(tx: Pick<PrismaClient, "$executeRaw">, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`premium:${userId}`}, 0))`;
}

/** A stored `PremiumMembership` row, as Prisma reads it. */
export interface StoredMembership extends AccessFields {
  readonly stripeSubscriptionId: string;
  readonly plan: PremiumPlan;
  readonly state: PremiumState;
  readonly cancelAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** The stored row in the reducer's terms (times in milliseconds). */
export function reducerRow(row: StoredMembership): MembershipRow {
  return {
    stripeSubscriptionId: row.stripeSubscriptionId,
    plan: row.plan,
    state: row.state,
    currentPeriodEndMs: row.currentPeriodEnd.getTime(),
    cancelAtMs: row.cancelAt?.getTime() ?? null,
    pastDueSince: row.pastDueSince?.getTime() ?? null,
  };
}
