import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { MoneyStripe } from "./stripe-port.ts";

export interface ReadReversalsDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
  readonly stripe: Pick<MoneyStripe, "refundsSince" | "disputesSince" | "dispute">;
}

export interface PostReversalsDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
}

export function readReversals(deps: ReadReversalsDeps): Promise<{ stored: number }> {
  return Promise.reject(new Error(`not built yet: readReversals ${typeof deps}`));
}

export function postReversals(deps: PostReversalsDeps): Promise<{ posted: number }> {
  return Promise.reject(new Error(`not built yet: postReversals ${typeof deps}`));
}
