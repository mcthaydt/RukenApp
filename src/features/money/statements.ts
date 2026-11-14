import type { MoneyTx } from "./journal.ts";
import type { Period } from "./period.ts";

export function writeStatements(tx: MoneyTx, period: Period, nowMs: number): Promise<{ makers: string[] }> {
  return Promise.reject(new Error(`not built yet: writeStatements ${typeof tx} ${period} ${String(nowMs)}`));
}
