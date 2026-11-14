import { describe, expect, it } from "vitest";
import type { StripeEvent } from "../../../src/features/membership/events.ts";
import { keptEvent } from "../../../src/features/membership/kept-event.ts";

// Ruken keeps a verified Stripe event so slice 5 can post the money and a failed one can be handled again. It keeps
// only what the handlers and the money work read: ids, amounts and states. A person's email, name and address never
// reach the database, so deleting the person's account leaves none of them behind (Owner, 2026-11-14).

function event(object: Record<string, unknown>, overrides: Partial<StripeEvent> = {}): StripeEvent {
  return {
    id: "evt_1",
    type: "checkout.session.completed",
    created: 1_793_620_800,
    livemode: false,
    data: { object },
    ...overrides,
  };
}

/** Everything a checkout session event carries about the person, as Stripe sends it. */
const PERSONAL = {
  customer_email: "grace@example.test",
  customer_details: {
    email: "grace@example.test",
    name: "Grace Hopper",
    phone: "+15555550100",
    address: { line1: "12 Elm Street", city: "Springfield", postal_code: "55555", country: "US" },
  },
  customer_name: "Grace Hopper",
  customer_address: { line1: "12 Elm Street" },
  billing_details: { name: "Grace Hopper", email: "grace@example.test" },
  shipping_details: { name: "Grace Hopper" },
  receipt_email: "grace@example.test",
};

describe("keptEvent", () => {
  it("keeps the event's own id, type, time and mode", () => {
    expect(keptEvent(event({ id: "cs_1" }))).toMatchObject({
      id: "evt_1",
      type: "checkout.session.completed",
      created: 1_793_620_800,
      livemode: false,
    });
  });

  it("keeps what the handlers read from a completed checkout", () => {
    const kept = keptEvent(
      event({
        id: "cs_1",
        payment_status: "paid",
        subscription: "sub_1",
        customer: "cus_1",
        metadata: { kind: "premium", plan: "monthly", userId: "user_1", checkoutRef: "ref_1" },
        ...PERSONAL,
      }),
    );
    expect(kept.data.object).toEqual({
      id: "cs_1",
      payment_status: "paid",
      subscription: "sub_1",
      customer: "cus_1",
      metadata: { kind: "premium", plan: "monthly", userId: "user_1", checkoutRef: "ref_1" },
    });
  });

  it("keeps an invoice's id, amounts and the subscription it belongs to, and nothing about the person", () => {
    const kept = keptEvent(
      event(
        {
          id: "in_1",
          amount_paid: 999,
          currency: "usd",
          status: "paid",
          customer: "cus_1",
          parent: {
            subscription_details: { subscription: "sub_1", metadata: { userId: "user_1" } },
          },
          ...PERSONAL,
        },
        { type: "invoice.paid" },
      ),
    );
    expect(kept.data.object).toEqual({
      id: "in_1",
      amount_paid: 999,
      currency: "usd",
      status: "paid",
      customer: "cus_1",
      parent: { subscription_details: { subscription: "sub_1" } },
    });
  });

  it("drops the person's email, name, address and phone wherever they sit", () => {
    const stored = JSON.stringify(keptEvent(event({ id: "cs_1", ...PERSONAL })));
    for (const detail of ["grace@example.test", "Grace Hopper", "12 Elm Street", "Springfield", "+1555"]) {
      expect(stored).not.toContain(detail);
    }
  });

  it("drops a kept field when Stripe sends an object where an id was, since that object may hold the person", () => {
    const kept = keptEvent(
      event({ id: "cs_1", customer: { id: "cus_1", email: "grace@example.test", name: "Grace Hopper" } }),
    );
    expect(kept.data.object).toEqual({ id: "cs_1" });
  });

  it("keeps only text in metadata", () => {
    const kept = keptEvent(event({ id: "cs_1", metadata: { kind: "premium", nested: { email: "x" } } }));
    expect(kept.data.object).toEqual({ id: "cs_1", metadata: { kind: "premium" } });
  });

  it("keeps an empty object for an event whose object is not an object, and leaves the original alone", () => {
    expect(keptEvent(event({})).data.object).toEqual({});
    const original = event({ id: "cs_1", ...PERSONAL });
    keptEvent(original);
    expect(original.data.object).toMatchObject({ customer_email: "grace@example.test" });
  });
});
