import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { GitHub } from "../../../src/features/games/github.ts";
import { newPublicId } from "../../../src/features/games/ids.ts";
import { createGamesService, type GamesService } from "../../../src/features/games/service.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { decisionsOff } from "../../support/decisions-off.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";
import { tarGz } from "../../support/tar.ts";
import { TestClock } from "../../support/test-clock.ts";

// A live game's videos and rating (unit A of the everything-editable spec): a change is held apart from what players
// see, goes for review in the same save, and only staff's yes makes it live. Staff's yes is for the look they made.

const SHA = "0123456789abcdef0123456789abcdef01234567";

let database: TestDatabase | undefined;
let clock: TestClock;
let files: MemoryFileStore;
let service: GamesService;

const github: GitHub = {
  commitOf: () => Promise.resolve(SHA),
  branchesOf: () => Promise.resolve([]),
  installationOf: () => Promise.resolve(null),
  tarball: async () =>
    new Blob([await tarGz([{ path: "top/index.html", content: "<html></html>" }])]).stream(),
};

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

beforeEach(() => {
  clock = new TestClock("2026-11-21T12:00:00Z");
  files = new MemoryFileStore();
  service = createGamesService({ db: db(), clock, files, github, schedule: decisionsOff });
});

let made = 0;

function mp4Bytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]);
  return bytes;
}

/** A game that is live on its first files and both videos, rated 12+. */
async function liveGame() {
  made += 1;
  const makerUserId = await createUser(db());
  const game = await db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `held-game-${String(made)}`,
      makerUserId,
      name: "A game",
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
      ageRating: "age_12",
    },
  });
  const pull = await db().gamePull.create({
    data: {
      id: crypto.randomUUID(),
      gameId: game.id,
      commitSha: "a".repeat(40),
      fileCount: 3,
      totalBytes: 1000n,
      connectHosts: [],
      pulledAt: new Date(clock.epochMs()),
    },
  });
  for (const shape of ["upright", "wide"] as const)
    await service.saveClip(game.id, shape, { contentType: "video/mp4", bytes: mp4Bytes() });
  await service.sendForReview(game.id, makerUserId);
  await service.accept(game.id, await createUser(db()));
  clock.advance(1_000);
  return { ...game, makerUserId, pullId: pull.id };
}

async function stateOf(gameId: string) {
  return db().game.findUniqueOrThrow({ where: { id: gameId } });
}

async function newVideo(game: { id: string }, shape: "upright" | "wide" = "wide") {
  clock.advance(1_000);
  await service.saveClip(game.id, shape, { contentType: "video/mp4", bytes: mp4Bytes() });
  return db().gameHeldClip.findUniqueOrThrow({ where: { gameId_shape: { gameId: game.id, shape } } });
}

/** The time staff's look carries back with a yes. */
async function lookOf(slug: string): Promise<string> {
  const looked = await service.gameForReview(slug);
  if (looked?.changedAt == null) throw new Error("the game has no change time");
  return looked.changedAt.toISOString();
}

describe("a live game's new video", () => {
  it("replaces the one that was held before, and deletes that file", async () => {
    const game = await liveGame();
    const first = await newVideo(game);

    const second = await newVideo(game);

    expect(await db().gameHeldClip.count({ where: { gameId: game.id } })).toBe(1);
    expect(second.key).not.toBe(first.key);
    expect(files.keys()).not.toContain(first.key);
    expect(files.keys()).toContain(second.key);
  });
});

describe("a live game's new rating", () => {
  it("holds nothing, and sends nothing, when the rating saved is the one that is live", async () => {
    const game = await liveGame();
    const before = await stateOf(game.id);

    await service.saveAnswer(game.id, game.makerUserId, { question: "age", ageRating: "age_12" });

    expect(await stateOf(game.id)).toMatchObject({
      heldAgeRating: null,
      pendingPullId: before.pendingPullId,
    });
  });
});

