import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { collectFeeReport, requestFeeReport } from "./fee-report.ts";
import { postFeeRows, type FeeBreakdown } from "./fees.ts";
import { finalizeDuePeriods } from "./finalize.ts";
import { postUnpostedPayments } from "./payments.ts";
import { closeDuePeriods } from "./periods.ts";
import { rollUpPlayDays } from "./play-rollup.ts";
import { releaseDueMonths, type ReleaseFailure } from "./releases.ts";
import { postReversals, readReversals } from "./reversals.ts";
import type { MoneyStripe } from "./stripe-port.ts";

/**
 * The site's daily money job: every step that turns what Stripe and the games recorded into the books, in one fixed
 * order, each able to run twice without posting twice. The facts are read before a month is closed, so what the run of
 * the 8th reads still lands in the month it belongs to, and a month is made final only after the closing step. Later
 * branches add the steps for payouts (after these) and for the cost of payouts (before closing).
 */

export interface MoneyJobDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
  readonly stripe: MoneyStripe;
  /**
   * Why Stripe's fee report is not asked for, when it is not: Stripe says some report types run only on a live key,
   * and a test deployment must not fail every day. Left out when the report is asked for.
   */
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
  readonly fees: readonly FeeBreakdown[];
  readonly reversals: number;
  readonly released: number;
  readonly playDays: readonly string[];
  readonly closed: readonly string[];
  /** The months made final in this run. */
  readonly final: readonly string[];
  readonly problems: readonly { readonly step: string; readonly message: string }[];
}

/** One step of the job: named in words, because staff read these and never a function's name. */
export interface Step {
  readonly name: string;
  /** True for a step the rest must not run without: a month must not become final on facts that are not all in. */
  readonly blocksTheRest?: boolean;
  /** True for a step that must not run in a run where any step before it failed. */
  readonly onlyIfAllWentWell?: boolean;
  run(): Promise<void>;
}

/**
 * Runs the steps in order, each in its own `try`. A step that throws is named with its message, and the steps after it
 * still run, unless it blocks the rest.
 */
export async function runSteps(steps: readonly Step[]): Promise<{ step: string; message: string }[]> {
  const problems: { step: string; message: string }[] = [];
  for (const step of steps) {
    try {
      await step.run();
    } catch (error) {
      problems.push({ step: step.name, message: error instanceof Error ? error.message : String(error) });
      if (step.blocksTheRest === true) break;
    }
  }
  return problems;
}

/** The words for payments that could not be released: each by its invoice, with the reason in the error's words. */
function describeReleaseFailures(failed: readonly ReleaseFailure[]): string {
  const list = failed.map((failure) => `${failure.stripeInvoiceId} (${failure.message})`).join("; ");
  return `${String(failed.length)} yearly payment${failed.length === 1 ? "" : "s"} could not be released: ${list}`;
}

export async function runMoneyJob(deps: MoneyJobDeps): Promise<MoneyJobReport> {
  const { db, clock, stripe } = deps;
  let payments = 0;
  let collected: MoneyJobReport["feeReport"]["collected"] = "none";
  let requested: MoneyJobReport["feeReport"]["requested"] = "nothing_new";
  let fees: readonly FeeBreakdown[] = [];
  let reversals = 0;
  let released = 0;
  let playDays: readonly string[] = [];
  let closed: readonly string[] = [];
  let final: readonly string[] = [];

  const feeReportSteps: Step[] =
    deps.feeReportSkipped === undefined
      ? [
          {
            name: "collecting Stripe's fee report",
            run: async () => {
              collected = await collectFeeReport({ db, clock, stripe });
            },
          },
          {
            name: "asking Stripe for its fee report",
            run: async () => {
              requested = await requestFeeReport({ db, clock, stripe });
            },
          },
        ]
      : [];

  const problems = await runSteps([
    {
      name: "posting payments",
      run: async () => {
        payments = (await postUnpostedPayments({ db, clock, stripe })).posted;
      },
    },
    ...feeReportSteps,
    {
      name: "taking Stripe's fees off the top",
      run: async () => {
        fees = (await postFeeRows({ db, clock })).breakdown;
      },
    },
    {
      name: "reading refunds and chargebacks from Stripe",
      run: async () => {
        await readReversals({ db, clock, stripe });
      },
    },
    {
      name: "posting refunds and chargebacks",
      run: async () => {
        reversals = (await postReversals({ db, clock })).posted;
      },
    },
    {
      name: "releasing yearly payments' months",
      run: async () => {
        const result = await releaseDueMonths({ db, clock });
        released = result.released;
        // The others were released; the step still fails, so the report names what a person must look at.
        if (result.failed !== undefined) throw new Error(describeReleaseFailures(result.failed));
      },
    },
    {
      name: "adding up play",
      run: async () => {
        playDays = (await rollUpPlayDays({ db, clock })).days;
      },
    },
    {
      name: "closing the month",
      blocksTheRest: true,
      run: async () => {
        closed = await closeDuePeriods({ db, clock });
      },
    },
    {
      name: "making the month final",
      run: async () => {
        final = await finalizeDuePeriods({ db, clock });
      },
    },
  ]);

  return {
    payments,
    feeReport: {
      collected,
      requested,
      ...(deps.feeReportSkipped === undefined ? {} : { skipped: deps.feeReportSkipped }),
    },
    fees,
    reversals,
    released,
    playDays,
    closed,
    final,
    problems,
  };
}
