// STUB (red push)
import type { PremiumState } from "../../lib/server/db.ts";

export const PAST_DUE_GRACE_MS = 0;

export interface AccessFields {
  readonly state: PremiumState;
  readonly currentPeriodEnd: Date;
  readonly pastDueSince: Date | null;
}

export function pastDuePausesAt(membership: AccessFields): Date {
  throw new Error(`not built yet ${typeof membership}`);
}

export function premiumAccess(membership: AccessFields | null, nowMs: number): boolean {
  throw new Error(`not built yet ${typeof membership} ${typeof nowMs}`);
}
