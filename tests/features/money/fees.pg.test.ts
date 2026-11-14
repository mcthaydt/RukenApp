import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FeeRow } from "../../../src/features/money/fee-rows.ts";
import { postFeeRows } from "../../../src/features/money/fees.ts";
import { postUnpostedPayments } from "../../../src/features/money/payments.ts";
import { parsePeriod } from "../../../src/features/money/period.ts";
import { closePeriod } from "../../../src/features/money/periods.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { feeRow, fakeMoneyStripe } from "../../support/fake-money-stripe.ts";
import { addMembershipPayment, expectBooksBalanced, movedBy } from "../../support/ledger.ts";
import { TestClock } from "../../support/test-clock.ts";

// Taking Stripe's other fees off the top. Each test pays for an invoice of its own, in a month of its own, and reads how
// the books moved. A row that cannot be placed stays and is counted again by every later run, so the tests that leave
// one (an unreadable row, a fee that names nothing) come last.

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

const stripe = fakeMoneyStripe();
const MONTHLY = { gross: 1081n, tax: 82n, cardFee: 61n, plan: "monthly" } as const;

/** A payment made and posted, on a clock that stands at `now`. */
async function postedPayment(
  invoice: string,
  paidAt: string,
  now: TestClock,
  more: { plan?: "monthly" | "annual"; gross?: bigint; tax?: bigint; cardFee?: bigint } = {},
): Promise<void> {
  await addMembershipPayment(db(), stripe, { ...MONTHLY, ...more, invoice, paidAt });
  await postUnpostedPayments({ db: db(), clock: now, stripe });
}

let runs = 0;

/** A fee report run that was stored at `storedAt`, with these rows (each as Stripe wrote it). */
async function storedRows(rows: Partial<FeeRow>[], storedAt: string): Promise<void> {
  runs += 1;
  const start = 10_000_000 + runs * 10_000;
  const run = await db().stripeFeeRun.create({
    data: {
      intervalStart: new Date(start * 1000),
      intervalEnd: new Date((start + 5_000) * 1000),
      stripeReportRunId: `frr_fees_${String(runs)}`,
      state: "stored",
      rowCount: rows.length,
      requestedAt: new Date(storedAt),
      storedAt: new Date(storedAt),
    },
  });
  await db().stripeFeeRow.createMany({
    data: rows.map((row, index) => ({ ...feeRow(row), runId: run.id, rowNumber: index + 1 })),
  });
}

