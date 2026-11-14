import { chicagoDayOf } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { lockLedger, type MoneyTx } from "./journal.ts";
import type { Period } from "./period.ts";
import { buildStatement, type StatementInput } from "./statement.ts";

/** What writing statements uses of a transaction. */
type StatementTx = MoneyTx & Pick<PrismaClient, "poolShare" | "statement" | "statementLine">;

/**
 * Writes a statement for every maker who has something to show for `period`: a share of its pool, any other line posted
 * for them in it, or a balance other than zero (money owed from before is shown even in a month the maker earned
 * nothing). A maker with nothing this month and nothing owed gets none. A statement is written once: a second call writes
 * nothing. Answers the makers it wrote for, in id order.
 *
 * The statement is what the maker is shown, copied from the journal when the month is made final, with each game's name
 * and address as they were then. It takes the ledger's lock, as everything that posts does; the caller usually holds it
 * already, which costs nothing twice.
 */
export async function writeStatements(
  tx: StatementTx,
  period: Period,
  nowMs: number,
): Promise<{ makers: string[] }> {
  await lockLedger(tx);
  // Every maker account's balance after every entry up to and including the month, and whether the month posted to it.
  const accounts = await tx.$queryRaw<{ makerUserId: string; balance: bigint; inMonth: boolean }[]>`
    SELECT l."makerUserId", sum(l."amount")::bigint AS "balance", bool_or(e."period" = ${period}) AS "inMonth"
    FROM "JournalLine" l JOIN "JournalEntry" e ON e."id" = l."entryId"
    WHERE l."makerUserId" IS NOT NULL AND e."period" <= ${period}
    GROUP BY l."makerUserId" ORDER BY l."makerUserId"`;
  const have = new Set(
    (await tx.statement.findMany({ where: { period }, select: { makerUserId: true } })).map(
      (row) => row.makerUserId,
    ),
  );

  const written: string[] = [];
  for (const account of accounts) {
    if (have.has(account.makerUserId) || (!account.inMonth && account.balance === 0n)) continue;
    await writeOne(tx, period, nowMs, account.makerUserId, -account.balance);
    written.push(account.makerUserId);
  }
  return { makers: written };
}

async function writeOne(
  tx: StatementTx,
  period: Period,
  nowMs: number,
  makerUserId: string,
  owed: bigint,
): Promise<void> {
  const shares = await tx.poolShare.findMany({
    where: { makerUserId, period },
    include: { game: { select: { id: true, slug: true, name: true } } },
  });
  // A maker's other lines of the month, as the journal has them: a credit is what they earned, a debit what was taken off.
  const lines = await tx.journalLine.findMany({
    where: { makerUserId, entry: { period, kind: { in: ["transfer", "payout_cost", "correction"] } } },
    include: { entry: { select: { idempotencyKey: true, kind: true, createdAt: true } } },
  });

  const input: StatementInput = {
    makerUserId,
    period,
    finalAt: new Date(nowMs).toISOString(),
    shares: shares.map((share) => ({
      kind: share.kind,
      game: share.game === null ? null : { slug: share.game.slug, name: share.game.name },
      amount: share.amountCents,
      seconds: share.seconds,
      members: share.members,
    })),
    others: lines.map((line) => ({
      kind: line.entry.kind as "transfer" | "payout_cost" | "correction",
      key: line.entry.idempotencyKey,
      amount: -line.amount,
      payoutId: line.entry.idempotencyKey,
      sentOn: chicagoDayOf(line.entry.createdAt.getTime()),
    })),
    owed,
  };
  const { document, canonical, hash } = buildStatement(input);

  const statement = await tx.statement.create({
    data: { makerUserId, period, document: JSON.parse(canonical) as object, totalsHash: hash },
  });
  const gameIdOf = new Map(
    shares.flatMap((share) => (share.game === null ? [] : [[share.game.slug, share.game.id] as const])),
  );
  await tx.statementLine.createMany({
    data: document.lines.map((line) => ({
      statementId: statement.id,
      source: line.source,
      gameId: line.source === "play" ? (gameIdOf.get(line.game.slug) ?? null) : null,
      ref: line.ref,
      amountCents: line.amount,
    })),
  });
}
