import type Stripe from "stripe";
import { FEE_COLUMNS, FEE_REPORT_TYPE } from "./fee-rows.ts";

/**
 * Everything the money feature asks of Stripe, as one port. The jobs take this interface and not a Stripe client, so
 * their Postgres tests can hand them a fake that only answers what the test said Stripe holds (as the membership's
 * `PremiumStripe` does).
 */
export interface MoneyStripe {
  /**
   * The three ids a payment is known by at Stripe: its charge, its payment intent (null when an invoice was paid by a
   * bare charge) and the balance transaction the card fee was read from. Throws `NotAtStripeYet` while the charge or
   * its balance transaction does not exist, so the caller can leave the payment for the next run.
   */
  paymentIds(stripeInvoiceId: string): Promise<PaymentIds>;
  /** The stretch of time Stripe's fee report can be asked for, in Unix seconds. */
  feeReportWindow(): Promise<FeeReportWindow>;
  /** Starts a report run over a stretch of time, and answers the run's id. */
  startFeeReport(fromSec: number, toSec: number): Promise<string>;
  /** How a report run stands and, once it has finished, the text of its file. */
  feeReport(runId: string): Promise<FeeReportAnswer>;
  /** Every refund created at or after `sec` (Unix seconds), every page of Stripe's list. */
  refundsSince(sec: number): Promise<RefundRead[]>;
  /** Every dispute created at or after `sec`, every page. */
  disputesSince(sec: number): Promise<DisputeRead[]>;
  /** One dispute as Stripe shows it now: a dispute can take months to be decided. */
  dispute(disputeId: string): Promise<DisputeRead>;
}

/** A refund, as the money feature needs it. */
export interface RefundRead {
  readonly id: string;
  readonly chargeId: string;
  readonly amountCents: bigint;
  readonly status: string;
  /** Always zero: a refund has no dispute fee. Kept so a refund and a dispute read alike. */
  readonly feeCents: bigint;
  /** The card fee Stripe gave back with the refund, when it did. */
  readonly returnedCents: bigint;
  readonly balanceTransactionIds: readonly string[];
  readonly atSec: number;
}

/**
 * A dispute, as the money feature needs it. `feeCents` is Stripe's dispute fee and `returnedCents` the part of what it
 * took that it gave back at once (a card fee). A won dispute gives the money back in a second balance transaction,
 * which is `reinstatedCents`, null until Stripe has made it. `closedAtSec` is when that happened (null while open).
 */
export interface DisputeRead {
  readonly id: string;
  readonly chargeId: string;
  readonly amountCents: bigint;
  readonly status: string;
  readonly feeCents: bigint;
  readonly returnedCents: bigint;
  readonly reinstatedCents: bigint | null;
  readonly balanceTransactionIds: readonly string[];
  readonly atSec: number;
  readonly closedAtSec: number | null;
}

export interface FeeReportWindow {
  readonly availableFromSec: number;
  readonly availableToSec: number;
}

export type FeeReportAnswer =
  | { readonly status: "pending" }
  | { readonly status: "failed"; readonly problem: string }
  | { readonly status: "succeeded"; readonly csv: string };

/** What reading a report's file needs: Stripe's secret key (the file answers to nothing else) and a way to fetch. */
export interface FileAccess {
  readonly secretKey: string;
  /** The only address (scheme, host and port) the key is sent to. */
  readonly origin: string;
  /** Replaced by a test; the global `fetch` otherwise. */
  readonly fetch?: typeof fetch;
}

export interface PaymentIds {
  readonly chargeId: string;
  readonly paymentIntentId: string | null;
  readonly balanceTransactionId: string;
}

/** What Stripe has not made yet. It is the one failure a daily run waits out; any other one is reported. */
export class NotAtStripeYet extends Error {
  override readonly name = "NotAtStripeYet";
}

/** The port on a real Stripe client. */
export function bindMoneyStripe(stripe: Stripe, files: FileAccess): MoneyStripe {
  return {
    paymentIds: (stripeInvoiceId) => readPaymentIds(stripe, stripeInvoiceId),
    feeReportWindow: async () => {
      const type = await stripe.reporting.reportTypes.retrieve(FEE_REPORT_TYPE);
      return { availableFromSec: type.data_available_start, availableToSec: type.data_available_end };
    },
    startFeeReport: async (fromSec, toSec) => {
      const run = await stripe.reporting.reportRuns.create({
        report_type: FEE_REPORT_TYPE,
        // The zone is sent and not left to Stripe's default, because every time in the report is written in it.
        parameters: {
          interval_start: fromSec,
          interval_end: toSec,
          columns: [...FEE_COLUMNS],
          timezone: "Etc/UTC",
        },
      });
      return run.id;
    },
    feeReport: (runId) => readFeeReport(stripe, files, runId),
    refundsSince: async (sec) => {
      const refunds: RefundRead[] = [];
      for await (const refund of stripe.refunds.list({
        created: { gte: sec },
        expand: ["data.balance_transaction"],
      })) {
        const read = refundRead(refund);
        if (read !== null) refunds.push(read);
      }
      return refunds;
    },
    disputesSince: async (sec) => {
      const disputes: DisputeRead[] = [];
      for await (const dispute of stripe.disputes.list({ created: { gte: sec } })) {
        const read = disputeRead(dispute);
        if (read !== null) disputes.push(read);
      }
      return disputes;
    },
    dispute: async (disputeId) => {
      const read = disputeRead(await stripe.disputes.retrieve(disputeId));
      if (read === null) throw new NotAtStripeYet(`Dispute ${disputeId} has no balance transaction yet`);
      return read;
    },
  };
}

