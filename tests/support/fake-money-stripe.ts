import { FEE_COLUMNS, type FeeRow } from "../../src/features/money/fee-rows.ts";
import {
  NotAtStripeYet,
  type FeeReportAnswer,
  type FeeReportWindow,
  type MoneyStripe,
  type PaymentIds,
} from "../../src/features/money/stripe-port.ts";

/**
 * A `MoneyStripe` in memory, for database tests. It only ever answers what a test said Stripe holds: a test calls a
 * setter, then the code under test asks. Tasks that add a method to `MoneyStripe` add its setter here.
 */
export class FakeMoneyStripe implements MoneyStripe {
  /** The stretches Stripe was asked to report on, in order. */
  readonly reportStarts: { fromSec: number; toSec: number }[] = [];
  private readonly payments = new Map<string, PaymentIds>();
  private window: FeeReportWindow | undefined;
  private readonly reports = new Map<string, FeeReportAnswer>();

  /** Says Stripe now holds this invoice's charge and balance transaction. */
  addPayment(stripeInvoiceId: string, ids: PaymentIds): void {
    this.payments.set(stripeInvoiceId, ids);
  }

  /** Says what stretch of time Stripe's fee report can be asked for. */
  setReportWindow(window: FeeReportWindow): void {
    this.window = window;
  }

  /** Says how a report run ended. A run no test said anything about is still pending. A CSV text means it succeeded. */
  setReport(runId: string, outcome: FeeReportAnswer | string): void {
    this.reports.set(runId, typeof outcome === "string" ? { status: "succeeded", csv: outcome } : outcome);
  }

  paymentIds(stripeInvoiceId: string): Promise<PaymentIds> {
    const ids = this.payments.get(stripeInvoiceId);
    if (ids === undefined) return Promise.reject(new NotAtStripeYet(`${stripeInvoiceId} has no charge yet`));
    return Promise.resolve(ids);
  }

  feeReportWindow(): Promise<FeeReportWindow> {
    const window = this.window;
    if (window === undefined) return Promise.reject(new Error("the test did not set Stripe's report window"));
    return Promise.resolve(window);
  }

  startFeeReport(fromSec: number, toSec: number): Promise<string> {
    this.reportStarts.push({ fromSec, toSec });
    return Promise.resolve(`frr_${String(this.reportStarts.length)}`);
  }

  feeReport(runId: string): Promise<FeeReportAnswer> {
    return Promise.resolve(this.reports.get(runId) ?? { status: "pending" });
  }
}

/** One quoted CSV field: a comma, a quote or a line break in it makes it need quotes. */
function csvField(text: string): string {
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One row of Stripe's fee report: a $0.05 Billing fee on invoice `in_1`, unless a test says otherwise. */
export function feeRow(overrides: Partial<FeeRow> = {}): FeeRow {
  return {
    balanceTransactionId: "txn_fee",
    balanceTransactionAt: "2026-11-20 10:00:00",
    feeTransactionId: "fee_1",
    incurredBy: "in_1",
    incurredByType: "invoice",
    incurredAt: "2026-11-20 10:00:00",
    product: "billing",
    featureName: "subscriptions",
    description: "Billing",
    amountText: "0.05",
    taxText: "0",
    currency: "usd",
    settledVia: "balance",
    ...overrides,
  };
}

/** A fee report as Stripe writes it: the header the code asked for, then one line for each row given. */
export function feeReportCsv(rows: readonly Partial<FeeRow>[]): string {
  const lines = rows.map((partial) => {
    const row = feeRow(partial);
    return [
      row.balanceTransactionId,
      row.balanceTransactionAt,
      row.feeTransactionId,
      row.incurredBy,
      row.incurredByType,
      row.incurredAt,
      row.product,
      row.featureName,
      row.description,
      row.amountText,
      row.taxText,
      row.currency,
      row.settledVia,
    ]
      .map(csvField)
      .join(",");
  });
  return [FEE_COLUMNS.join(","), ...lines].join("\n") + "\n";
}

export function fakeMoneyStripe(): FakeMoneyStripe {
  return new FakeMoneyStripe();
}
