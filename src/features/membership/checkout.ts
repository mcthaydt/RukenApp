// STUB (red push)
import type Stripe from "stripe";
import type { PremiumPlan } from "./plans.ts";
import type { CheckoutStarted } from "./stripe-client.ts";

export const PREMIUM_PRODUCT_ID = "";

export const PREMIUM_TAX_CODE = "";

export const PREMIUM_LOOKUP_KEYS = { monthly: "", annual: "" } as const satisfies Record<PremiumPlan, string>;

export interface PremiumPrices {
  readonly monthly: string;
  readonly annual: string;
}

export function ensurePremiumPrices(stripe: Stripe): Promise<PremiumPrices> {
  throw new Error(`not built yet ${typeof stripe}`);
}

export function isMissing(error: unknown): boolean {
  throw new Error(`not built yet ${typeof error}`);
}

export function createBillingCustomer(
  stripe: Stripe,
  input: { readonly userId: string; readonly email: string },
): Promise<string> {
  throw new Error(`not built yet ${typeof stripe} ${typeof input}`);
}

export function premiumCheckoutExpiry(nowMs: number): number {
  throw new Error(`not built yet ${typeof nowMs}`);
}

export interface PremiumCheckoutInput {
  readonly priceId: string;
  readonly customerId: string;
  readonly userId: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly expiresAtSec: number;
  readonly metadata: Readonly<Record<string, string>>;
}

export function startPremiumCheckoutSession(
  stripe: Stripe,
  input: PremiumCheckoutInput,
): Promise<CheckoutStarted> {
  throw new Error(`not built yet ${typeof stripe} ${typeof input}`);
}

export function closeCheckoutSession(stripe: Stripe, sessionId: string): Promise<"expired" | "complete"> {
  throw new Error(`not built yet ${typeof stripe} ${typeof sessionId}`);
}
