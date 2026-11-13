import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  cancelSubscriptionNow,
  createPortalLink,
  readPaidPremiumInvoice,
  readSubscription,
  voidPayableInvoices,
} from "../../../src/features/membership/subscription.ts";

// The Stripe reads and writes behind a membership. Each test hands the function a Stripe that
// answers with the shapes of the current API (SDK 22, API 2026-08-26), so these test what Ruken
// reads out of the answers.

const PERIOD_START = 1_793_620_800; // 2026-11-02 15:00 UTC, in Unix seconds as Stripe sends them
const PERIOD_END = 1_796_212_800;
const PAID_AT = PERIOD_START + 60;

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    cancel_at_period_end: false,
    cancel_at: null,
    ended_at: null,
    metadata: { kind: "premium", userId: "user_1" },
    pending_update: null,
    default_payment_method: null,
    latest_invoice: null,
    items: {
      data: [
        {
          id: "si_1",
          current_period_start: PERIOD_START,
          current_period_end: PERIOD_END,
          price: { id: "price_monthly", recurring: { interval: "month" } },
        },
      ],
    },
    ...overrides,
  };
}

function fakeStripe() {
  const fake = {
    subscriptions: {
      retrieve: vi.fn((): Promise<unknown> => Promise.resolve(subscription())),
      update: vi.fn((): Promise<unknown> => Promise.resolve(subscription())),
      cancel: vi.fn((): Promise<unknown> => Promise.resolve(subscription({ status: "canceled" }))),
    },
    billingPortal: {
      sessions: {
        create: vi.fn(() => Promise.resolve({ url: "https://billing.stripe.com/p/session/test_1" })),
      },
    },
    invoices: {
      retrieve: vi.fn((): Promise<unknown> => Promise.resolve(invoice())),
      list: vi.fn((): Promise<unknown> => Promise.resolve({ data: [] })),
      voidInvoice: vi.fn((id: string): Promise<unknown> => Promise.resolve({ id, status: "void" })),
    },
    paymentIntents: {
      retrieve: vi.fn(() =>
        Promise.resolve({ id: "pi_1", latest_charge: { id: "ch_1", balance_transaction: { fee: 267 } } }),
      ),
    },
    charges: {
      retrieve: vi.fn(() => Promise.resolve({ id: "ch_1", balance_transaction: { fee: 31 } })),
    },
  };
  return { fake, stripe: fake as unknown as Stripe };
}

