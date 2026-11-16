import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { GitHub } from "../../../src/features/games/github.ts";
import { newPublicId } from "../../../src/features/games/ids.ts";
import { createGamesService, type GamesService } from "../../../src/features/games/service.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";
import { tarGz } from "../../support/tar.ts";
import { TestClock } from "../../support/test-clock.ts";

// A maker takes their own live game off Ruken, and puts it back (spec 13.1 M1 and M2). Each step leaves a MakerAction
// row: who, what, when. Putting it back never makes it live without a person's yes.

const SHA = "0123456789abcdef0123456789abcdef01234567";

let database: TestDatabase | undefined;
let clock: TestClock;
let files: MemoryFileStore;
let service: GamesService;
/** The installation GitHub says holds each repository now (the maker's own check, which these tests pass). */
const holding = new Map<string, bigint>();

const github: GitHub = {
  commitOf: () => Promise.resolve(SHA),
  installationOf: (repo) => Promise.resolve(holding.get(repo) ?? null),
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
  clock = new TestClock("2026-12-12T18:00:00Z");
  files = new MemoryFileStore();
  service = createGamesService({ db: db(), clock, files, github });
});

let made = 0;

/** A clip's first bytes as an MP4 has them. */
function mp4Bytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]);
  return bytes;
}

/** A draft game whose maker has connected GitHub, with its files copied and both clips: ready to send. */
async function readyGame() {
  made += 1;
  const makerUserId = await createUser(db());
  const installationId = BigInt(3000 + made);
  await db().gitHubInstallation.create({
    data: {
      userId: makerUserId,
      installationId,
      accountLogin: "acme",
      repositories: { create: [{ fullName: "acme/game", defaultBranch: "main" }] },
    },
  });
  holding.set("acme/game", installationId);
  const game = await db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `take-off-game-${String(made)}`,
      makerUserId,
      name: "Tiny game",
      oneLine: "A tiny game about tapping.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
      ageRating: "age_12",
    },
  });
  await service.pullLatest(game.id);
  await service.saveClip(game.id, "upright", { contentType: "video/mp4", bytes: mp4Bytes() });
  await service.saveClip(game.id, "wide", { contentType: "video/mp4", bytes: mp4Bytes() });
  return { ...game, makerUserId };
}

/** A game staff have said yes to: live on its first files. */
async function liveGame() {
  const game = await readyGame();
  await service.sendForReview(game.id, game.makerUserId);
  const looked = await service.gameForReview(game.slug);
  if (looked === null) throw new Error("the game is not there to look at");
  await service.accept(game.id, await createUser(db()), {
    ageRating: "age_12",
    contentMarks: [],
    seen: looked.seen,
  });
  return game;
}

async function rowOf(gameId: string) {
  return db().game.findUniqueOrThrow({ where: { id: gameId } });
}

function keysOf(publicId: string, folder: "files" | "clips"): string[] {
  return files.keys().filter((key) => key.startsWith(`${folder}/${publicId}/`));
}

