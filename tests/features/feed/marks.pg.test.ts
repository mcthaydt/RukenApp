import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMarks, type Marks } from "../../../src/features/feed/marks.ts";
import { newPublicId } from "../../../src/features/games/ids.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// Like, Save and Repost against Postgres (learned-feed spec, unit G1): one row per person, game and kind; pressing
// again takes it back; a maker may mark their own game; a count is a count of rows.

let database: TestDatabase | undefined;
const clock = new TestClock("2026-11-27T12:00:00Z");
let marks: Marks;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  marks = createMarks({ db: db(), clock });
});

afterAll(async () => {
  await database?.stop();
});

let made = 0;

async function newGame() {
  made += 1;
  const makerUserId = await createUser(db());
  return db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `marked-${String(made)}`,
      makerUserId,
      name: `Game ${String(made)}`,
    },
    select: { id: true, slug: true, makerUserId: true },
  });
}

describe("marks", () => {
  it("turns a like on once, with the clock's time, and off again", async () => {
    const player = await createUser(db());
    const game = await newGame();

    expect(await marks.set(player, game, "like", true)).toEqual({ on: true, likes: 1 });
    expect(await marks.set(player, game, "like", true)).toEqual({ on: true, likes: 1 });
    expect(await db().gameMark.findMany({ where: { userId: player } })).toMatchObject([
      { gameId: game.id, kind: "like", madeAt: new Date(clock.epochMs()) },
    ]);

    expect(await marks.set(player, game, "like", false)).toEqual({ on: false, likes: 0 });
    expect(await marks.set(player, game, "like", false)).toEqual({ on: false, likes: 0 });
    expect(await db().gameMark.count({ where: { userId: player } })).toBe(0);
  });

  it("makes one row from two presses at the same moment", async () => {
    const player = await createUser(db());
    const game = await newGame();
    await Promise.all([marks.set(player, game, "save", true), marks.set(player, game, "save", true)]);
    expect(await db().gameMark.count({ where: { userId: player, gameId: game.id } })).toBe(1);
  });

  it("keeps like, save and repost apart, and counts only likes, from every person", async () => {
    const game = await newGame();
    const one = await createUser(db());
    const two = await createUser(db());
    await marks.set(one, game, "like", true);
    await marks.set(one, game, "save", true);
    await marks.set(two, game, "repost", true);
    expect(await marks.set(two, game, "like", true)).toEqual({ on: true, likes: 2 });

    const seen = await marks.ofClips(one, [game]);
    expect(seen.get(game.id)).toEqual({ likes: 2, liked: true, saved: true, reposted: false });
    const signedOut = await marks.ofClips(null, [game]);
    expect(signedOut.get(game.id)).toEqual({
      likes: 2,
      liked: false,
      saved: false,
      reposted: false,
    });
  });

  it("lets a maker like, save and repost their own game", async () => {
    const game = await newGame();
    expect(await marks.set(game.makerUserId, game, "like", true)).toEqual({ on: true, likes: 1 });
    await marks.set(game.makerUserId, game, "save", true);
    await marks.set(game.makerUserId, game, "repost", true);
    expect((await marks.ofClips(game.makerUserId, [game])).get(game.id)).toEqual({
      likes: 1,
      liked: true,
      saved: true,
      reposted: true,
    });
  });

  it("lists saves and reposts apart, the latest first, and takes one off by the game's address", async () => {
    const player = await createUser(db());
    const first = await newGame();
    const second = await newGame();
    await marks.set(player, first, "save", true);
    clock.advance(1000);
    await marks.set(player, second, "save", true);
    await marks.set(player, first, "repost", true);

    expect(await marks.gameIdsOf(player, "save")).toEqual([second.id, first.id]);
    expect(await marks.gameIdsOf(player, "repost")).toEqual([first.id]);

    await marks.takeOff(player, second.slug, "save");
    expect(await marks.gameIdsOf(player, "save")).toEqual([first.id]);
    expect(await marks.gameIdsOf(player, "repost")).toEqual([first.id]);
  });

  it("the table refuses a second row for the same person, game and kind, and an unknown kind", async () => {
    const player = await createUser(db());
    const game = await newGame();
    const row = { userId: player, gameId: game.id, kind: "like" as const, madeAt: new Date(clock.epochMs()) };
    await db().gameMark.create({ data: row });
    await expect(db().gameMark.create({ data: row })).rejects.toThrow();
    await expect(
      db().$executeRaw`INSERT INTO "GameMark" ("id", "userId", "gameId", "kind", "madeAt")
        VALUES ('x', ${player}, ${game.id}, 'follow', now())`,
    ).rejects.toThrow();
  });
});
