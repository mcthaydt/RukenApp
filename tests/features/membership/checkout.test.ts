import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  closeCheckoutSession,
  ensurePremiumPrices,
  PREMIUM_LOOKUP_KEYS,
  PREMIUM_PRODUCT_ID,
  PREMIUM_TAX_CODE,
  premiumCheckoutExpiry,
  startPremiumCheckoutSession,
} from "../../../src/features/membership/checkout.ts";

// The membership product and prices are found or made by code, never typed into Stripe, and the
// checkout is a subscription at those prices with nothing taken off. These tests use a hand-made
// Stripe with only the calls this file makes.

function missing(): Stripe.errors.StripeInvalidRequestError {
  return new Stripe.errors.StripeInvalidRequestError({
    message: "No such product",
    code: "resource_missing",
    type: "invalid_request_error",
    statusCode: 404,
  });
}

interface FakePrice {
  id: string;
  lookup_key: string;
  unit_amount: number;
  currency: string;
  tax_behavior: string;
  recurring: { interval: string };
}

function price(plan: "monthly" | "annual", overrides: Partial<FakePrice> = {}): FakePrice {
  return {
    id: `price_${plan}`,
    lookup_key: PREMIUM_LOOKUP_KEYS[plan],
    unit_amount: plan === "monthly" ? 999 : 9900,
    currency: "usd",
    tax_behavior: "exclusive",
    recurring: { interval: plan === "monthly" ? "month" : "year" },
    ...overrides,
  };
}