describe("staff's look and their yes", () => {
  it("refuses a yes with no look, and a yes for a look the maker has changed since, and changes nothing", async () => {
    const game = await liveGame();
    await newVideo(game);
    const looked = await lookOf(game.slug);
    const staff = await createUser(db());
    const before = await stateOf(game.id);

    await expect(service.accept(game.id, staff)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "It changed since you looked. Look again.",
    });
    await newVideo(game);
    await expect(service.accept(game.id, staff, looked)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "It changed since you looked. Look again.",
    });

    const after = await stateOf(game.id);
    expect(after).toMatchObject({ state: "live", livePullId: before.livePullId });
    expect(after.pendingPullId).toBe(before.pendingPullId);
    expect(await db().gameHeldClip.count({ where: { gameId: game.id } })).toBe(1);
    expect(await db().gameReview.count({ where: { gameId: game.id, decision: "accepted" } })).toBe(1);

    // A second look, and a yes with its own time, makes the last video live.
    const last = await db().gameHeldClip.findUniqueOrThrow({
      where: { gameId_shape: { gameId: game.id, shape: "wide" } },
    });
    await service.accept(game.id, staff, await lookOf(game.slug));
    expect(
      (await db().gameClip.findUniqueOrThrow({ where: { gameId_shape: { gameId: game.id, shape: "wide" } } }))
        .key,
    ).toBe(last.key);
  });

  // A7: the yes is one transaction, so a failure part way leaves every live and held value exactly as it was.
  it("leaves the video, rating, held values and live copy as they were when the yes fails part way", async () => {
    const game = await liveGame();
    await newVideo(game);
    await service.saveAnswer(game.id, game.makerUserId, { question: "age", ageRating: "age_16" });
    const looked = await lookOf(game.slug);
    const before = await stateOf(game.id);
    const clipBefore = await db().gameClip.findUniqueOrThrow({
      where: { gameId_shape: { gameId: game.id, shape: "wide" } },
    });
    const heldBefore = await db().gameHeldClip.findUniqueOrThrow({
      where: { gameId_shape: { gameId: game.id, shape: "wide" } },
    });
    // The live row the held video would replace is gone, so the swap fails after the game's own row was changed.
    await db().$executeRaw`DELETE FROM "GameClip" WHERE "id" = ${clipBefore.id}`;

    await expect(service.accept(game.id, await createUser(db()), looked)).rejects.toThrow();

    expect(await stateOf(game.id)).toEqual(before);
    expect(await db().gameHeldClip.findUniqueOrThrow({ where: { id: heldBefore.id } })).toEqual(heldBefore);
    expect(files.keys()).toContain(heldBefore.key);
    expect(await db().gameReview.count({ where: { gameId: game.id, decision: "accepted" } })).toBe(1);
  });
});

