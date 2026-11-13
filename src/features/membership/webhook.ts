// STUB (red push)
import type Stripe from "stripe";

export const WEBHOOK_TOLERANCE_SECONDS = 0;

export interface WebhookDelivery {
  readonly payload: string;
  readonly signature: string;
  readonly secret: string;
  readonly nowMs: number;
}

export function verifyStripeWebhook(delivery: WebhookDelivery): Promise<Stripe.Event> {
  throw new Error(`not built yet ${typeof delivery}`);
}