describe("postFeeRows", () => {
  it("takes a Billing fee and a Tax fee off a payment, rounded up once", async () => {
    const now = new TestClock("2026-11-25T12:00:00Z");
    const deps = { db: db(), clock: now };
    await postedPayment("in_1", "2026-11-02T15:00:00Z", now); // pool 469, Ruken 530 less the card fee
    await storedRows(
      [
        { incurredBy: "in_1", amountText: "0.06993" },
        { incurredBy: "ch_1", amountText: "0.04995" },
      ],
      "2026-11-25T11:00:00Z",
    );
    const moved = await movedBy(db(), async () => {
      expect(await postFeeRows(deps)).toMatchObject({ payment: 2 });
    });
    // 6.993 + 4.995 cents is 11.988, so 12 cents are taken: 7, then 5 more. Six come from each half.
    expect(moved).toEqual({
      "platform:stripe_clearing": -12n,
      "pool:premium:2026-11": 6n,
      "platform:revenue:premium": 6n,
    });
    const again = await movedBy(db(), async () => {
      expect(await postFeeRows(deps)).toMatchObject({ payment: 0 }); // Review Focus 9
    });
    expect(again).toEqual({});
    const fees = await db().journalEntry.count({ where: { stripeInvoiceId: "in_1", kind: "payment_fee" } });
    expect(fees).toBe(2);
  });

  it("does not take the card fee a second time", async () => {
    // Review Focus 2
    const now = new TestClock("2027-01-20T12:00:00Z");
    await postedPayment("in_2", "2027-01-02T15:00:00Z", now);
    // The same fee, seen again in the report: it sits in the payment's own balance transaction.
    await storedRows(
      [{ incurredBy: "ch_2", balanceTransactionId: "txn_2", amountText: "0.61" }],
      "2027-01-20T11:00:00Z",
    );
    const moved = await movedBy(db(), async () => {
      expect(await postFeeRows({ db: db(), clock: now })).toMatchObject({ counted: 1, payment: 0 });
    });
    expect(moved).toEqual({});
    expect(await db().feePosting.count({ where: { kind: "counted" } })).toBe(1);
  });

  it("posts a fee that arrives after the month closed into the open month's pool", async () => {
    // Review Focus 3
    const early = new TestClock("2027-03-03T12:00:00Z");
    await postedPayment("in_3", "2027-03-02T15:00:00Z", early);
    const late = new TestClock("2027-04-09T12:00:00Z");
    await closePeriod({ db: db(), clock: late }, parsePeriod("2027-03"));
    await storedRows(
      [{ incurredBy: "in_3", amountText: "0.12", incurredAt: "2027-03-20 10:00:00" }],
      "2027-04-09T11:00:00Z",
    );
    const moved = await movedBy(db(), async () => {
      expect(await postFeeRows({ db: db(), clock: late })).toMatchObject({ payment: 1 });
    });
    expect(moved).toEqual({
      "platform:stripe_clearing": -12n,
      "pool:premium:2027-04": 6n, // March's pool is left as it was; April's gives up the part
      "platform:revenue:premium": 6n,
    });
    const entry = await db().journalEntry.findFirstOrThrow({
      where: { stripeInvoiceId: "in_3", kind: "payment_fee" },
    });
    expect(entry.period).toBe("2027-04");
  });

  it("takes a yearly payment's fee from the months still set aside", async () => {
    const now = new TestClock("2027-05-20T12:00:00Z");
    const yearly = { plan: "annual", gross: 10_810n, tax: 820n, cardFee: 330n } as const;
    await postedPayment("in_4", "2027-05-02T15:00:00Z", now, yearly);
    await storedRows([{ incurredBy: "in_4", amountText: "1.00" }], "2027-05-20T11:00:00Z");
    const moved = await movedBy(db(), async () => {
      expect(await postFeeRows({ db: db(), clock: now })).toMatchObject({ payment: 1 });
    });
    // 100 cents more of fees: the makers' half goes from 4,830 to 4,780. The first month gives up 4 of its 403, the
    // eleven months set aside give up 46 together, and Ruken's half gives up the other 50.
    expect(moved).toEqual({
      "platform:stripe_clearing": -100n,
      "pool:premium:2027-05": 4n,
      "premium:deferred": 46n,
      "platform:revenue:premium": 50n,
    });
  });

  it("does not take a fee Stripe's credits paid, or a returned fee", async () => {
    // Owner, 2026-11-14: "No, skip them". That neither holds a month up is Task 23's test: a month is made final
    // there, and these two kinds are never among what blocks it.
    const now = new TestClock("2027-07-20T12:00:00Z");
    await postedPayment("in_5", "2027-07-02T15:00:00Z", now);
    await storedRows(
      [
        { incurredBy: "in_5", settledVia: "credit", amountText: "0.30" },
        { incurredBy: "in_5", amountText: "-0.10" },
      ],
      "2027-07-20T11:00:00Z",
    );
    const moved = await movedBy(db(), async () => {
      const counts = await postFeeRows({ db: db(), clock: now });
      expect(counts).toMatchObject({ credit: 1, returned: 1, payment: 0 });
    });
    expect(moved).toEqual({});
    expect(await db().feePosting.count({ where: { kind: { in: ["credit", "returned"] } } })).toBe(2);
  });

  it("ignores a report stored more than 62 days ago", async () => {
    const now = new TestClock("2027-09-20T12:00:00Z");
    await postedPayment("in_6", "2027-09-02T15:00:00Z", now);
    await storedRows([{ incurredBy: "in_6", amountText: "0.12" }], "2027-07-17T12:00:00Z"); // 65 days before
    const moved = await movedBy(db(), async () => {
      expect(await postFeeRows({ db: db(), clock: now })).toMatchObject({ payment: 0 });
    });
    expect(moved).toEqual({});
  });

  it("leaves a row it cannot read unposted, and says so every run", async () => {
    // Review Focus 4
    const now = new TestClock("2027-11-20T12:00:00Z");
    await storedRows([{ incurredBy: "in_1", amountText: "n/a" }], "2027-11-20T11:00:00Z");
    const before = await db().feePosting.count();
    expect(await postFeeRows({ db: db(), clock: now })).toMatchObject({ unreadable: 1 });
    expect(await postFeeRows({ db: db(), clock: now })).toMatchObject({ unreadable: 1 });
    expect(await db().feePosting.count()).toBe(before);
  });

  it("leaves a fee that names nothing unplaced, and places it once its payment is posted", async () => {
    const now = new TestClock("2028-01-20T12:00:00Z");
    await addMembershipPayment(db(), stripe, { ...MONTHLY, invoice: "in_7", paidAt: "2028-01-02T15:00:00Z" });
    await storedRows(
      [{ incurredBy: "in_7", amountText: "0.12", incurredAt: "2028-01-05 10:00:00" }],
      "2028-01-20T11:00:00Z",
    );
    expect(await postFeeRows({ db: db(), clock: now })).toMatchObject({ unplaced: 1, payment: 0 });
    await postUnpostedPayments({ db: db(), clock: now, stripe });
    expect(await postFeeRows({ db: db(), clock: now })).toMatchObject({ payment: 1 });
    expect(await db().feePosting.count({ where: { kind: "payment", stripeInvoiceId: "in_7" } })).toBe(1);
  });

  it("keeps the books balanced", async () => {
    await expectBooksBalanced(db());
  });
});