/**
 * The same walk the membership makes to read a card fee (`invoiceCardFee`): the invoice with its payments, its paid
 * payment's payment intent with the charge and the charge's balance transaction, or the charge alone for an invoice
 * paid by a bare charge.
 */
async function readPaymentIds(stripe: Stripe, stripeInvoiceId: string): Promise<PaymentIds> {
  const invoice = await stripe.invoices.retrieve(stripeInvoiceId, { expand: ["payments"] });
  const payment = invoice.payments?.data.find((candidate) => candidate.status === "paid")?.payment;
  const intent = payment?.payment_intent;
  if (intent !== undefined) {
    const paymentIntentId = typeof intent === "string" ? intent : intent.id;
    const read = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = read.latest_charge;
    if (charge === null || typeof charge === "string") {
      throw new NotAtStripeYet(`Payment ${paymentIntentId} has no charge yet`);
    }
    const balance = charge.balance_transaction;
    if (balance === null || typeof balance === "string") {
      throw new NotAtStripeYet(`Payment ${paymentIntentId} has no balance transaction yet`);
    }
    return { chargeId: charge.id, paymentIntentId, balanceTransactionId: balance.id };
  }
  const chargeRef = payment?.charge;
  if (chargeRef === undefined) throw new NotAtStripeYet(`Invoice ${stripeInvoiceId} has no paid payment yet`);
  const charge = await stripe.charges.retrieve(typeof chargeRef === "string" ? chargeRef : chargeRef.id, {
    expand: ["balance_transaction"],
  });
  const balance = charge.balance_transaction;
  if (balance === null || typeof balance === "string") {
    throw new NotAtStripeYet(`Invoice ${stripeInvoiceId} has no balance transaction yet`);
  }
  return { chargeId: charge.id, paymentIntentId: null, balanceTransactionId: balance.id };
}

/**
 * How a report run stands, and its file once it has finished. The file is at an address that answers only to the
 * secret key, so it is fetched with it, and never without it.
 */
async function readFeeReport(stripe: Stripe, files: FileAccess, runId: string): Promise<FeeReportAnswer> {
  const run = await stripe.reporting.reportRuns.retrieve(runId);
  if (run.status === "pending") return { status: "pending" };
  if (run.status === "failed") return { status: "failed", problem: run.error ?? "Stripe gave no reason" };
  const url = run.result?.url;
  if (url === undefined || url === null)
    throw new Error(`Stripe's report run ${runId} finished with no file`);
  const fetchFile = files.fetch ?? fetch;
  const response = await fetchFile(url, { headers: { Authorization: `Bearer ${files.secretKey}` } });
  if (!response.ok) throw new Error(`Stripe's report file answered ${String(response.status)}`);
  return { status: "succeeded", csv: await response.text() };
}

/** The id of something Stripe sends either as its id or expanded. */
function idOf(value: string | { readonly id: string } | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * A refund as the money feature needs it, or null for one with no charge. Its balance transaction (asked for expanded)
 * carries the card fee Stripe gave back, if it did, as a negative fee.
 */
function refundRead(refund: Stripe.Refund): RefundRead | null {
  const chargeId = idOf(refund.charge);
  if (chargeId === null) return null;
  const balance = refund.balance_transaction;
  const balanceId = idOf(balance);
  const transaction = typeof balance === "object" && balance !== null ? balance : null;
  const feeBack = transaction !== null && transaction.fee < 0 ? -transaction.fee : 0;
  return {
    id: refund.id,
    chargeId,
    amountCents: BigInt(refund.amount),
    status: refund.status ?? "unknown",
    feeCents: 0n,
    returnedCents: BigInt(feeBack),
    balanceTransactionIds: balanceId === null ? [] : [balanceId],
    atSec: refund.created,
  };
}

/**
 * A dispute as the money feature needs it, or null while Stripe has not made the withdrawal yet (the next run reads it
 * again). The first balance transaction is the withdrawal: its `fee` is the dispute fee and its `net` is everything
 * Stripe took out (negative), so whatever of the disputed amount and the fee it did not take out is a card fee it gave
 * back. A win gives money back in a second balance transaction, the only one with a positive net; whether the dispute
 * fee comes back with it depends on the account's pricing, so what was given back is read from it.
 */
function disputeRead(dispute: Stripe.Dispute): DisputeRead | null {
  const [withdrawal] = dispute.balance_transactions;
  if (withdrawal === undefined) return null;
  const amount = BigInt(dispute.amount);
  const fee = BigInt(withdrawal.fee);
  const reinstatement = dispute.balance_transactions.find((transaction) => transaction.net > 0);
  const last = dispute.balance_transactions.at(-1);
  const closedAtSec = reinstatement?.created ?? (dispute.status === "lost" ? (last?.created ?? null) : null);
  return {
    id: dispute.id,
    chargeId: idOf(dispute.charge) ?? "",
    amountCents: amount,
    status: dispute.status,
    feeCents: fee,
    returnedCents: amount + fee + BigInt(withdrawal.net),
    reinstatedCents: reinstatement === undefined ? null : BigInt(reinstatement.net),
    balanceTransactionIds: dispute.balance_transactions.map((transaction) => transaction.id),
    atSec: dispute.created,
    closedAtSec,
  };
}
