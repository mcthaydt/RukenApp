import { Temporal } from "@js-temporal/polyfill";
import { parseCsv } from "../../lib/csv.ts";
import { microCentsOf } from "./major-units.ts";

/**
 * Stripe's Fees report: one row per fee Stripe charged, each naming the payment, refund, dispute, transfer or payout
 * that caused it. The report is asked for through Stripe's Reporting API, and its rows are read here as text and placed
 * by the id they name. Nothing here guesses: a row it cannot read is `unreadable`, and a row that names nothing it
 * knows is `unplaced`; both are kept and shown to staff, never posted.
 */

/** The report asked for: every fee, one row each, by the time its balance transaction was created. */
export const FEE_REPORT_TYPE = "all_fees.balance_transaction_created.itemized.2";

/** The columns asked for, in this order. The report must come back with exactly these. */
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

type FeeColumn = (typeof FEE_COLUMNS)[number];

/** One row of the report, every field as written (the amounts are decimal dollars, the times carry no zone). */
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

/** What the rows are placed against. */
export interface KnownIds {
  /** An invoice, charge or payment-intent id, to the payment's invoice id. */
  readonly payments: ReadonlyMap<string, string>;
  /** A transfer id, a payout id or a maker's Stripe account id, to the maker's account id. */
  readonly payouts: ReadonlyMap<string, string>;
  /** The balance transactions a fee was already read from (a payment's own, a refund's, a dispute's). */
  readonly counted: ReadonlySet<string>;
}

/** Where a fee row goes. */
export type FeePlace =
  | { kind: "unreadable" }
  | { kind: "credit" }
  | { kind: "returned" }
  | { kind: "counted" }
  | { kind: "payment"; stripeInvoiceId: string }
  | { kind: "payout"; makerUserId: string }
  | { kind: "unplaced" };

/**
 * The rows of a report's CSV. The header must be exactly `FEE_COLUMNS`, and every row must have a field for each, or it
 * throws: a report this code does not understand is refused whole rather than guessed at.
 */
export function feeRowsFrom(csv: string): FeeRow[] {
  const [header, ...lines] = parseCsv(csv);
  if (header?.join(",") !== FEE_COLUMNS.join(",")) {
    throw new Error("Stripe's fee report has columns this code does not know");
  }
  return lines.map((fields) => {
    if (fields.length !== FEE_COLUMNS.length) {
      throw new Error(
        `a row of Stripe's fee report has ${String(fields.length)} fields, not ${String(FEE_COLUMNS.length)}`,
      );
    }
    const at = (column: FeeColumn) => fields[FEE_COLUMNS.indexOf(column)] ?? "";
    return {
      balanceTransactionId: at("balance_transaction_id"),
      balanceTransactionAt: at("balance_transaction_created"),
      feeTransactionId: at("fee_transaction_id"),
      incurredBy: at("incurred_by"),
      incurredByType: at("incurred_by_type"),
      incurredAt: at("incurred_at"),
      product: at("product"),
      featureName: at("feature_name"),
      description: at("fee_description"),
      amountText: at("amount"),
      taxText: at("tax"),
      currency: at("currency"),
      settledVia: at("settled_via"),
    };
  });
}

/**
 * What a row cost, in millionths of a cent: `amount` plus `tax` (Stripe's tax on its own fee is part of what Stripe
 * took). Null when either cannot be read or the currency is not US dollars.
 */
export function feeMicroCents(row: FeeRow): bigint | null {
  if (row.currency.toLowerCase() !== "usd") return null;
  const amount = microCentsOf(row.amountText);
  const tax = microCentsOf(row.taxText);
  return amount === null || tax === null ? null : amount + tax;
}

/**
 * One of the report's times. They carry no zone: the report is asked for in `Etc/UTC`, so the text is read as a UTC
 * date and time, never through `Date.parse`, which would read it as the machine's local time and differ between Node
 * and a Worker. Null when it cannot be read.
 */
export function reportTimeMs(text: string): number | null {
  try {
    return Temporal.PlainDateTime.from(text).toZonedDateTime("UTC").epochMilliseconds;
  } catch {
    return null;
  }
}

/**
 * Where a fee row goes, the first of these that applies:
 *
 * 1. `unreadable`: the amount, the tax, the currency or a time cannot be read;
 * 2. `credit`: Stripe's own credits paid it, so it cost Ruken no money and does not come off the top (Owner,
 *    2026-11-14: "No, skip them");
 * 3. `returned`: a fee Stripe gave back, below zero. Kept and shown to staff, never posted, and never a reason to hold
 *    a month up; taking returned fees back into the split is a later spec;
 * 4. `counted`: its balance transaction was already read, so taking it again would take the same fee twice;
 * 5. `payment`: it names a payment, by invoice, charge or payment-intent id;
 * 6. `payout`: it names a transfer, a payout or a maker's Stripe account;
 * 7. `unplaced`: it names nothing known.
 */
export function placeFee(row: FeeRow, known: KnownIds): FeePlace {
  const micro = feeMicroCents(row);
  if (
    micro === null ||
    reportTimeMs(row.incurredAt) === null ||
    reportTimeMs(row.balanceTransactionAt) === null
  ) {
    return { kind: "unreadable" };
  }
  if (row.settledVia === "credit") return { kind: "credit" };
  if (micro < 0n) return { kind: "returned" };
  if (known.counted.has(row.balanceTransactionId)) return { kind: "counted" };
  const stripeInvoiceId = known.payments.get(row.incurredBy);
  if (stripeInvoiceId !== undefined) return { kind: "payment", stripeInvoiceId };
  const makerUserId = known.payouts.get(row.incurredBy);
  if (makerUserId !== undefined) return { kind: "payout", makerUserId };
  return { kind: "unplaced" };
}
