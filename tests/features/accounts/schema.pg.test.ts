import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// The phone sign-in tables. Plain SQL on purpose: these check what the database itself refuses, whatever the
// application code does.

let database: TestDatabase | undefined;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.stop();
});

let made = 0;
function nextEmail(): string {
  made += 1;
  return `schema-${String(made)}@phone.ruken.invalid`;
}

async function insertUser(phoneNumber: string | null): Promise<void> {
  const email = nextEmail();
  await db().$executeRaw`
    INSERT INTO "User" ("id", "name", "email", "phoneNumber", "updatedAt")
    VALUES (${email}, 'Player', ${email}, ${phoneNumber}, now())`;
}

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);

describe("a phone number on a user", () => {
  it("is refused a second time", async () => {
    await insertUser("+13125551001");
    await expect(insertUser("+13125551001")).rejects.toThrow(/User_phoneNumber_key/);
  });

  it("must be a plus and 8 to 15 digits", async () => {
    await expect(insertUser("3125550142")).rejects.toThrow(/User_phoneNumber_check/);
    await expect(insertUser("+1312")).rejects.toThrow(/User_phoneNumber_check/);
    await expect(insertUser("+1 312 555 0142")).rejects.toThrow(/User_phoneNumber_check/);
  });

  it("may be missing on any number of users", async () => {
    await insertUser(null);
    await insertUser(null);
    const rows = await db().$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "User" WHERE "phoneNumber" IS NULL`;
    expect(Number(rows[0]?.n)).toBeGreaterThanOrEqual(2);
  });

  it("starts unconfirmed, with no paper email", async () => {
    const id = await createUser(db());
    const user = await db().user.findUniqueOrThrow({ where: { id } });
    expect(user.phoneNumberVerified).toBe(false);
    expect(user.phoneConfirmedAt).toBeNull();
    expect(user.paperEmail).toBeNull();
  });
});

describe("a pending sign-up", () => {
  async function insertPending(numberHash: string, browserHash: string): Promise<void> {
    await db().$executeRaw`
      INSERT INTO "PendingSignUp" ("numberHash", "browserHash", "passwordHash", "adultOn", "expiresAt")
      VALUES (${numberHash}, ${browserHash}, 'hash', '2000-01-01', now() + interval '10 minutes')`;
  }

  it("lets two browsers start for the same number", async () => {
    await insertPending(HASH, "1".repeat(64));
    await insertPending(HASH, "2".repeat(64));
  });

  it("refuses a second row for the same number and browser", async () => {
    await insertPending(OTHER_HASH, "3".repeat(64));
    await expect(insertPending(OTHER_HASH, "3".repeat(64))).rejects.toThrow(/PendingSignUp_pkey/);
  });
});

describe("the sign-in guard", () => {
  it("is keyed by numberHash, and has no emailHash", async () => {
    const columns = await db().$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'SignInGuard'`;
    const names = columns.map((column) => column.column_name);
    expect(names).toContain("numberHash");
    expect(names).not.toContain("emailHash");
  });

  it("refuses a numberHash that is not 64 lower-case hex characters", async () => {
    await expect(
      db().$executeRaw`INSERT INTO "SignInGuard" ("numberHash", failures, "windowStartedAt", "updatedAt")
        VALUES ('nope', 1, now(), now())`,
    ).rejects.toThrow(/SignInGuard_numberHash_check/);
  });
});

describe("a text that was sent", () => {
  async function insertText(userId: string, kind: string, key: string): Promise<string> {
    made += 1;
    const id = `text-${String(made)}`;
    await db().$executeRaw`
      INSERT INTO "TextSent" ("id", "userId", "kind", "key", "line", "sentAt")
      VALUES (${id}, ${userId}, ${kind}, ${key}, 'account', now())`;
    return id;
  }

  it("is refused a second time for the same person, kind and key", async () => {
    const userId = await createUser(db());
    await insertText(userId, "game_out", "g1");
    await expect(insertText(userId, "game_out", "g1")).rejects.toThrow(/TextSent_userId_kind_key_key/);
    await insertText(userId, "game_out", "g2");
  });

  it("can be neither changed nor deleted", async () => {
    const userId = await createUser(db());
    const id = await insertText(userId, "split", "s1");
    await expect(db().$executeRaw`UPDATE "TextSent" SET "line" = 'news' WHERE "id" = ${id}`).rejects.toThrow(
      /TextSent/,
    );
    await expect(db().$executeRaw`DELETE FROM "TextSent" WHERE "id" = ${id}`).rejects.toThrow(/TextSent/);
  });

  it("keeps its person from being deleted", async () => {
    const userId = await createUser(db());
    await insertText(userId, "extra", "e1");
    await expect(db().$executeRaw`DELETE FROM "User" WHERE "id" = ${userId}`).rejects.toThrow(/TextSent_userId_fkey/);
  });
});
