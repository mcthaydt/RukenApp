import type { StripeEvent } from "./events.ts";

/**
 * What of a verified Stripe event Ruken keeps in `WebhookInbox`.
 *
 * Not built yet: for now it keeps the whole event.
 */
export function keptEvent(event: StripeEvent): StripeEvent {
  return event;
}
