import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// Plain SQL on purpose, as for the play tables: these check what the database itself refuses (the CHECK rules, the
// add-only triggers, "every entry adds up to zero", "no entry into a final month" and "a month only moves forward"),
// whatever the application code does. The ledger is the one place where a wrong row must be impossible, not unlikely.

let database: TestDatabase | undefined;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES ('2026-11')`;
});

afterAll(async () => {
  await database?.stop();
});

let counter = 0;

/** A new person, for a line that names a maker. */
async function newMaker(): Promise<string> {
  counter += 1;
  const user = await db().user.create({
    data: { name: "Maker", email: `maker-${String(counter)}@example.test` },
  });
  return user.id;
}

interface LineValues {
  account: string;
  amount: bigint;
  makerUserId?: string | null;
}

/**
 * One entry and its lines, in one transaction, by plain SQL. The database checks that the lines add up when the
 * transaction commits, so a wrong entry is refused at the commit and nothing of it stays.
 */
async function postRaw(lines: readonly LineValues[], values: { period?: string } = {}): Promise<string> {
  const entryId = randomUUID();
  const period = values.period ?? "2026-11";
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "JournalEntry" ("id", "idempotencyKey", "period", "kind", "linesHash")
      VALUES (${entryId}, ${entryId}, ${period}, 'payment'::"JournalEntryKind", 'not-checked-here')`;
    for (const line of lines) {
      await tx.$executeRaw`
        INSERT INTO "JournalLine" ("id", "entryId", "account", "makerUserId", "amount")
        VALUES (${randomUUID()}, ${entryId}, ${line.account}, ${line.makerUserId ?? null}, ${line.amount})`;
    }
  });
  return entryId;
}

const BALANCED: readonly LineValues[] = [
  { account: "platform:cash", amount: 100n },
  { account: "platform:revenue:premium", amount: -100n },
];

describe("the ledger tables", () => {
  it("makes the ledger tables", async () => {
    const rows = await db().$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    expect(rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(["LedgerPeriod", "JournalEntry", "JournalLine"]),
    );
  });

  it("takes an entry whose lines add up to zero", async () => {
    const entryId = await postRaw(BALANCED);
    const lines = await db().$queryRaw<{ amount: bigint }[]>`
      SELECT "amount" FROM "JournalLine" WHERE "entryId" = ${entryId} ORDER BY "amount"`;
    expect(lines.map((line) => line.amount)).toEqual([-100n, 100n]);
  });

  it("refuses an entry whose lines do not add up to zero", async () => {
    await expect(
      postRaw([
        { account: "platform:cash", amount: 100n },
        { account: "platform:revenue:premium", amount: -99n },
      ]),
    ).rejects.toThrow(/does not balance/);
  });

  it("refuses an entry with one line", async () => {
    await expect(postRaw([{ account: "platform:cash", amount: 0n }])).rejects.toThrow(/does not balance/);
  });

  it("refuses to change or delete an entry or a line", async () => {
    const entryId = await postRaw(BALANCED);
    await expect(
      db()
        .$executeRaw`UPDATE "JournalEntry" SET "kind" = 'refund'::"JournalEntryKind" WHERE "id" = ${entryId}`,
    ).rejects.toThrow(/JournalEntry is append-only/);
    await expect(db().$executeRaw`DELETE FROM "JournalEntry" WHERE "id" = ${entryId}`).rejects.toThrow(
      /JournalEntry is append-only/,
    );
    await expect(
      db().$executeRaw`UPDATE "JournalLine" SET "amount" = 7 WHERE "entryId" = ${entryId}`,
    ).rejects.toThrow(/JournalLine is append-only/);
    await expect(db().$executeRaw`DELETE FROM "JournalLine" WHERE "entryId" = ${entryId}`).rejects.toThrow(
      /JournalLine is append-only/,
    );
  });

  it("refuses an entry into a month that is final", async () => {
    await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES ('2026-08')`;
    // A closed month still takes entries: its pool is shared after it closes and before it is final.
    await db()
      .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed', "closedAt" = now() WHERE "period" = '2026-08'`;
    await expect(postRaw(BALANCED, { period: "2026-08" })).resolves.toBeDefined();

    await db()
      .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'final', "finalAt" = now() WHERE "period" = '2026-08'`;
    await expect(postRaw(BALANCED, { period: "2026-08" })).rejects.toThrow(
      /2026-08 is final and takes no new entries/,
    );
  });

  describe("a month", () => {
    it("moves only forward: open, closed, final", async () => {
      await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES ('2026-07')`;
      await db()
        .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed', "closedAt" = now() WHERE "period" = '2026-07'`;
      await db()
        .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'final', "finalAt" = now() WHERE "period" = '2026-07'`;

      await expect(
        db().$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed' WHERE "period" = '2026-07'`,
      ).rejects.toThrow(/moving final → closed is not allowed/);
      await expect(
        db().$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'open' WHERE "period" = '2026-07'`,
      ).rejects.toThrow(/moving final → open is not allowed/);
    });

    it("cannot go from closed back to open, or from open straight to final", async () => {
      await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES ('2026-06')`;
      await expect(
        db().$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'final' WHERE "period" = '2026-06'`,
      ).rejects.toThrow(/moving open → final is not allowed/);
      await db()
        .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed', "closedAt" = now() WHERE "period" = '2026-06'`;
      await expect(
        db().$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'open' WHERE "period" = '2026-06'`,
      ).rejects.toThrow(/moving closed → open is not allowed/);
    });

    it("is never deleted, and changes only when its state moves", async () => {
      await expect(db().$executeRaw`DELETE FROM "LedgerPeriod" WHERE "period" = '2026-11'`).rejects.toThrow(
        /LedgerPeriod rows are never deleted/,
      );
      await expect(
        db().$executeRaw`UPDATE "LedgerPeriod" SET "createdAt" = now() WHERE "period" = '2026-11'`,
      ).rejects.toThrow(/a row changes only when its state moves/);
    });

    it("is refused a name that is not YYYY-MM", async () => {
      for (const period of ["2026-13", "2026-00", "26-11", "2026-1", "2026-11-01", "November"]) {
        await expect(
          db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES (${period})`,
        ).rejects.toThrow(/LedgerPeriod_period_check/);
      }
    });
  });

  describe("a line", () => {
    it("ties a maker's account to that maker", async () => {
      const maker = await newMaker();
      const other = await newMaker();
      const pool: LineValues = { account: "pool:premium:2026-11", amount: -50n };

      // A maker's own account, naming that maker.
      await expect(
        postRaw([{ account: `maker:${maker}:payable`, amount: 50n, makerUserId: maker }, pool]),
      ).resolves.toBeDefined();

      // Another maker's id on it, or none at all.
      for (const makerUserId of [other, null]) {
        await expect(
          postRaw([{ account: `maker:${maker}:payable`, amount: 50n, makerUserId }, pool]),
        ).rejects.toThrow(/JournalLine_maker_check/);
      }
      // A maker's account that is not the payable one.
      await expect(
        postRaw([{ account: `maker:${maker}:pending`, amount: 50n, makerUserId: maker }, pool]),
      ).rejects.toThrow(/JournalLine_maker_check/);
    });

    it("names no maker on an account that is not a maker's", async () => {
      const maker = await newMaker();
      await expect(
        postRaw([
          { account: "pool:premium:2026-11", amount: 50n, makerUserId: maker },
          { account: "platform:cash", amount: -50n },
        ]),
      ).rejects.toThrow(/JournalLine_maker_check/);
    });
  });
});
