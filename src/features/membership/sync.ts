// STUB (red push)
import type { PremiumPlan, PremiumState, PrismaClient } from "../../lib/server/db.ts";
import type { AccessFields } from "./access.ts";
import type { SyncOutcome } from "./events.ts";
import type { MembershipRow } from "./reducer.ts";
import type { PremiumStripe } from "./stripe-port.ts";

export type { SyncOutcome };

export interface SyncDeps {
  readonly db: PrismaClient;
  readonly stripe: Pick<PremiumStripe, "subscription">;
}

export function syncMembership(
  deps: SyncDeps,
  subscriptionId: string,
  observedAtMs: number,
): Promise<SyncOutcome> {
  throw new Error(`not built yet ${typeof deps} ${typeof subscriptionId} ${typeof observedAtMs}`);
}

export function lockMembership(tx: Pick<PrismaClient, "$executeRaw">, userId: string): Promise<void> {
  throw new Error(`not built yet ${typeof tx} ${typeof userId}`);
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

export function reducerRow(row: StoredMembership): MembershipRow {
  throw new Error(`not built yet ${typeof row}`);
}
