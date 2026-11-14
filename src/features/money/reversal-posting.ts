// What a refund or a chargeback undoes (stub: red step).
import type { Period } from "./period.ts";
import type { PostingLine } from "./posting.ts";
import type { Release } from "./payment-posting.ts";

export interface Chargeback {
  readonly paymentLines: readonly PostingLine[];
  readonly paymentGross: bigint;
  readonly amount: bigint;
  readonly disputeFee: bigint;
  readonly feeReturned: bigint;
  readonly deferredLeft: bigint;
  readonly openPool: Period;
}

export type RefundInput = Omit<Chargeback, "disputeFee">;

export function postChargebackOpened(chargeback: Chargeback): PostingLine[] {
  throw new Error(`not built yet: postChargebackOpened ${String(chargeback.amount)}`);
}

export function postChargebackWon(
  opened: readonly PostingLine[],
  openPool: Period,
  reinstated: bigint,
): PostingLine[] {
  throw new Error(
    `not built yet: postChargebackWon ${String(opened.length)} ${openPool} ${String(reinstated)}`,
  );
}

export function postRefund(input: RefundInput): PostingLine[] {
  throw new Error(`not built yet: postRefund ${String(input.amount)}`);
}

export function cancelledMonths(releases: readonly Release[], cancelled: bigint): Map<Period, bigint> {
  throw new Error(`not built yet: cancelledMonths ${String(releases.length)} ${String(cancelled)}`);
}

export function reverseOpenedEntry(
  opened: readonly PostingLine[],
  reinstated: bigint,
): { reversal: PostingLine[]; notReturned: bigint } {
  throw new Error(`not built yet: reverseOpenedEntry ${String(opened.length)} ${String(reinstated)}`);
}

export function reversePaymentLines(
  paymentLines: readonly PostingLine[],
  amount: bigint,
  paymentGross: bigint,
): PostingLine[] {
  throw new Error(
    `not built yet: reversePaymentLines ${String(paymentLines.length)} ${String(amount)} ${String(paymentGross)}`,
  );
}
