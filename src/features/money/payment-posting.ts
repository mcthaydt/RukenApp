// The entries a payment makes (stub: red step).
import type { Period } from "./period.ts";
import type { Payment } from "./pool-share.ts";
import type { PostingLine } from "./posting.ts";

export interface Release {
  readonly period: Period;
  readonly amount: bigint;
}

export interface FeeParts {
  readonly months: readonly Release[];
  readonly ruken: bigint;
}

export function postPaymentPaid(payment: Payment): PostingLine[] {
  throw new Error(`not built yet: postPaymentPaid ${payment.plan}`);
}

export function releases(payment: Payment): Release[] {
  throw new Error(`not built yet: releases ${payment.plan}`);
}

export function postRelease(release: Release): PostingLine[] {
  throw new Error(`not built yet: postRelease ${release.period}`);
}

export function releaseKey(stripeInvoiceId: string, period: Period): string {
  throw new Error(`not built yet: releaseKey ${stripeInvoiceId} ${period}`);
}

export function feeParts(payment: Payment, fee: bigint): FeeParts {
  throw new Error(`not built yet: feeParts ${payment.plan} ${String(fee)}`);
}

export function postPaymentFee(parts: FeeParts, accountFor: (period: Period) => string): PostingLine[] {
  throw new Error(`not built yet: postPaymentFee ${String(parts.ruken)} ${typeof accountFor}`);
}
