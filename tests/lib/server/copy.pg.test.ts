import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { claimCopy, stampedCopy, type RunSql } from "../../../src/lib/server/copy.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// The stamp is read and written through plain SQL, as the deploy command does, so these tests check what the
// database itself keeps and refuses, whatever the application code does.

let database: TestDatabase | undefined;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

const run: RunSql = (sql, values) => db().$queryRawUnsafe(sql, ...values);

async function stampRows(): Promise<number> {
  const rows = await db().$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM "CopyStamp"`;
  return Number(rows[0]?.count);
}

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.stop();
});

// The add-only trigger refuses a DELETE too, so each test starts from an unstamped table by switching it off for
// that one statement. Only the tests do this; nothing in the site can.
beforeEach(async () => {
  await db().$executeRawUnsafe(`ALTER TABLE "CopyStamp" DISABLE TRIGGER "CopyStamp_append_only"`);
  await db().$executeRawUnsafe(`DELETE FROM "CopyStamp"`);
  await db().$executeRawUnsafe(`ALTER TABLE "CopyStamp" ENABLE TRIGGER "CopyStamp_append_only"`);
});

describe("the database's stamp", () => {
  it("is missing on a new database", async () => {
    expect(await stampedCopy(run)).toBeNull();
  });

  it("reads the copy that claimed it", async () => {
    await claimCopy(run, "test");
    expect(await stampedCopy(run)).toBe("test");
  });

  it("can be claimed again by the same copy, and stays one row", async () => {
    await claimCopy(run, "test");
    await expect(claimCopy(run, "test")).resolves.toBeUndefined();
    expect(await stampRows()).toBe(1);
  });

  it("refuses the other copy and changes nothing", async () => {
    await claimCopy(run, "test");
    await expect(claimCopy(run, "live")).rejects.toThrow(
      "This database belongs to the test copy of Ruken, and this is the live copy. Nothing was changed.",
    );
    expect(await stampedCopy(run)).toBe("test");
  });

  it("is claimed once when two claims start together", async () => {
    await expect(Promise.all([claimCopy(run, "live"), claimCopy(run, "live")])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    expect(await stampRows()).toBe(1);
  });
});

describe("the CopyStamp table", () => {
  it("cannot have its row changed or deleted", async () => {
    await claimCopy(run, "live");
    await expect(db().$executeRawUnsafe(`UPDATE "CopyStamp" SET "copy" = 'test'`)).rejects.toThrow(
      /CopyStamp is append-only/,
    );
    await expect(db().$executeRawUnsafe(`DELETE FROM "CopyStamp"`)).rejects.toThrow(
      /CopyStamp is append-only/,
    );
  });

  it("holds one row only", async () => {
    await expect(
      db().$executeRawUnsafe(`INSERT INTO "CopyStamp" ("id", "copy") VALUES (2, 'live')`),
    ).rejects.toThrow(/CopyStamp_one_row/);
  });

  it("holds test or live, nothing else", async () => {
    await expect(
      db().$executeRawUnsafe(`INSERT INTO "CopyStamp" ("id", "copy") VALUES (1, 'prod')`),
    ).rejects.toThrow(/CopyStamp_copy_check/);
  });
});
