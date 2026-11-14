import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { lockLedger, postEntry, postingPeriod } from "./journal.ts";
import { postChargebackOpened, postChargebackWon, postRefund } from "./reversal-posting.ts";
import type { PostingLine } from "./posting.ts";
import type { DisputeRead, MoneyStripe, RefundRead } from "./stripe-port.ts";

/**
 * Refunds and chargebacks. Stripe's own lists are read by the daily job (a webhook is not relied on, so a missed event
 * cannot leave the books wrong), each refund or step of a dispute is kept as a `StripeReversal` fact, and each fact is
 * posted once, as an entry that undoes the payment in proportion (`reversal-posting.ts`).
 */

export interface ReadReversalsDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
  readonly stripe: Pick<MoneyStripe, "refundsSince" | "disputesSince" | "dispute">;
}

export interface PostReversalsDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
}

/** The lists are read from this long before the newest reversal kept, so one that was a little late is still seen. */
const OVERLAP_MS = 40 * 24 * 60 * 60 * 1000;

const SECOND_MS = 1000;

/** What `StripeReversal` holds, before it is stored. */
interface ReversalFact {
  readonly id: string;
  readonly kind: "refund" | "chargeback_opened" | "chargeback_won" | "chargeback_lost";
  readonly stripeInvoiceId: string;
  readonly amountCents: bigint;
  readonly feeCents: bigint;
  readonly returnedCents: bigint;
  readonly balanceTransactionIds: readonly string[];
  readonly at: Date;
}

/**
 * Keeps every refund and every step of a dispute that is not kept yet. Answers how many it stored. A refund or dispute
 * of a charge that is not one of this database's membership payments is not Ruken's and is skipped.
 *
 * The lists are read from 40 days before the newest reversal kept (the first run: from the oldest payment). A dispute
 * can take months to be decided, and by then it is outside that stretch, so every dispute that was opened and not yet
 * won or lost is also read again by its id on each run.
 */
export async function readReversals(deps: ReadReversalsDeps): Promise<{ stored: number }> {
  const sinceSec = await readFromSec(deps.db);
  if (sinceSec === null) return { stored: 0 };

  const postings = await deps.db.paymentPosting.findMany({
    select: { stripeInvoiceId: true, stripeChargeId: true },
  });
  const invoiceOf = new Map<string, string>();
  for (const posting of postings) invoiceOf.set(posting.stripeChargeId, posting.stripeInvoiceId);

  const facts: ReversalFact[] = [];
  for (const refund of await deps.stripe.refundsSince(sinceSec)) {
    const fact = refundFact(refund, invoiceOf);
    if (fact !== null) facts.push(fact);
  }

  const disputes = new Map<string, DisputeRead>();
  for (const dispute of await deps.stripe.disputesSince(sinceSec)) disputes.set(dispute.id, dispute);
  for (const disputeId of await standingDisputes(deps.db)) {
    if (!disputes.has(disputeId)) disputes.set(disputeId, await deps.stripe.dispute(disputeId));
  }
  for (const dispute of disputes.values()) facts.push(...disputeFacts(dispute, invoiceOf));

  const { count } = await deps.db.stripeReversal.createMany({
    data: facts.map((fact) => ({ ...fact, balanceTransactionIds: [...fact.balanceTransactionIds] })),
    skipDuplicates: true,
  });
  return { stored: count };
}

/** Where to read Stripe's lists from, in Unix seconds, or null when there is no payment yet to be refunded. */
async function readFromSec(db: PrismaClient): Promise<number | null> {
  const newest = (await db.stripeReversal.aggregate({ _max: { at: true } }))._max.at;
  if (newest !== null) return Math.floor((newest.getTime() - OVERLAP_MS) / SECOND_MS);
  const oldest = (await db.membershipPayment.aggregate({ _min: { paidAt: true } }))._min.paidAt;
  return oldest === null ? null : Math.floor(oldest.getTime() / SECOND_MS);
}

/** The disputes opened and neither won nor lost. */
async function standingDisputes(db: PrismaClient): Promise<string[]> {
  const rows = await db.stripeReversal.findMany({
    where: { kind: { in: ["chargeback_opened", "chargeback_won", "chargeback_lost"] } },
    select: { id: true },
  });
  const ids = new Set(rows.map((row) => row.id));
  return rows
    .map((row) => /^dispute:(.+):opened$/.exec(row.id)?.[1])
    .filter((disputeId): disputeId is string => disputeId !== undefined)
    .filter((disputeId) => !ids.has(`dispute:${disputeId}:won`) && !ids.has(`dispute:${disputeId}:lost`));
}

function refundFact(refund: RefundRead, invoiceOf: ReadonlyMap<string, string>): ReversalFact | null {
  const stripeInvoiceId = invoiceOf.get(refund.chargeId);
  if (stripeInvoiceId === undefined || refund.status !== "succeeded") return null;
  return {
    id: `refund:${refund.id}`,
    kind: "refund",
    stripeInvoiceId,
    amountCents: refund.amountCents,
    feeCents: 0n,
    returnedCents: refund.returnedCents,
    balanceTransactionIds: refund.balanceTransactionIds,
    at: new Date(refund.atSec * SECOND_MS),
  };
}