describe("takeOff", () => {
  it("takes a live game off Ruken, deletes its files, keeps its clips and records who and when", async () => {
    const game = await liveGame();
    expect(keysOf(game.publicId, "files").length).toBeGreaterThan(0);
    const clips = keysOf(game.publicId, "clips");

    await service.takeOff(game.id, game.makerUserId);

    expect(await rowOf(game.id)).toMatchObject({
      state: "taken_off",
      livePullId: null,
      pendingPullId: null,
      pendingSince: null,
      stateReason: null,
      toFix: [],
    });
    expect(await service.liveGameBySlug(game.slug)).toBeNull();
    expect(keysOf(game.publicId, "files")).toEqual([]);
    expect(keysOf(game.publicId, "clips")).toEqual(clips);
    expect(await db().makerAction.findMany({ where: { gameId: game.id } })).toMatchObject([
      { userId: game.makerUserId, action: "taken_off", at: new Date(clock.epochMs()) },
    ]);
  });

  // Review Focus 8.
  it("drops an update that waits for review, so nothing is left in staff's queue", async () => {
    const game = await liveGame();
    await service.pullLatest(game.id);
    await service.sendForReview(game.id, game.makerUserId);
    expect((await service.waitingGames()).map((one) => one.slug)).toContain(game.slug);

    await service.takeOff(game.id, game.makerUserId);

    expect((await service.waitingGames()).map((one) => one.slug)).not.toContain(game.slug);
    expect((await rowOf(game.id)).pendingPullId).toBeNull();
  });

  it("writes one record however many presses arrive at once", async () => {
    const game = await liveGame();

    const presses = await Promise.allSettled([
      service.takeOff(game.id, game.makerUserId),
      service.takeOff(game.id, game.makerUserId),
    ]);

    expect(presses.filter((press) => press.status === "fulfilled")).toHaveLength(1);
    expect(await db().makerAction.count({ where: { gameId: game.id } })).toBe(1);
  });

  it("stays off when a new version that was being copied is sent after it was taken off", async () => {
    const game = await liveGame();
    await service.pullLatest(game.id);
    await service.takeOff(game.id, game.makerUserId);

    // The send that was waiting for its copy, from another device, arrives now.
    await expect(service.sendForReview(game.id, game.makerUserId)).rejects.toMatchObject({
      code: "NOT_READY",
      message: "This game isn't on Ruken.",
    });
    expect(await rowOf(game.id)).toMatchObject({ state: "taken_off", pendingPullId: null });
  });

  it("stays out of staff's queue when it is taken off while a new version of a waiting update is being copied", async () => {
    const game = await liveGame();
    await service.pullLatest(game.id);
    await service.sendForReview(game.id, game.makerUserId);
    // The maker takes it off on another device while this copy is fetching the files (the files are read twice: once
    // to check them, once to store them).
    let takenOff = false;
    const copying = createGamesService({
      db: db(),
      clock,
      files,
      github: {
        ...github,
        tarball: async (...args) => {
          if (!takenOff) {
            takenOff = true;
            await service.takeOff(game.id, game.makerUserId);
          }
          return github.tarball(...args);
        },
      },
    });

    await copying.pullLatest(game.id);

    expect(await rowOf(game.id)).toMatchObject({ state: "taken_off", pendingPullId: null });
    expect((await service.waitingGames()).map((one) => one.slug)).not.toContain(game.slug);
  });

  it("is another maker's game: not found, and nothing changes", async () => {
    const game = await liveGame();

    await expect(service.takeOff(game.id, await createUser(db()))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await rowOf(game.id)).state).toBe("live");
  });

  it("refuses a draft, a waiting game and a sent-back game in plain words", async () => {
    const draft = await readyGame();
    const waiting = await readyGame();
    await service.sendForReview(waiting.id, waiting.makerUserId);
    const sentBack = await readyGame();
    await db().game.update({ where: { id: sentBack.id }, data: { state: "sent_back" } });

    for (const game of [draft, waiting, sentBack]) {
      await expect(service.takeOff(game.id, game.makerUserId)).rejects.toMatchObject({
        code: "NOT_READY",
        message: "This game isn't on Ruken.",
      });
    }
    expect(
      await db().makerAction.count({ where: { gameId: { in: [draft.id, waiting.id, sentBack.id] } } }),
    ).toBe(0);
  });

  // Review Focus 9: the database goes first, so a delete that stops halfway leaves the game off its page.
  it("leaves the game off with files left when the delete stops halfway, and Delete them takes the rest", async () => {
    const game = await liveGame();
    const deleteAll = files.deleteAll.bind(files);
    files.deleteAll = () => Promise.reject(new Error("the bucket stopped answering"));

    await expect(service.takeOff(game.id, game.makerUserId)).rejects.toThrow("the bucket stopped answering");

    expect((await rowOf(game.id)).state).toBe("taken_off");
    expect((await service.gameForMaker(game.slug, game.makerUserId))?.filesLeft).toBe(true);

    files.deleteAll = deleteAll;
    await service.deleteLeftFiles(game.id, game.makerUserId);

    expect(keysOf(game.publicId, "files")).toEqual([]);
    expect((await service.gameForMaker(game.slug, game.makerUserId))?.filesLeft).toBe(false);
  });

  it("deletes left files only for the maker's own game that is off Ruken", async () => {
    const live = await liveGame();

    await expect(service.deleteLeftFiles(live.id, live.makerUserId)).rejects.toMatchObject({
      code: "NOT_READY",
    });
    await expect(service.deleteLeftFiles(live.id, await createUser(db()))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(keysOf(live.publicId, "files").length).toBeGreaterThan(0);
  });
});

describe("what the maker's page knows of a game taken off", () => {
  it("says when it was taken off, from the newest taken-off row", async () => {
    const game = await liveGame();
    await service.takeOff(game.id, game.makerUserId);

    expect(await service.gameForMaker(game.slug, game.makerUserId)).toMatchObject({
      state: "taken_off",
      takenOffAt: new Date(clock.epochMs()),
      filesLeft: false,
    });
  });

  it("has no date for a game that is not off Ruken", async () => {
    const game = await liveGame();

    expect(await service.gameForMaker(game.slug, game.makerUserId)).toMatchObject({
      takenOffAt: null,
      filesLeft: false,
    });
  });
});

