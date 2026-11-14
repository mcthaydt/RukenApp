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
    paymentIds: (stripeInvoiceId) =>
      Promise.reject(new Error(`not built yet: paymentIds ${typeof stripe} ${stripeInvoiceId}`)),
  };
}
