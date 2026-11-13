import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordPayment } from "../../../src/features/membership/payments.ts";
import type { PaidPremiumInvoice } from "../../../src/features/membership/subscription.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// One MembershipPayment row per paid invoice, in the cents Stripe reported.

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

const PAID_AT = Date.UTC(2026, 10, 2, 12, 0, 0);

function invoice(userId: string, changes: Partial<PaidPremiumInvoice> = {}): PaidPremiumInvoice {
  return {
    stripeInvoiceId: "in_payments_1",
    subscriptionId: "sub_payments_1",
    userId,
    plan: "monthly",
    periodStartMs: PAID_AT,
    paidAtMs: PAID_AT,
    gross: 1081n,
    tax: 82n,
    fee: 61n,
    ...changes,
  };
}

describe("recordPayment", () => {
  it("keeps what Stripe said was paid, in cents", async () => {
    const userId = await createUser(db());
    expect(await recordPayment(db(), invoice(userId))).toBe("recorded");
    expect(
      await db().membershipPayment.findUniqueOrThrow({ where: { stripeInvoiceId: "in_payments_1" } }),
    ).toMatchObject({
      userId,
      stripeSubscriptionId: "sub_payments_1",
      plan: "monthly",
      periodStart: new Date(PAID_AT),
      paidAt: new Date(PAID_AT),
      grossCents: 1081n,
      taxCents: 82n,
      cardFeeCents: 61n,
    });
  });

  it("answers duplicate, and adds nothing, for an invoice already kept", async () => {
    const userId = await createUser(db());
    const paid = invoice(userId, { stripeInvoiceId: "in_payments_2" });
    expect(await recordPayment(db(), paid)).toBe("recorded");
    expect(await recordPayment(db(), paid)).toBe("duplicate");
    expect(await db().membershipPayment.count({ where: { stripeInvoiceId: "in_payments_2" } })).toBe(1);
  });

  it("refuses an invoice with nothing paid, in words", async () => {
    const userId = await createUser(db());
    await expect(
      recordPayment(db(), invoice(userId, { stripeInvoiceId: "in_payments_3", gross: 0n })),
    ).rejects.toThrow("Invoice in_payments_3 has nothing paid, so it is not a membership payment");
  });
});
