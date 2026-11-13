import { describe, expect, it, vi } from "vitest";
import { checkoutExpiry, createStripe } from "../../../src/features/membership/stripe-client.ts";

/** A fetch that answers Stripe's "customer created" reply and remembers what it was asked. */
function fakeFetch() {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify({ id: "cus_1", object: "customer" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

describe("createStripe", () => {
  it("sends every call through the given fetch, to the stand-in's address, over http", async () => {
    const send = fakeFetch();
    const stripe = createStripe({
      secretKey: "sk_test_fake",
      apiBase: "http://127.0.0.1:12111",
      fetch: send,
    });
    await stripe.customers.create({ email: "a@b.test" });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatch(/^http:\/\/127\.0\.0\.1:12111\/v1\/customers/);
  });

  it("goes to Stripe itself when no stand-in address is given", async () => {
    const send = fakeFetch();
    const stripe = createStripe({ secretKey: "sk_test_fake", fetch: send });
    await stripe.customers.create({ email: "a@b.test" });
    expect(send.mock.calls[0]?.[0]).toMatch(/^https:\/\/api\.stripe\.com\/v1\/customers/);
  });
});

describe("checkoutExpiry", () => {
  const NOW = Date.UTC(2026, 10, 2, 15, 0, 0);

  it("is 31 minutes from now in Unix seconds, just past Stripe's 30-minute least", () => {
    expect(checkoutExpiry(NOW)).toBe(NOW / 1000 + 31 * 60);
  });
});