describe("Keep the old one", () => {
  it("changes nothing when nothing is held, so a second press is the same as the first", async () => {
    const game = await liveGame();
    await newVideo(game);
    await service.keepTheOldOne(game.id, game.makerUserId, "wide_video");
    const once = await stateOf(game.id);

    await service.keepTheOldOne(game.id, game.makerUserId, "wide_video");

    expect(await stateOf(game.id)).toEqual(once);
  });

  it("is the maker's own: another person's game is not found, and nothing is dropped", async () => {
    const game = await liveGame();
    await newVideo(game);
    const stranger = await createUser(db());

    await expect(service.keepTheOldOne(game.id, stranger, "wide_video")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(await db().gameHeldClip.count({ where: { gameId: game.id } })).toBe(1);
  });
});

describe("Your games, after the old one was kept", () => {
  it("still asks to send it again when what was sent back is a line", async () => {
    const game = await liveGame();
    await newVideo(game);
    await service.sendBack(game.id, await createUser(db()), [
      { part: "one_line", reason: "something_else", note: "Say more." },
    ]);
    await service.keepTheOldOne(game.id, game.makerUserId, "wide_video");
    await db().game.update({ where: { id: game.id }, data: { toFix: [] } });

    expect((await service.gamesOf(game.makerUserId)).find((one) => one.slug === game.slug)?.words).toBe(
      "Live. Your update is fixed. Send it again.",
    );
  });
});

describe("taking a live game off", () => {
  // A8: only a live game may hold a change, so taking it off clears the held rows, columns and files.
  it("leaves no held clip, no held column and no held file", async () => {
    const game = await liveGame();
    const held = await newVideo(game);
    await service.saveAnswer(game.id, game.makerUserId, { question: "age", ageRating: "age_16" });

    await service.takeOff(game.id, game.makerUserId);

    expect(await db().gameHeldClip.count({ where: { gameId: game.id } })).toBe(0);
    expect(await stateOf(game.id)).toMatchObject({
      state: "taken_off",
      heldAgeRating: null,
      heldContentMarks: [],
    });
    expect(files.keys()).not.toContain(held.key);
  });
});

/**
 * Holds the game's row as staff's yes does, starts `run`, waits until it is stuck on that lock, then makes the yes: the
 * held video becomes the live one and its held row goes. What `run` read before the lock is exactly what it would get
 * wrong, so this is the order the code must survive. Returns what `run` ended with.
 */
async function runWhileAYesIsBeingMade(
  game: { id: string },
  held: { id: string; key: string; contentType: string; bytes: number },
  run: () => Promise<unknown>,
): Promise<PromiseSettledResult<unknown>> {
  if (database === undefined) throw new Error("the database did not start");
  // A connection of its own: the client's pool is small, and the racing call needs its share of it.
  const staff = new pg.Client({ connectionString: database.url });
  await staff.connect();
  try {
    await staff.query("BEGIN");
    await staff.query('SELECT "id" FROM "Game" WHERE "id" = $1 FOR UPDATE', [game.id]);
    const racer = run();
    // Readiness, not a guess: someone is stuck on a lock when the server shows it.
    for (let tries = 0; ; tries += 1) {
      const waiting = await staff.query<{ n: string }>(
        "SELECT count(*) AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()",
      );
      if (Number(waiting.rows[0]?.n ?? 0) > 0) break;
      if (tries > 400) throw new Error("nothing is waiting for the game's lock");
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    // What a yes does to a held video: it becomes the live one and its held row goes.
    await staff.query(
      'UPDATE "GameClip" SET "key" = $1, "contentType" = $2, "bytes" = $3 WHERE "gameId" = $4 AND "shape" = \'wide\'',
      [held.key, held.contentType, held.bytes, game.id],
    );
    await staff.query('DELETE FROM "GameHeldClip" WHERE "id" = $1', [held.id]);
    await staff.query("COMMIT");
    const [outcome] = await Promise.allSettled([racer]);
    return outcome;
  } finally {
    await staff.end();
  }
}

async function liveWideFile(gameId: string): Promise<string> {
  return (await db().gameClip.findUniqueOrThrow({ where: { gameId_shape: { gameId, shape: "wide" } } })).key;
}

describe("a yes that lands while the maker is changing the game", () => {
  it("never deletes the video it made live, when the maker saved another video at the same time", async () => {
    const game = await liveGame();
    const held = await newVideo(game);

    const outcome = await runWhileAYesIsBeingMade(game, held, () =>
      service.saveClip(game.id, "wide", { contentType: "video/mp4", bytes: mp4Bytes() }),
    );

    expect(outcome.status).toBe("fulfilled");
    const live = await liveWideFile(game.id);
    expect(live).toBe(held.key);
    expect(files.keys()).toContain(live);
    const waiting = await db().gameHeldClip.findUniqueOrThrow({
      where: { gameId_shape: { gameId: game.id, shape: "wide" } },
    });
    expect(waiting.key).not.toBe(live);
    expect(files.keys()).toContain(waiting.key);
  });

  it("keeps the video it made live when the maker takes the game off at the same time, for Put it back", async () => {
    const game = await liveGame();
    const held = await newVideo(game);

    const outcome = await runWhileAYesIsBeingMade(game, held, () =>
      service.takeOff(game.id, game.makerUserId),
    );

    expect(outcome.status).toBe("fulfilled");
    expect(await stateOf(game.id)).toMatchObject({ state: "taken_off", heldAgeRating: null });
    expect(await db().gameHeldClip.count({ where: { gameId: game.id } })).toBe(0);
    expect(files.keys()).toContain(await liveWideFile(game.id));
  });

  it("does not fail, and does not drop the video it made live, when the maker keeps the old one at the same time", async () => {
    const game = await liveGame();
    const held = await newVideo(game);

    const outcome = await runWhileAYesIsBeingMade(game, held, () =>
      service.keepTheOldOne(game.id, game.makerUserId, "wide_video"),
    );

    expect(outcome.status).toBe("fulfilled");
    expect(await liveWideFile(game.id)).toBe(held.key);
    expect(files.keys()).toContain(held.key);
  });
});

describe("another person's game", () => {
  it("is not found when its maker's video, rating or keep-the-old-one is asked for by someone else", async () => {
    const game = await liveGame();
    const stranger = await createUser(db());

    await expect(
      service.saveAnswer(game.id, stranger, { question: "age", ageRating: "age_16" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await stateOf(game.id)).toMatchObject({ heldAgeRating: null });
  });
});
