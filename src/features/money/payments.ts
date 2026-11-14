import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { MoneyStripe } from "./stripe-port.ts";

export interface PaymentDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
  readonly stripe: Pick<MoneyStripe, "paymentIds">;
}

export function postUnpostedPayments(deps: PaymentDeps): Promise<{ posted: number }> {
  return Promise.reject(new Error(`not built yet: postUnpostedPayments ${typeof deps}`));
}
