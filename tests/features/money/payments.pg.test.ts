import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePeriod } from "../../../src/features/money/periods.ts";
import { parsePeriod } from "../../../src/features/money/period.ts";
import { postUnpostedPayments } from "../../../src/features/money/payments.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { fakeMoneyStripe } from "../../support/fake-money-stripe.ts";
import { addMembershipPayment, expectBooksBalanced, movedBy } from "../../support/ledger.ts";
import { TestClock } from "../../support/test-clock.ts";

// Posting what members paid. Each test pays in a month of its own and reads how the books moved (a change, not a
// total), so the tests do not see each other's payments.

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

/** A monthly payment of $10.81, 82 cents of it tax, with a 61-cent card fee. */
/** The posting of one invoice, as stored. */
function postingOf(invoice: string) {
  return db().paymentPosting.findUniqueOrThrow({ where: { stripeInvoiceId: invoice } });
}

const MONTHLY = { gross: 1081n, tax: 82n, cardFee: 61n, plan: "monthly" } as const;

describe("postUnpostedPayments", () => {
  it("posts a payment once, with the lines the rule gives", async () => {
    const clock = new TestClock("2026-11-03T12:00:00Z");
    const deps = { db: db(), clock, stripe };
    await addMembershipPayment(db(), stripe, { ...MONTHLY, invoice: "in_1" });
    const moved = await movedBy(db(), async () => {
      expect(await postUnpostedPayments(deps)).toEqual({ posted: 1 });
    });
    expect(moved).toEqual({
      "platform:stripe_clearing": 1020n,
      "platform:processor_fees": 61n,
      "platform:tax_payable": -82n,
      "pool:premium:2026-11": -469n,
      "platform:revenue:premium": -530n,
    });
    expect(await postUnpostedPayments(deps)).toEqual({ posted: 0 }); // Review Focus 9
    expect(await postingOf("in_1")).toMatchObject({
      firstPeriod: "2026-11",
      stripeChargeId: "ch_1",
      stripePaymentIntentId: "pi_1",
      balanceTransactionId: "txn_1",
      postedAt: new Date("2026-11-03T12:00:00Z"),
    });
    expect(await db().journalEntry.count({ where: { idempotencyKey: "paid:in_1" } })).toBe(1);
  });

  it("puts a yearly payment's first month in its pool and the rest aside", async () => {
    const clock = new TestClock("2027-03-03T12:00:00Z");
    await addMembershipPayment(db(), stripe, {
      invoice: "in_2",
      gross: 10_810n,
      tax: 820n,
      cardFee: 330n,
      plan: "annual",
      paidAt: "2027-03-02T15:00:00Z",
    });
    // 10,810 − 820 − 330 = 9,660 is left; the makers' half, 4,830, is twelve parts of 402 with 6 cents over, which
    // go to the first six months, so the first month's part is 403 and eleven parts (4,427) wait.
    const moved = await movedBy(db(), () => postUnpostedPayments({ db: db(), clock, stripe }));
    expect(moved).toEqual({
      "platform:stripe_clearing": 10_480n,
      "platform:processor_fees": 330n,
      "platform:tax_payable": -820n,
      "pool:premium:2027-03": -403n,
      "premium:deferred": -4_427n,
      "platform:revenue:premium": -5_160n,
    });
  });

  it("posts a payment found after its month closed into the open month", async () => {
    // Review Focus 3. Paid in June, found on 9 July, when June has closed.
    const clock = new TestClock("2027-07-09T12:00:00Z");
    await closePeriod({ db: db(), clock }, parsePeriod("2027-06"));
    await addMembershipPayment(db(), stripe, {
      ...MONTHLY,
      invoice: "in_3",
      paidAt: "2027-06-20T15:00:00Z",
    });
    await postUnpostedPayments({ db: db(), clock, stripe });
    expect(await postingOf("in_3")).toMatchObject({
      firstPeriod: "2027-07",
    });
    const entry = await db().journalEntry.findUniqueOrThrow({ where: { idempotencyKey: "paid:in_3" } });
    expect(entry).toMatchObject({
      period: "2027-07",
      kind: "payment",
      stripeInvoiceId: "in_3",
    });
    const june = await db().journalLine.aggregate({
      where: { account: "pool:premium:2027-06" },
      _sum: { amount: true },
    });
    expect(june._sum.amount).toBeNull();
  });

  it("leaves a payment whose charge is not at Stripe yet for the next run", async () => {
    const clock = new TestClock("2027-09-03T12:00:00Z");
    const deps = { db: db(), clock, stripe };
    await addMembershipPayment(db(), stripe, {
      ...MONTHLY,
      invoice: "in_4",
      paidAt: "2027-09-02T15:00:00Z",
      notAtStripe: true,
    });
    const moved = await movedBy(db(), async () => {
      expect(await postUnpostedPayments(deps)).toEqual({ posted: 0 });
    });
    expect(moved).toEqual({});
    expect(await db().paymentPosting.count({ where: { stripeInvoiceId: "in_4" } })).toBe(0);

    stripe.addPayment("in_4", { chargeId: "ch_4", paymentIntentId: null, balanceTransactionId: "txn_4" });
    expect(await postUnpostedPayments(deps)).toEqual({ posted: 1 });
    expect(await postingOf("in_4")).toMatchObject({
      stripePaymentIntentId: null,
    });
  });

  it("posts the oldest payment first", async () => {
    const clock = new TestClock("2027-11-20T12:00:00Z");
    await addMembershipPayment(db(), stripe, {
      ...MONTHLY,
      invoice: "in_6",
      paidAt: "2027-11-12T15:00:00Z",
    });
    await addMembershipPayment(db(), stripe, {
      ...MONTHLY,
      invoice: "in_5",
      paidAt: "2027-11-05T15:00:00Z",
    });
    expect(await postUnpostedPayments({ db: db(), clock, stripe })).toEqual({ posted: 2 });
    const entries = await db().journalEntry.findMany({
      where: { idempotencyKey: { in: ["paid:in_5", "paid:in_6"] } },
      orderBy: { createdAt: "asc" },
      select: { idempotencyKey: true },
    });
    expect(entries.map((entry) => entry.idempotencyKey)).toEqual(["paid:in_5", "paid:in_6"]);
  });

  it("makes the makers' half nothing, never less, when the fees are more than what is left", async () => {
    // Review Focus 1. 500 paid, 82 tax, 450 fee: nothing is left, so the pool gets nothing and Ruken carries the loss.
    const clock = new TestClock("2028-01-03T12:00:00Z");
    await addMembershipPayment(db(), stripe, {
      invoice: "in_7",
      gross: 500n,
      tax: 82n,
      cardFee: 450n,
      plan: "monthly",
      paidAt: "2028-01-02T15:00:00Z",
    });
    const moved = await movedBy(db(), () => postUnpostedPayments({ db: db(), clock, stripe }));
    expect(moved).toEqual({
      "platform:stripe_clearing": 50n,
      "platform:processor_fees": 450n,
      "platform:tax_payable": -82n,
      "platform:revenue:premium": -418n,
    });
  });

  it("keeps the books balanced", async () => {
    await expectBooksBalanced(db());
  });
});
