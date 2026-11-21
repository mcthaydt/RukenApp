import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postEntry } from "../../../src/features/money/journal.ts";
import { parsePeriod } from "../../../src/features/money/period.ts";
import { createMoneyServices } from "../../../src/features/money/services.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// Forgot password asks whether an account ever touched money (accounts/changed-hands.ts): a journal line that names
// the person says it did.

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

describe("hasBeenPaid", () => {
  it("is true for a person a journal line names, and false for anyone else", async () => {
    const services = createMoneyServices(
      { STRIPE_SECRET_KEY: "sk_test_fake" },
      { prisma: db(), clock: new TestClock("2027-05-10T12:00:00Z"), stripe: new Stripe("sk_test_fake") },
    );
    const maker = await createUser(db());
    const other = await createUser(db());
    await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES ('2027-05') ON CONFLICT DO NOTHING`;

    expect(await services.hasBeenPaid(maker)).toBe(false);

    await db().$transaction((tx) =>
      postEntry(tx, {
        key: `test:${randomUUID()}`,
        period: parsePeriod("2027-05"),
        kind: "correction",
        lines: [
          { account: "platform:cash", amount: 40n },
          { account: `maker:${maker}:payable`, amount: -40n, makerUserId: maker },
        ],
      }),
    );

    expect(await services.hasBeenPaid(maker)).toBe(true);
    expect(await services.hasBeenPaid(other)).toBe(false);
  });
});
