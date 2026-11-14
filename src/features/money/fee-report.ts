import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { MoneyStripe } from "./stripe-port.ts";

export interface FeeReportDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
  readonly stripe: Pick<MoneyStripe, "feeReportWindow" | "startFeeReport" | "feeReport">;
}

export function collectFeeReport(deps: FeeReportDeps): Promise<"none" | "pending" | "stored" | "failed"> {
  return Promise.reject(new Error(`not built yet: collectFeeReport ${typeof deps}`));
}

export function requestFeeReport(deps: FeeReportDeps): Promise<"requested" | "waiting" | "nothing_new"> {
  return Promise.reject(new Error(`not built yet: requestFeeReport ${typeof deps}`));
}
