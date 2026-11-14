import type { Clock } from "../../lib/clock.ts";
import type { PremiumPlan, PrismaClient } from "../../lib/server/db.ts";
import { lockLedger, postEntry, postingPeriod } from "./journal.ts";
import { postPaymentPaid } from "./payment-posting.ts";
import { NotAtStripeYet, type MoneyStripe, type PaymentIds } from "./stripe-port.ts";

/**
 * Posting what members paid. Slice 1 keeps one `MembershipPayment` row for each paid invoice; this turns each into
 * its journal entry, once, and remembers the three Stripe ids a later fee is placed by (`PaymentPosting`).
 */

export interface PaymentDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
  readonly stripe: Pick<MoneyStripe, "paymentIds">;
}

/** What posting needs of a `MembershipPayment` row. */
interface PaymentRow {
  readonly stripeInvoiceId: string;
  readonly plan: PremiumPlan;
  readonly periodStart: Date;
  readonly paidAt: Date;
  readonly grossCents: bigint;
  readonly taxCents: bigint;
  readonly cardFeeCents: bigint;
}

/**
 * Posts every payment not yet posted, oldest first, each in a transaction of its own, so one that cannot be posted
 * never holds up the others. A payment whose charge is not at Stripe yet is left for the next run and counted in
 * nothing; any other failure is thrown, for the daily job to report. Answers how many it posted.
 */
export async function postUnpostedPayments(deps: PaymentDeps): Promise<{ posted: number }> {
  const unposted = await deps.db.membershipPayment.findMany({
    where: { posting: null },
    orderBy: [{ paidAt: "asc" }, { stripeInvoiceId: "asc" }],
  });
  let posted = 0;
  for (const payment of unposted) {
    // Stripe is asked outside the transaction: the ledger's lock is held for the posting only, not for a network call.
    let ids: PaymentIds;
    try {
      ids = await deps.stripe.paymentIds(payment.stripeInvoiceId);
    } catch (error) {
      if (error instanceof NotAtStripeYet) continue;
      throw error;
    }
    if (await postPayment(deps, payment, ids)) posted += 1;
  }
  return { posted };
}

/** One payment's entry and posting row, together or not at all. False when another run already posted it. */
async function postPayment(deps: PaymentDeps, payment: PaymentRow, ids: PaymentIds): Promise<boolean> {
  const nowMs = deps.clock.epochMs();
  return deps.db.$transaction(async (tx) => {
    await lockLedger(tx);
    // A run that waited for the lock finds what the one before it posted.
    const already = await tx.paymentPosting.findUnique({
      where: { stripeInvoiceId: payment.stripeInvoiceId },
    });
    if (already !== null) return false;
    // Two months, by two rules: the month the payment's first part goes to follows the month it pays for, and the
    // entry itself is in the month it was paid. Each is its own month while that is open, else the month now.
    const firstPeriod = await postingPeriod(tx, payment.periodStart.getTime(), nowMs);
    const entryPeriod = await postingPeriod(tx, payment.paidAt.getTime(), nowMs);
    await postEntry(tx, {
      key: `paid:${payment.stripeInvoiceId}`,
      period: entryPeriod,
      kind: "payment",
      stripeInvoiceId: payment.stripeInvoiceId,
      lines: postPaymentPaid({
        plan: payment.plan,
        firstPeriod,
        gross: payment.grossCents,
        tax: payment.taxCents,
        fees: payment.cardFeeCents,
      }),
    });
    await tx.paymentPosting.create({
      data: {
        stripeInvoiceId: payment.stripeInvoiceId,
        firstPeriod,
        stripeChargeId: ids.chargeId,
        stripePaymentIntentId: ids.paymentIntentId,
        balanceTransactionId: ids.balanceTransactionId,
        postedAt: new Date(nowMs),
      },
    });
    return true;
  });
}
