import { describe, expect, it } from "vitest";
import {
  FEE_COLUMNS,
  feeMicroCents,
  feeRowsFrom,
  placeFee,
  reportTimeMs,
  type FeeRow,
  type KnownIds,
} from "../../../src/features/money/fee-rows.ts";
import { periodOf } from "../../../src/features/money/period.ts";

const blankRow: FeeRow = {
  balanceTransactionId: "",
  balanceTransactionAt: "2026-12-01 04:30:00",
  feeTransactionId: "",
  incurredBy: "",
  incurredByType: "",
  incurredAt: "2026-12-01 04:30:00",
  product: "",
  featureName: "",
  description: "",
  amountText: "0",
  taxText: "0",
  currency: "usd",
  settledVia: "",
};

const row: FeeRow = {
  ...blankRow,
  balanceTransactionId: "txn_fee",
  incurredBy: "in_1",
  amountText: "0.06993",
  taxText: "0",
  currency: "usd",
};

const known: KnownIds = {
  payments: new Map([
    ["in_1", "in_1"],
    ["ch_1", "in_1"],
    ["pi_1", "in_1"],
  ]),
  payouts: new Map([
    ["tr_1", "maker"],
    ["po_1", "maker"],
    ["acct_1", "maker"],
  ]),
  counted: new Set(["txn_charge"]),
};

describe("feeRowsFrom", () => {
  it("reads the report's rows as text and changes nothing", () => {
    const csv = [
      FEE_COLUMNS.join(","),
      'txn_1,2026-11-20 10:00:00,fee_1,in_1,invoice,2026-11-20 10:00:00,billing,subscriptions,"Billing, monthly",0.06993,0,usd,balance',
      "txn_2,2026-11-21 11:00:00,fee_2,ch_9,charge,2026-11-21 11:00:00,tax,transactions,Tax,0.05,0.001,usd,invoice",
      "",
    ].join("\n");
    expect(feeRowsFrom(csv)).toEqual([
      {
        balanceTransactionId: "txn_1",
        balanceTransactionAt: "2026-11-20 10:00:00",
        feeTransactionId: "fee_1",
        incurredBy: "in_1",
        incurredByType: "invoice",
        incurredAt: "2026-11-20 10:00:00",
        product: "billing",
        featureName: "subscriptions",
        description: "Billing, monthly",
        amountText: "0.06993",
        taxText: "0",
        currency: "usd",
        settledVia: "balance",
      },
      {
        balanceTransactionId: "txn_2",
        balanceTransactionAt: "2026-11-21 11:00:00",
        feeTransactionId: "fee_2",
        incurredBy: "ch_9",
        incurredByType: "charge",
        incurredAt: "2026-11-21 11:00:00",
        product: "tax",
        featureName: "transactions",
        description: "Tax",
        amountText: "0.05",
        taxText: "0.001",
        currency: "usd",
        settledVia: "invoice",
      },
    ]);
  });

  it("refuses a report whose columns are not the ones asked for", () => {
    const renamed: string[] = [...FEE_COLUMNS];
    renamed[9] = "fee_amount";
    expect(() => feeRowsFrom(`${renamed.join(",")}\n`)).toThrow(
      "Stripe's fee report has columns this code does not know",
    );
    expect(() => feeRowsFrom(`${[...FEE_COLUMNS].reverse().join(",")}\n`)).toThrow(
      "Stripe's fee report has columns this code does not know",
    );
  });

  it("refuses a row that does not have a field for every column, rather than guess which is missing", () => {
    expect(() => feeRowsFrom(`${FEE_COLUMNS.join(",")}\ntxn_1,2026-11-20 10:00:00\n`)).toThrow(
      "a row of Stripe's fee report",
    );
  });

  it("gives no rows for a report with a header and nothing else", () => {
    expect(feeRowsFrom(`${FEE_COLUMNS.join(",")}\n`)).toEqual([]);
  });
});

