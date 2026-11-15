import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postFeeRows } from "../../../src/features/money/fees.ts";
import { releaseDueMonths } from "../../../src/features/money/releases.ts";
import { postReversals, readReversals } from "../../../src/features/money/reversals.ts";
import type { DisputeRead, RefundRead } from "../../../src/features/money/stripe-port.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { fakeMoneyStripe } from "../../support/fake-money-stripe.ts";
import { expectBooksBalanced, movedBy, postedPayment, storedFeeRows } from "../../support/ledger.ts";
import { TestClock } from "../../support/test-clock.ts";

// Refunds and chargebacks come from Stripe's own lists, read by the daily job, never from a webhook. Each test pays
// in a year of its own and later tests are in later years, because what is read is measured from the newest
// reversal already stored.

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
const YEARLY = { gross: 10_810n, tax: 820n, cardFee: 330n, plan: "annual" } as const;

/** Unix seconds of a moment written as text. */
function sec(iso: string): number {
  return Date.parse(iso) / 1000;
}

/** Stripe holding a refund of the charge `ch_<name>` (the charge `in_<name>` was paid with). */
function refund(
  name: string,
  at: string,
  amountCents: bigint,
  overrides: Partial<RefundRead> = {},
): RefundRead {
  return {
    id: `re_${name}`,
    chargeId: `ch_${name}`,
    amountCents,
    status: "succeeded",
    feeCents: 0n,
    returnedCents: 0n,
    balanceTransactionIds: [`txn_re_${name}`],
    atSec: sec(at),
    ...overrides,
  };
}

/** Stripe holding an open dispute of the charge `ch_<name>`, taking the amount and a $15.00 fee. */
function dispute(
  name: string,
  at: string,
  amountCents: bigint,
  overrides: Partial<DisputeRead> = {},
): DisputeRead {
  return {
    id: `dp_${name}`,
    chargeId: `ch_${name}`,
    amountCents,
    status: "needs_response",
    feeCents: 1_500n,
    returnedCents: 0n,
    reinstatedCents: null,
    balanceTransactionIds: [`txn_dp_${name}`],
    atSec: sec(at),
    closedAtSec: null,
    ...overrides,
  };
}

async function pay(name: string, at: string, setup: typeof MONTHLY | typeof YEARLY = MONTHLY): Promise<void> {
  await postedPayment(db(), stripe, new TestClock(at), { ...setup, invoice: `in_${name}`, paidAt: at });
}

async function reverse(now: string): Promise<{ stored: number; posted: number }> {
  const clock = new TestClock(now);
  const { stored } = await readReversals({ db: db(), clock, stripe });
  const { posted } = await postReversals({ db: db(), clock });
  return { stored, posted };
}

