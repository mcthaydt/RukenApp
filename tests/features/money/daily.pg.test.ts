import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMoneyJob, runSteps, type Step } from "../../../src/features/money/daily.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { fakeMoneyStripe } from "../../support/fake-money-stripe.ts";
import { addGame, addSession } from "../../support/play.ts";
import { postEntry, postingPeriod } from "../../../src/features/money/journal.ts";
import { closeDuePeriods } from "../../../src/features/money/periods.ts";
import {
  addMembershipPayment,
  balancesOf,
  expectBooksBalanced,
  storedFeeRows,
} from "../../support/ledger.ts";
import { TestClock } from "../../support/test-clock.ts";

// The daily job runs every step in a fixed order, and what one step does is read by the next. The tests share one
// database and each run of the job is on a clock of its own.

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

const PAYMENT = { gross: 1081n, tax: 82n, cardFee: 61n, plan: "monthly" } as const;

/** The first stored report (made by `storedFeeRows`) covers 10,010,000 to 10,015,000 seconds. */
const FIRST_REPORT_ENDS_SEC = 10_015_000;

/** A Stripe whose fee report holds nothing newer than the first stored report, so none is asked for. */
function quietStripe() {
  const stripe = fakeMoneyStripe();
  stripe.setReportWindow({ availableFromSec: 0, availableToSec: FIRST_REPORT_ENDS_SEC });
  return stripe;
}

describe("runMoneyJob", () => {
  const stripe = quietStripe();

  it("runs the steps in order and reports what each did", async () => {
    await addMembershipPayment(db(), stripe, { ...PAYMENT, invoice: "in_1" });
    await storedFeeRows(db(), [{ incurredBy: "in_1", amountText: "0.12" }], "2026-11-24T00:00:00Z");
    const clock = new TestClock("2026-11-25T12:00:00Z");
    expect(await runMoneyJob({ db: db(), clock, stripe })).toEqual({
      payments: 1,
      feeReport: { collected: "none", requested: "nothing_new" },
      fees: [{ product: "billing", featureName: "subscriptions", kind: "payment", rows: 1 }],
      reversals: 0,
      released: 0,
      playDays: [],
      closed: ["2026-10"],
      final: ["2026-10"], // an empty month, due on 10 November, is made final once it is closed
      problems: [],
    });
  });

  it("does nothing the second time", async () => {
    // Review Focus 9
    await addMembershipPayment(db(), stripe, { ...PAYMENT, invoice: "in_2", paidAt: "2026-11-03T15:00:00Z" });
    const clock = new TestClock("2026-11-25T13:00:00Z");
    const first = await runMoneyJob({ db: db(), clock, stripe });
    expect(first.payments).toBe(1);
    const before = await balancesOf(db());
    clock.advance(60_000);
    const second = await runMoneyJob({ db: db(), clock, stripe });
    expect(second).toMatchObject({
      payments: 0,
      reversals: 0,
      released: 0,
      playDays: [],
      closed: [],
      problems: [],
    });
    expect(await balancesOf(db())).toEqual(before);
  });

  it("carries on after a step that fails, and names it", async () => {
    const down = quietStripe();
    down.refundsSince = () => Promise.reject(new Error("Stripe is down"));
    const game = await addGame(db());
    const member = await addMembershipPayment(db(), down, { ...PAYMENT, invoice: "in_3" });
    await addSession(db(), game, {
      userId: member,
      basis: "member",
      startedAt: "2026-11-20T18:00:00Z",
      beats: 40,
      everySeconds: 15,
    });
    const report = await runMoneyJob({
      db: db(),
      clock: new TestClock("2026-11-26T12:00:00Z"),
      stripe: down,
    });
    expect(report.problems).toEqual([
      { step: "reading refunds and chargebacks from Stripe", message: "Stripe is down" },
    ]);
    // The steps after it still ran: the payment was posted before it, and the play was added up after it.
    expect(report.payments).toBe(1);
    expect(report.playDays).toEqual([
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
    ]);
  });

  it("skips Stripe's fee report on a test key, and says so", async () => {
    const untouched = fakeMoneyStripe(); // no report window: asking it anything would be reported as a problem
    const report = await runMoneyJob({
      db: db(),
      clock: new TestClock("2026-11-27T12:00:00Z"),
      stripe: untouched,
      feeReportSkipped: "Stripe's fee report needs a live key",
    });
    expect(report.feeReport).toEqual({
      collected: "none",
      requested: "nothing_new",
      skipped: "Stripe's fee report needs a live key",
    });
    expect(report.problems).toEqual([]);
    expect(untouched.reportStarts).toEqual([]);
  });

  it("names a yearly payment it cannot release, and still releases the others", async () => {
    // Review B1. The first payment's second release was already posted with other lines, which needs a person to
    // look. The job says so by the payment's name, and the payment after it is released all the same.
    const yearly = { ...PAYMENT, plan: "annual", gross: 10_810n, tax: 820n, cardFee: 330n } as const;
    await addMembershipPayment(db(), stripe, { ...yearly, invoice: "in_y1", paidAt: "2026-11-05T15:00:00Z" });
    await addMembershipPayment(db(), stripe, { ...yearly, invoice: "in_y2", paidAt: "2026-11-06T15:00:00Z" });
    const clock = new TestClock("2026-12-02T12:00:00Z");
    await db().$transaction(async (tx) => {
      const period = await postingPeriod(tx, clock.epochMs(), clock.epochMs());
      await postEntry(tx, {
        key: "release:in_y1:2026-12:2",
        period,
        kind: "release",
        stripeInvoiceId: "in_y1",
        lines: [
          { account: "platform:processor_fees", amount: 1n },
          { account: "platform:stripe_clearing", amount: -1n },
        ],
      });
    });
    const report = await runMoneyJob({ db: db(), clock, stripe });
    expect(report.released).toBe(1);
    expect(report.problems).toEqual([
      { step: "releasing yearly payments' months", message: expect.stringContaining("in_y1") as string },
    ]);
  });

  it("keeps the books balanced", async () => {
    await expectBooksBalanced(db());
  });
});

