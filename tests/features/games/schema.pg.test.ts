import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// These tests use plain SQL on purpose: they check what the database itself refuses (the CHECK rules,
// the append-only trigger, the unique keys), whatever the application code does.

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

async function newMaker(): Promise<string> {
  counter += 1;
  const user = await db().user.create({
    data: { name: "Maker", email: `maker-${String(counter)}@example.test` },
  });
  return user.id;
}

/** The values a test may change; everything else is a plain, valid game. */
interface GameValues {
  publicId?: string;
  slug?: string;
  repoFolder?: string;
  state?: "draft" | "live";
  livePullId?: string | null;
}

/** One game row, by plain SQL, so a test can offer the database values the application would never make. */
async function insertGame(makerUserId: string, values: GameValues = {}): Promise<string> {
  counter += 1;
  const id = randomUUID();
  const publicId = values.publicId ?? "abcdefghij";
  const slug = values.slug ?? `game-${String(counter)}`;
  const repoFolder = values.repoFolder ?? "";
  const state = values.state ?? "draft";
  const livePullId = values.livePullId ?? null;
  await db().$executeRaw`
    INSERT INTO "Game"
      ("id", "publicId", "slug", "makerUserId", "name", "oneLine", "playsOn", "state", "repoFullName",
       "repoFolder", "livePullId", "updatedAt")
    VALUES
      (${id}, ${publicId}, ${slug}, ${makerUserId}, 'A game', 'A game about a thing.',
       'phone_and_computer'::"GamePlaysOn", ${state}::"GameState", 'acme/game', ${repoFolder}, ${livePullId},
       now())`;
  return id;
}

/** One pull row; the commit and the counts are the ones a test may want to spoil. */
async function insertPull(input: {
  gameId: string;
  commitSha?: string;
  fileCount?: number;
  totalBytes?: bigint;
}): Promise<string> {
  const id = randomUUID();
  const commitSha = input.commitSha ?? "a".repeat(40);
  const fileCount = input.fileCount ?? 3;
  const totalBytes = input.totalBytes ?? 1_000n;
  await db().$executeRaw`
    INSERT INTO "GamePull"
      ("id", "gameId", "commitSha", "fileCount", "totalBytes", "connectHosts", "pulledAt")
    VALUES
      (${id}, ${input.gameId}, ${commitSha}, ${fileCount}, ${totalBytes}, ARRAY[]::TEXT[], now())`;
  return id;
}

async function insertClip(gameId: string, shape: "upright" | "wide", key: string): Promise<void> {
  await db().$executeRaw`
    INSERT INTO "GameClip" ("id", "gameId", "shape", "key", "contentType", "bytes", "updatedAt")
    VALUES (${randomUUID()}, ${gameId}, ${shape}::"ClipShape", ${key}, 'video/mp4', 1000, now())`;
}

describe("the games tables", () => {
  it("are made by the migrations", async () => {
    const rows = await db().$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    expect(rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(["Game", "GamePull", "GameClip"]),
    );
  });

  describe("a game", () => {
    it("is refused a public id that is not ten characters of a-z and 2-7", async () => {
      const makerId = await newMaker();
      for (const publicId of ["FLOOR50", "abcdefghi1", "abcdefghi", "abcdefghijk"]) {
        await expect(insertGame(makerId, { publicId })).rejects.toThrow(/Game_publicId_check/);
      }
    });

    it("is refused a slug with a slash, a capital or a space", async () => {
      const makerId = await newMaker();
      for (const slug of ["a/b/c", "Floor-fifty", "floor fifty", "-floor", "floor-", "fl", "a".repeat(41)]) {
        await expect(insertGame(makerId, { slug })).rejects.toThrow(/Game_slug_check/);
      }
    });

    it("is refused a folder that climbs out of the repository", async () => {
      const makerId = await newMaker();
      for (const repoFolder of ["../x", "/x", "x/", "a/../b", "x".repeat(201)]) {
        await expect(insertGame(makerId, { repoFolder })).rejects.toThrow(/Game_repoFolder_check/);
      }
      await insertGame(makerId, { repoFolder: "", publicId: "aaaaaaaaaa" });
      await insertGame(makerId, { repoFolder: "web/build", publicId: "bbbbbbbbbb" });
    });

    it("is refused to be live with no files", async () => {
      const makerId = await newMaker();
      await expect(insertGame(makerId, { state: "live", livePullId: null })).rejects.toThrow(
        /Game_live_check/,
      );
    });

    it("keeps its public id and its address to itself", async () => {
      const makerId = await newMaker();
      await insertGame(makerId, { publicId: "cccccccccc", slug: "the-one" });
      await expect(insertGame(makerId, { publicId: "cccccccccc", slug: "another" })).rejects.toThrow(
        /Game_publicId_key/,
      );
      await expect(insertGame(makerId, { publicId: "dddddddddd", slug: "the-one" })).rejects.toThrow(
        /Game_slug_key/,
      );
    });
  });

  describe("a pull", () => {
    it("cannot be changed or deleted", async () => {
      const makerId = await newMaker();
      const gameId = await insertGame(makerId, { publicId: "eeeeeeeeee" });
      await insertPull({ gameId });
      await expect(db().$executeRaw`UPDATE "GamePull" SET "fileCount" = 99`).rejects.toThrow(
        /GamePull is append-only/,
      );
      await expect(db().$executeRaw`DELETE FROM "GamePull"`).rejects.toThrow(/GamePull is append-only/);
    });

    it("is refused a commit that is not 40 hex characters", async () => {
      const makerId = await newMaker();
      const gameId = await insertGame(makerId, { publicId: "ffffffffff" });
      for (const commitSha of ["main", "A".repeat(40), "a".repeat(39)]) {
        await expect(insertPull({ gameId, commitSha })).rejects.toThrow(/GamePull_commitSha_check/);
      }
    });

    it("is refused for a game of nothing", async () => {
      const makerId = await newMaker();
      const gameId = await insertGame(makerId, { publicId: "gggggggggg" });
      await expect(insertPull({ gameId, fileCount: 0 })).rejects.toThrow(/GamePull_counts_check/);
      await expect(insertPull({ gameId, totalBytes: 0n })).rejects.toThrow(/GamePull_counts_check/);
    });

    it("can be the files a game is live on", async () => {
      const makerId = await newMaker();
      const gameId = await insertGame(makerId, { publicId: "hhhhhhhhhh" });
      const pullId = await insertPull({ gameId });
      await db()
        .$executeRaw`UPDATE "Game" SET "state" = 'live', "livePullId" = ${pullId} WHERE "id" = ${gameId}`;
      const rows = await db().$queryRaw<
        { state: string }[]
      >`SELECT "state"::text FROM "Game" WHERE "id" = ${gameId}`;
      expect(rows).toEqual([{ state: "live" }]);
    });
  });

  describe("a clip", () => {
    it("is kept once per shape per game", async () => {
      const makerId = await newMaker();
      const gameId = await insertGame(makerId, { publicId: "iiiiiiiiii" });
      await insertClip(gameId, "upright", "clips/iiiiiiiiii/upright-0000000000000001.mp4");
      await insertClip(gameId, "wide", "clips/iiiiiiiiii/wide-0000000000000002.mp4");
      await expect(
        insertClip(gameId, "upright", "clips/iiiiiiiiii/upright-0000000000000003.mp4"),
      ).rejects.toThrow(/GameClip_gameId_shape_key/);
    });
  });
});