describe("reversals", () => {
  it("undoes a refunded payment: each side gives back what it got", async () => {
    // $10.81 paid with 82 cents of tax and a 61-cent card fee, then 12 cents of later fees: the makers' half is 463.
    await pay("a1", "2028-01-02T15:00:00Z");
    const fee = { incurredBy: "in_a1", amountText: "0.12", incurredAt: "2028-01-03 10:00:00" };
    await storedFeeRows(db(), [fee], "2028-01-03T11:00:00Z");
    await postFeeRows({ db: db(), clock: new TestClock("2028-01-04T12:00:00Z") });
    stripe.addRefund(refund("a1", "2028-01-10T15:00:00Z", 1081n));
    const moved = await movedBy(db(), async () => {
      expect(await reverse("2028-01-11T12:00:00Z")).toEqual({ stored: 1, posted: 1 });
    });
    // Stripe gives 1,081 back and keeps its 73 in fees (61 + 12), which is shared half and half, the makers' half
    // rounded up: 37 and 36. The pool of the open month gives back the 463 it got and takes its 37 (500), Ruken
    // gives back its 524 and takes its 36 of the fees.
    expect(moved).toEqual({
      "platform:stripe_clearing": -1_081n,
      "platform:processor_fees": -25n,
      "platform:tax_payable": 82n,
      "pool:premium:2028-01": 500n,
      "platform:revenue:premium": 524n,
    });
    expect(await db().journalEntry.count({ where: { idempotencyKey: "refund:re_a1", kind: "refund" } })).toBe(
      1,
    );
  });

  it("cancels a yearly payment's unreleased months first", async () => {
    // Review Focus 5
    await pay("a2", "2030-01-02T15:00:00Z", YEARLY);
    stripe.addRefund(refund("a2", "2030-01-10T15:00:00Z", 10_810n));
    const moved = await movedBy(db(), async () => {
      expect(await reverse("2030-01-11T12:00:00Z")).toEqual({ stored: 1, posted: 1 });
    });
    // The 4,427 set aside is cancelled, and only the first month's 403 comes out of a pool.
    expect(moved).toMatchObject({ "premium:deferred": 4_427n, "pool:premium:2030-01": 568n });
    // Nothing is left to release.
    expect(await releaseDueMonths({ db: db(), clock: new TestClock("2030-06-02T12:00:00Z") })).toEqual({
      released: 0,
    });
  });

  it("stores a refund once however many runs see it", async () => {
    // Review Focus 9
    await pay("a3", "2032-01-02T15:00:00Z");
    stripe.addRefund(refund("a3", "2032-01-10T15:00:00Z", 500n));
    expect(await reverse("2032-01-11T12:00:00Z")).toEqual({ stored: 1, posted: 1 });
    expect(await reverse("2032-01-12T12:00:00Z")).toEqual({ stored: 0, posted: 0 });
    expect(await db().stripeReversal.count({ where: { id: "refund:re_a3" } })).toBe(1);
    expect(await db().journalEntry.count({ where: { idempotencyKey: "refund:re_a3" } })).toBe(1);
  });

  it("posts nothing for a lost dispute beyond its opening", async () => {
    await pay("a4", "2034-01-02T15:00:00Z");
    stripe.addDispute(dispute("a4", "2034-01-10T15:00:00Z", 1081n));
    expect(await reverse("2034-01-11T12:00:00Z")).toEqual({ stored: 1, posted: 1 });
    stripe.changeDispute("dp_a4", { status: "lost", closedAtSec: sec("2034-02-20T15:00:00Z") });
    expect(await reverse("2034-02-21T12:00:00Z")).toEqual({ stored: 1, posted: 0 });
    const kinds = await db().stripeReversal.findMany({
      where: { stripeInvoiceId: "in_a4" },
      orderBy: { at: "asc" },
      select: { id: true, kind: true },
    });
    expect(kinds).toEqual([
      { id: "dispute:dp_a4:opened", kind: "chargeback_opened" },
      { id: "dispute:dp_a4:lost", kind: "chargeback_lost" },
    ]);
    expect(await db().journalEntry.count({ where: { stripeInvoiceId: "in_a4", kind: "chargeback" } })).toBe(
      1,
    );
  });

  it("gives a won dispute's money back, against the entry that opened it", async () => {
    await pay("a5", "2036-01-02T15:00:00Z");
    stripe.addDispute(dispute("a5", "2036-01-10T15:00:00Z", 1081n));
    await reverse("2036-01-11T12:00:00Z");
    // Stripe gives the 1,081 back and keeps the dispute fee.
    stripe.changeDispute("dp_a5", {
      status: "won",
      reinstatedCents: 1081n,
      closedAtSec: sec("2036-02-20T15:00:00Z"),
      balanceTransactionIds: ["txn_dp_a5", "txn_dp_a5_won"],
    });
    expect(await reverse("2036-02-21T12:00:00Z")).toEqual({ stored: 1, posted: 1 });
    const opened = await db().journalEntry.findUniqueOrThrow({
      where: { idempotencyKey: "dispute:dp_a5:opened" },
    });
    const won = await db().journalEntry.findUniqueOrThrow({ where: { idempotencyKey: "dispute:dp_a5:won" } });
    expect(won).toMatchObject({ kind: "chargeback", reversesId: opened.id, period: "2036-02" });
  });

  it("sees a dispute won long after it opened, whatever came since", async () => {
    // Review Focus 23. Opened on 5 March; a newer refund is stored on 13 May; Stripe says won on 14 May, 70 days on.
    // The list since 40 days before the newest reversal starts after the dispute, so only reading it by its id sees it.
    await pay("a6", "2038-03-02T15:00:00Z");
    await pay("a7", "2038-05-02T15:00:00Z");
    stripe.addDispute(dispute("a6", "2038-03-05T15:00:00Z", 1081n));
    expect(await reverse("2038-03-06T12:00:00Z")).toEqual({ stored: 1, posted: 1 });
    stripe.addRefund(refund("a7", "2038-05-13T15:00:00Z", 500n));
    expect(await reverse("2038-05-13T18:00:00Z")).toEqual({ stored: 1, posted: 1 });

    stripe.changeDispute("dp_a6", {
      status: "won",
      reinstatedCents: 1081n,
      closedAtSec: sec("2038-05-14T09:00:00Z"),
      balanceTransactionIds: ["txn_dp_a6", "txn_dp_a6_won"],
    });
    expect(await reverse("2038-05-14T12:00:00Z")).toEqual({ stored: 1, posted: 1 });
    expect(await db().stripeReversal.count({ where: { id: "dispute:dp_a6:won" } })).toBe(1);
  });

  it("waits for a won dispute's money to be at Stripe before it stores the win", async () => {
    await pay("a8", "2040-01-02T15:00:00Z");
    stripe.addDispute(dispute("a8", "2040-01-10T15:00:00Z", 1081n));
    await reverse("2040-01-11T12:00:00Z");
    stripe.changeDispute("dp_a8", { status: "won", reinstatedCents: null });
    expect(await reverse("2040-02-01T12:00:00Z")).toEqual({ stored: 0, posted: 0 });
    stripe.changeDispute("dp_a8", { reinstatedCents: 1081n, closedAtSec: sec("2040-02-01T09:00:00Z") });
    expect(await reverse("2040-02-02T12:00:00Z")).toEqual({ stored: 1, posted: 1 });
  });

  it("skips a refund of a charge that is not a membership payment here", async () => {
    stripe.addRefund(refund("elsewhere", "2042-01-10T15:00:00Z", 500n));
    stripe.addDispute(dispute("elsewhere", "2042-01-10T15:00:00Z", 500n));
    expect(await reverse("2042-01-11T12:00:00Z")).toEqual({ stored: 0, posted: 0 });
    expect(await db().stripeReversal.count({ where: { id: { contains: "elsewhere" } } })).toBe(0);
  });

  it("takes a late fee on a fully refunded yearly payment from the open pool, never from deferred money it no longer has", async () => {
    // Review B1. The refund cancels all 4,427 set aside, and only then does Stripe's Billing fee arrive.
    await pay("b1", "2044-01-02T15:00:00Z", YEARLY);
    stripe.addRefund(refund("b1", "2044-01-10T15:00:00Z", 10_810n));
    await reverse("2044-01-11T12:00:00Z");
    await storedFeeRows(
      db(),
      [{ incurredBy: "in_b1", amountText: "0.70", incurredAt: "2044-01-05 10:00:00" }],
      "2044-01-12T11:00:00Z",
    );
    const moved = await movedBy(db(), async () => {
      expect(await postFeeRows({ db: db(), clock: new TestClock("2044-01-13T12:00:00Z") })).toMatchObject({
        payment: 1,
      });
    });
    // The makers' half goes from 4,830 to 4,795, so 35 of the 70 cents are the makers'. Nothing waits in deferred
    // any more, so all 35 come out of the open month's pool; Ruken's half gives up the other 35.
    expect(moved).toEqual({
      "platform:stripe_clearing": -70n,
      "pool:premium:2044-01": 35n,
      "platform:revenue:premium": 35n,
    });
    const deferred = await db().journalLine.aggregate({
      where: { account: "premium:deferred", entry: { stripeInvoiceId: "in_b1" } },
      _sum: { amount: true },
    });
    expect(deferred._sum.amount).toBe(0n);
  });

  it("releases nothing, and does not fail, for a yearly payment that was refunded before its late fee", async () => {
    // The same payment a month later: the months were all cancelled, and the fee changes the parts, not the sum.
    expect(await releaseDueMonths({ db: db(), clock: new TestClock("2044-03-02T12:00:00Z") })).toEqual({
      released: 0,
    });
  });

  it("keeps the books balanced after each", async () => {
    await expectBooksBalanced(db());
  });
});