/**
 * The steps of a dispute Stripe has shown so far: it opened (always), and was won or lost. A warning (an inquiry)
 * withdrew nothing and is ignored. A win is kept only once the money it gave back is at Stripe, so a later run keeps it.
 */
function disputeFacts(dispute: DisputeRead, invoiceOf: ReadonlyMap<string, string>): ReversalFact[] {
  const stripeInvoiceId = invoiceOf.get(dispute.chargeId);
  if (stripeInvoiceId === undefined || dispute.status.startsWith("warning_")) return [];
  const shared = {
    stripeInvoiceId,
    amountCents: dispute.amountCents,
    feeCents: dispute.feeCents,
    balanceTransactionIds: dispute.balanceTransactionIds,
  };
  const facts: ReversalFact[] = [
    {
      ...shared,
      id: `dispute:${dispute.id}:opened`,
      kind: "chargeback_opened",
      returnedCents: dispute.returnedCents,
      at: new Date(dispute.atSec * SECOND_MS),
    },
  ];
  const closedAt = new Date((dispute.closedAtSec ?? dispute.atSec) * SECOND_MS);
  if (dispute.status === "lost") {
    facts.push({
      ...shared,
      id: `dispute:${dispute.id}:lost`,
      kind: "chargeback_lost",
      returnedCents: 0n,
      at: closedAt,
    });
  }
  if (dispute.status === "won" && dispute.reinstatedCents !== null && dispute.closedAtSec !== null) {
    facts.push({
      ...shared,
      id: `dispute:${dispute.id}:won`,
      kind: "chargeback_won",
      returnedCents: dispute.reinstatedCents,
      at: closedAt,
    });
  }
  return facts;
}

/**
 * Posts every kept reversal that has no entry yet, oldest first, each under the ledger's lock in a transaction of its
 * own. A refund and an opened chargeback undo the payment; a won one undoes the opened entry; a lost one posts nothing,
 * because the opened entry already says the money is gone. The entry's key is the fact's id, so a repeat posts nothing.
 * Answers how many it posted.
 */
export async function postReversals(deps: PostReversalsDeps): Promise<{ posted: number }> {
  const facts = await deps.db.stripeReversal.findMany({
    where: { kind: { not: "chargeback_lost" } },
    orderBy: [{ at: "asc" }, { id: "asc" }],
  });
  const done = await deps.db.journalEntry.findMany({
    where: { idempotencyKey: { in: facts.map((fact) => fact.id) } },
    select: { idempotencyKey: true },
  });
  const posted = new Set(done.map((entry) => entry.idempotencyKey));
  let count = 0;
  for (const fact of facts.filter((candidate) => !posted.has(candidate.id))) {
    if (await postReversal(deps, fact)) count += 1;
  }
  return { posted: count };
}

/** A kept reversal, as read back (its balance transaction ids matter to the fees, not to posting). */
type StoredReversal = Omit<ReversalFact, "balanceTransactionIds">;

async function postReversal(deps: PostReversalsDeps, fact: StoredReversal): Promise<boolean> {
  const nowMs = deps.clock.epochMs();
  return deps.db.$transaction(async (tx) => {
    await lockLedger(tx);
    const already = await tx.journalEntry.findUnique({ where: { idempotencyKey: fact.id } });
    if (already !== null) return false;

    const { stripeInvoiceId } = fact;
    // The payment's own lines and every later fee's, so a reversal undoes the fees in proportion too.
    const lines = await tx.journalLine.findMany({
      where: { entry: { stripeInvoiceId, kind: { in: ["payment", "payment_fee"] } } },
      select: { account: true, amount: true },
    });
    const paymentLines: PostingLine[] = lines.map((line) => ({ account: line.account, amount: line.amount }));
    const payment = await tx.membershipPayment.findUniqueOrThrow({ where: { stripeInvoiceId } });
    // What still waits in `premium:deferred`: what the payment put there, less every fee, release and reversal since.
    const deferred = await tx.journalLine.aggregate({
      where: { account: "premium:deferred", entry: { stripeInvoiceId } },
      _sum: { amount: true },
    });
    const deferredLeft = -(deferred._sum.amount ?? 0n);
    const period = await postingPeriod(tx, fact.at.getTime(), nowMs);

    const common = {
      paymentLines,
      paymentGross: payment.grossCents,
      amount: fact.amountCents,
      feeReturned: fact.returnedCents,
      deferredLeft,
      openPool: period,
    };
    if (fact.kind === "chargeback_won") {
      const opened = await tx.journalEntry.findUnique({
        where: { idempotencyKey: fact.id.replace(/:won$/, ":opened") },
        include: { lines: true },
      });
      if (opened === null) throw new Error(`Dispute ${fact.id} was won but its opening was never posted`);
      await postEntry(tx, {
        key: fact.id,
        period,
        kind: "chargeback",
        stripeInvoiceId,
        reversesId: opened.id,
        lines: postChargebackWon(
          opened.lines.map((line) => ({ account: line.account, amount: line.amount })),
          period,
          fact.returnedCents,
        ),
      });
      return true;
    }
    const isRefund = fact.kind === "refund";
    await postEntry(tx, {
      key: fact.id,
      period,
      kind: isRefund ? "refund" : "chargeback",
      stripeInvoiceId,
      lines: isRefund ? postRefund(common) : postChargebackOpened({ ...common, disputeFee: fact.feeCents }),
    });
    return true;
  });
}
