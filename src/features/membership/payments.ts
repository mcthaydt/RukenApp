import type { PrismaClient } from "../../lib/server/db.ts";
import type { PaidPremiumInvoice } from "./subscription.ts";

/**
 * Keeps one `MembershipPayment` row for a paid invoice, as Stripe reported it. Slice 5 posts these
 * rows into the books; this slice only keeps them, added and never changed (the table refuses both).
 *
 * The invoice id is the table's unique key, so Stripe delivering the same event twice adds nothing the
 * second time: `createMany` with `skipDuplicates` counts what it really inserted.
 */
export async function recordPayment(
  db: Pick<PrismaClient, "membershipPayment">,
  paid: PaidPremiumInvoice,
): Promise<"recorded" | "duplicate"> {
  if (paid.gross === 0n) {
    // A zero-amount invoice (a credit that covered it all) is not a payment. The webhook skips
    // these; the table's CHECK refuses one too, but a clear message is better than a constraint name.
    throw new Error(`Invoice ${paid.stripeInvoiceId} has nothing paid, so it is not a membership payment`);
  }
  const inserted = await db.membershipPayment.createMany({
    data: [
      {
        stripeInvoiceId: paid.stripeInvoiceId,
        userId: paid.userId,
        stripeSubscriptionId: paid.subscriptionId,
        plan: paid.plan,
        periodStart: new Date(paid.periodStartMs),
        paidAt: new Date(paid.paidAtMs),
        grossCents: paid.gross,
        taxCents: paid.tax,
        cardFeeCents: paid.fee,
      },
    ],
    skipDuplicates: true,
  });
  return inserted.count === 1 ? "recorded" : "duplicate";
}

/**
 * Whether an invoice was paid after its subscription ended. Such a payment bought no membership, so
 * nothing is recorded for it and a person refunds it in Stripe.
 *
 * An ended subscription with no end time counts as ended before any payment. A payment made while the
 * subscription still ran (before `endedAtMs`) is a normal one, even if it is recorded late.
 */
export function paidAfterEnd(
  subscription: { readonly status: string; readonly endedAtMs: number | null },
  paidAtMs: number,
): boolean {
  const ended = subscription.status === "canceled" || subscription.status === "incomplete_expired";
  return ended && (subscription.endedAtMs === null || paidAtMs >= subscription.endedAtMs);
}
