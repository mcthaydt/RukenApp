/**
 * The two rounding primitives every money rule is built from.
 *
 * All amounts are integer cents as `bigint`. Nothing here ever uses floating
 * point, so the same inputs always give the same cents on every machine.
 */

/** 100% expressed in basis points (1 bp = 0.01%). */
export const FULL_SHARE_BPS = 10_000;

/**
 * The share `bps` of a non-negative amount, rounded half up.
 *
 * Example: 50% of 799 cents is 399.5, which rounds up to 400.
 *
 * It refuses negative amounts on purpose: a refund or chargeback never
 * recomputes a share of a negative number. It negates the lines that were
 * posted for the original sale, so the reversal is always exact.
 */
export function pct(amount: bigint, bps: number): bigint {
  if (amount < 0n) throw new RangeError(`pct needs a non-negative amount, got ${String(amount)}`);
  if (!Number.isInteger(bps) || bps < 0 || bps > FULL_SHARE_BPS) {
    throw new RangeError(
      `pct needs whole basis points between 0 and ${String(FULL_SHARE_BPS)}, got ${String(bps)}`,
    );
  }
  const fullShare = BigInt(FULL_SHARE_BPS);
  return (amount * BigInt(bps) + fullShare / 2n) / fullShare;
}

export interface WeightedItem {
  readonly key: string;
  readonly weight: bigint;
}

/**
 * Largest-remainder rounding: splits `total` cents across items in proportion
 * to their weights so that the shares add up to exactly `total`.
 *
 * How it works:
 * 1. Each item first gets the floor of its exact share, `total × weight / W`.
 * 2. That leaves fewer than `items.length` cents over. They go one each to the
 *    items with the largest remainders (the part the floor threw away).
 * 3. Equal remainders are broken by key in ascending code-unit order, so the
 *    result never depends on the order the items arrive in.
 *
 * Every share is therefore the floor or the ceiling of its exact share.
 */
export function lrr(total: bigint, items: readonly WeightedItem[]): Map<string, bigint> {
  if (total < 0n) throw new RangeError(`lrr needs a non-negative total, got ${String(total)}`);
  if (items.length === 0) throw new RangeError("lrr needs at least one item");

  const keys = new Set<string>();
  let weightSum = 0n;
  for (const item of items) {
    if (item.weight < 0n) throw new RangeError(`lrr weight for "${item.key}" is negative`);
    if (keys.has(item.key)) throw new RangeError(`lrr key "${item.key}" appears twice`);
    keys.add(item.key);
    weightSum += item.weight;
  }
  if (weightSum === 0n) throw new RangeError("lrr needs a positive total weight");

  const shares = new Map<string, bigint>();
  const remainders: { key: string; remainder: bigint }[] = [];
  let allocated = 0n;
  for (const item of items) {
    const exactTimesWeightSum = total * item.weight;
    const floor = exactTimesWeightSum / weightSum;
    shares.set(item.key, floor);
    remainders.push({ key: item.key, remainder: exactTimesWeightSum % weightSum });
    allocated += floor;
  }

  remainders.sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  let leftover = total - allocated;
  for (const { key } of remainders) {
    if (leftover === 0n) break;
    shares.set(key, (shares.get(key) ?? 0n) + 1n);
    leftover -= 1n;
  }
  return shares;
}
