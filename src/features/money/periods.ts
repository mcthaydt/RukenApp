// Months that close (stub: red step).
import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { Period } from "./period.ts";

export interface PeriodDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
}

export function closeAt(period: Period): number {
  throw new Error(`not built yet: closeAt ${period}`);
}

export function finalAt(period: Period): number {
  throw new Error(`not built yet: finalAt ${period}`);
}

export function latestPeriodDue(nowMs: number, momentOf: (period: Period) => number): Period {
  throw new Error(`not built yet: latestPeriodDue ${String(nowMs)} ${typeof momentOf}`);
}

export function closePeriod(deps: PeriodDeps, period: Period): Promise<{ closed: boolean }> {
  return Promise.reject(new Error(`not built yet: closePeriod ${typeof deps} ${period}`));
}

export function closeDuePeriods(deps: PeriodDeps): Promise<Period[]> {
  return Promise.reject(new Error(`not built yet: closeDuePeriods ${typeof deps}`));
}
