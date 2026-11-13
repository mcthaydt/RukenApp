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

/** The fields of a Checkout Session read here. Stripe sends more. */
interface CompletedSession {
  id: string;
  payment_status: string;
  subscription: string | null;
  metadata: Record<string, string> | null;
}

/** The fields of an Invoice read here: only its subscription, since the handlers read the rest from Stripe. */
interface Invoice {
  id: string;
  parent: { subscription_details: { subscription: string } | null } | null;
}

const SECOND_SUBSCRIPTION = "A member has two subscriptions running. Cancel one in Stripe.";
const PAID_AFTER_END = "An invoice was paid after its subscription ended. Refund it in Stripe.";

export async function handleStripeEvent(
  handlers: MembershipEventHandlers,
  event: StripeEvent,
): Promise<void> {
  const atMs = event.created * 1000;
  switch (event.type) {
    case "checkout.session.completed":
      await completeCheckout(handlers, event.data.object as CompletedSession, atMs);
      return;
    case "checkout.session.expired":
      await handlers.expireCheckout((event.data.object as { id: string }).id);
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(handlers, (event.data.object as { id: string }).id, atMs);
      return;
    case "invoice.paid": {
      const paid = await handlers.recordInvoicePaid((event.data.object as Invoice).id);
      if (paid.outcome === "paid_after_end") handlers.report(new Error(PAID_AFTER_END));
      return;
    }
    case "invoice.payment_failed": {
      // The subscription is now past_due on Stripe's side; mirroring it stamps the first failure
      // with this event's time.
      const subscriptionId = (event.data.object as Invoice).parent?.subscription_details?.subscription;
      if (subscriptionId !== undefined) await syncSubscription(handlers, subscriptionId, atMs);
      return;
    }
    default:
      // Disputes, refunds and every other type are kept in the inbox and do nothing here.
      return;
  }
}

async function completeCheckout(handlers: MembershipEventHandlers, session: CompletedSession, atMs: number) {
  // "unpaid" means a delayed payment method that may still fail: nothing is granted until Stripe
  // says it is paid. Checkout only offers cards, so this does not happen in practice.
  if (session.payment_status !== "paid") return;
  // A checkout Ruken did not start for the membership is none of this code's business.
  if (session.metadata?.kind !== "premium") return;
  if (session.subscription === null) throw new Error(`Membership checkout ${session.id} has no subscription`);
  await handlers.completeCheckout({
    stripeCheckoutSessionId: session.id,
    subscriptionId: session.subscription,
    atMs,
  });
}

async function syncSubscription(handlers: MembershipEventHandlers, subscriptionId: string, atMs: number) {
  if ((await handlers.syncSubscription(subscriptionId, atMs)) === "second_subscription") {
    // The member is paying for two subscriptions. Ruken mirrors only the first.
    handlers.report(new Error(SECOND_SUBSCRIPTION));
  }
}
