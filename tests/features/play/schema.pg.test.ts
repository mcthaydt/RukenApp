import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPublicId } from "../../../src/features/games/ids.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// Plain SQL on purpose, as for the games tables: these check what the database itself refuses (the CHECK rules and the
// add-only triggers), whatever the application code does.

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

let counter = 0;

/** A person and a game with one pull, which every play row needs to point at. */
async function newGameAndPerson(): Promise<{ userId: string; gameId: string; pullId: string }> {
  counter += 1;
  const user = await db().user.create({
    data: { name: "Person", email: `person-${String(counter)}@example.test` },
  });
  const gameId = randomUUID();
  await db().$executeRaw`
    INSERT INTO "Game"
      ("id", "publicId", "slug", "makerUserId", "name", "oneLine", "playsOn", "repoFullName", "updatedAt")
    VALUES
      (${gameId}, ${newPublicId()}, ${`game-${String(counter)}`}, ${user.id}, 'A game', 'A game about a thing.',
       'phone_and_computer'::"GamePlaysOn", 'acme/game', now())`;
  const pullId = randomUUID();
  await db().$executeRaw`
    INSERT INTO "GamePull" ("id", "gameId", "commitSha", "fileCount", "totalBytes", "connectHosts", "pulledAt")
    VALUES (${pullId}, ${gameId}, ${"a".repeat(40)}, 3, 1000, ARRAY[]::TEXT[], now())`;
  return { userId: user.id, gameId, pullId };
}

type Base = Awaited<ReturnType<typeof newGameAndPerson>>;

/** A pass's own id: 22 characters of base64url, one per call. */
function passId(): string {
  counter += 1;
  return `pass${String(counter).padStart(18, "0")}`;
}

/** One pass, by plain SQL. A test changes the one value it is about; the rest is valid. */
async function insertPass(
  base: Base,
  values: { id?: string; userId?: string | null; hoursLeft?: number } = {},
): Promise<string> {
  const id = values.id ?? passId();
  const userId = values.userId === undefined ? base.userId : values.userId;
  const hoursLeft = values.hoursLeft ?? 24;
  await db().$executeRaw`
    INSERT INTO "PlayPass" ("id", "gameId", "pullId", "userId", "madeAt", "expiresAt")
    VALUES (${id}, ${base.gameId}, ${base.pullId}, ${userId}, now(), now() + ${hoursLeft} * interval '1 hour')`;
  return id;
}

/** One session on a pass. */
async function insertSession(
  base: Base,
  pass: string,
  values: { basis?: string; userId?: string | null; tokenHash?: string } = {},
): Promise<string> {
  const id = randomUUID();
  const basis = values.basis ?? "member";
  const userId = values.userId === undefined ? base.userId : values.userId;
  const tokenHash = values.tokenHash ?? "f".repeat(64);
  await db().$executeRaw`
    INSERT INTO "PlaySession" ("id", "gameId", "pullId", "passId", "userId", "basis", "tokenHash", "startedAt")
    VALUES (${id}, ${base.gameId}, ${base.pullId}, ${pass}, ${userId}, ${basis}::"PlayBasis", ${tokenHash}, now())`;
  return id;
}

async function insertBeat(sessionId: string, attentive = true): Promise<void> {
  await db().$executeRaw`
    INSERT INTO "PlayBeat" ("sessionId", "receivedAt", "attentive") VALUES (${sessionId}, now(), ${attentive})`;
}