describe("putBack", () => {
  // Review Focus 10.
  it("copies the newest files again and sends them for review, and does not make the game live", async () => {
    const game = await liveGame();
    await service.takeOff(game.id, game.makerUserId);
    clock.advance(60_000);

    await service.putBack(game.id, game.makerUserId);

    const row = await rowOf(game.id);
    expect(row).toMatchObject({
      state: "waiting",
      livePullId: null,
      pendingSince: new Date(clock.epochMs()),
    });
    expect(row.pendingPullId).not.toBeNull();
    expect(keysOf(game.publicId, "files").length).toBeGreaterThan(0);
    expect(await service.liveGameBySlug(game.slug)).toBeNull();
    expect((await service.waitingGames()).map((one) => one.slug)).toContain(game.slug);
    expect(
      (await db().makerAction.findMany({ where: { gameId: game.id }, orderBy: { at: "asc" } })).map(
        (one) => one.action,
      ),
    ).toEqual(["taken_off", "put_back"]);
  });

  it("leaves a draft with the files' problem when GitHub's copy is refused", async () => {
    const game = await liveGame();
    await service.takeOff(game.id, game.makerUserId);
    // The maker took the app off the repository since: the copy is refused.
    holding.delete("acme/game");

    await expect(service.putBack(game.id, game.makerUserId)).rejects.toMatchObject({ code: "NOT_CONNECTED" });

    // The old copy's files are gone from the bucket, so the problem stands in front of it: the files question asks
    // again, and the game cannot be sent with the old copy.
    const row = await rowOf(game.id);
    expect(row).toMatchObject({ state: "draft", pendingPullId: null });
    expect(row.pullProblem).not.toBeNull();
    await expect(service.sendForReview(game.id, game.makerUserId)).rejects.toMatchObject({
      code: "NOT_READY",
    });
    expect(await service.liveGameBySlug(game.slug)).toBeNull();
  });

  it("keeps the old copy from counting while the new one is being made", async () => {
    const game = await liveGame();
    await service.takeOff(game.id, game.makerUserId);
    // GitHub is asked for the commit once the draft is made: what the row says then is what a request cut off here leaves.
    let seen: { state: string; pullProblem: string | null } | undefined;
    const watching = createGamesService({
      db: db(),
      clock,
      files,
      github: {
        ...github,
        commitOf: async (...args) => {
          seen = await rowOf(game.id);
          return github.commitOf(...args);
        },
      },
    });

    await watching.putBack(game.id, game.makerUserId);

    expect(seen).toMatchObject({ state: "draft" });
    expect(seen?.pullProblem).not.toBeNull();
    expect(await rowOf(game.id)).toMatchObject({ state: "waiting", pullProblem: null });
  });

  it("says a failure that is not Ruken's own refusal in plain words, and keeps them", async () => {
    const game = await liveGame();
    await service.takeOff(game.id, game.makerUserId);
    const broken = createGamesService({
      db: db(),
      clock,
      files,
      github: { ...github, commitOf: () => Promise.reject(new Error("GitHub answered 502")) },
    });

    await expect(broken.putBack(game.id, game.makerUserId)).rejects.toMatchObject({
      code: "NOT_READY",
      message: "We couldn't copy your game from GitHub. Try again.",
    });
    expect(await rowOf(game.id)).toMatchObject({
      state: "draft",
      pullProblem: "We couldn't copy your game from GitHub. Try again.",
    });
  });

  it("writes one record and makes one copy however many presses arrive at once", async () => {
    const game = await liveGame();
    await service.takeOff(game.id, game.makerUserId);
    const pullsBefore = await db().gamePull.count({ where: { gameId: game.id } });

    const presses = await Promise.allSettled([
      service.putBack(game.id, game.makerUserId),
      service.putBack(game.id, game.makerUserId),
    ]);

    expect(presses.filter((press) => press.status === "fulfilled")).toHaveLength(1);
    expect(await db().makerAction.count({ where: { gameId: game.id, action: "put_back" } })).toBe(1);
    expect(await db().gamePull.count({ where: { gameId: game.id } })).toBe(pullsBefore + 1);
  });

  it("puts back only the maker's own game that is off Ruken", async () => {
    const live = await liveGame();

    await expect(service.putBack(live.id, live.makerUserId)).rejects.toMatchObject({ code: "NOT_READY" });
    await expect(service.putBack(live.id, await createUser(db()))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await rowOf(live.id)).state).toBe("live");
  });
});

describe("MakerAction", () => {
  it("is only ever added: a row cannot be changed or deleted", async () => {
    const game = await liveGame();
    await service.takeOff(game.id, game.makerUserId);

    await expect(
      db().$executeRaw`UPDATE "MakerAction" SET "action" = 'put_back' WHERE "gameId" = ${game.id}`,
    ).rejects.toThrow(/MakerAction is append-only/);
    await expect(db().$executeRaw`DELETE FROM "MakerAction" WHERE "gameId" = ${game.id}`).rejects.toThrow(
      /MakerAction is append-only/,
    );
  });
});
