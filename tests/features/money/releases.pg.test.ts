import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postFeeRows } from "../../../src/features/money/fees.ts";
import { postingPeriod, postEntry } from "../../../src/features/money/journal.ts";
import { postChargebackOpened, postChargebackWon } from "../../../src/features/money/reversal-posting.ts";
import { releaseDueMonths } from "../../../src/features/money/releases.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { fakeMoneyStripe } from "../../support/fake-money-stripe.ts";
import { expectBooksBalanced, postedPayment, storedFeeRows } from "../../support/ledger.ts";
import { TestClock } from "../../support/test-clock.ts";

// A yearly payment puts its first month's part into that month's pool at once and keeps the other eleven in
// `premium:deferred`; each is released when its month opens. The tests share one database, and each pays in a year of
// its own, because the job looks only at payments from the last 400 days: no test sees another's payment.
//
// The yearly payment used throughout is $108.10 with $8.20 tax and a $3.30 card fee. Its makers' half is 4,830: twelve
// parts of 402 with 6 cents over, which go to the first six months. The first month's part, 403, goes to the pool at
// once, and 4,427 is set aside.

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
const YEARLY = { gross: 10_810n, tax: 820n, cardFee: 330n, plan: "annual" } as const;

/** The first of a month at noon UTC, a time at which the month has opened in Chicago. */
function firstOf(year: number, month: number): string {
  return `${String(year)}-${String(month).padStart(2, "0")}-01T12:00:00Z`;
}

/** Makes a yearly payment on 15 January of `year`, posted that day. */
async function payOnJanuary15(year: number, invoice: string): Promise<void> {
  const paidAt = `${String(year)}-01-15T18:00:00Z`;
  await postedPayment(db(), stripe, new TestClock(paidAt), { ...YEARLY, invoice, paidAt });
}

/** The releases of one invoice, by key. */
async function releasesOf(invoice: string) {
  return db().journalEntry.findMany({
    where: { idempotencyKey: { startsWith: `release:${invoice}:` } },
    include: { lines: true },
    orderBy: { idempotencyKey: "asc" },
  });
}

/** What the invoice's months set aside still hold: its payment, fees, releases and reversals all count. */
async function deferredLeft(invoice: string): Promise<bigint> {
  const { _sum } = await db().journalLine.aggregate({
    where: { account: "premium:deferred", entry: { stripeInvoiceId: invoice } },
    _sum: { amount: true },
  });
  return -(_sum.amount ?? 0n);
}

/** The amount a release entry moved out of `premium:deferred`. */
function movedFromDeferred(entry: { lines: { account: string; amount: bigint }[] }): bigint {
  return entry.lines
    .filter((line) => line.account === "premium:deferred")
    .reduce((sum, l) => sum + l.amount, 0n);
}

