import { describe, expect, it, vi } from "vitest";
import {
  handleStripeEvent,
  type InvoicePaidOutcome,
  type MembershipEventHandlers,
  type StripeEvent,
  type SyncOutcome,
} from "../../../src/features/membership/events.ts";

// What each Stripe event does. A handler is a fake that records the call, so these tests show which
// event reaches which handler, with what.

const CREATED = 1_793_620_800;

function event(type: string, object: unknown): StripeEvent {
  return { id: "evt_1", type, created: CREATED, livemode: false, data: { object } };
}

function handlers() {
  return {
    completeCheckout: vi.fn((): Promise<unknown> => Promise.resolve("recorded")),
    expireCheckout: vi.fn((): Promise<unknown> => Promise.resolve()),
    syncSubscription: vi.fn((): Promise<SyncOutcome> => Promise.resolve("updated")),
    recordInvoicePaid: vi.fn((): Promise<InvoicePaidOutcome> => Promise.resolve({ outcome: "recorded" })),
    report: vi.fn<(problem: Error) => void>(),
  } satisfies MembershipEventHandlers;
}

/** True when no handler of `h` was called. */
function nothingCalled(h: ReturnType<typeof handlers>): boolean {
  return Object.values(h).every((handler) => handler.mock.calls.length === 0);
}

const SESSION = {
  id: "cs_premium_1",
  payment_status: "paid",
  subscription: "sub_1",
  metadata: { kind: "premium", checkoutRef: "ref_1", plan: "monthly" },
};

describe("checkout.session.completed", () => {
  it("completes a membership checkout with its subscription and the event's time", async () => {
    const h = handlers();
    await handleStripeEvent(h, event("checkout.session.completed", SESSION));
    expect(h.completeCheckout).toHaveBeenCalledWith({
      stripeCheckoutSessionId: "cs_premium_1",
      subscriptionId: "sub_1",
      atMs: CREATED * 1000,
    });
  });

  it("throws for a membership checkout without a subscription, so it is tried again", async () => {
    const h = handlers();
    await expect(
      handleStripeEvent(h, event("checkout.session.completed", { ...SESSION, subscription: null })),
    ).rejects.toThrow(/cs_premium_1/);
  });

  it("does nothing with an unpaid session, or one that is not for the membership", async () => {
    const h = handlers();
    await handleStripeEvent(h, event("checkout.session.completed", { ...SESSION, payment_status: "unpaid" }));
    await handleStripeEvent(h, event("checkout.session.completed", { ...SESSION, metadata: null }));
    await handleStripeEvent(h, event("checkout.session.completed", { ...SESSION, metadata: { kind: "x" } }));
    expect(nothingCalled(h)).toBe(true);
  });
});

describe("checkout.session.expired", () => {
  it("closes the checkout of an expired session", async () => {
    const h = handlers();
    await handleStripeEvent(h, event("checkout.session.expired", { id: "cs_premium_1" }));
    expect(h.expireCheckout).toHaveBeenCalledWith("cs_premium_1");
  });
});

describe("subscriptions", () => {
  it.each([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ])("mirrors the subscription on %s, from the event's time", async (type) => {
    const h = handlers();
    await handleStripeEvent(h, event(type, { id: "sub_1" }));
    expect(h.syncSubscription).toHaveBeenCalledWith("sub_1", CREATED * 1000);
    expect(h.report).not.toHaveBeenCalled();
  });

  it("raises a problem when a member has a second subscription running", async () => {
    const h = handlers();
    h.syncSubscription.mockResolvedValueOnce("second_subscription");
    await handleStripeEvent(h, event("customer.subscription.created", { id: "sub_2" }));
    expect(h.report).toHaveBeenCalledWith(
      new Error("A member has two subscriptions running. Cancel one in Stripe."),
    );
  });
});

describe("invoices", () => {
  it("records a paid invoice and raises nothing", async () => {
    const h = handlers();
    await handleStripeEvent(h, event("invoice.paid", { id: "in_1" }));
    expect(h.recordInvoicePaid).toHaveBeenCalledWith("in_1");
    expect(h.report).not.toHaveBeenCalled();
  });

  it.each(["duplicate", "not_premium", "not_this_stack"] as const)(
    "raises nothing for an invoice answered %s",
    async (outcome) => {
      const h = handlers();
      h.recordInvoicePaid.mockResolvedValueOnce({ outcome });
      await handleStripeEvent(h, event("invoice.paid", { id: "in_1" }));
      expect(h.report).not.toHaveBeenCalled();
    },
  );

  it("raises a payment for a subscription that has ended, for a person to refund", async () => {
    const h = handlers();
    h.recordInvoicePaid.mockResolvedValueOnce({ outcome: "paid_after_end" });
    await handleStripeEvent(h, event("invoice.paid", { id: "in_1" }));
    expect(h.report).toHaveBeenCalledWith(
      new Error("An invoice was paid after its subscription ended. Refund it in Stripe."),
    );
  });

  it("mirrors the subscription of a failed invoice, from the event's time", async () => {
    const h = handlers();
    await handleStripeEvent(
      h,
      event("invoice.payment_failed", {
        id: "in_1",
        parent: { subscription_details: { subscription: "sub_1" } },
      }),
    );
    expect(h.syncSubscription).toHaveBeenCalledWith("sub_1", CREATED * 1000);
  });

  it("does nothing with a failed invoice that has no subscription", async () => {
    const h = handlers();
    await handleStripeEvent(h, event("invoice.payment_failed", { id: "in_1", parent: null }));
    expect(nothingCalled(h)).toBe(true);
  });
});

describe("events that are kept and not acted on", () => {
  it.each(["charge.dispute.created", "charge.dispute.closed", "charge.refunded", "customer.created"])(
    "calls no handler for %s and does not throw",
    async (type) => {
      const h = handlers();
      await expect(handleStripeEvent(h, event(type, { id: "x_1" }))).resolves.toBeUndefined();
      expect(nothingCalled(h)).toBe(true);
    },
  );
});
