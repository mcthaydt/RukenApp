import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collectFeeReport, requestFeeReport } from "../../../src/features/money/fee-report.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { feeReportCsv, fakeMoneyStripe } from "../../support/fake-money-stripe.ts";
import { addMembershipPayment } from "../../support/ledger.ts";
import { TestClock } from "../../support/test-clock.ts";

// Asking Stripe for its fee report, and keeping every row of it. The tests of one describe walk one database
// through the stretches in order, each starting where the last ended, so each reads the state the one before left.
// Times in seconds are small round numbers: the first payment is at 87,400 s, a day and a little after the start of
// time, so "a day before the first payment" is 1,000 s.

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

const FIRST_PAYMENT_AT = new Date(87_400_000).toISOString();
const PAYMENT = { gross: 1081n, tax: 82n, cardFee: 61n, plan: "monthly" } as const;

/** The run row Stripe was asked for, by the stretch's start in seconds. */
async function runStartingAt(startSec: number) {
  return db().stripeFeeRun.findFirstOrThrow({
    where: { intervalStart: new Date(startSec * 1000) },
    orderBy: { createdAt: "desc" },
  });
}

describe("asking for the fee report, one stretch after another", () => {
  const stripe = fakeMoneyStripe();
  const clock = new TestClock("2026-12-01T12:00:00Z");
  // The database starts in beforeAll, after this body has run, so the dependencies are made when a test asks.
  const deps = () => ({ db: db(), clock, stripe });

  it("asks for nothing while there is no payment, and does not ask Stripe", async () => {
    stripe.setReportWindow({ availableFromSec: 1_000, availableToSec: 5_000 });
    expect(await requestFeeReport(deps())).toBe("nothing_new");
    expect(stripe.reportStarts).toEqual([]);
    expect(await db().stripeFeeRun.count()).toBe(0);
  });

  it("asks from a day before the first payment, the first time", async () => {
    await addMembershipPayment(db(), stripe, { ...PAYMENT, invoice: "in_1", paidAt: FIRST_PAYMENT_AT });
    expect(await requestFeeReport(deps())).toBe("requested");
    expect(stripe.reportStarts).toEqual([{ fromSec: 1_000, toSec: 5_000 }]); // 87,400 − 86,400 = 1,000
    expect(await db().stripeFeeRun.findFirstOrThrow()).toMatchObject({
      intervalStart: new Date(1_000_000),
      intervalEnd: new Date(5_000_000),
      state: "requested",
      requestedAt: new Date(clock.epochMs()),
    });
  });

  it("waits while Stripe is still working, and asks for nothing else meanwhile", async () => {
    // Review Focus 16
    expect(await collectFeeReport(deps())).toBe("pending");
    expect(await requestFeeReport(deps())).toBe("waiting");
    expect(await db().stripeFeeRow.count()).toBe(0);
    expect(stripe.reportStarts).toHaveLength(1);
  });

  it("keeps every row exactly as Stripe wrote it", async () => {
    const first = await runStartingAt(1_000);
    stripe.setReport(
      first.stripeReportRunId,
      feeReportCsv([
        { incurredBy: "in_1", amountText: "0.06993", description: "Billing, monthly" },
        { incurredBy: "ch_1", amountText: "0.04995", taxText: "0.001", settledVia: "invoice" },
      ]),
    );
    expect(await collectFeeReport(deps())).toBe("stored");
    const rows = await db().stripeFeeRow.findMany({
      where: { runId: first.id },
      orderBy: { rowNumber: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      rowNumber: 1,
      incurredBy: "in_1",
      amountText: "0.06993",
      description: "Billing, monthly",
      currency: "usd",
    });
    expect(rows[1]).toMatchObject({
      rowNumber: 2,
      incurredBy: "ch_1",
      taxText: "0.001",
      settledVia: "invoice",
    });
    expect(await runStartingAt(1_000)).toMatchObject({
      state: "stored",
      rowCount: 2,
      storedAt: new Date(clock.epochMs()),
    });
    expect(await collectFeeReport(deps())).toBe("none"); // nothing is waiting any more
  });

  it("starts the next stretch where the last one ended", async () => {
    stripe.setReportWindow({ availableFromSec: 1_000, availableToSec: 9_000 });
    expect(await requestFeeReport(deps())).toBe("requested");
    expect(stripe.reportStarts.at(-1)).toEqual({ fromSec: 5_000, toSec: 9_000 });
    expect(await runStartingAt(5_000)).toMatchObject({
      intervalEnd: new Date(9_000_000),
      state: "requested",
    });
  });

  it("asks again for a stretch whose run failed", async () => {
    // Review Focus 16
    const run = await runStartingAt(5_000);
    stripe.setReport(run.stripeReportRunId, { status: "failed", problem: "no data for this stretch" });
    expect(await collectFeeReport(deps())).toBe("failed");
    expect(await runStartingAt(5_000)).toMatchObject({
      state: "failed",
      problem: "no data for this stretch",
    });
    expect(await db().stripeFeeRow.count({ where: { runId: run.id } })).toBe(0);

    expect(await requestFeeReport(deps())).toBe("requested");
    expect(stripe.reportStarts.at(-1)).toEqual({ fromSec: 5_000, toSec: 9_000 }); // the same start
    const again = await runStartingAt(5_000);
    expect(again.id).not.toBe(run.id);
    expect(again.state).toBe("requested");
  });

  it("asks for nothing when Stripe has nothing new", async () => {
    const run = await runStartingAt(5_000);
    stripe.setReport(run.stripeReportRunId, feeReportCsv([]));
    expect(await collectFeeReport(deps())).toBe("stored");
    expect(await runStartingAt(5_000)).toMatchObject({ state: "stored", rowCount: 0 });
    const asked = stripe.reportStarts.length;
    expect(await requestFeeReport(deps())).toBe("nothing_new"); // Stripe's data still ends at 9,000
    expect(stripe.reportStarts).toHaveLength(asked);
  });

  it("stores nothing when the report's columns are not the ones asked for", async () => {
    stripe.setReportWindow({ availableFromSec: 1_000, availableToSec: 12_000 });
    expect(await requestFeeReport(deps())).toBe("requested");
    const run = await runStartingAt(9_000);
    stripe.setReport(run.stripeReportRunId, { status: "succeeded", csv: "id,amount\nx,1\n" });
    await expect(collectFeeReport(deps())).rejects.toThrow(/columns this code does not know/);
    expect(await runStartingAt(9_000)).toMatchObject({ state: "requested", rowCount: null });
    expect(await db().stripeFeeRow.count({ where: { runId: run.id } })).toBe(0);
  });
});

describe("the first stretch", () => {
  it("never starts before what Stripe still holds", async () => {
    // A new database of its own: the first stretch is asked for once.
    const own = await startTestDatabase();
    try {
      const stripe = fakeMoneyStripe();
      const clock = new TestClock("2026-12-01T12:00:00Z");
      const payment = { ...PAYMENT, invoice: "in_1", paidAt: FIRST_PAYMENT_AT };
      await addMembershipPayment(own.prisma, stripe, payment);
      stripe.setReportWindow({ availableFromSec: 50_000, availableToSec: 90_000 });
      expect(await requestFeeReport({ db: own.prisma, clock, stripe })).toBe("requested");
      expect(stripe.reportStarts).toEqual([{ fromSec: 50_000, toSec: 90_000 }]);
    } finally {
      await own.stop();
    }
  });
});
