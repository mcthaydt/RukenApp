import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { Period } from "./period.ts";

export interface FinalizeDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
}

export function finalizePeriod(
  deps: FinalizeDeps,
  period: Period,
): Promise<{ final: boolean; makers: string[] }> {
  return Promise.reject(new Error(`not built yet: finalizePeriod ${typeof deps} ${period}`));
}

export function finalizeDuePeriods(deps: FinalizeDeps): Promise<Period[]> {
  return Promise.reject(new Error(`not built yet: finalizeDuePeriods ${typeof deps}`));
}
