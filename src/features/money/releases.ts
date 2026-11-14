import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";

export interface ReleaseDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
}

export function releaseDueMonths(deps: ReleaseDeps): Promise<{ released: number }> {
  return Promise.reject(new Error(`not built yet: releaseDueMonths ${typeof deps}`));
}
