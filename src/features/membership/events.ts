// STUB (red push)
/**
 * What each Stripe event does. The webhook route only checks and stores a verified delivery; the
 * inbox then calls this for it, and again later if it failed.
 *
 * Every handler is safe to run again for the same event: the services key what they record by
 * Stripe's ids and skip a repeat, and the subscription and invoice handlers read the current state
 * from Stripe rather than trusting the event, so a late or out-of-order event changes nothing it
 * shouldn't. A handler throws when something it needs is not there yet; the delivery is then
 * tried again.
 *
 * Disputes and refunds are kept in the inbox and not acted on yet: they are the money rules of a
 * later slice.
 */

/** The fields of a verified Stripe event this code reads. */
export interface StripeEvent {
  readonly id: string;
  readonly type: string;
  /** When Stripe created the event, in Unix seconds. */
  readonly created: number;
  readonly livemode: boolean;
  readonly data: { readonly object: unknown };
}

/** What syncing a subscription into the member's row answered. */
export type SyncOutcome =
  /** The row now mirrors the subscription (or already did). */
  | "updated"
  /** Nothing to change: the first payment has not gone through, or the event was about an old subscription. */
  | "ignored"
  /** A second subscription is running beside the member's current one. Nothing is changed; a person must look. */
  | "second_subscription"
  /** Not a subscription Ruken started for the membership. */
  | "not_premium"
  /** A subscription of a person this database does not have: another stack's, in a shared Stripe test mode. */
  | "not_this_stack";

/** What recording a paid invoice answered. */
export type InvoicePaidOutcome =
  | { readonly outcome: "recorded" }
  /**
   * The invoice was paid when its subscription had already ended: it bought no membership. Nothing
   * is recorded, and a person refunds it in Stripe.
   */
  | { readonly outcome: "paid_after_end" }
  | { readonly outcome: "duplicate" | "not_premium" | "not_this_stack" };

export interface MembershipEventHandlers {
  completeCheckout(input: {
    readonly stripeCheckoutSessionId: string;
    readonly subscriptionId: string;
    readonly atMs: number;
  }): Promise<unknown>;
  expireCheckout(stripeCheckoutSessionId: string): Promise<unknown>;
  syncSubscription(subscriptionId: string, observedAtMs: number): Promise<SyncOutcome>;
  recordInvoicePaid(invoiceId: string): Promise<InvoicePaidOutcome>;
  /** Raises something a person should look at; it does not stop the event being handled. */
  report(problem: Error): void;
}

export function handleStripeEvent(handlers: MembershipEventHandlers, event: StripeEvent): Promise<void> {
  throw new Error(`not built yet ${typeof handlers} ${typeof event}`);
}
