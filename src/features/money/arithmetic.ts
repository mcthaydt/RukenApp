// The two rounding primitives every money rule is built from (stub: red step).

export const FULL_SHARE_BPS = 10_000;

export function pct(amount: bigint, bps: number): bigint {
  throw new Error(`not built yet: pct ${String(amount)} ${String(bps)}`);
}

export interface WeightedItem {
  readonly key: string;
  readonly weight: bigint;
}

export function lrr(total: bigint, items: readonly WeightedItem[]): Map<string, bigint> {
  throw new Error(`not built yet: lrr ${String(total)} ${String(items.length)}`);
}