describe("releaseDueMonths", () => {
  it("releases nothing in the month a yearly payment is made", async () => {
    await payOnJanuary15(2027, "in_r1");
    const clock = new TestClock("2027-01-20T12:00:00Z");
    expect(await releaseDueMonths({ db: db(), clock })).toEqual({ released: 0 });
    expect(await releasesOf("in_r1")).toEqual([]);
  });

  it("releases February's part when February opens, into February's pool, once", async () => {
    await payOnJanuary15(2029, "in_r2");
    const clock = new TestClock(firstOf(2029, 2));
    expect(await releaseDueMonths({ db: db(), clock })).toEqual({ released: 1 });
    const [february, ...rest] = await releasesOf("in_r2");
    expect(rest).toEqual([]);
    expect(february).toMatchObject({
      kind: "release",
      period: "2029-02",
      idempotencyKey: "release:in_r2:2029-02",
    });
    expect(february?.lines.map((line) => [line.account, line.amount])).toEqual(
      expect.arrayContaining([
        ["premium:deferred", 403n],
        ["pool:premium:2029-02", -403n],
      ]),
    );
    clock.advance(60_000);
    expect(await releaseDueMonths({ db: db(), clock })).toEqual({ released: 0 }); // Review Focus 9
  });

  it("releases everything set aside by the twelfth month, to the cent", async () => {
    await payOnJanuary15(2031, "in_r3");
    for (let month = 2; month <= 12; month += 1) {
      expect(await releaseDueMonths({ db: db(), clock: new TestClock(firstOf(2031, month)) })).toEqual({
        released: 1,
      });
    }
    expect(await releasesOf("in_r3")).toHaveLength(11);
    expect(await deferredLeft("in_r3")).toBe(0n);
  });

  it("posts a month that was missed into the open month, never into a closed one", async () => {
    await payOnJanuary15(2033, "in_r4");
    await db().ledgerPeriod.create({ data: { period: "2033-02" } });
    await db()
      .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed', "closedAt" = now() WHERE "period" = '2033-02'`;
    // The run of February never happened. This is 2 March.
    const clock = new TestClock("2033-03-02T18:00:00Z");
    expect(await releaseDueMonths({ db: db(), clock })).toEqual({ released: 2 });
    const february = (await releasesOf("in_r4")).find((entry) => entry.idempotencyKey.endsWith(":2033-02"));
    expect(february?.period).toBe("2033-03");
    expect(february?.lines.some((line) => line.account === "pool:premium:2033-03")).toBe(true);
    expect(february?.lines.some((line) => line.account === "pool:premium:2033-02")).toBe(false);
    expect(await releaseDueMonths({ db: db(), clock })).toEqual({ released: 0 });
  });

  it("never releases anything for a monthly payment", async () => {
    const paidAt = "2035-01-15T18:00:00Z";
    const monthly = {
      gross: 1081n,
      tax: 82n,
      cardFee: 61n,
      plan: "monthly",
      invoice: "in_r5",
      paidAt,
    } as const;
    await postedPayment(db(), stripe, new TestClock(paidAt), monthly);
    expect(await releaseDueMonths({ db: db(), clock: new TestClock(firstOf(2035, 6)) })).toEqual({
      released: 0,
    });
    expect(await releasesOf("in_r5")).toEqual([]);
  });

  it("takes a fee that came after the payment out of the parts not yet released, and never takes back what was", async () => {
    await payOnJanuary15(2037, "in_r6");
    expect(await releaseDueMonths({ db: db(), clock: new TestClock(firstOf(2037, 2)) })).toEqual({
      released: 1,
    });
    // $1.00 of Billing fees, found in March. February's part was released at 403 and is left as it was: its 4 cents
    // came out of its pool. The eleven months still set aside lose 46 between them, so March releases 399, not 403.
    const march = new TestClock(firstOf(2037, 3));
    await storedFeeRows(
      db(),
      [{ incurredBy: "in_r6", amountText: "1.00", incurredAt: "2037-02-20 10:00:00" }],
      firstOf(2037, 3),
    );
    expect(await postFeeRows({ db: db(), clock: march })).toMatchObject({ payment: 1 });
    expect(await releaseDueMonths({ db: db(), clock: march })).toEqual({ released: 1 });
    const keys = (await releasesOf("in_r6")).map((entry) => [entry.idempotencyKey, movedFromDeferred(entry)]);
    expect(keys).toEqual([
      ["release:in_r6:2037-02", 403n],
      ["release:in_r6:2037-03", 399n],
    ]);
    for (let month = 4; month <= 12; month += 1) {
      await releaseDueMonths({ db: db(), clock: new TestClock(firstOf(2037, month)) });
    }
    expect(await deferredLeft("in_r6")).toBe(0n);
  });

  it("does not release the months a standing chargeback cancelled, and brings them back when it is won", async () => {
    await payOnJanuary15(2039, "in_r7");
    // A dispute over half the payment opens in January: half of the makers' share, 2,415, comes out of what is set
    // aside, from the latest month back: months 12 to 7 (402 each, 2,412) and 3 cents of month 6.
    const january = new TestClock("2039-01-20T12:00:00Z");
    const opened = await db().journalLine.findMany({ where: { entry: { stripeInvoiceId: "in_r7" } } });
    await db().$transaction(async (tx) => {
      const period = await postingPeriod(tx, january.epochMs(), january.epochMs());
      await postEntry(tx, {
        key: "dispute:dp_r7:opened",
        period,
        kind: "chargeback",
        stripeInvoiceId: "in_r7",
        lines: postChargebackOpened({
          paymentLines: opened.map((line) => ({ account: line.account, amount: line.amount })),
          paymentGross: 10_810n,
          amount: 5_405n,
          disputeFee: 1_500n,
          feeReturned: 0n,
          deferredLeft: 4_427n,
          openPool: period,
        }),
      });
    });
    for (let month = 2; month <= 12; month += 1) {
      await releaseDueMonths({ db: db(), clock: new TestClock(firstOf(2039, month)) });
    }
    const standing = await releasesOf("in_r7");
    expect(standing.map((entry) => entry.idempotencyKey)).toEqual([
      "release:in_r7:2039-02",
      "release:in_r7:2039-03",
      "release:in_r7:2039-04",
      "release:in_r7:2039-05",
      "release:in_r7:2039-06",
    ]);
    expect(movedFromDeferred(standing[4] ?? { lines: [] })).toBe(400n); // month 6: 403 less the 3 cancelled
    expect(await deferredLeft("in_r7")).toBe(0n); // the cancelled 2,415 left it with the dispute

    // The dispute is won in January a year on: the opened entry is undone, and the months come back.
    const later = new TestClock("2040-01-05T12:00:00Z");
    const entry = await db().journalEntry.findUniqueOrThrow({
      where: { idempotencyKey: "dispute:dp_r7:opened" },
      include: { lines: true },
    });
    await db().$transaction(async (tx) => {
      const period = await postingPeriod(tx, later.epochMs(), later.epochMs());
      await postEntry(tx, {
        key: "dispute:dp_r7:won",
        period,
        kind: "chargeback",
        stripeInvoiceId: "in_r7",
        reversesId: entry.id,
        lines: postChargebackWon(
          entry.lines.map((line) => ({ account: line.account, amount: line.amount })),
          period,
          5_405n,
        ),
      });
    });
    expect(await releaseDueMonths({ db: db(), clock: later })).toEqual({ released: 7 });
    const keys = (await releasesOf("in_r7")).map((release) => release.idempotencyKey);
    expect(keys).toContain("release:in_r7:2039-06:2"); // month 6's 3 cents, as a top-up
    expect(keys).toContain("release:in_r7:2039-12"); // and the six months that were cancelled
    expect(await deferredLeft("in_r7")).toBe(0n);
  });

  it("carries on past a payment it cannot release, and names that payment", async () => {
    // Review B1. The first payment's second release was already posted with other lines, which needs a person to
    // look. The payment after it must still be released.
    await postedPayment(db(), stripe, new TestClock("2045-01-15T18:00:00Z"), {
      ...YEARLY,
      invoice: "in_r8",
      paidAt: "2045-01-15T18:00:00Z",
    });
    await postedPayment(db(), stripe, new TestClock("2045-01-16T18:00:00Z"), {
      ...YEARLY,
      invoice: "in_r9",
      paidAt: "2045-01-16T18:00:00Z",
    });
    const february = new TestClock(firstOf(2045, 2));
    await db().$transaction(async (tx) => {
      const period = await postingPeriod(tx, february.epochMs(), february.epochMs());
      await postEntry(tx, {
        key: "release:in_r8:2045-02:2",
        period,
        kind: "release",
        stripeInvoiceId: "in_r8",
        lines: [
          { account: "platform:processor_fees", amount: 1n },
          { account: "platform:stripe_clearing", amount: -1n },
        ],
      });
    });

    const result = await releaseDueMonths({ db: db(), clock: february });

    expect(result.released).toBe(1);
    expect(result.failed?.map((failure) => failure.stripeInvoiceId)).toEqual(["in_r8"]);
    expect((await releasesOf("in_r9")).map((entry) => entry.idempotencyKey)).toEqual(["release:in_r9:2045-02"]);
  });

  it("keeps the books balanced", async () => {
    await expectBooksBalanced(db());
  });
});
