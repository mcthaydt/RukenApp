import type Stripe from "stripe";

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
    feeReportWindow: () => Promise.reject(new Error(`not built yet: feeReportWindow ${typeof stripe}`)),
    startFeeReport: (fromSec, toSec) =>
      Promise.reject(new Error(`not built yet: startFeeReport ${String(fromSec)} ${String(toSec)}`)),
    feeReport: (runId) => Promise.reject(new Error(`not built yet: feeReport ${runId} ${typeof files}`)),
    refundsSince: (sec) => Promise.reject(new Error(`not built yet: refundsSince ${String(sec)}`)),
    disputesSince: (sec) => Promise.reject(new Error(`not built yet: disputesSince ${String(sec)}`)),
    dispute: (disputeId) => Promise.reject(new Error(`not built yet: dispute ${disputeId}`)),
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
