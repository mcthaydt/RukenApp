// STUB (red push)
import type { PrismaClient } from "../../lib/server/db.ts";
import type { PaidPremiumInvoice } from "./subscription.ts";

export function recordPayment(
  db: Pick<PrismaClient, "membershipPayment">,
  paid: PaidPremiumInvoice,
): Promise<"recorded" | "duplicate"> {
  throw new Error(`not built yet ${typeof db} ${typeof paid}`);
}

export function paidAfterEnd(
  subscription: { readonly status: string; readonly endedAtMs: number | null },
  paidAtMs: number,
): boolean {
  throw new Error(`not built yet ${typeof subscription} ${typeof paidAtMs}`);
}
