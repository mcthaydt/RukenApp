// The entries that share a pool out (stub: red step).
import type { PoolOutcome } from "./makers-pool.ts";
import type { Period } from "./period.ts";
import type { PostingLine } from "./posting.ts";

export interface PoolEntry {
  readonly key: string;
  readonly kind: "pool_share" | "pool_carry";
  readonly gameId: string | null;
  readonly lines: readonly PostingLine[];
}

export function postPoolShares(
  period: Period,
  outcome: Extract<PoolOutcome, { kind: "shared" }>,
  makerOf: ReadonlyMap<string, string>,
): PoolEntry[] {
  throw new Error(
    `not built yet: postPoolShares ${period} ${String(outcome.games.length)} ${String(makerOf.size)}`,
  );
}

export function postPoolCarry(period: Period, amount: bigint): PoolEntry[] {
  throw new Error(`not built yet: postPoolCarry ${period} ${String(amount)}`);
}
