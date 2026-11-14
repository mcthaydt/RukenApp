import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// These tests use plain SQL on purpose: they check what the database itself refuses (the CHECK rules,
// the append-only triggers, the unique keys), whatever the application code does.

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

async function newUser(email: string): Promise<string> {
  const user = await db().user.create({ data: { name: "Person", email } });
  return user.id;
}

/** One paid invoice. `grossCents` is the only amount that varies in these tests. */
async function insertPayment(input: {
  userId: string;
  stripeInvoiceId: string;
  grossCents: bigint;
}): Promise<void> {
  await db().$executeRaw`
    INSERT INTO "MembershipPayment"
      ("id", "stripeInvoiceId", "userId", "stripeSubscriptionId", "plan", "periodStart", "paidAt",
       "grossCents", "taxCents", "cardFeeCents")
    VALUES
      (${randomUUID()}, ${input.stripeInvoiceId}, ${input.userId}, 'sub_1', 'monthly', now(), now(),
       ${input.grossCents}, 0, 0)`;
}

/** One membership start; the three arrival columns are given together or not at all. */
async function insertStart(input: {
  userId: string;
  checkoutIntentId: string;
  arrival?: { broughtByUserId: string; arrivalPath: string; arrivedAt: Date };
  halfArrival?: boolean;
}): Promise<void> {
  const maker = input.arrival?.broughtByUserId ?? null;
  const path = input.halfArrival === true ? null : (input.arrival?.arrivalPath ?? null);
  const arrivedAt = input.halfArrival === true ? null : (input.arrival?.arrivedAt ?? null);
  await db().$executeRaw`
    INSERT INTO "MembershipStart"
      ("id", "checkoutIntentId", "userId", "stripeSubscriptionId", "plan", "startedAt",
       "broughtByUserId", "arrivalPath", "arrivedAt")
    VALUES
      (${randomUUID()}, ${input.checkoutIntentId}, ${input.userId}, 'sub_1', 'monthly', now(),
       ${maker}, ${path}, ${arrivedAt})`;
}

describe("the membership tables", () => {
  it("are made by the migrations", async () => {
    const rows = await db().$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    expect(rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        "BillingCustomer",
        "PremiumMembership",
        "CheckoutIntent",
        "WebhookInbox",
        "MembershipPayment",
        "MembershipStart",
      ]),
    );
  });

  describe("a payment row", () => {
    it("cannot be changed or deleted", async () => {
      const userId = await newUser("payer-1@example.test");
      await insertPayment({ userId, stripeInvoiceId: "in_1", grossCents: 999n });
      await expect(db().$executeRaw`UPDATE "MembershipPayment" SET "grossCents" = 1`).rejects.toThrow(
        /MembershipPayment is append-only/,
      );
      await expect(db().$executeRaw`DELETE FROM "MembershipPayment"`).rejects.toThrow(
        /MembershipPayment is append-only/,
      );
    });

    it("cannot be a payment of nothing", async () => {
      const userId = await newUser("payer-2@example.test");
      await expect(insertPayment({ userId, stripeInvoiceId: "in_zero", grossCents: 0n })).rejects.toThrow(
        /MembershipPayment_amounts_check/,
      );
    });

    it("is kept once per Stripe invoice", async () => {
      const userId = await newUser("payer-3@example.test");
      await insertPayment({ userId, stripeInvoiceId: "in_twice", grossCents: 999n });
      await expect(insertPayment({ userId, stripeInvoiceId: "in_twice", grossCents: 999n })).rejects.toThrow(
        /MembershipPayment_stripeInvoiceId_key/,
      );
    });
  });

  describe("a membership start row", () => {
    it("cannot be changed or deleted", async () => {
      const userId = await newUser("member-1@example.test");
      const makerId = await newUser("maker-1@example.test");
      await insertStart({
        userId,
        checkoutIntentId: "c1",
        arrival: {
          broughtByUserId: makerId,
          arrivalPath: "/g/a-game",
          arrivedAt: new Date("2026-11-20T12:00:00Z"),
        },
      });
      await expect(
        db()
          .$executeRaw`UPDATE "MembershipStart" SET "broughtByUserId" = NULL, "arrivalPath" = NULL, "arrivedAt" = NULL`,
      ).rejects.toThrow(/MembershipStart is append-only/);
      await expect(db().$executeRaw`DELETE FROM "MembershipStart"`).rejects.toThrow(
        /MembershipStart is append-only/,
      );
    });

    it("cannot hold half an arrival", async () => {
      const userId = await newUser("member-2@example.test");
      const makerId = await newUser("maker-2@example.test");
      await expect(
        insertStart({
          userId,
          checkoutIntentId: "c-half",
          halfArrival: true,
          arrival: {
            broughtByUserId: makerId,
            arrivalPath: "/g/a-game",
            arrivedAt: new Date("2026-11-20T12:00:00Z"),
          },
        }),
      ).rejects.toThrow(/MembershipStart_arrival_check/);
    });

    it("can hold no arrival at all: a member nobody brought", async () => {
      const userId = await newUser("member-3@example.test");
      await insertStart({ userId, checkoutIntentId: "c-nobody" });
      const rows = await db().$queryRaw<{ broughtByUserId: string | null }[]>`
        SELECT "broughtByUserId" FROM "MembershipStart" WHERE "checkoutIntentId" = 'c-nobody'`;
      expect(rows).toEqual([{ broughtByUserId: null }]);
    });

    it("is kept once per checkout", async () => {
      const userId = await newUser("member-4@example.test");
      await insertStart({ userId, checkoutIntentId: "c-twice" });
      await expect(insertStart({ userId, checkoutIntentId: "c-twice" })).rejects.toThrow(
        /MembershipStart_checkoutIntentId_key/,
      );
    });
  });
});
