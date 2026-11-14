import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { FEE_COLUMNS, FEE_REPORT_TYPE } from "../../../src/features/money/fee-rows.ts";
import { bindMoneyStripe, NotAtStripeYet } from "../../../src/features/money/stripe-port.ts";

// What money reads from Stripe, from answers in the shapes of the current API (SDK 22). Each test hands the port a
// Stripe that answers as Stripe would, so these test what Ruken reads out of the answers.

/** An invoice whose paid payment is the one given (`payment_intent` or `charge`). */
function invoice(payment: Record<string, unknown>) {
  return { id: "in_1", payments: { data: [{ status: "paid", payment }] } };
}

const KEY = "sk_test_fake";

/** Where Stripe's report files are, for these tests: the only address the key may be sent to. */
const FILES = { secretKey: KEY, origin: "https://files.example" } as const;

const CHARGED = { id: "ch_1", balance_transaction: { id: "txn_1" } };
const BARE_CHARGE = { id: "ch_2", balance_transaction: { id: "txn_2" } };

interface Answers {
  invoice?: unknown;
  intent?: unknown;
  run?: unknown;
  refunds?: unknown[];
  disputes?: unknown[];
}

function fakeStripe(answers: Answers = {}) {
  const invoiceAnswer = answers.invoice ?? invoice({ payment_intent: "pi_1" });
  const intentAnswer = answers.intent ?? { id: "pi_1", latest_charge: CHARGED };
  const runAnswer = answers.run ?? { id: "frr_1", status: "pending" };
  const fake = {
    invoices: { retrieve: vi.fn((): Promise<unknown> => Promise.resolve(invoiceAnswer)) },
    paymentIntents: { retrieve: vi.fn((): Promise<unknown> => Promise.resolve(intentAnswer)) },
    charges: { retrieve: vi.fn((): Promise<unknown> => Promise.resolve(BARE_CHARGE)) },
    refunds: { list: listOf(...(answers.refunds ?? [])) },
    disputes: {
      list: listOf(...(answers.disputes ?? [])),
      retrieve: vi.fn((): Promise<unknown> => Promise.resolve(answers.disputes?.[0])),
    },
    reporting: {
      reportTypes: {
        retrieve: vi.fn((): Promise<unknown> =>
          Promise.resolve({ data_available_start: 1_000, data_available_end: 5_000 }),
        ),
      },
      reportRuns: {
        create: vi.fn((): Promise<unknown> => Promise.resolve({ id: "frr_1" })),
        retrieve: vi.fn((): Promise<unknown> => Promise.resolve(runAnswer)),
      },
    },
  };
  return { fake, stripe: fake as unknown as Stripe };
}

/** The port, reading report files through a `fetch` that answers `body`. */
function portWithFile(stripe: Stripe, body = "a,b\n") {
  const fetchFile = vi.fn((): Promise<Response> => Promise.resolve(new Response(body)));
  const fetch = fetchFile as unknown as typeof globalThis.fetch;
  return { fetchFile, port: bindMoneyStripe(stripe, { ...FILES, fetch }) };
}

function idsOf(stripe: Stripe) {
  return bindMoneyStripe(stripe, FILES).paymentIds("in_1");
}

