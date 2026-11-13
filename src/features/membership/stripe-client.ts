import Stripe from "stripe";

export interface StripeOptions {
  readonly secretKey: string;
  /**
   * Tests and local runs only: send every call to a stand-in Stripe at this address, for example
   * `http://127.0.0.1:12111`. Left out, calls go to Stripe itself.
   */
  readonly apiBase?: string;
  /** The `fetch` to send calls with. Left out, the platform's own is used. */
  readonly fetch?: typeof fetch;
}

/**
 * Makes the Stripe client. Every call goes through `fetch`, which is what a Worker has, whichever
 * build of the SDK the bundler picks (Node's own HTTP client does not run on Workers).
 */
export function createStripe(options: StripeOptions): Stripe {
  const httpClient = Stripe.createFetchHttpClient(options.fetch);
  if (options.apiBase === undefined) return new Stripe(options.secretKey, { httpClient });
  const base = new URL(options.apiBase);
  return new Stripe(options.secretKey, {
    httpClient,
    host: base.hostname,
    port: base.port,
    protocol: base.protocol === "https:" ? "https" : "http",
  });
}

/**
 * When a new Checkout expires, in Unix seconds: 31 minutes from now. Stripe refuses an `expires_at` less
 * than 30 minutes away, and a few seconds pass between working it out and Stripe reading it. Stripe then
 * sends `checkout.session.expired`, which closes the CheckoutIntent, instead of waiting its default 24 hours.
 */
export function checkoutExpiry(nowMs: number): number {
  return Math.floor(nowMs / 1000) + 31 * 60;
}

export interface CheckoutStarted {
  /** The Checkout Session id; the return page finds the checkout again with it. */
  readonly id: string;
  /** The hosted Stripe page the person is sent to. */
  readonly url: string;
}
