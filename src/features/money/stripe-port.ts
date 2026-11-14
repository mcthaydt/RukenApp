import type Stripe from "stripe";

/**
 * Everything the money feature asks of Stripe, as one port. The jobs take this interface and not a Stripe client, so
 * their Postgres tests can hand them a fake that only answers what the test said Stripe holds (as the membership's
 * `PremiumStripe` does).
 */
export interface MoneyStripe {
  /**
   * The three ids a payment is known by at Stripe: its charge, its payment intent (null when an invoice was paid by a
   * bare charge) and the balance transaction the card fee was read from. Throws `NotAtStripeYet` while the charge or
   * its balance transaction does not exist, so the caller can leave the payment for the next run.
   */
  paymentIds(stripeInvoiceId: string): Promise<PaymentIds>;
}

export interface PaymentIds {
  readonly chargeId: string;
  readonly paymentIntentId: string | null;
  readonly balanceTransactionId: string;
}

/** What Stripe has not made yet. It is the one failure a daily run waits out; any other one is reported. */
export class NotAtStripeYet extends Error {
  override readonly name = "NotAtStripeYet";
}

/** The port on a real Stripe client. */
export function bindMoneyStripe(stripe: Stripe): MoneyStripe {
  return {
    paymentIds: (stripeInvoiceId) => readPaymentIds(stripe, stripeInvoiceId),
  };
}

/**
 * The same walk the membership makes to read a card fee (`invoiceCardFee`): the invoice with its payments, its paid
 * payment's payment intent with the charge and the charge's balance transaction, or the charge alone for an invoice
 * paid by a bare charge.
 */
async function readPaymentIds(stripe: Stripe, stripeInvoiceId: string): Promise<PaymentIds> {
  const invoice = await stripe.invoices.retrieve(stripeInvoiceId, { expand: ["payments"] });
  const payment = invoice.payments?.data.find((candidate) => candidate.status === "paid")?.payment;
  const intent = payment?.payment_intent;
  if (intent !== undefined) {
    const paymentIntentId = typeof intent === "string" ? intent : intent.id;
    const read = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = read.latest_charge;
    if (charge === null || typeof charge === "string") {
      throw new NotAtStripeYet(`Payment ${paymentIntentId} has no charge yet`);
    }
    const balance = charge.balance_transaction;
    if (balance === null || typeof balance === "string") {
      throw new NotAtStripeYet(`Payment ${paymentIntentId} has no balance transaction yet`);
    }
    return { chargeId: charge.id, paymentIntentId, balanceTransactionId: balance.id };
  }
  const chargeRef = payment?.charge;
  if (chargeRef === undefined) throw new NotAtStripeYet(`Invoice ${stripeInvoiceId} has no paid payment yet`);
  const charge = await stripe.charges.retrieve(typeof chargeRef === "string" ? chargeRef : chargeRef.id, {
    expand: ["balance_transaction"],
  });
  const balance = charge.balance_transaction;
  if (balance === null || typeof balance === "string") {
    throw new NotAtStripeYet(`Invoice ${stripeInvoiceId} has no balance transaction yet`);
  }
  return { chargeId: charge.id, paymentIntentId: null, balanceTransactionId: balance.id };
}
