import { NotAtStripeYet, type MoneyStripe, type PaymentIds } from "../../src/features/money/stripe-port.ts";

/**
 * A `MoneyStripe` in memory, for database tests. It only ever answers what a test said Stripe holds: a test calls a
 * setter, then the code under test asks. Tasks that add a method to `MoneyStripe` add its setter here.
 */
export class FakeMoneyStripe implements MoneyStripe {
  private readonly payments = new Map<string, PaymentIds>();

  /** Says Stripe now holds this invoice's charge and balance transaction. */
  addPayment(stripeInvoiceId: string, ids: PaymentIds): void {
    this.payments.set(stripeInvoiceId, ids);
  }

  paymentIds(stripeInvoiceId: string): Promise<PaymentIds> {
    const ids = this.payments.get(stripeInvoiceId);
    if (ids === undefined) return Promise.reject(new NotAtStripeYet(`${stripeInvoiceId} has no charge yet`));
    return Promise.resolve(ids);
  }
}

export function fakeMoneyStripe(): FakeMoneyStripe {
  return new FakeMoneyStripe();
}
