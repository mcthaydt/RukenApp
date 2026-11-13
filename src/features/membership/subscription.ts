import type Stripe from "stripe";
import type { PremiumPlan } from "./plans.ts";
import type { SubscriptionSnapshot } from "./reducer.ts";

/**
 * The Stripe reads and writes behind a membership. Webhooks are only signals: whatever an event
 * says, the handler reads the subscription or invoice again here, so Ruken always works from
 * Stripe's current state. Every amount comes from Stripe; nobody types one.
 */

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

const SECOND_MS = 1000;

/** Reads what Ruken needs out of a Stripe subscription. The plan comes from the price's interval. */
export function premiumSubscriptionOf(subscription: Stripe.Subscription): PremiumSubscription {
  const item = subscription.items.data[0];
  if (item === undefined) throw new Error(`Subscription ${subscription.id} has no item`);
  const interval = item.price.recurring?.interval;
  if (interval !== "month" && interval !== "year") {
    throw new Error(`Subscription ${subscription.id} is not billed by month or year`);
  }
  const plan: PremiumPlan = interval === "year" ? "annual" : "monthly";
  return {
    id: subscription.id,
    status: subscription.status,
    plan,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAtMs: subscription.cancel_at === null ? null : subscription.cancel_at * SECOND_MS,
    // Since API 2025-03-31 the period lives on the item; a membership subscription has one item.
    currentPeriodEndMs: item.current_period_end * SECOND_MS,
    customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    userId: subscription.metadata.userId ?? null,
    premium: subscription.metadata.kind === "premium",
    endedAtMs: subscription.ended_at === null ? null : subscription.ended_at * SECOND_MS,
  };
}

export async function readSubscription(stripe: Stripe, subscriptionId: string): Promise<PremiumSubscription> {
  return premiumSubscriptionOf(await stripe.subscriptions.retrieve(subscriptionId));
}

/**
 * Ends the subscription now: when a member deletes their account, so they are never charged while it waits.
 * No final invoice and no proration, so nothing more is charged or credited.
 */
export async function cancelSubscriptionNow(
  stripe: Stripe,
  subscriptionId: string,
): Promise<PremiumSubscription> {
  return premiumSubscriptionOf(
    await stripe.subscriptions.cancel(subscriptionId, { invoice_now: false, prorate: false }),
  );
}

/**
 * Voids the invoices of an ended subscription that could still be paid, and answers how
 * many it voided. Cancelling with `invoice_now: false` leaves a past-due renewal invoice open, and
 * Stripe's dunning may have marked one uncollectible; either can still be paid from Stripe's hosted
 * invoice page, which would charge the member for a period with no membership. A voided invoice can't
 * be paid. Called for every subscription Ruken ends; safe to call again.
 */
export async function voidPayableInvoices(stripe: Stripe, subscriptionId: string): Promise<number> {
  let voided = 0;
  for (const status of ["open", "uncollectible"] as const) {
    // A subscription has at most a few unpaid invoices; 100 is Stripe's largest page.
    const page = await stripe.invoices.list({ subscription: subscriptionId, status, limit: 100 });
    for (const invoice of page.data) {
      await stripe.invoices.voidInvoice(invoice.id);
      voided += 1;
    }
  }
  return voided;
}

/**
 * A short-lived link into Stripe's billing portal, opened whole: the member updates their card and
 * cancels there, so Ruken keeps no cancel screen of its own (design 5.6). What the portal offers is
 * set in Stripe's own settings.
 */
