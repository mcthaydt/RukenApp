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

// A maker takes their own live game off Ruken and puts it back (spec 13.1 M1 and M2). The database goes first, so a
// delete that stops halfway still leaves the game off its page.

const SHA = "0123456789abcdef0123456789abcdef01234567";

/** A bucket whose delete can be made to stop, as one that fails halfway does. */
class FlakyFileStore extends MemoryFileStore {
  failing = false;
  override deleteAll(prefix: string): Promise<number> {
    return this.failing ? Promise.reject(new Error("the bucket stopped")) : super.deleteAll(prefix);
  }
}

let database: TestDatabase | undefined;
let clock: TestClock;
let files: FlakyFileStore;
let service: GamesService;
let installed: bigint | null = null;

const github: GitHub = {
  commitOf: () => Promise.resolve(SHA),
  installationOf: () => Promise.resolve(installed),
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
  clock = new TestClock("2026-11-14T12:00:00Z");
  files = new FlakyFileStore();
  installed = null;
  service = createGamesService({ db: db(), clock, files, github });
});

let made = 0;

function mp4Bytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]);
  return bytes;
}

/** A draft that has every answer, its files (a pull and one file in the bucket) and both clips, and a connected maker. */
async function newGame() {
  made += 1;
  const makerUserId = await createUser(db());
  const game = await db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `take-off-game-${String(made)}`,
      makerUserId,
      name: "A game",
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
      ageRating: "age_12",
    },
  });
  const installationId = BigInt(5000 + made);
  await db().gitHubInstallation.create({
    data: {
      userId: makerUserId,
      installationId,
      accountLogin: "acme",
      repositories: { create: [{ fullName: "acme/game", defaultBranch: "main" }] },
    },
  });
  const pullId = crypto.randomUUID();
  await db().gamePull.create({
    data: {
      id: pullId,
      gameId: game.id,
      commitSha: "a".repeat(40),
      fileCount: 1,
      totalBytes: 100n,
      connectHosts: [],
      pulledAt: new Date(clock.epochMs()),
    },
  });
  await files.put(`files/${game.publicId}/${pullId}/index.html`, new Uint8Array([1]));
  for (const shape of ["upright", "wide"] as const)
    await service.saveClip(game.id, shape, { contentType: "video/mp4", bytes: mp4Bytes() });
  return { ...game, makerUserId, pullId, installationId };
}

/** A game that is live on its files, with the maker's yes recorded. */
async function liveGame() {
  const game = await newGame();
  await service.sendForReview(game.id, game.makerUserId);
  await service.accept(game.id, await createUser(db()));
  installed = game.installationId;
  return game;
}

const row = (gameId: string) => db().game.findUniqueOrThrow({ where: { id: gameId } });

describe("takeOff", () => {
  it("takes a live game off: off its page, its files gone, its videos kept", async () => {
    const game = await liveGame();

    await service.takeOff(game.id, game.makerUserId);

    expect(await row(game.id)).toMatchObject({ state: "taken_off", livePullId: null, pendingPullId: null });
    expect(await service.liveGameBySlug(game.slug)).toBeNull();
    expect(files.keys().filter((key) => key.startsWith(`files/${game.publicId}/`))).toEqual([]);
    expect(files.keys().filter((key) => key.startsWith(`clips/${game.publicId}/`))).toHaveLength(2);
  });

  it("drops an update that was waiting, so the list no longer shows it", async () => {
    const game = await liveGame();
    await db().gamePull.create({
      data: {
        id: crypto.randomUUID(),
        gameId: game.id,
        commitSha: "b".repeat(40),
        fileCount: 1,
        totalBytes: 100n,
        connectHosts: [],
        pulledAt: new Date(clock.epochMs() + 1000),
      },
    });
    await service.sendForReview(game.id, game.makerUserId);
    expect((await service.waitingGames()).map((one) => one.slug)).toContain(game.slug);

    await service.takeOff(game.id, game.makerUserId);

    expect((await service.waitingGames()).map((one) => one.slug)).not.toContain(game.slug);
    expect(await row(game.id)).toMatchObject({ pendingPullId: null, pendingSince: null });
  });

  it("is a missing game for another maker's game", async () => {
    const game = await liveGame();

    await expect(service.takeOff(game.id, await createUser(db()))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await row(game.id)).state).toBe("live");
  });

  it.each(["draft", "waiting", "sent_back", "taken_off"] as const)("refuses a %s game", async (state) => {
    const game = await newGame();
    await db().game.update({ where: { id: game.id }, data: { state } });

    await expect(service.takeOff(game.id, game.makerUserId)).rejects.toMatchObject({
      name: "GameError",
      message: "This game isn't live.",
    });
  });

  it("leaves the game off when deleting its files stops, says files are left, and deleting them again clears it", async () => {
    const game = await liveGame();
    files.failing = true;

    await expect(service.takeOff(game.id, game.makerUserId)).rejects.toThrow("the bucket stopped");

    expect((await row(game.id)).state).toBe("taken_off");
    expect((await service.gameForMaker(game.slug, game.makerUserId))?.filesLeft).toBe(true);
    files.failing = false;
    await service.deleteLeftFiles(game.id, game.makerUserId);
    expect((await service.gameForMaker(game.slug, game.makerUserId))?.filesLeft).toBe(false);
  });

  it("asks the bucket about files left only for a game that is off", async () => {
    const game = await liveGame();

    expect((await service.gameForMaker(game.slug, game.makerUserId))?.filesLeft).toBe(false);
  });
});

describe("putBack", () => {
  /** A game that was live and has been taken off. */
  async function offGame() {
    const game = await liveGame();
    await service.takeOff(game.id, game.makerUserId);
    return game;
  }

  it("copies the files again and waits for a person's yes, and is never live by itself", async () => {
    const game = await offGame();

    await service.putBack(game.id, game.makerUserId);

    const after = await row(game.id);
    expect(after).toMatchObject({ state: "waiting", livePullId: null });
    expect(after.pendingPullId).not.toBeNull();
    expect(after.pendingPullId).not.toBe(game.pullId);
    expect(await service.liveGameBySlug(game.slug)).toBeNull();
    expect(
      files.keys().some((key) => key.startsWith(`files/${game.publicId}/${after.pendingPullId ?? ""}/`)),
    ).toBe(true);
  });

  it("stays off when GitHub refuses the copy, and says why", async () => {
    const game = await offGame();
    installed = null;

    await expect(service.putBack(game.id, game.makerUserId)).rejects.toMatchObject({
      name: "GameError",
      code: "NOT_CONNECTED",
    });

    expect((await row(game.id)).state).toBe("taken_off");
  });

  it.each(["draft", "waiting", "sent_back", "live"] as const)(
    "refuses to put back or clean up a %s game",
    async (state) => {
      const game = await liveGame();
      await db().game.update({ where: { id: game.id }, data: { state } });

      await expect(service.putBack(game.id, game.makerUserId)).rejects.toMatchObject({
        message: "This game isn't off Ruken.",
      });
      await expect(service.deleteLeftFiles(game.id, game.makerUserId)).rejects.toMatchObject({
        message: "This game isn't off Ruken.",
      });
    },
  );

  it("is a missing game for another maker's game", async () => {
    const game = await offGame();

    await expect(service.putBack(game.id, await createUser(db()))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