describe("feeMicroCents", () => {
  it("counts Stripe's tax on its own fee as part of the fee", () => {
    expect(feeMicroCents({ ...row, taxText: "0.00007" })).toBe(7_000_000n);
  });

  it("cannot read a fee whose amount or tax is not a number, or that is not in US dollars", () => {
    expect(feeMicroCents({ ...row, amountText: "n/a" })).toBeNull();
    expect(feeMicroCents({ ...row, taxText: "n/a" })).toBeNull();
    expect(feeMicroCents({ ...row, currency: "eur" })).toBeNull();
  });
});

describe("reportTimeMs", () => {
  it("reads the report's times as UTC, whatever the machine's own zone", () => {
    expect(reportTimeMs("2026-12-01 04:30:00")).toBe(Date.parse("2026-12-01T04:30:00Z")); // November in Chicago
    expect(periodOf(reportTimeMs("2026-12-01 04:30:00") ?? 0)).toBe("2026-11");
    expect(reportTimeMs("2026-12-01 06:30:00")).toBe(Date.parse("2026-12-01T06:30:00Z"));
  });

  it("cannot read anything else", () => {
    expect(reportTimeMs("yesterday")).toBeNull();
    expect(reportTimeMs("")).toBeNull();
  });
});

describe("placeFee", () => {
  it("places a fee by the id it names", () => {
    expect(placeFee(row, known)).toEqual({ kind: "payment", stripeInvoiceId: "in_1" });
    expect(placeFee({ ...row, incurredBy: "ch_1" }, known)).toEqual({
      kind: "payment",
      stripeInvoiceId: "in_1",
    });
    expect(placeFee({ ...row, incurredBy: "pi_1" }, known)).toEqual({
      kind: "payment",
      stripeInvoiceId: "in_1",
    });
    expect(placeFee({ ...row, incurredBy: "po_1" }, known)).toEqual({ kind: "payout", makerUserId: "maker" });
    expect(placeFee({ ...row, incurredBy: "tr_1" }, known)).toEqual({ kind: "payout", makerUserId: "maker" });
    expect(placeFee({ ...row, incurredBy: "acct_1" }, known)).toEqual({
      kind: "payout",
      makerUserId: "maker",
    });
    expect(placeFee({ ...row, incurredBy: "" }, known)).toEqual({ kind: "unplaced" });
    expect(placeFee({ ...row, incurredBy: "in_unknown" }, known)).toEqual({ kind: "unplaced" });
  });

  it("does not take a fee twice", () => {
    // Review Focus 2
    expect(placeFee({ ...row, balanceTransactionId: "txn_charge" }, known)).toEqual({ kind: "counted" });
  });

  it("never guesses at a row it cannot read", () => {
    // Review Focus 4
    expect(placeFee({ ...row, amountText: "n/a" }, known)).toEqual({ kind: "unreadable" });
    expect(placeFee({ ...row, currency: "eur" }, known)).toEqual({ kind: "unreadable" });
    expect(placeFee({ ...row, incurredAt: "yesterday" }, known)).toEqual({ kind: "unreadable" });
    expect(placeFee({ ...row, balanceTransactionAt: "yesterday" }, known)).toEqual({ kind: "unreadable" });
  });

  it("skips a fee Stripe's credits paid, and keeps a returned fee out of the split", () => {
    // Review Focus 21
    expect(placeFee({ ...row, settledVia: "credit" }, known)).toEqual({ kind: "credit" });
    expect(placeFee({ ...row, amountText: "-0.06993" }, known)).toEqual({ kind: "returned" });
  });

  it("looks at a row's own readability before anything else about it", () => {
    expect(placeFee({ ...row, amountText: "n/a", settledVia: "credit" }, known)).toEqual({
      kind: "unreadable",
    });
    expect(placeFee({ ...row, settledVia: "credit", balanceTransactionId: "txn_charge" }, known)).toEqual({
      kind: "credit",
    });
  });
});