function fakeStripe(options: { product?: "exists" | "missing" | Error; prices?: FakePrice[] } = {}) {
  const fake = {
    products: {
      retrieve: vi.fn(() => {
        const product = options.product ?? "exists";
        if (product === "exists") return Promise.resolve({ id: PREMIUM_PRODUCT_ID });
        return Promise.reject(product === "missing" ? missing() : product);
      }),
      create: vi.fn(() => Promise.resolve({ id: PREMIUM_PRODUCT_ID })),
    },
    prices: {
      list: vi.fn(() => Promise.resolve({ data: options.prices ?? [] })),
      create: vi.fn((params: { lookup_key: string }) =>
        Promise.resolve({ id: `price_new_${params.lookup_key}` }),
      ),
    },
    checkout: {
      sessions: {
        create: vi.fn(() =>
          Promise.resolve({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" }),
        ),
        expire: vi.fn(() => Promise.resolve({ id: "cs_old", status: "expired" })),
        retrieve: vi.fn(() => Promise.resolve({ id: "cs_old", status: "complete" })),
      },
    },
  };
  return { fake, stripe: fake as unknown as Stripe };
}

describe("ensurePremiumPrices", () => {
  it("reuses the product and the prices found by their lookup keys", async () => {
    const { fake, stripe } = fakeStripe({ prices: [price("monthly"), price("annual")] });
    await expect(ensurePremiumPrices(stripe)).resolves.toEqual({
      monthly: "price_monthly",
      annual: "price_annual",
    });
    expect(fake.products.retrieve).toHaveBeenCalledWith(PREMIUM_PRODUCT_ID);
    expect(fake.products.create).not.toHaveBeenCalled();
    expect(fake.prices.list).toHaveBeenCalledWith(
      expect.objectContaining({
        lookup_keys: [PREMIUM_LOOKUP_KEYS.monthly, PREMIUM_LOOKUP_KEYS.annual],
        active: true,
      }),
    );
    expect(fake.prices.create).not.toHaveBeenCalled();
  });

  it("creates the product with its own id and tax code when it is missing", async () => {
    const { fake, stripe } = fakeStripe({ product: "missing", prices: [price("monthly"), price("annual")] });
    await ensurePremiumPrices(stripe);
    expect(fake.products.create).toHaveBeenCalledWith({
      id: PREMIUM_PRODUCT_ID,
      name: "Ruken membership",
      tax_code: PREMIUM_TAX_CODE,
    });
  });

  it("passes on any other error reading the product", async () => {
    const { stripe } = fakeStripe({ product: new Error("Stripe is down") });
    await expect(ensurePremiumPrices(stripe)).rejects.toThrow("Stripe is down");
  });

  it("creates a missing price at the constant amount, before tax, recurring by month or year", async () => {
    const { fake, stripe } = fakeStripe({ prices: [price("monthly")] });
    await expect(ensurePremiumPrices(stripe)).resolves.toEqual({
      monthly: "price_monthly",
      annual: `price_new_${PREMIUM_LOOKUP_KEYS.annual}`,
    });
    expect(fake.prices.create).toHaveBeenCalledTimes(1);
    expect(fake.prices.create).toHaveBeenCalledWith({
      product: PREMIUM_PRODUCT_ID,
      currency: "usd",
      unit_amount: 9900,
      tax_behavior: "exclusive",
      recurring: { interval: "year" },
      lookup_key: PREMIUM_LOOKUP_KEYS.annual,
      metadata: { plan: "annual" },
    });
  });

  it.each([
    ["another amount", { unit_amount: 799 }],
    ["another interval", { recurring: { interval: "week" } }],
    ["another currency", { currency: "eur" }],
    ["tax included", { tax_behavior: "inclusive" }],
  ])("never reuses a price with %s, and creates nothing in its place", async (_label, change) => {
    const { fake, stripe } = fakeStripe({ prices: [price("monthly", change), price("annual")] });
    await expect(ensurePremiumPrices(stripe)).rejects.toThrow(/ruken_membership_monthly/);
    expect(fake.prices.create).not.toHaveBeenCalled();
  });
});

describe("the new prices (Owner, 2026-11-13: $9.99 a month, $99 a year)", () => {
  it("are looked up under the new keys, so a Stripe account that ran the old code is left alone", async () => {
    const { fake, stripe } = fakeStripe({ prices: [price("monthly"), price("annual")] });
    await ensurePremiumPrices(stripe);
    expect(PREMIUM_PRODUCT_ID).toBe("ruken_membership");
    expect(fake.prices.list).toHaveBeenCalledWith(
      expect.objectContaining({ lookup_keys: ["ruken_membership_monthly", "ruken_membership_annual"] }),
    );
  });

  it("are made at 999 and 9900 cents when Stripe holds neither", async () => {
    const { fake, stripe } = fakeStripe();
    await ensurePremiumPrices(stripe);
    expect(fake.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({ lookup_key: "ruken_membership_monthly", unit_amount: 999 }),
    );
    expect(fake.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({ lookup_key: "ruken_membership_annual", unit_amount: 9900 }),
    );
  });

  it("are never used when Stripe holds the old $7.99 under a new key", async () => {
    const { fake, stripe } = fakeStripe({
      prices: [price("monthly", { unit_amount: 799 }), price("annual")],
    });
    await expect(ensurePremiumPrices(stripe)).rejects.toThrow(/ruken_membership_monthly/);
    expect(fake.prices.create).not.toHaveBeenCalled();
  });
});

describe("startPremiumCheckoutSession", () => {
  const input = {
    priceId: "price_monthly",
    customerId: "cus_1",
    userId: "user_1",
    successUrl: "https://ruken.example/join/done?checkout=ref_1",
    cancelUrl: "https://ruken.example/join?plan=monthly",
    expiresAtSec: 1_793_622_660,
    metadata: { checkoutRef: "ref_1", kind: "premium", plan: "monthly" },
  };

  it("is a hosted subscription checkout for the buyer's customer, with tax and an address", async () => {
    const { fake, stripe } = fakeStripe();
    await expect(startPremiumCheckoutSession(stripe, input)).resolves.toEqual({
      id: "cs_test_1",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    });
    expect(fake.checkout.sessions.create).toHaveBeenCalledWith({
      mode: "subscription",
      customer: "cus_1",
      line_items: [{ price: "price_monthly", quantity: 1 }],
      client_reference_id: "user_1",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      expires_at: 1_793_622_660,
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      allow_promotion_codes: false,
      metadata: { checkoutRef: "ref_1", kind: "premium", plan: "monthly", userId: "user_1" },
      subscription_data: {
        metadata: { checkoutRef: "ref_1", kind: "premium", plan: "monthly", userId: "user_1" },
      },
    });
  });

  it("offers no trial and no discount", async () => {
    const { fake, stripe } = fakeStripe();
    await startPremiumCheckoutSession(stripe, input);
    const params = JSON.stringify(fake.checkout.sessions.create.mock.calls[0]);
    expect(params).not.toMatch(/trial|discount|coupon/);
  });

  it("refuses a session without a page to send the buyer to", async () => {
    const { fake, stripe } = fakeStripe();
    fake.checkout.sessions.create.mockResolvedValueOnce({ id: "cs_test_1", url: null as unknown as string });
    await expect(startPremiumCheckoutSession(stripe, input)).rejects.toThrow(/cs_test_1/);
  });
});

describe("premiumCheckoutExpiry", () => {
  it("is 31 minutes out in Unix seconds, just past Stripe's 30-minute minimum", () => {
    expect(premiumCheckoutExpiry(Date.UTC(2026, 10, 2, 15, 0, 0))).toBe(
      Date.UTC(2026, 10, 2, 15, 31, 0) / 1000,
    );
  });
});

describe("closeCheckoutSession", () => {
  function notOpen() {
    return new Stripe.errors.StripeInvalidRequestError({
      message: "Only Checkout Sessions with a status of open can be expired.",
      type: "invalid_request_error",
      statusCode: 400,
    });
  }

  it("expires a session that is still open", async () => {
    const { fake, stripe } = fakeStripe();
    await expect(closeCheckoutSession(stripe, "cs_old")).resolves.toBe("expired");
    expect(fake.checkout.sessions.expire).toHaveBeenCalledWith("cs_old");
  });

  it("answers complete for a session that was paid, so no second checkout starts", async () => {
    const { fake, stripe } = fakeStripe();
    fake.checkout.sessions.expire.mockRejectedValueOnce(notOpen());
    await expect(closeCheckoutSession(stripe, "cs_old")).resolves.toBe("complete");
  });

  it("answers expired for a session that had already expired", async () => {
    const { fake, stripe } = fakeStripe();
    fake.checkout.sessions.expire.mockRejectedValueOnce(notOpen());
    fake.checkout.sessions.retrieve.mockResolvedValueOnce({ id: "cs_old", status: "expired" });
    await expect(closeCheckoutSession(stripe, "cs_old")).resolves.toBe("expired");
  });

  it("passes on any other error", async () => {
    const { fake, stripe } = fakeStripe();
    fake.checkout.sessions.expire.mockRejectedValueOnce(new Error("Stripe is down"));
    await expect(closeCheckoutSession(stripe, "cs_old")).rejects.toThrow("Stripe is down");
  });
});
