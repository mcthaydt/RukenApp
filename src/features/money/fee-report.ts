import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { feeRowsFrom } from "./fee-rows.ts";
import { lockLedger } from "./journal.ts";
import type { MoneyStripe } from "./stripe-port.ts";

/**
 * Stripe's Fees report, asked for in stretches of time and kept row by row, exactly as Stripe wrote it. Placing a row
 * against a payment is `fees.ts`'s work; this file only asks, waits and keeps.
 *
 * Why a stretch cannot miss a fee or read one twice: the report is by the time a fee reached Ruken's balance, Stripe
 * says its data is complete up to `availableToSec`, and each stretch starts exactly where the last stored one ended.
 */

export interface FeeReportDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
  readonly stripe: Pick<MoneyStripe, "feeReportWindow" | "startFeeReport" | "feeReport">;
}

const SECOND_MS = 1000;
const DAY_SECONDS = 86_400;

/** Rows are stored this many to a statement, so a report of thousands of lines stays under the database's limit. */
const ROWS_PER_INSERT = 1000;

/**
 * Looks at the run Stripe was asked for, if there is one. Still working: nothing changes. Failed: the run is marked so,
 * with Stripe's words, and its stretch is asked for again by `requestFeeReport`. Finished: every line becomes a row and
 * the run is marked stored, together or not at all. A report whose columns are not the ones asked for throws and
 * stores nothing, and the run stays as it was.
 */
export async function collectFeeReport(
  deps: FeeReportDeps,
): Promise<"none" | "pending" | "stored" | "failed"> {
  const run = await deps.db.stripeFeeRun.findFirst({
    where: { state: "requested" },
    orderBy: { intervalStart: "asc" },
  });
  if (run === null) return "none";
  const answer = await deps.stripe.feeReport(run.stripeReportRunId);
  if (answer.status === "pending") return "pending";
  if (answer.status === "failed") {
    // Only a run still requested moves, so two runs of the job at once record the failure once.
    await deps.db.stripeFeeRun.updateMany({
      where: { id: run.id, state: "requested" },
      data: { state: "failed", problem: answer.problem },
    });
    return "failed";
  }
  const rows = feeRowsFrom(answer.csv);
  await deps.db.$transaction(async (tx) => {
    await lockLedger(tx);
    const fresh = await tx.stripeFeeRun.findUniqueOrThrow({ where: { id: run.id }, select: { state: true } });
    if (fresh.state !== "requested") return; // another run of the job stored it while this one waited
    for (let start = 0; start < rows.length; start += ROWS_PER_INSERT) {
      await tx.stripeFeeRow.createMany({
        data: rows
          .slice(start, start + ROWS_PER_INSERT)
          .map((row, index) => ({ ...row, runId: run.id, rowNumber: start + index + 1 })),
      });
    }
    await tx.stripeFeeRun.update({
      where: { id: run.id },
      data: { state: "stored", rowCount: rows.length, storedAt: new Date(deps.clock.epochMs()) },
    });
  });
  return "stored";
}

/**
 * Asks Stripe for the next stretch, unless one is still being worked on. The next stretch starts where the last stored
 * one ended; the first one starts a day before the oldest payment (and never before what Stripe still holds, so an old
 * account's years of rows are not stored), and with no payment yet there is nothing to ask for. It ends where Stripe's
 * data ends. A failed run's stretch is asked for again, because the next one still starts at the last stored end.
 */
export async function requestFeeReport(
  deps: FeeReportDeps,
): Promise<"requested" | "waiting" | "nothing_new"> {
  if ((await deps.db.stripeFeeRun.count({ where: { state: "requested" } })) > 0) return "waiting";

  const lastStored = await deps.db.stripeFeeRun.findFirst({
    where: { state: "stored" },
    orderBy: { intervalEnd: "desc" },
    select: { intervalEnd: true },
  });
  let fromSec: number;
  let firstEver = false;
  if (lastStored !== null) {
    fromSec = lastStored.intervalEnd.getTime() / SECOND_MS;
  } else {
    const oldest = (await deps.db.membershipPayment.aggregate({ _min: { paidAt: true } }))._min.paidAt;
    if (oldest === null) return "nothing_new";
    fromSec = Math.floor(oldest.getTime() / SECOND_MS) - DAY_SECONDS;
    firstEver = true;
  }

  const reportWindow = await deps.stripe.feeReportWindow();
  if (firstEver) fromSec = Math.max(fromSec, reportWindow.availableFromSec);
  const toSec = reportWindow.availableToSec;
  if (toSec <= fromSec) return "nothing_new";

  const stripeReportRunId = await deps.stripe.startFeeReport(fromSec, toSec);
  await deps.db.$transaction(async (tx) => {
    await lockLedger(tx);
    await tx.stripeFeeRun.create({
      data: {
        intervalStart: new Date(fromSec * SECOND_MS),
        intervalEnd: new Date(toSec * SECOND_MS),
        stripeReportRunId,
        requestedAt: new Date(deps.clock.epochMs()),
      },
    });
  });
  return "requested";
}
