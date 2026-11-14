import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { StripeEvent } from "../../../src/features/membership/events.ts";
import { processStripeDelivery, storeStripeDelivery } from "../../../src/features/membership/inbox.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// Every verified Stripe delivery is stored in WebhookInbox before anything else, once per event id,
// and marked processed when its handler succeeds. A failure is written on the row and thrown, so
// Stripe sends the event again; an event from the other Stripe mode is never processed.

let database: TestDatabase | undefined;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.stop();
});

const NOW = "2026-11-02T12:00:00Z";
let events = 0;

function stripeEvent(overrides: Partial<StripeEvent> = {}): StripeEvent {
  events += 1;
  return {
    id: `evt_inbox_${String(events)}`,
    type: "invoice.paid",
    created: 1_793_620_800,
    livemode: false,
    data: { object: { id: "in_1" } },
    ...overrides,
  };
}

function deps(handle = vi.fn<(event: StripeEvent) => Promise<void>>(() => Promise.resolve()), live = false) {
  return { db: db(), clock: new TestClock(NOW), live, handle };
}

describe("storeStripeDelivery", () => {
  it("stores the event once under its id, and answers the same row for a repeat", async () => {
    const event = stripeEvent();
    const first = await storeStripeDelivery(db(), event, Date.parse(NOW));
    const again = await storeStripeDelivery(db(), event, Date.parse(NOW) + 60_000);
    expect(again).toBe(first);
    const rows = await db().webhookInbox.findMany({ where: { deliveryId: event.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ receivedAt: new Date(NOW), processedAt: null, error: null });
    expect(rows[0]?.payload).toEqual(event);
  });
});

describe("processStripeDelivery", () => {
  it("handles the event and marks the row processed", async () => {
    const event = stripeEvent();
    const inboxId = await storeStripeDelivery(db(), event, Date.parse(NOW));
    const d = deps();
    await expect(processStripeDelivery(d, inboxId)).resolves.toBe("processed");
    expect(d.handle).toHaveBeenCalledWith(event);
    expect(await db().webhookInbox.findUniqueOrThrow({ where: { id: inboxId } })).toMatchObject({
      processedAt: new Date(NOW),
      error: null,
    });
  });

  it("calls the handler once when the same event is stored and processed twice", async () => {
    const event = stripeEvent();
    const first = await storeStripeDelivery(db(), event, Date.parse(NOW));
    const again = await storeStripeDelivery(db(), event, Date.parse(NOW));
    const d = deps();
    await expect(processStripeDelivery(d, first)).resolves.toBe("processed");
    await expect(processStripeDelivery(d, again)).resolves.toBe("already_processed");
    expect(d.handle).toHaveBeenCalledTimes(1);
  });

  it("writes the failure on the row and throws, then clears it when a later try succeeds", async () => {
    const inboxId = await storeStripeDelivery(db(), stripeEvent(), Date.parse(NOW));
    const failing = deps(
      vi.fn(() => Promise.reject(new Error("Invoice in_1 has no balance transaction yet"))),
    );
    await expect(processStripeDelivery(failing, inboxId)).rejects.toThrow(/balance transaction/);
    expect(await db().webhookInbox.findUniqueOrThrow({ where: { id: inboxId } })).toMatchObject({
      processedAt: null,
      error: "Invoice in_1 has no balance transaction yet",
    });

    await processStripeDelivery(deps(), inboxId);
    expect(await db().webhookInbox.findUniqueOrThrow({ where: { id: inboxId } })).toMatchObject({
      processedAt: new Date(NOW),
      error: null,
    });
  });

  it("never processes an event from the other Stripe mode (the livemode guard)", async () => {
    const liveEvent = await storeStripeDelivery(db(), stripeEvent({ livemode: true }), Date.parse(NOW));
    const testEvent = await storeStripeDelivery(db(), stripeEvent({ livemode: false }), Date.parse(NOW));

    const testSite = deps();
    await expect(processStripeDelivery(testSite, liveEvent)).resolves.toBe("livemode_mismatch");
    const liveSite = deps(undefined, true);
    await expect(processStripeDelivery(liveSite, testEvent)).resolves.toBe("livemode_mismatch");

    expect(testSite.handle).not.toHaveBeenCalled();
    expect(liveSite.handle).not.toHaveBeenCalled();
    expect(await db().webhookInbox.findUniqueOrThrow({ where: { id: liveEvent } })).toMatchObject({
      processedAt: null,
      error: "livemode_mismatch",
    });
  });
});