export async function createPortalLink(
  stripe: Stripe,
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
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

/**
 * Reads a paid invoice of a membership subscription. Null for an invoice that isn't one, or that has
 * nothing paid (a credit that covered the whole invoice): neither is a membership payment.
 *
 * Throws while something isn't there yet (the invoice not marked paid, the balance transaction
 * with the fee missing): the webhook then fails and Stripe sends the event again later, rather
 * than Ruken recording a guessed fee.
 */
export async function readPaidPremiumInvoice(
  stripe: Stripe,
  invoiceId: string,
): Promise<PaidPremiumInvoice | null> {
  const invoice = await stripe.invoices.retrieve(invoiceId, {
    expand: ["payments", "lines.data.pricing.price_details.price"],
  });
  const details = invoice.parent?.subscription_details ?? null;
  if (details === null || details.metadata?.kind !== "premium") return null;
  if (invoice.amount_paid === 0) return null;

  const paidAt = invoice.status_transitions.paid_at;
  const userId = details.metadata.userId;
  if (invoice.status !== "paid" || paidAt === null) throw new Error(`Invoice ${invoiceId} is not paid yet`);
  if (userId === undefined) throw new Error(`Invoice ${invoiceId} has no member`);

  // The membership is priced in USD, and amounts are kept as US cents. Stripe's Adaptive Pricing or a
  // localized Checkout would charge another currency: that is refused, for a person to look at,
  // rather than kept as the wrong money.
  if (invoice.currency !== "usd") {
    throw new Error(`Invoice ${invoiceId} was paid in ${invoice.currency}; the membership is priced in USD`);
  }

  const paidFor = paidForLine(invoice);
  return {
    stripeInvoiceId: invoice.id,
    subscriptionId: typeof details.subscription === "string" ? details.subscription : details.subscription.id,
    userId,
    plan: paidFor.plan,
    periodStartMs: paidFor.periodStartMs,
    paidAtMs: paidAt * SECOND_MS,
    gross: BigInt(invoice.amount_paid),
    tax: taxPaid(invoice),
    fee: await invoiceCardFee(stripe, invoice),
  };
}

/**
 * The tax in what the member paid. Usually the invoice's whole tax. When a customer credit balance
 * (one given in Stripe's dashboard) paid part of the invoice, `amount_paid` is less than `total`,
 * and the tax is scaled to the part paid by card, rounded half up: the whole tax could
 * otherwise be more than the payment, which the payment row refuses (its CHECK).
 */
function taxPaid(invoice: Stripe.Invoice): bigint {
  const tax = (invoice.total_taxes ?? []).reduce((sum, line) => sum + BigInt(line.amount), 0n);
  const total = BigInt(invoice.total);
  const paid = BigInt(invoice.amount_paid);
  if (paid >= total || total === 0n) return tax;
  return (tax * paid * 2n + total) / (2n * total);
}

/**
 * The line the member is paying for. A renewal has one line. If a credit line is also there, the paid
 * line is the positive one that starts last.
 */
function paidForLine(invoice: Stripe.Invoice): { plan: PremiumPlan; periodStartMs: number } {
  const charged = invoice.lines.data
    .filter((line) => line.amount > 0)
    .sort((a, b) => b.period.start - a.period.start)[0];
  const price = charged?.pricing?.price_details?.price;
  const interval = typeof price === "object" ? price.recurring?.interval : undefined;
  if (charged === undefined || (interval !== "month" && interval !== "year")) {
    throw new Error(`Invoice ${invoice.id} has no monthly or yearly line to pay for`);
  }
  return {
    plan: interval === "year" ? "annual" : "monthly",
    periodStartMs: charged.period.start * SECOND_MS,
  };
}

/**
 * The card fee Stripe charged for a payment, in cents, from the balance transaction of its charge.
 * Throws if the payment has no charge or balance transaction yet: the webhook then fails and Stripe
 * delivers it again later, rather than Ruken keeping a guessed fee.
 */
async function readCardFee(stripe: Stripe, paymentIntentId: string): Promise<bigint> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = intent.latest_charge;
  if (charge === null || typeof charge === "string") {
    throw new Error(`Payment ${paymentIntentId} has no charge to read a fee from yet`);
  }
  const balance = charge.balance_transaction;
  if (balance === null || typeof balance === "string") {
    throw new Error(`Payment ${paymentIntentId} has no balance transaction yet`);
  }
  return BigInt(balance.fee);
}

async function invoiceCardFee(stripe: Stripe, invoice: Stripe.Invoice): Promise<bigint> {
  const payment = invoice.payments?.data.find((candidate) => candidate.status === "paid")?.payment;
  const intent = payment?.payment_intent;
  if (intent !== undefined) return readCardFee(stripe, typeof intent === "string" ? intent : intent.id);
  const charge = payment?.charge;
  if (charge === undefined) throw new Error(`Invoice ${invoice.id} has no payment to read a fee from yet`);
  const read = await stripe.charges.retrieve(typeof charge === "string" ? charge : charge.id, {
    expand: ["balance_transaction"],
  });
  const balance = read.balance_transaction;
  if (balance === null || typeof balance === "string") {
    throw new Error(`Invoice ${invoice.id} has no balance transaction yet`);
  }
  return BigInt(balance.fee);
}
