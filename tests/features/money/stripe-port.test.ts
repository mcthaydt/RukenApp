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

const CHARGED = { id: "ch_1", balance_transaction: { id: "txn_1" } };
const BARE_CHARGE = { id: "ch_2", balance_transaction: { id: "txn_2" } };

function fakeStripe(answers: { invoice?: unknown; intent?: unknown; run?: unknown } = {}) {
  const invoiceAnswer = answers.invoice ?? invoice({ payment_intent: "pi_1" });
  const intentAnswer = answers.intent ?? { id: "pi_1", latest_charge: CHARGED };
  const runAnswer = answers.run ?? { id: "frr_1", status: "pending" };
  const fake = {
    invoices: { retrieve: vi.fn((): Promise<unknown> => Promise.resolve(invoiceAnswer)) },
    paymentIntents: { retrieve: vi.fn((): Promise<unknown> => Promise.resolve(intentAnswer)) },
    charges: { retrieve: vi.fn((): Promise<unknown> => Promise.resolve(BARE_CHARGE)) },
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
  return { fetchFile, port: bindMoneyStripe(stripe, { secretKey: KEY, fetch }) };
}

function idsOf(stripe: Stripe) {
  return bindMoneyStripe(stripe, { secretKey: KEY }).paymentIds("in_1");
}

describe("paymentIds", () => {
  it("reads the three ids from an invoice paid through a payment intent", async () => {
    const { fake, stripe } = fakeStripe();
    await expect(bindMoneyStripe(stripe, { secretKey: KEY }).paymentIds("in_1")).resolves.toEqual({
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
    await expect(bindMoneyStripe(stripe, { secretKey: KEY }).paymentIds("in_1")).resolves.toEqual({
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

  it("refuses a file Stripe will not hand over", async () => {
    const run = { id: "frr_1", status: "succeeded", result: { url: "https://files.example/report.csv" } };
    const { stripe } = fakeStripe({ run });
    const refused = vi.fn((): Promise<Response> => Promise.resolve(new Response("no", { status: 401 })));
    const fetch = refused as unknown as typeof globalThis.fetch;
    const port = bindMoneyStripe(stripe, { secretKey: KEY, fetch });
    await expect(port.feeReport("frr_1")).rejects.toThrow(/401/);
  });
});
