import Stripe from "stripe";
import { PREMIUM_PRICES_CENTS, type PremiumPlan } from "./plans.ts";
import { checkoutExpiry, type CheckoutStarted } from "./stripe-client.ts";

/**
 * The Stripe side of joining. The product and its two prices are found or created by code from
 * `PREMIUM_PRICES_CENTS`, never typed into the Stripe dashboard.
 */

/** A custom product id, so "create it if it is missing" is one retrieve, with no listing. */
export const PREMIUM_PRODUCT_ID = "ruken_membership";

/** Electronically supplied services. The Owner's accountant confirms it before live mode. */
export const PREMIUM_TAX_CODE = "txcd_10000000";

/**
 * The prices are found by these keys. A changed price needs a new key and an Owner decision. These are
 * not the keys the old code used, so a Stripe account that ran it, and holds its old prices, is never
 * charged from.
 */
export const PREMIUM_LOOKUP_KEYS = {
  monthly: "ruken_membership_monthly",
  annual: "ruken_membership_annual",
} as const satisfies Record<PremiumPlan, string>;

const INTERVALS = { monthly: "month", annual: "year" } as const satisfies Record<PremiumPlan, string>;

/** The Stripe price id of each plan. */
export interface PremiumPrices {
  readonly monthly: string;
  readonly annual: string;
}

/**
 * Finds the membership product and prices, creating whatever is missing, and returns the price ids.
 *
 * A price found under a membership lookup key is used only when it is exactly the price the rules
 * say: the constant amount in USD, before tax, by month or by year. Anything else throws rather
 * than charge members a price nobody decided.
 */
export async function ensurePremiumPrices(stripe: Stripe): Promise<PremiumPrices> {
  await ensurePremiumProduct(stripe);
  const found = await stripe.prices.list({
    lookup_keys: [PREMIUM_LOOKUP_KEYS.monthly, PREMIUM_LOOKUP_KEYS.annual],
    active: true,
    limit: 10,
  });
  return {
    monthly: await premiumPriceId(stripe, "monthly", found.data),
    annual: await premiumPriceId(stripe, "annual", found.data),
  };
}

async function ensurePremiumProduct(stripe: Stripe): Promise<void> {
  try {
    await stripe.products.retrieve(PREMIUM_PRODUCT_ID);
    return;
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  await stripe.products.create({
    id: PREMIUM_PRODUCT_ID,
    name: "Ruken membership",
    tax_code: PREMIUM_TAX_CODE,
  });
}

async function premiumPriceId(
  stripe: Stripe,
  plan: PremiumPlan,
  found: readonly Stripe.Price[],
): Promise<string> {
  const lookupKey = PREMIUM_LOOKUP_KEYS[plan];
  const existing = found.find((candidate) => candidate.lookup_key === lookupKey);
  if (existing !== undefined) {
    if (!isTheRulesPrice(existing, plan)) {
      throw new Error(
        `Stripe price ${existing.id} (${lookupKey}) is not ${PREMIUM_PRICES_CENTS[plan].toString()} cents a ${INTERVALS[plan]} before tax; a changed price needs a new lookup key and an Owner decision`,
      );
    }
    return existing.id;
  }
  const created = await stripe.prices.create({
    product: PREMIUM_PRODUCT_ID,
    currency: "usd",
    unit_amount: Number(PREMIUM_PRICES_CENTS[plan]),
    // Stripe Tax adds tax on top, as the prices are before tax.
    tax_behavior: "exclusive",
    recurring: { interval: INTERVALS[plan] },
    lookup_key: lookupKey,
    metadata: { plan },
  });
  return created.id;
}

function isTheRulesPrice(price: Stripe.Price, plan: PremiumPlan): boolean {
  return (
    price.unit_amount === Number(PREMIUM_PRICES_CENTS[plan]) &&
    price.currency === "usd" &&
    price.tax_behavior === "exclusive" &&
    price.recurring?.interval === INTERVALS[plan]
  );
}

/** Stripe answers 404 `resource_missing` for an id it doesn't know. */
export function isMissing(error: unknown): boolean {
  return error instanceof Stripe.errors.StripeError && error.code === "resource_missing";
}

/** Makes the member's Stripe customer, the first time they check out. */
export async function createBillingCustomer(
  stripe: Stripe,
  input: { readonly userId: string; readonly email: string },
): Promise<string> {
  const customer = await stripe.customers.create({ email: input.email, metadata: { userId: input.userId } });
  return customer.id;
}

/** When a new membership checkout expires, in Unix seconds: the same 31 minutes as every Checkout. */
export function premiumCheckoutExpiry(nowMs: number): number {
  return checkoutExpiry(nowMs);
}

export interface PremiumCheckoutInput {
  readonly priceId: string;
  readonly customerId: string;
  /** The buyer's Ruken user id; the webhook builds the membership for this account. */
  readonly userId: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
  /** From premiumCheckoutExpiry. */
  readonly expiresAtSec: number;
  /** What the webhook needs to find the checkout again: the ref, `kind: "premium"` (how it knows the checkout is ours) and the plan. */
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Starts a hosted Stripe Checkout for the membership subscription. No trial and no coupons. The
 * metadata goes on the session and on the subscription it makes, because invoices and
 * subscription events later name only the subscription.
 */
export async function startPremiumCheckoutSession(
  stripe: Stripe,
  input: PremiumCheckoutInput,
): Promise<CheckoutStarted> {
  const metadata = { ...input.metadata, userId: input.userId };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.customerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    client_reference_id: input.userId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    expires_at: input.expiresAtSec,
    automatic_tax: { enabled: true },
    // Stripe Tax needs the buyer's address, and stores it on the customer for renewals.
    billing_address_collection: "required",
    customer_update: { address: "auto", name: "auto" },
    allow_promotion_codes: false,
    metadata,
    subscription_data: { metadata },
  });
  if (session.url === null) throw new Error(`Stripe returned no page for checkout ${session.id}`);
  return { id: session.id, url: session.url };
}

/**
 * Closes the buyer's earlier Checkout before they start another, so they can't pay for two. Answers
 * how it ended: "expired" when it was still open (or had already expired), "complete" when it was
 * paid, in which case the caller must not start a second one.
 */
export async function closeCheckoutSession(
  stripe: Stripe,
  sessionId: string,
): Promise<"expired" | "complete"> {
  try {
    await stripe.checkout.sessions.expire(sessionId);
    return "expired";
  } catch (error) {
    // Stripe answers 400 for a session that is no longer open. Read which way it went.
    if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) throw error;
  }
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return session.status === "complete" ? "complete" : "expired";
}
