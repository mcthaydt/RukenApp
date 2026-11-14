import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";

export interface FeeDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
}

/** How many report rows the run placed as each kind, and how many it could not place or read. */
export interface FeeCounts {
  readonly payment: number;
  readonly payout: number;
  readonly counted: number;
  readonly credit: number;
  readonly returned: number;
  readonly unplaced: number;
  readonly unreadable: number;
}

export function postFeeRows(deps: FeeDeps): Promise<FeeCounts> {
  return Promise.reject(new Error(`not built yet: postFeeRows ${typeof deps}`));
}
