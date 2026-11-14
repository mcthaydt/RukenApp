import Stripe from "stripe";

/**
 * How old a webhook signature may be, in seconds. Stripe's own default: a captured delivery
 * can't be replayed later, while Stripe's normal delivery delay stays well inside it.
 */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export interface WebhookDelivery {
  /** The raw request body, exactly as received: the signature covers these bytes. */
  readonly payload: string;
  /** The `Stripe-Signature` header. */
  readonly signature: string;
  /** The endpoint's signing secret (`whsec_…`). */
  readonly secret: string;
  /** Now, in milliseconds, from the injected Clock. */
  readonly nowMs: number;
}

// Verifying a signature needs no API key and makes no request; the Stripe instance only
// provides the SDK's verifier. The key below is never sent anywhere.
const verifier = new Stripe("sk_unused_for_verification");

// Web Crypto, the one HMAC a Worker offers without waiting. The synchronous check needs Node's own
// crypto, which Workers do not have in the same shape.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Checks that a webhook came from Stripe and is recent, and returns its event. Rejects on a wrong
 * or missing signature, a changed body, or a delivery older than the tolerance; the caller answers
 * 400 and stores nothing.
 */
export function verifyStripeWebhook(delivery: WebhookDelivery): Promise<Stripe.Event> {
  return verifier.webhooks.constructEventAsync(
    delivery.payload,
    delivery.signature,
    delivery.secret,
    WEBHOOK_TOLERANCE_SECONDS,
    cryptoProvider,
    // The SDK takes "received at" in milliseconds (it divides by 1000 itself), so the injected
    // time goes in unchanged; without it the SDK would read the system clock.
    delivery.nowMs,
  );
}