describe("readSubscription", () => {
  it("reads the state, the plan from the price's interval and the period end from the item", async () => {
    const { fake, stripe } = fakeStripe();
    await expect(readSubscription(stripe, "sub_1")).resolves.toEqual({
      id: "sub_1",
      status: "active",
      plan: "monthly",
      cancelAtPeriodEnd: false,
      cancelAtMs: null,
      currentPeriodEndMs: PERIOD_END * 1000,
      customerId: "cus_1",
      userId: "user_1",
      premium: true,
      endedAtMs: null,
    });
    expect(fake.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
  });

  it("reads a yearly price as the annual plan, and a set cancel time", async () => {
    const { fake, stripe } = fakeStripe();
    fake.subscriptions.retrieve.mockResolvedValueOnce(
      subscription({
        cancel_at: PERIOD_END,
        items: {
          data: [{ id: "si_1", current_period_end: PERIOD_END, price: { recurring: { interval: "year" } } }],
        },
      }),
    );
    await expect(readSubscription(stripe, "sub_1")).resolves.toMatchObject({
      plan: "annual",
      cancelAtMs: PERIOD_END * 1000,
    });
  });

  it("reads when an ended subscription ended", async () => {
    const { fake, stripe } = fakeStripe();
    fake.subscriptions.retrieve.mockResolvedValueOnce(
      subscription({ status: "canceled", ended_at: PAID_AT }),
    );
    await expect(readSubscription(stripe, "sub_1")).resolves.toMatchObject({
      status: "canceled",
      endedAtMs: PAID_AT * 1000,
    });
  });

  it("marks a subscription Ruken did not start for the membership", async () => {
    const { fake, stripe } = fakeStripe();
    fake.subscriptions.retrieve.mockResolvedValueOnce(subscription({ metadata: {} }));
    await expect(readSubscription(stripe, "sub_1")).resolves.toMatchObject({ premium: false, userId: null });
  });

  it("refuses a price that is neither monthly nor yearly", async () => {
    const { fake, stripe } = fakeStripe();
    fake.subscriptions.retrieve.mockResolvedValueOnce(
      subscription({
        items: {
          data: [{ id: "si_1", current_period_end: PERIOD_END, price: { recurring: { interval: "week" } } }],
        },
      }),
    );
    await expect(readSubscription(stripe, "sub_1")).rejects.toThrow(/sub_1/);
  });
});

describe("cancelSubscriptionNow", () => {
  it("cancels at once with no final invoice and no proration, so nothing more is charged or credited", async () => {
    const { fake, stripe } = fakeStripe();
    await expect(cancelSubscriptionNow(stripe, "sub_1")).resolves.toMatchObject({ status: "canceled" });
    expect(fake.subscriptions.cancel).toHaveBeenCalledWith("sub_1", { invoice_now: false, prorate: false });
  });
});

// An ended subscription's unpaid invoice could still be paid from Stripe's hosted page.
describe("voidPayableInvoices", () => {
  it("voids the subscription's open and uncollectible invoices, and nothing else", async () => {
    const { fake, stripe } = fakeStripe();
    fake.invoices.list
      .mockResolvedValueOnce({ data: [{ id: "in_open" }] })
      .mockResolvedValueOnce({ data: [{ id: "in_uncollectible" }] });

    await expect(voidPayableInvoices(stripe, "sub_1")).resolves.toBe(2);

    expect(fake.invoices.list).toHaveBeenCalledWith({ subscription: "sub_1", status: "open", limit: 100 });
    expect(fake.invoices.list).toHaveBeenCalledWith({
      subscription: "sub_1",
      status: "uncollectible",
      limit: 100,
    });
    expect(fake.invoices.voidInvoice.mock.calls).toEqual([["in_open"], ["in_uncollectible"]]);
  });

  it("voids nothing when every invoice is paid", async () => {
    const { fake, stripe } = fakeStripe();
    await expect(voidPayableInvoices(stripe, "sub_1")).resolves.toBe(0);
    expect(fake.invoices.voidInvoice).not.toHaveBeenCalled();
  });
});

describe("createPortalLink", () => {
  it("opens Stripe's billing portal whole, so the member can cancel there (design 5.6)", async () => {
    const { fake, stripe } = fakeStripe();
    await expect(createPortalLink(stripe, "cus_1", "https://ruken.example/me")).resolves.toBe(
      "https://billing.stripe.com/p/session/test_1",
    );
    expect(fake.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://ruken.example/me",
    });
    expect(JSON.stringify(fake.billingPortal.sessions.create.mock.calls[0])).not.toContain("flow_data");
  });
});

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "in_1",
    status: "paid",
    currency: "usd",
    total: 8552,
    amount_paid: 8552,
    total_taxes: [{ amount: 600 }, { amount: 52 }],
    status_transitions: { paid_at: PAID_AT },
    parent: {
      type: "subscription_details",
      subscription_details: { subscription: "sub_1", metadata: { kind: "premium", userId: "user_1" } },
    },
    payments: { data: [{ status: "paid", payment: { type: "payment_intent", payment_intent: "pi_1" } }] },
    lines: {
      data: [
        {
          amount: 7900,
          period: { start: PERIOD_START, end: PERIOD_START + 365 * 86_400 },
          pricing: { price_details: { price: { recurring: { interval: "year" } } } },
        },
      ],
    },
    ...overrides,
  };
}

