import type { MoneyTx } from "./journal.ts";
import type { MemberMonth, PoolOutcome } from "./makers-pool.ts";
import type { Period } from "./period.ts";

/** What a transaction must offer to read and share a month's pool. */
export type PoolTx = MoneyTx;

export function membersOf(tx: PoolTx, period: Period): Promise<MemberMonth[]> {
  return Promise.reject(new Error(`not built yet: membersOf ${typeof tx} ${period}`));
}

export function poolFor(
  tx: PoolTx,
  period: Period,
): Promise<{ pool: bigint; members: MemberMonth[]; outcome: PoolOutcome; inputsHash: string }> {
  return Promise.reject(new Error(`not built yet: poolFor ${typeof tx} ${period}`));
}

export function sharePool(tx: PoolTx, period: Period, nowMs: number): Promise<{ shared: boolean }> {
  return Promise.reject(new Error(`not built yet: sharePool ${typeof tx} ${period} ${String(nowMs)}`));
}
