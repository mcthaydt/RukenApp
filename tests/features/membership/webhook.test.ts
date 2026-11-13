import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { verifyStripeWebhook, WEBHOOK_TOLERANCE_SECONDS } from "../../../src/features/membership/webhook.ts";

// Stripe signs every webhook with the endpoint's secret. Ruken acts only on a delivery whose
// signature is right and recent, so nobody can forge a "paid" event.

const SECRET = "whsec_test_fake";
const SIGNED_AT = 1_800_000_000; // seconds
const payload = JSON.stringify({
  id: "evt_1",
  object: "event",
  type: "invoice.paid",
  data: { object: {} },
});

/** A signature header for the payload, made the way Stripe makes one (with Web Crypto). */
function signed(secret: string, atSeconds: number): Promise<string> {
  return Stripe.webhooks.generateTestHeaderStringAsync({ payload, secret, timestamp: atSeconds });
}

describe("verifyStripeWebhook", () => {
  it("answers a promise of the event for a good signature", async () => {
    const result = verifyStripeWebhook({
      payload,
      signature: await signed(SECRET, SIGNED_AT),
      secret: SECRET,
      nowMs: SIGNED_AT * 1000,
    });
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toMatchObject({ id: "evt_1", type: "invoice.paid" });
  });

  it("rejects a signature made with another secret", async () => {
    await expect(
      verifyStripeWebhook({
        payload,
        signature: await signed("whsec_wrong", SIGNED_AT),
        secret: SECRET,
        nowMs: SIGNED_AT * 1000,
      }),
    ).rejects.toThrow();
  });

  it("rejects a body changed after signing", async () => {
    await expect(
      verifyStripeWebhook({
        payload: `${payload} `,
        signature: await signed(SECRET, SIGNED_AT),
        secret: SECRET,
        nowMs: SIGNED_AT * 1000,
      }),
    ).rejects.toThrow();
  });

  it("rejects a delivery older than five minutes by the injected clock", async () => {
    expect(WEBHOOK_TOLERANCE_SECONDS).toBe(300);
    await expect(
      verifyStripeWebhook({
        payload,
        signature: await signed(SECRET, SIGNED_AT),
        secret: SECRET,
        nowMs: (SIGNED_AT + WEBHOOK_TOLERANCE_SECONDS + 1) * 1000,
      }),
    ).rejects.toThrow();
  });

  it("accepts a delivery just inside the five minutes", async () => {
    await expect(
      verifyStripeWebhook({
        payload,
        signature: await signed(SECRET, SIGNED_AT),
        secret: SECRET,
        nowMs: (SIGNED_AT + WEBHOOK_TOLERANCE_SECONDS) * 1000,
      }),
    ).resolves.toMatchObject({ id: "evt_1" });
  });

  it("rejects a missing signature", async () => {
    await expect(
      verifyStripeWebhook({ payload, signature: "", secret: SECRET, nowMs: SIGNED_AT * 1000 }),
    ).rejects.toThrow();
  });

  it("never uses the synchronous check, which Workers cannot run", async () => {
    const sync = vi.spyOn(Stripe.webhooks, "constructEvent");
    await verifyStripeWebhook({
      payload,
      signature: await signed(SECRET, SIGNED_AT),
      secret: SECRET,
      nowMs: SIGNED_AT * 1000,
    });
    expect(sync).not.toHaveBeenCalled();
    sync.mockRestore();
  });
});