describe("the steps", () => {
  it("runs on after a step that fails, and names the failure", async () => {
    const ran: string[] = [];
    const step = (name: string, fails = false, blocksTheRest = false): Step => ({
      name,
      blocksTheRest,
      run: () => {
        ran.push(name);
        return fails ? Promise.reject(new Error(`${name} broke`)) : Promise.resolve();
      },
    });
    const problems = await runSteps([step("one"), step("two", true), step("three")]);
    expect(ran).toEqual(["one", "two", "three"]);
    expect(problems).toEqual([{ step: "two", message: "two broke" }]);
  });

  it("closes nothing when closing fails, and runs nothing after it", async () => {
    const ran: string[] = [];
    const step = (name: string, fails = false, blocksTheRest = false): Step => ({
      name,
      blocksTheRest,
      run: () => {
        ran.push(name);
        return fails ? Promise.reject(new Error(`${name} broke`)) : Promise.resolve();
      },
    });
    const problems = await runSteps([step("before"), step("closing the month", true, true), step("after")]);
    expect(ran).toEqual(["before", "closing the month"]);
    expect(problems).toEqual([{ step: "closing the month", message: "closing the month broke" }]);
  });
});

describe("the 8th", () => {
  it("reads the 8th's facts before it closes the month", async () => {
    const own = await startTestDatabase();
    try {
      const stripe = quietStripe();
      await addMembershipPayment(own.prisma, stripe, {
        ...PAYMENT,
        invoice: "in_1",
        paidAt: "2026-11-02T15:00:00Z",
      });
      // A fee stored by the run of 8 December, for a November payment.
      await storedFeeRows(own.prisma, [{ incurredBy: "in_1", amountText: "0.12" }], "2026-12-08T05:00:00Z");
      // 00:30 on 8 December in Chicago: November is due to close, and nothing has closed it yet.
      const clock = new TestClock("2026-12-08T06:30:00Z");
      const report = await runMoneyJob({ db: own.prisma, clock, stripe });
      expect(report.closed).toEqual(["2026-11"]);
      const balances = await balancesOf(own.prisma);
      // The payment put 469 into November's pool and the fee took 6 back out of it, before November closed.
      expect(balances["pool:premium:2026-11"]).toBe(-463n);
      const november = await own.prisma.ledgerPeriod.findUniqueOrThrow({ where: { period: "2026-11" } });
      expect(november.state).toBe("closed");
    } finally {
      await own.stop();
    }
  });
});

describe("the 10th", () => {
  it("makes the month final after it closes it, in the same run when both are due", async () => {
    const own = await startTestDatabase();
    try {
      const stripe = quietStripe();
      await addMembershipPayment(own.prisma, stripe, {
        ...PAYMENT,
        invoice: "in_t1",
        paidAt: "2026-11-02T15:00:00Z",
      });
      const report = await runMoneyJob({
        db: own.prisma,
        clock: new TestClock("2026-12-10T06:30:00Z"),
        stripe,
      });
      expect(report.closed).toEqual(["2026-11"]);
      expect(report.final).toEqual(["2026-11"]);
      expect(report.problems).toEqual([]);
      expect((await own.prisma.ledgerPeriod.findUniqueOrThrow({ where: { period: "2026-11" } })).state).toBe(
        "final",
      );
    } finally {
      await own.stop();
    }
  });

  it("reports a fee it cannot read under the step's own words, and leaves the month closed", async () => {
    const own = await startTestDatabase();
    try {
      const stripe = quietStripe();
      await addMembershipPayment(own.prisma, stripe, {
        ...PAYMENT,
        invoice: "in_t2",
        paidAt: "2026-11-02T15:00:00Z",
      });
      await storedFeeRows(
        own.prisma,
        [{ amountText: "n/a", balanceTransactionAt: "2026-11-20 10:00:00" }],
        "2026-12-05T00:00:00Z",
      );
      const report = await runMoneyJob({
        db: own.prisma,
        clock: new TestClock("2026-12-10T06:30:00Z"),
        stripe,
      });
      expect(report.final).toEqual([]);
      expect(report.problems).toEqual([
        {
          step: "making the month final",
          message: expect.stringContaining("Stripe sent a fee this code cannot read") as string,
        },
      ]);
      expect((await own.prisma.ledgerPeriod.findUniqueOrThrow({ where: { period: "2026-11" } })).state).toBe(
        "closed",
      );
      // Closing is not undone by it, and the facts are all in.
      expect(await closeDuePeriods({ db: own.prisma, clock: new TestClock("2026-12-10T07:00:00Z") })).toEqual(
        [],
      );
    } finally {
      await own.stop();
    }
  });
});
