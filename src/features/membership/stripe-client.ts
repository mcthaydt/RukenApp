// STUB (red push)
import type Stripe from "stripe";

export interface StripeOptions {
  readonly secretKey: string;
  readonly apiBase?: string;
  readonly fetch?: typeof fetch;
}

export function createStripe(options: StripeOptions): Stripe {
  throw new Error(`not built yet ${typeof options}`);
}

export function checkoutExpiry(nowMs: number): number {
  throw new Error(`not built yet ${typeof nowMs}`);
}

export interface CheckoutStarted {
  readonly id: string;
  readonly url: string;
}
