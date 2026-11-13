import type { PremiumCheckoutInput } from "../../src/features/membership/checkout.ts";
import type { PremiumStripe } from "../../src/features/membership/stripe-port.ts";
import type { PaidPremiumInvoice, PremiumSubscription } from "../../src/features/membership/subscription.ts";

// Stripe ids are unique in the database, so the fake numbers them across the whole test file.
let stripeIds = 0;
function nextId(prefix: string): string {
  stripeIds += 1;
  return `${prefix}_${String(stripeIds)}`;
}

/**
 * A PremiumStripe that remembers state, so database tests can drive subscriptions, checkouts and
 * invoices the way Stripe would. A test sets up what Stripe "holds" in the public maps, then calls
 * the service.
 */
export class FakePremiumStripe implements PremiumStripe {
  readonly subscriptions = new Map<string, PremiumSubscription>();
  readonly invoices = new Map<string, PaidPremiumInvoice>();
  readonly sessions = new Map<string, "open" | "complete" | "expired">();
  readonly customersMade: { userId: string; email: string }[] = [];
  readonly checkouts: PremiumCheckoutInput[] = [];
  readonly portalLinks: { customerId: string; returnUrl: string }[] = [];
  /** The calls that change something in Stripe, in order. */
  readonly writes: string[] = [];
  /** How long Stripe takes to make a checkout, to widen the window two starts can race in. */
  checkoutDelayMs = 0;
  private readonly nowMs: () => number;

  /** `nowMs` is the test's clock: the moment a cancelled subscription is said to have ended. */
  constructor(nowMs: () => number) {
    this.nowMs = nowMs;
  }

  prices() {
    return Promise.resolve({ monthly: "price_monthly", annual: "price_annual" });
  }

  createCustomer(input: { userId: string; email: string }) {
    this.customersMade.push(input);
    return Promise.resolve(nextId("cus"));
  }

  async startCheckout(input: PremiumCheckoutInput) {
    this.checkouts.push(input);
    const id = nextId("cs_premium");
    this.sessions.set(id, "open");
    if (this.checkoutDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.checkoutDelayMs));
    return { id, url: `https://checkout.stripe.com/c/pay/${id}` };
  }

  closeCheckout(sessionId: string) {
    if (this.sessions.get(sessionId) === "complete") return Promise.resolve("complete" as const);
    this.sessions.set(sessionId, "expired");
    return Promise.resolve("expired" as const);
  }

  subscription(subscriptionId: string) {
    const found = this.subscriptions.get(subscriptionId);
    if (found === undefined) return Promise.reject(new Error(`no ${subscriptionId}`));
    return Promise.resolve(found);
  }

  /** Changes what Stripe holds for a subscription, as a payment, a cancel or a failure would. */
  change(subscriptionId: string, changes: Partial<PremiumSubscription>): PremiumSubscription {
    const next = { ...this.subscriptions.get(subscriptionId), ...changes } as PremiumSubscription;
    this.subscriptions.set(subscriptionId, next);
    return next;
  }

  cancelNow(subscriptionId: string) {
    this.writes.push("cancelNow");
    return Promise.resolve(this.change(subscriptionId, { status: "canceled", endedAtMs: this.nowMs() }));
  }

  voidPayableInvoices() {
    this.writes.push("voidPayableInvoices");
    return Promise.resolve(0);
  }

  portalLink(customerId: string, returnUrl: string) {
    this.portalLinks.push({ customerId, returnUrl });
    return Promise.resolve("https://billing.stripe.com/p/session/test_1");
  }

  paidInvoice(invoiceId: string) {
    return Promise.resolve(this.invoices.get(invoiceId) ?? null);
  }
}
