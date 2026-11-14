import { expect } from "vitest";
import type { PrismaClient } from "../../src/lib/server/db.ts";

/** Every account's balance, summed over every line the journal holds. An account nothing posted to is absent. */
export async function balancesOf(prisma: PrismaClient): Promise<Record<string, bigint>> {
  const rows = await prisma.$queryRaw<{ account: string; balance: bigint }[]>`
    SELECT "account", sum("amount")::bigint AS "balance" FROM "JournalLine" GROUP BY "account"`;
  return Object.fromEntries(rows.map((row) => [row.account, row.balance]));
}

/**
 * The books balance: every account adds up to something, and all of them together add up to nothing. The database
 * already refuses an entry that does not add up to zero, so this is the check a test makes at the end that nothing
 * went around it.
 */
export async function expectBooksBalanced(prisma: PrismaClient): Promise<void> {
  const balances = await balancesOf(prisma);
  const total = Object.values(balances).reduce((sum, balance) => sum + balance, 0n);
  expect(total).toBe(0n);
}