describe("the play tables", () => {
  it("are made by the migrations", async () => {
    const rows = await db().$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    expect(rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(["PlayPass", "PlaySession", "PlayBeat"]),
    );
  });

  describe("a pass", () => {
    it("is refused an id that is not 22 characters of base64url", async () => {
      const base = await newGameAndPerson();
      for (const id of [
        "short",
        "a".repeat(21),
        "a".repeat(23),
        `${"a".repeat(21)}!`,
        `${"a".repeat(21)} `,
      ]) {
        await expect(insertPass(base, { id })).rejects.toThrow(/PlayPass_id_check/);
      }
      await insertPass(base, { id: "Az09_-".repeat(3) + "abcd" });
    });

    it("is refused to run out before it was made", async () => {
      const base = await newGameAndPerson();
      await expect(insertPass(base, { hoursLeft: 0 })).rejects.toThrow(/PlayPass_time_check/);
      await expect(insertPass(base, { hoursLeft: -1 })).rejects.toThrow(/PlayPass_time_check/);
    });

    it("may belong to nobody: the one pass of a free game that everyone signed out shares", async () => {
      const base = await newGameAndPerson();
      await expect(insertPass(base, { userId: null })).resolves.toBeDefined();
    });
  });

  describe("a session", () => {
    it("is refused a token hash that is not 64 lower-case hex characters", async () => {
      const base = await newGameAndPerson();
      const pass = await insertPass(base);
      for (const tokenHash of ["", "f".repeat(63), "f".repeat(65), "F".repeat(64), `${"f".repeat(63)}g`]) {
        await expect(insertSession(base, pass, { tokenHash })).rejects.toThrow(/PlaySession_tokenHash_check/);
      }
    });

    // Only a free game is played by nobody.
    it("with nobody signed in is refused for every basis but a free game", async () => {
      const base = await newGameAndPerson();
      const pass = await insertPass(base, { userId: null });
      for (const basis of ["member", "staff", "own_game"]) {
        await expect(insertSession(base, pass, { basis, userId: null })).rejects.toThrow(
          /PlaySession_basis_check/,
        );
      }
      await expect(insertSession(base, pass, { basis: "free_game", userId: null })).resolves.toBeDefined();
    });

    it("with someone signed in takes any basis", async () => {
      const base = await newGameAndPerson();
      const pass = await insertPass(base);
      for (const basis of ["member", "free_game", "staff", "own_game"]) {
        await expect(insertSession(base, pass, { basis })).resolves.toBeDefined();
      }
    });
  });

  describe("a beat", () => {
    it("is numbered in the order it was stored", async () => {
      const base = await newGameAndPerson();
      const session = await insertSession(base, await insertPass(base));
      await insertBeat(session);
      await insertBeat(session, false);
      const rows = await db().$queryRaw<{ id: bigint; attentive: boolean }[]>`
        SELECT "id", "attentive" FROM "PlayBeat" WHERE "sessionId" = ${session} ORDER BY "id"`;
      expect(rows).toHaveLength(2);
      expect(rows[1]?.id).toBeGreaterThan(rows[0]?.id ?? 0n);
      expect(rows.map((row) => row.attentive)).toEqual([true, false]);
    });
  });

  // What was played, by whom and when is a fact the money slice reads, so a row is added and never changed.
  describe("every row is only ever added", () => {
    it.each(["PlayPass", "PlaySession", "PlayBeat"] as const)(
      "%s refuses an update and a delete",
      async (table) => {
        const base = await newGameAndPerson();
        const pass = await insertPass(base);
        const session = await insertSession(base, pass);
        await insertBeat(session);

        const change = {
          PlayPass: `UPDATE "PlayPass" SET "expiresAt" = now() + interval '99 hours' WHERE "id" = '${pass}'`,
          PlaySession: `UPDATE "PlaySession" SET "basis" = 'staff' WHERE "id" = '${session}'`,
          PlayBeat: `UPDATE "PlayBeat" SET "attentive" = false WHERE "sessionId" = '${session}'`,
        }[table];
        await expect(db().$executeRawUnsafe(change)).rejects.toThrow(new RegExp(`${table} is append-only`));
        await expect(db().$executeRawUnsafe(`DELETE FROM "${table}"`)).rejects.toThrow(
          new RegExp(`${table} is append-only`),
        );
      },
    );
  });
});
