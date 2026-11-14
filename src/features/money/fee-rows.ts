// Stripe's Fees report, read into rows (stub: red step).

export const FEE_REPORT_TYPE = "all_fees.balance_transaction_created.itemized.2";

export const FEE_COLUMNS = [
  "balance_transaction_id",
  "balance_transaction_created",
  "fee_transaction_id",
  "incurred_by",
  "incurred_by_type",
  "incurred_at",
  "product",
  "feature_name",
  "fee_description",
  "amount",
  "tax",
  "currency",
  "settled_via",
] as const;

export interface FeeRow {
  readonly balanceTransactionId: string;
  readonly balanceTransactionAt: string;
  readonly feeTransactionId: string;
  readonly incurredBy: string;
  readonly incurredByType: string;
  readonly incurredAt: string;
  readonly product: string;
  readonly featureName: string;
  readonly description: string;
  readonly amountText: string;
  readonly taxText: string;
  readonly currency: string;
  readonly settledVia: string;
}

export interface KnownIds {
  readonly payments: ReadonlyMap<string, string>;
  readonly payouts: ReadonlyMap<string, string>;
  readonly counted: ReadonlySet<string>;
}

export type FeePlace =
  | { kind: "unreadable" }
  | { kind: "credit" }
  | { kind: "returned" }
  | { kind: "counted" }
  | { kind: "payment"; stripeInvoiceId: string }
  | { kind: "payout"; makerUserId: string }
  | { kind: "unplaced" };

export function feeRowsFrom(csv: string): FeeRow[] {
  throw new Error(`not built yet: feeRowsFrom ${String(csv.length)}`);
}

export function feeMicroCents(row: FeeRow): bigint | null {
  throw new Error(`not built yet: feeMicroCents ${row.feeTransactionId}`);
}

export function reportTimeMs(text: string): number | null {
  throw new Error(`not built yet: reportTimeMs ${text}`);
}

export function placeFee(row: FeeRow, known: KnownIds): FeePlace {
  throw new Error(`not built yet: placeFee ${row.feeTransactionId} ${String(known.counted.size)}`);
}