describe("paymentIds", () => {
  it("reads the three ids from an invoice paid through a payment intent", async () => {
    const { fake, stripe } = fakeStripe();
    await expect(bindMoneyStripe(stripe, FILES).paymentIds("in_1")).resolves.toEqual({
      chargeId: "ch_1",
      paymentIntentId: "pi_1",
      balanceTransactionId: "txn_1",
    });
    expect(fake.invoices.retrieve).toHaveBeenCalledWith("in_1", { expand: ["payments"] });
    expect(fake.paymentIntents.retrieve).toHaveBeenCalledWith("pi_1", {
      expand: ["latest_charge.balance_transaction"],
    });
  });

  it("reads them from an invoice paid by a bare charge, with no payment intent", async () => {
    const { fake, stripe } = fakeStripe({ invoice: invoice({ charge: "ch_2" }) });
    await expect(bindMoneyStripe(stripe, FILES).paymentIds("in_1")).resolves.toEqual({
      chargeId: "ch_2",
      paymentIntentId: null,
      balanceTransactionId: "txn_2",
    });
    expect(fake.charges.retrieve).toHaveBeenCalledWith("ch_2", { expand: ["balance_transaction"] });
    expect(fake.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it("is not at Stripe yet while the charge has no balance transaction", async () => {
    const intent = { id: "pi_1", latest_charge: { id: "ch_1", balance_transaction: null } };
    const { stripe } = fakeStripe({ intent });
    await expect(idsOf(stripe)).rejects.toBeInstanceOf(NotAtStripeYet);
  });

  it("is not at Stripe yet while the payment intent has no charge", async () => {
    const { stripe } = fakeStripe({ intent: { id: "pi_1", latest_charge: null } });
    await expect(idsOf(stripe)).rejects.toBeInstanceOf(NotAtStripeYet);
  });

  it("is not at Stripe yet while the invoice has no paid payment", async () => {
    const { stripe } = fakeStripe({ invoice: { id: "in_1", payments: { data: [] } } });
    await expect(idsOf(stripe)).rejects.toBeInstanceOf(NotAtStripeYet);
  });
});

describe("the fee report", () => {
  it("says what stretch of time Stripe's report can be asked for", async () => {
    const { fake, stripe } = fakeStripe();
    await expect(portWithFile(stripe).port.feeReportWindow()).resolves.toEqual({
      availableFromSec: 1_000,
      availableToSec: 5_000,
    });
    expect(fake.reporting.reportTypes.retrieve).toHaveBeenCalledWith(FEE_REPORT_TYPE);
  });

  it("starts a run for the stretch, the columns and the zone it will read the times in", async () => {
    const { fake, stripe } = fakeStripe();
    await expect(portWithFile(stripe).port.startFeeReport(1_000, 5_000)).resolves.toBe("frr_1");
    expect(fake.reporting.reportRuns.create).toHaveBeenCalledWith({
      report_type: FEE_REPORT_TYPE,
      parameters: {
        interval_start: 1_000,
        interval_end: 5_000,
        columns: [...FEE_COLUMNS],
        timezone: "Etc/UTC",
      },
    });
  });

  it("is pending while Stripe works, and never fetches a file then", async () => {
    const { stripe } = fakeStripe();
    const { port, fetchFile } = portWithFile(stripe);
    await expect(port.feeReport("frr_1")).resolves.toEqual({ status: "pending" });
    expect(fetchFile).not.toHaveBeenCalled();
  });

  it("has failed with Stripe's words, or with a plain line when Stripe gave none", async () => {
    const failed = { id: "frr_1", status: "failed", error: "no data" };
    await expect(portWithFile(fakeStripe({ run: failed }).stripe).port.feeReport("frr_1")).resolves.toEqual({
      status: "failed",
      problem: "no data",
    });
    const silent = { id: "frr_1", status: "failed", error: null };
    const answer = await portWithFile(fakeStripe({ run: silent }).stripe).port.feeReport("frr_1");
    expect(answer).toMatchObject({ status: "failed" });
  });

  it("reads the file of a finished run with the key, and never without it", async () => {
    const run = { id: "frr_1", status: "succeeded", result: { url: "https://files.example/report.csv" } };
    const { stripe } = fakeStripe({ run });
    const { port, fetchFile } = portWithFile(stripe, "a,b\n1,2\n");
    await expect(port.feeReport("frr_1")).resolves.toEqual({ status: "succeeded", csv: "a,b\n1,2\n" });
    expect(fetchFile).toHaveBeenCalledWith("https://files.example/report.csv", {
      headers: { Authorization: `Bearer ${KEY}` },
    });
  });

  it.each([
    ["another host", "https://files.other.example/report.csv"],
    ["a host that only starts like Stripe's", "https://files.example.evil.test/report.csv"],
    ["a plain http address", "http://files.example/report.csv"],
    ["an address with a login in it", "https://files.example@evil.test/report.csv"],
    ["something that is not an address", "report.csv"],
  ])("never sends the key to %s", async (_name, url) => {
    const run = { id: "frr_1", status: "succeeded", result: { url } };
    const { stripe } = fakeStripe({ run });
    const { port, fetchFile } = portWithFile(stripe);
    await expect(port.feeReport("frr_1")).rejects.toThrow(/did not send the key/);
    expect(fetchFile).not.toHaveBeenCalled();
  });

  it("refuses a file Stripe will not hand over", async () => {
    const run = { id: "frr_1", status: "succeeded", result: { url: "https://files.example/report.csv" } };
    const { stripe } = fakeStripe({ run });
    const refused = vi.fn((): Promise<Response> => Promise.resolve(new Response("no", { status: 401 })));
    const fetch = refused as unknown as typeof globalThis.fetch;
    const port = bindMoneyStripe(stripe, { ...FILES, fetch });
    await expect(port.feeReport("frr_1")).rejects.toThrow(/401/);
  });
});

/** A list the way Stripe's SDK answers one: it can be read page by page, with `for await`. */
function listOf(...items: unknown[]) {
  return vi.fn(() => ({
    [Symbol.asyncIterator]: () => {
      let next = 0;
      return {
        next: () => {
          const done = next >= items.length;
          const value: unknown = items[next];
          next += 1;
          return Promise.resolve({ value, done });
        },
      };
    },
  }));
}

/** A balance transaction as a dispute or a refund carries it. */
function balance(id: string, fee: number, net: number, created = 1_000) {
  return { id, fee, net, created };
}

describe("refunds and disputes", () => {
  it("reads a refund's amount, its charge, and the card fee Stripe gave back with it", async () => {
    const refund = {
      id: "re_1",
      charge: "ch_1",
      amount: 500,
      status: "succeeded",
      created: 1_000,
      balance_transaction: balance("txn_r1", -12, -488),
    };
    const { fake, stripe } = fakeStripe({ refunds: [refund] });
    await expect(portWithFile(stripe).port.refundsSince(900)).resolves.toEqual([
      {
        id: "re_1",
        chargeId: "ch_1",
        amountCents: 500n,
        status: "succeeded",
        feeCents: 0n,
        returnedCents: 12n,
        balanceTransactionIds: ["txn_r1"],
        atSec: 1_000,
      },
    ]);
    expect(fake.refunds.list).toHaveBeenCalledWith({
      created: { gte: 900 },
      expand: ["data.balance_transaction"],
    });
  });

  it("reads an open dispute: its fee, and what of what Stripe took it gave back at once", async () => {
    const dispute = {
      id: "dp_1",
      charge: "ch_1",
      amount: 1081,
      status: "needs_response",
      created: 2_000,
      balance_transactions: [balance("txn_d1", 1500, -2581, 2_000)],
    };
    const { fake, stripe } = fakeStripe({ disputes: [dispute] });
    const expected = {
      id: "dp_1",
      chargeId: "ch_1",
      amountCents: 1081n,
      status: "needs_response",
      feeCents: 1500n,
      returnedCents: 0n, // 1,081 + 1,500 is 2,581, and all 2,581 was taken
      reinstatedCents: null,
      balanceTransactionIds: ["txn_d1"],
      atSec: 2_000,
      closedAtSec: null,
    };
    const { port } = portWithFile(stripe);
    await expect(port.disputesSince(1_500)).resolves.toEqual([expected]);
    expect(fake.disputes.list).toHaveBeenCalledWith({ created: { gte: 1_500 } });
    await expect(port.dispute("dp_1")).resolves.toEqual(expected);
    expect(fake.disputes.retrieve).toHaveBeenCalledWith("dp_1");
  });

  it("reads what a won dispute gave back, from the one balance transaction that adds money", async () => {
    const dispute = {
      id: "dp_1",
      charge: "ch_1",
      amount: 1081,
      status: "won",
      created: 2_000,
      balance_transactions: [balance("txn_d1", 1500, -2581, 2_000), balance("txn_d2", 0, 1081, 3_000)],
    };
    const { stripe } = fakeStripe({ disputes: [dispute] });
    const [read] = await portWithFile(stripe).port.disputesSince(0);
    expect(read).toMatchObject({
      status: "won",
      reinstatedCents: 1081n,
      closedAtSec: 3_000,
      balanceTransactionIds: ["txn_d1", "txn_d2"],
    });
  });

  it("leaves out a dispute whose withdrawal Stripe has not made yet, to be read again next run", async () => {
    const dispute = { id: "dp_1", charge: "ch_1", amount: 1081, status: "needs_response", created: 2_000 };
    const { stripe } = fakeStripe({ disputes: [{ ...dispute, balance_transactions: [] }] });
    await expect(portWithFile(stripe).port.disputesSince(0)).resolves.toEqual([]);
  });
});