describe("readPaidPremiumInvoice", () => {
  // Amounts are kept as US cents.
  it("refuses an invoice paid in another currency", async () => {
    const { fake, stripe } = fakeStripe();
    fake.invoices.retrieve.mockResolvedValueOnce(invoice({ currency: "eur" }));
    await expect(readPaidPremiumInvoice(stripe, "in_1")).rejects.toThrow(/paid in eur/);
  });

  // A dashboard credit paid 2000 of the 8552, so the card paid 6552 and its share of tax.
  it("scales the tax to the part paid by card when a credit balance paid the rest", async () => {
    const { fake, stripe } = fakeStripe();
    fake.invoices.retrieve.mockResolvedValueOnce(invoice({ amount_paid: 6552 }));
    // 652 × 6552 / 8552 = 499.52…, rounded half up.
    await expect(readPaidPremiumInvoice(stripe, "in_1")).resolves.toMatchObject({ gross: 6552n, tax: 500n });
  });

  it("reads the payment from the invoice: amounts, tax, the card fee, the plan and the paid period", async () => {
    const { fake, stripe } = fakeStripe();
    await expect(readPaidPremiumInvoice(stripe, "in_1")).resolves.toEqual({
      stripeInvoiceId: "in_1",
      subscriptionId: "sub_1",
      userId: "user_1",
      plan: "annual",
      periodStartMs: PERIOD_START * 1000,
      paidAtMs: PAID_AT * 1000,
      gross: 8552n,
      tax: 652n,
      fee: 267n,
    });
    expect(fake.invoices.retrieve).toHaveBeenCalledWith("in_1", {
      expand: ["payments", "lines.data.pricing.price_details.price"],
    });
    expect(fake.paymentIntents.retrieve).toHaveBeenCalledWith("pi_1", {
      expand: ["latest_charge.balance_transaction"],
    });
  });

  it("takes the plan and period of the line being paid for, not a credit line for unused time", async () => {
    const { stripe, fake } = fakeStripe();
    fake.invoices.retrieve.mockResolvedValueOnce(
      invoice({
        lines: {
          data: [
            {
              amount: -400,
              period: { start: PERIOD_START - 15 * 86_400, end: PERIOD_START + 15 * 86_400 },
              pricing: { price_details: { price: { recurring: { interval: "month" } } } },
            },
            {
              amount: 7900,
              period: { start: PERIOD_START, end: PERIOD_START + 365 * 86_400 },
              pricing: { price_details: { price: { recurring: { interval: "year" } } } },
            },
          ],
        },
      }),
    );
    await expect(readPaidPremiumInvoice(stripe, "in_1")).resolves.toMatchObject({
      plan: "annual",
      periodStartMs: PERIOD_START * 1000,
    });
  });

  it("reads the fee from a charge when the payment has no payment intent", async () => {
    const { stripe, fake } = fakeStripe();
    fake.invoices.retrieve.mockResolvedValueOnce(
      invoice({ payments: { data: [{ status: "paid", payment: { type: "charge", charge: "ch_1" } }] } }),
    );
    await expect(readPaidPremiumInvoice(stripe, "in_1")).resolves.toMatchObject({ fee: 31n });
    expect(fake.charges.retrieve).toHaveBeenCalledWith("ch_1", { expand: ["balance_transaction"] });
  });

  it("is null for an invoice that isn't a membership subscription's", async () => {
    const { stripe, fake } = fakeStripe();
    fake.invoices.retrieve.mockResolvedValueOnce(invoice({ parent: null }));
    await expect(readPaidPremiumInvoice(stripe, "in_1")).resolves.toBeNull();
    fake.invoices.retrieve.mockResolvedValueOnce(
      invoice({ parent: { subscription_details: { subscription: "sub_1", metadata: { kind: "other" } } } }),
    );
    await expect(readPaidPremiumInvoice(stripe, "in_1")).resolves.toBeNull();
  });

  it("is null for an invoice with nothing paid (a credit covered it)", async () => {
    const { stripe, fake } = fakeStripe();
    fake.invoices.retrieve.mockResolvedValueOnce(invoice({ amount_paid: 0 }));
    await expect(readPaidPremiumInvoice(stripe, "in_1")).resolves.toBeNull();
  });

  it("throws, so Stripe sends the event again, while the fee can't be read yet", async () => {
    const { stripe, fake } = fakeStripe();
    fake.paymentIntents.retrieve.mockResolvedValueOnce({
      id: "pi_1",
      latest_charge: { id: "ch_1", balance_transaction: null },
    } as never);
    await expect(readPaidPremiumInvoice(stripe, "in_1")).rejects.toThrow(/balance transaction/);
  });

  it("throws for an invoice that isn't paid yet", async () => {
    const { stripe, fake } = fakeStripe();
    fake.invoices.retrieve.mockResolvedValueOnce(invoice({ status: "open" }));
    await expect(readPaidPremiumInvoice(stripe, "in_1")).rejects.toThrow(/in_1/);
  });
});
