import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { MoneyStripe } from "./stripe-port.ts";

export interface MoneyJobDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
  readonly stripe: MoneyStripe;
  readonly feeReportSkipped?: string;
}

/** What one run did, for the person who runs it and for staff. It holds counts and names only: no amount, no person. */
export interface MoneyJobReport {
  readonly payments: number;
  readonly feeReport: {
    readonly collected: "none" | "pending" | "stored" | "failed";
    readonly requested: "requested" | "waiting" | "nothing_new";
    readonly skipped?: string;
  };
  readonly fees: readonly {
    readonly product: string;
    readonly featureName: string;
    readonly kind: "payment" | "payout" | "counted" | "credit" | "returned" | "unplaced" | "unreadable";
    readonly rows: number;
  }[];
  readonly reversals: number;
  readonly released: number;
  readonly playDays: readonly string[];
  readonly closed: readonly string[];
  readonly problems: readonly { readonly step: string; readonly message: string }[];
}

/** One step of the job: what staff read when it fails, and whether the steps after it may still run. */
export interface Step {
  readonly name: string;
  readonly blocksTheRest?: boolean;
  run(): Promise<void>;
}

export function runSteps(steps: readonly Step[]): Promise<{ step: string; message: string }[]> {
  return Promise.reject(new Error(`not built yet: runSteps ${String(steps.length)}`));
}

export function runMoneyJob(deps: MoneyJobDeps): Promise<MoneyJobReport> {
  return Promise.reject(new Error(`not built yet: runMoneyJob ${typeof deps}`));
}
