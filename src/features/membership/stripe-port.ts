import type Stripe from "stripe";
import {
  closeCheckoutSession,
  createBillingCustomer,
  ensurePremiumPrices,
  startPremiumCheckoutSession,
  type PremiumCheckoutInput,
  type PremiumPrices,
} from "./checkout.ts";
import type { CheckoutStarted } from "./stripe-client.ts";
import {
  cancelSubscriptionNow,
  createPortalLink,
  readPaidPremiumInvoice,
  readSubscription,
  voidPayableInvoices,
  type PaidPremiumInvoice,
  type PremiumSubscription,
} from "./subscription.ts";

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
  // The prices never change while a process runs, so they are looked up once. A failed lookup is
  // forgotten, so the next request tries again rather than failing until a restart.
  let prices: Promise<PremiumPrices> | undefined;
  return {
    prices() {
      prices ??= ensurePremiumPrices(stripe).catch((error: unknown) => {
        prices = undefined;
        throw error;
      });
      return prices;
    },
    createCustomer: (input) => createBillingCustomer(stripe, input),
    startCheckout: (input) => startPremiumCheckoutSession(stripe, input),
    closeCheckout: (sessionId) => closeCheckoutSession(stripe, sessionId),
    subscription: (subscriptionId) => readSubscription(stripe, subscriptionId),
    cancelNow: (subscriptionId) => cancelSubscriptionNow(stripe, subscriptionId),
    voidPayableInvoices: (subscriptionId) => voidPayableInvoices(stripe, subscriptionId),
    portalLink: (customerId, returnUrl) => createPortalLink(stripe, customerId, returnUrl),
    paidInvoice: (invoiceId) => readPaidPremiumInvoice(stripe, invoiceId),
  };
}
