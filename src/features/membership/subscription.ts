// STUB (red push)
import type Stripe from "stripe";
import type { PremiumPlan } from "./plans.ts";
import type { SubscriptionSnapshot } from "./reducer.ts";

/** A subscription as Ruken reads it: what the reducer needs, plus who it belongs to. */
export interface PremiumSubscription extends SubscriptionSnapshot {
  readonly customerId: string;
  /** `metadata.userId`, set by the membership checkout. */
  readonly userId: string | null;
  /** Whether Ruken started this subscription for the membership (`metadata.kind`). */
  readonly premium: boolean;
  /**
   * When the subscription ended, in milliseconds; null while it runs. A payment recorded late is
   * compared with this, not with the status now, to tell whether it was paid after the end.
   */
  readonly endedAtMs: number | null;
}

/** A paid membership invoice, as the payment row needs it. */
export interface PaidPremiumInvoice {
  readonly stripeInvoiceId: string;
  readonly subscriptionId: string;
  readonly userId: string;
  readonly plan: PremiumPlan;
  /** When the period this invoice pays for starts. */
  readonly periodStartMs: number;
  readonly paidAtMs: number;
  /** `amount_paid`: what the member paid, tax included. */
  readonly gross: bigint;
  /** The invoice's total tax. */
  readonly tax: bigint;
  /** The card fee from the payment's balance transaction (Stripe's Billing and Tax fees are not on it). */
  readonly fee: bigint;
}

export function premiumSubscriptionOf(subscription: Stripe.Subscription): PremiumSubscription {
  throw new Error(`not built yet ${typeof subscription}`);
}

export function readSubscription(stripe: Stripe, subscriptionId: string): Promise<PremiumSubscription> {
  throw new Error(`not built yet ${typeof stripe} ${typeof subscriptionId}`);
}

export function cancelSubscriptionNow(stripe: Stripe, subscriptionId: string): Promise<PremiumSubscription> {
  throw new Error(`not built yet ${typeof stripe} ${typeof subscriptionId}`);
}

export function voidPayableInvoices(stripe: Stripe, subscriptionId: string): Promise<number> {
  throw new Error(`not built yet ${typeof stripe} ${typeof subscriptionId}`);
}

export function createPortalLink(stripe: Stripe, customerId: string, returnUrl: string): Promise<string> {
  throw new Error(`not built yet ${typeof stripe} ${typeof customerId} ${typeof returnUrl}`);
}

export function readPaidPremiumInvoice(
  stripe: Stripe,
  invoiceId: string,
): Promise<PaidPremiumInvoice | null> {
  throw new Error(`not built yet ${typeof stripe} ${typeof invoiceId}`);
}
