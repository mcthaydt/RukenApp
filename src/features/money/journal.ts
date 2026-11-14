import { createHash } from "node:crypto";
import type { JournalEntryKind, PrismaClient } from "../../lib/server/db.ts";
import { canonicalJson } from "./canonical-json.ts";
import { periodOf, type Period } from "./period.ts";
import type { PostingLine } from "./posting.ts";

/**
 * Writing journal entries. The money arithmetic lives in the pure posting functions of this folder; this file only
 * stores what they return, and reads what they need back. Every function takes the caller's transaction, so a fact
 * and the entry it makes commit together or not at all.
 */

/** What these functions use of a transaction. Prisma does not export the type of `tx`. */
export type MoneyTx = Pick<
  PrismaClient,
  "$queryRaw" | "$executeRaw" | "journalEntry" | "journalLine" | "ledgerPeriod"
>;

/**
 * The month a fact posts into: its own month while that month is open, otherwise the month of `nowMs`. A late fact
 * never reopens a closed month, and a closed month's statement never moves. A month that has no row yet is made,
 * open.
 */
export async function postingPeriod(tx: MoneyTx, factAtMs: number, nowMs: number): Promise<Period> {
  return postingPeriodForMonth(tx, periodOf(factAtMs), nowMs);
}

/** Like `postingPeriod`, for something that belongs to a month and not to an instant (a yearly payment's release). */
export async function postingPeriodForMonth(tx: MoneyTx, month: Period, nowMs: number): Promise<Period> {
  if ((await ensurePeriod(tx, month)).state === "open") return month;
  const current = periodOf(nowMs);
  // The current month is open unless something closed it early; then there is nowhere honest to post, so stop.
  if ((await ensurePeriod(tx, current)).state !== "open") {
    throw new Error(`The current period ${current} is not open`);
  }
  return current;
}

async function ensurePeriod(tx: MoneyTx, period: Period) {
  return tx.ledgerPeriod.upsert({ where: { period }, create: { period }, update: {} });
}

export interface EntryDraft {
  /** The same event always has the same key, so posting it twice makes one entry. */
  readonly key: string;
  readonly period: Period;
  readonly kind: JournalEntryKind;
  /** The payment (a Stripe invoice) the entry belongs to, when it has one. */
  readonly stripeInvoiceId?: string | null;
  readonly gameId?: string | null;
  /**
   * The entry this one undoes, such as the opened chargeback a won one cancels. That entry must not itself be a
   * reversal: a reversal is corrected by a fresh entry, never reversed again.
   */
  readonly reversesId?: string | null;
  readonly lines: readonly PostingLine[];
}

/**
 * An entry's key is already taken by an entry with other lines. The same key with the same lines is a harmless
 * repeat and posts nothing; other lines mean the code worked the same event out two ways, which needs a person to
 * look, so the whole transaction is refused.
 */
export class IdempotencyConflict extends Error {
  override readonly name = "IdempotencyConflict";
  readonly key: string;

  constructor(key: string) {
    super(`Journal entry "${key}" was already posted with different lines`);
    this.key = key;
  }
}

/**
 * Writes one entry and its lines. The database checks that the lines add up to zero when the transaction commits,
 * and refuses an entry into a final month.
 *
 * A key already stored with the same lines is a repeat: nothing is written and the answer is "repeat". The check
 * reads before it inserts, so two transactions racing on one key both pass it and the unique key stops the later
 * insert, which rolls that transaction back: it fails closed, never twice. Callers also take `lockLedger`, so in
 * practice the second one waits and finds the first one's entry.
 */
export async function postEntry(tx: MoneyTx, draft: EntryDraft): Promise<"posted" | "repeat"> {
  const linesHash = hashOfLines(draft.lines);
  const existing = await tx.journalEntry.findUnique({
    where: { idempotencyKey: draft.key },
    select: { linesHash: true },
  });
  if (existing !== null) {
    if (existing.linesHash === linesHash) return "repeat";
    throw new IdempotencyConflict(draft.key);
  }
  const reversesId = draft.reversesId ?? null;
  if (reversesId !== null) await requireReversible(tx, reversesId);
  await tx.journalEntry.create({
    data: {
      idempotencyKey: draft.key,
      period: draft.period,
      kind: draft.kind,
      stripeInvoiceId: draft.stripeInvoiceId ?? null,
      gameId: draft.gameId ?? null,
      reversesId,
      linesHash,
      lines: {
        create: draft.lines.map((line) => ({
          account: line.account,
          amount: line.amount,
          makerUserId: line.makerUserId ?? null,
        })),
      },
    },
  });
  return "posted";
}

/**
 * A hash of an entry's lines that does not depend on their order, or on a maker being left out or set to null, so
 * "the same lines" means the same money moved to the same places.
 */
function hashOfLines(lines: readonly PostingLine[]): string {
  const forms = lines.map((line) =>
    canonicalJson({ account: line.account, amount: line.amount, makerUserId: line.makerUserId ?? null }),
  );
  // A plain code-unit sort, not a locale one: the hash must be the same on every machine.
  forms.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return createHash("sha256").update(forms.join("\n")).digest("hex");
}

/** Only an entry that exists and is not itself a reversal can be reversed. */
async function requireReversible(tx: MoneyTx, entryId: string): Promise<void> {
  const target = await tx.journalEntry.findUnique({ where: { id: entryId }, select: { reversesId: true } });
  if (target === null) throw new Error(`There is no entry ${entryId} to reverse`);
  if (target.reversesId !== null) {
    throw new Error(`Entry ${entryId} is itself a reversal; post a fresh corrective entry instead`);
  }
}

/** The balance of one account over every entry: debits positive, credits negative. */
export async function accountBalance(tx: MoneyTx, account: string): Promise<bigint> {
  const { _sum } = await tx.journalLine.aggregate({ where: { account }, _sum: { amount: true } });
  return _sum.amount ?? 0n;
}

/**
 * The balance of every account whose name starts with `prefix`, such as `maker:` for what every maker is owed. An
 * account nothing was posted to is not in the answer. The prefix is compared as plain text, so a `_` or `%` in it
 * means itself.
 */
export async function accountBalances(tx: MoneyTx, prefix: string): Promise<Map<string, bigint>> {
  const rows = await tx.$queryRaw<{ account: string; balance: bigint }[]>`
    SELECT "account", sum("amount")::bigint AS "balance" FROM "JournalLine"
    WHERE starts_with("account", ${prefix}) GROUP BY "account"`;
  return new Map(rows.map((row) => [row.account, row.balance]));
}

/**
 * Takes the ledger's lock for the rest of the transaction. Every function that posts takes it first, so two runs of
 * the daily job take turns, and the second finds what the first one posted instead of posting it again.
 *
 * A transaction-scoped advisory lock, as slice 1's `lockMembership` takes its own: it is let go at commit and holds
 * up nothing that only reads.
 */
export async function lockLedger(tx: Pick<MoneyTx, "$executeRaw">): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('ledger', 0))`;
}
