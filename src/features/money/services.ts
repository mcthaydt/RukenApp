import type Stripe from "stripe";
import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { MoneyJobReport } from "./daily.ts";

type Settings = Readonly<Record<string, string | undefined>>;

export interface MoneyServices {
  /** Runs the daily money job once. */
  runJob(): Promise<MoneyJobReport>;
}

export function feeReportSkipReason(source: Settings): string | undefined {
  return `not built yet: ${String(Object.keys(source).length)}`;
}

export function createMoneyServices(
  source: Settings,
  parts: { prisma: PrismaClient; clock: Clock; stripe: Stripe },
): MoneyServices {
  throw new Error(`not built yet: ${String(Object.keys(source).length)} ${typeof parts}`);
}

export function moneyServices(): MoneyServices {
  throw new Error("not built yet: moneyServices");
}
