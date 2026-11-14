import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { DateText } from "./calendar.ts";

export interface RollupDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
}

export function rollUpPlayDays(deps: RollupDeps): Promise<{ days: DateText[] }> {
  return Promise.reject(new Error(`not built yet: rollUpPlayDays ${typeof deps}`));
}
