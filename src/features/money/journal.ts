// The journal (stub: red step).
import type { JournalEntryKind, PrismaClient } from "../../lib/server/db.ts";
import type { Period } from "./period.ts";
import type { PostingLine } from "./posting.ts";

export type MoneyTx = Pick<
  PrismaClient,
  "$queryRaw" | "$executeRaw" | "journalEntry" | "journalLine" | "ledgerPeriod"
>;

export async function postingPeriod(tx: MoneyTx, factAtMs: number, nowMs: number): Promise<Period> {
  throw new Error(`not built yet: postingPeriod ${typeof tx} ${String(factAtMs)} ${String(nowMs)}`);
}

export async function postingPeriodForMonth(tx: MoneyTx, month: Period, nowMs: number): Promise<Period> {
  throw new Error(`not built yet: postingPeriodForMonth ${typeof tx} ${month} ${String(nowMs)}`);
}

export interface EntryDraft {
  readonly key: string;
  readonly period: Period;
  readonly kind: JournalEntryKind;
  readonly stripeInvoiceId?: string | null;
  readonly gameId?: string | null;
  readonly reversesId?: string | null;
  readonly lines: readonly PostingLine[];
}

export class IdempotencyConflict extends Error {
  override readonly name = "IdempotencyConflict";
}

export async function postEntry(tx: MoneyTx, draft: EntryDraft): Promise<"posted" | "repeat"> {
  throw new Error(`not built yet: postEntry ${typeof tx} ${draft.key}`);
}

export async function accountBalance(tx: MoneyTx, account: string): Promise<bigint> {
  throw new Error(`not built yet: accountBalance ${typeof tx} ${account}`);
}

export async function accountBalances(tx: MoneyTx, prefix: string): Promise<Map<string, bigint>> {
  throw new Error(`not built yet: accountBalances ${typeof tx} ${prefix}`);
}

export async function lockLedger(tx: MoneyTx): Promise<void> {
  throw new Error(`not built yet: lockLedger ${typeof tx}`);
}
