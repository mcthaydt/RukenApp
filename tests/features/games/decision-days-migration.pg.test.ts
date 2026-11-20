import { randomBytes, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPublicId } from "../../../src/features/games/ids.ts";

// The migration that stores decision days also marks every game that was ever accepted as having seen its Accepted
// screen, so none of them shows it. To test that, the earlier migrations are run first, the games are made, and only
// then is this one run: the way a deploy meets the test site's real rows.

const MIGRATIONS = fileURLToPath(new URL("../../../prisma/migrations/", import.meta.url));
const THIS_ONE = "decision_days";

let admin: pg.Client;
let client: pg.Client;
let name: string;
let runAt: Date;
const games: Record<string, string> = {};

function migrationFolders(): string[] {
  return readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function id(): string {
  return randomUUID();
}

beforeAll(async () => {
  const serverUrl = process.env.TEST_DATABASE_URL;
  if (serverUrl === undefined || serverUrl === "") throw new Error("TEST_DATABASE_URL is not set.");
  name = `ruken_test_${randomBytes(8).toString("hex")}`;
  admin = new pg.Client({ connectionString: serverUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  client = new pg.Client({ connectionString: url.toString() });
  await client.connect();

  const folders = migrationFolders();
  const mine = folders.filter((folder) => folder.endsWith(`_${THIS_ONE}`));
  expect(mine).toHaveLength(1);
  for (const folder of folders.filter((folder) => !folder.endsWith(`_${THIS_ONE}`))) {
    await client.query(readFileSync(`${MIGRATIONS}${folder}/migration.sql`, "utf8"));
  }

  const maker = id();
  await client.query(
    `INSERT INTO "User" ("id", "name", "email", "updatedAt") VALUES ($1, 'Maker', 'maker@example.test', now())`,
    [maker],
  );
  // One game in each state, each with the reviews that put it there.
  const makeGame = async (key: string, state: string, decisions: string[]): Promise<void> => {
    const gameId = id();
    const pullId = id();
    games[key] = gameId;
    await client.query(
      `INSERT INTO "Game" ("id", "publicId", "slug", "makerUserId", "name", "oneLine", "playsOn", "state",
         "repoFullName", "ageRating", "updatedAt")
       VALUES ($1, $2, $3, $4, 'G', 'A game.', 'phone_and_computer', 'waiting', 'acme/g', 'age_12', now())`,
      [gameId, newPublicId(), `game-${key.toLowerCase()}`, maker],
    );
    await client.query(
      `INSERT INTO "GamePull" ("id", "gameId", "commitSha", "fileCount", "totalBytes", "connectHosts", "pulledAt")
       VALUES ($1, $2, $3, 1, 1, '{}', now())`,
      [pullId, gameId, "a".repeat(40)],
    );
    if (state === "live") {
      await client.query(`UPDATE "Game" SET "state" = 'live', "livePullId" = $2 WHERE "id" = $1`, [
        gameId,
        pullId,
      ]);
    } else if (state !== "waiting") {
      await client.query(`UPDATE "Game" SET "state" = $2::"GameState" WHERE "id" = $1`, [gameId, state]);
    }
    for (const decision of decisions) {
      await client.query(
        `INSERT INTO "GameReview" ("id", "gameId", "pullId", "staffUserId", "decision", "decidedAt")
         VALUES ($1, $2, $3, $4, $5::"ReviewDecision", now())`,
        [id(), gameId, pullId, maker, decision],
      );
    }
  };
  await makeGame("live", "live", ["accepted"]);
  await makeGame("takenOff", "taken_off", ["accepted"]);
  await makeGame("backAndIn", "live", ["sent_back", "accepted"]);
  await makeGame("sentBack", "sent_back", ["sent_back"]);
  await makeGame("waiting", "waiting", []);

  runAt = new Date();
  await client.query(readFileSync(`${MIGRATIONS}${mine[0] ?? ""}/migration.sql`, "utf8"));
});

afterAll(async () => {
  await client.end();
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.end();
});

async function seen(key: string): Promise<Date | null> {
  const result = await client.query<{ acceptedSeenAt: Date | null }>(
    `SELECT "acceptedSeenAt" FROM "Game" WHERE "id" = $1`,
    [games[key] ?? ""],
  );
  return result.rows[0]?.acceptedSeenAt ?? null;
}

describe("the decision days migration", () => {
  it("marks a live game that was accepted as having seen its Accepted screen, at the migration's time", async () => {
    const at = await seen("live");
    expect(at).toBeInstanceOf(Date);
    const time = at?.getTime() ?? 0;
    expect(time).toBeGreaterThanOrEqual(runAt.getTime() - 1000);
    expect(time).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("marks a game that was accepted and then taken off", async () => {
    expect(await seen("takenOff")).not.toBeNull();
  });

  it("marks a game that was sent back and then accepted", async () => {
    expect(await seen("backAndIn")).not.toBeNull();
  });

  it("leaves a game that was never accepted empty", async () => {
    expect(await seen("sentBack")).toBeNull();
    expect(await seen("waiting")).toBeNull();
  });

  it("leaves every decision made before it as one that took effect at once", async () => {
    const result = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM "GameReview" WHERE "goesOutOn" IS NOT NULL`,
    );
    expect(result.rows[0]?.n).toBe("0");
  });
});
