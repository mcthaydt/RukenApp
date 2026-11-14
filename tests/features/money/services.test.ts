import Stripe from "stripe";
import { afterAll, describe, expect, it } from "vitest";
import { createMoneyServices, feeReportSkipReason } from "../../../src/features/money/services.ts";
import { createPrismaClient } from "../../../src/lib/server/db.ts";
import { TestClock } from "../../support/test-clock.ts";

// The money services are built from what slice 1 already reads and ask for no setting of their own. Nothing here
// connects: the database address is one that nothing listens on, and Stripe is never called.

const prisma = createPrismaClient("postgresql://postgres:x@127.0.0.1:1/ruken");

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createMoneyServices", () => {
  it("is built from the Stripe client and the settings the membership already has, and adds none", () => {
    const stripe = new Stripe("sk_test_fake");
    const services = createMoneyServices(
      { STRIPE_SECRET_KEY: "sk_test_fake" },
      { prisma, clock: new TestClock("2026-11-14T12:00:00Z"), stripe },
    );
    expect(typeof services.runJob).toBe("function");
  });
});

describe("feeReportSkipReason", () => {
  it("skips Stripe's fee report on a test key with no stand-in, which Stripe's report does not run on", () => {
    expect(feeReportSkipReason({ STRIPE_SECRET_KEY: "sk_test_fake" })).toBe(
      "Stripe's fee report needs a live key",
    );
  });

  it("asks for it on a live key, and on a test key pointed at the stand-in", () => {
    expect(feeReportSkipReason({ STRIPE_SECRET_KEY: "sk_live_fake" })).toBeUndefined();
    expect(
      feeReportSkipReason({ STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_API_BASE: "http://127.0.0.1:12111" }),
    ).toBeUndefined();
  });
});
