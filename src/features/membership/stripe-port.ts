// STUB (red push)
import type Stripe from "stripe";
import type { PremiumCheckoutInput, PremiumPrices } from "./checkout.ts";
import type { CheckoutStarted } from "./stripe-client.ts";
import type { PaidPremiumInvoice, PremiumSubscription } from "./subscription.ts";

/**
 * Everything the membership service asks of Stripe, as one port. The service takes this interface
 * rather than a Stripe client, so its Postgres tests can hand it a fake that remembers state.
 */
export interface PremiumStripe {
  /** The two membership price ids, found or created on first use. */
  prices(): Promise<PremiumPrices>;
  createCustomer(input: { readonly userId: string; readonly email: string }): Promise<string>;
  startCheckout(input: PremiumCheckoutInput): Promise<CheckoutStarted>;
  closeCheckout(sessionId: string): Promise<"expired" | "complete">;
  subscription(subscriptionId: string): Promise<PremiumSubscription>;
  cancelNow(subscriptionId: string): Promise<PremiumSubscription>;
  /** Voids an ended subscription's open and uncollectible invoices, so none can be paid. */
  voidPayableInvoices(subscriptionId: string): Promise<number>;
  portalLink(customerId: string, returnUrl: string): Promise<string>;
  paidInvoice(invoiceId: string): Promise<PaidPremiumInvoice | null>;
}

/** The port on a real Stripe client. */
export function bindPremiumStripe(stripe: Stripe): PremiumStripe {
  throw new Error(`not built yet ${typeof stripe}`);
}
