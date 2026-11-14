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

// Sending a game for review, and a person's yes or no. The review row is the record design 5.5 asks of every staff
// action: who, what, when.

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
  clock = new TestClock("2026-11-14T12:00:00Z");
  files = new MemoryFileStore();
  service = createGamesService({ db: db(), clock, files, github });
});

let made = 0;

/** A draft game for a new maker. */
async function newGame() {
  made += 1;
  const makerUserId = await createUser(db());
  const game = await db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `review-game-${String(made)}`,
      makerUserId,
      name: "A game",
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
    },
  });
  return { ...game, makerUserId };
}

/** The maker has connected GitHub and can reach `acme/game`, so a pull is allowed. */
async function connect(makerUserId: string): Promise<void> {
  const installationId = BigInt(2000 + made);
  await db().gitHubInstallation.create({
    data: {
      userId: makerUserId,
      installationId,
      accountLogin: "acme",
      repositories: { create: [{ fullName: "acme/game", defaultBranch: "main" }] },
    },
  });
  holding.set("acme/game", installationId);
}

/** A pull row for a game as a passing pull leaves it, a second after the last. */
async function addPull(gameId: string): Promise<string> {
  clock.advance(1_000);
  const pull = await db().gamePull.create({
    data: {
      id: crypto.randomUUID(),
      gameId,
      commitSha: "a".repeat(40),
      fileCount: 3,
      totalBytes: 1000n,
      connectHosts: [],
      pulledAt: new Date(clock.epochMs()),
    },
  });
  return pull.id;
}

/** A clip's first bytes as an MP4 has them. */
function mp4Bytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]);
  return bytes;
}

async function addClip(gameId: string, shape: "upright" | "wide"): Promise<void> {
  await service.saveClip(gameId, shape, { contentType: "video/mp4", bytes: mp4Bytes() });
}

/** A draft game that has its files and both clips: ready to send. */
async function readyGame() {
  const game = await newGame();
  const pullId = await addPull(game.id);
  await addClip(game.id, "upright");
  await addClip(game.id, "wide");
  return { ...game, pullId };
}

async function stateOf(gameId: string) {
  return db().game.findUniqueOrThrow({ where: { id: gameId } });
}

describe("sendForReview", () => {
  it.each([
    ["no files", false, true, true, "Pull your game's files first."],
    ["no upright video", true, false, true, "Add an upright video."],
    ["no wide video", true, true, false, "Add a wide video."],
  ])(
    "refuses a game with %s, in words, and changes nothing",
    async (_why, pulled, upright, wide, message) => {
      const game = await newGame();
      if (pulled) await addPull(game.id);
      if (upright) await addClip(game.id, "upright");
      if (wide) await addClip(game.id, "wide");

      await expect(service.sendForReview(game.id, game.makerUserId)).rejects.toMatchObject({
        name: "GameError",
        code: "NOT_READY",
        message,
      });
      expect(await stateOf(game.id)).toMatchObject({
        state: "draft",
        pendingPullId: null,
        pendingSince: null,
      });
    },
  );

  it("makes a draft wait on its newest files, and notes when they were sent", async () => {
    const game = await readyGame();
    const newer = await addPull(game.id);

    await service.sendForReview(game.id, game.makerUserId);

    expect(await stateOf(game.id)).toMatchObject({
      state: "waiting",
      pendingPullId: newer,
      pendingSince: new Date(clock.epochMs()),
      livePullId: null,
    });
  });

  it("leaves a live game live on its old files while the new ones wait", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);
    await service.accept(game.id, await createUser(db()));
    const update = await addPull(game.id);

    await service.sendForReview(game.id, game.makerUserId);

    expect(await stateOf(game.id)).toMatchObject({
      state: "live",
      livePullId: game.pullId,
      pendingPullId: update,
    });
  });

  it("will not send another maker's game, and says it is not there", async () => {
    const game = await readyGame();
    const stranger = await createUser(db());

    await expect(service.sendForReview(game.id, stranger)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await stateOf(game.id)).toMatchObject({ state: "draft", pendingPullId: null });
  });
});

describe("accept", () => {
  it("makes the game live on the files that waited, and records who said yes", async () => {
    const game = await readyGame();
    const staff = await createUser(db());
    await service.sendForReview(game.id, game.makerUserId);

    await service.accept(game.id, staff);

    expect(await stateOf(game.id)).toMatchObject({
      state: "live",
      livePullId: game.pullId,
      pendingPullId: null,
      stateReason: null,
    });
    expect(await db().gameReview.findMany({ where: { gameId: game.id } })).toMatchObject([
      {
        staffUserId: staff,
        pullId: game.pullId,
        decision: "accepted",
        reason: null,
        decidedAt: new Date(clock.epochMs()),
      },
    ]);
  });

  it("says so when nothing is waiting, and writes nothing", async () => {
    const game = await readyGame();

    await expect(service.accept(game.id, await createUser(db()))).rejects.toMatchObject({
      code: "NOT_READY",
      message: "Nothing is waiting for review.",
    });
    expect(await db().gameReview.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("puts a live game's update live on the new files, and the old files stay in the bucket", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);
    await service.accept(game.id, await createUser(db()));
    await files.put(`files/${game.publicId}/${game.pullId}/index.html`, new Uint8Array([1]));
    const update = await addPull(game.id);
    await service.sendForReview(game.id, game.makerUserId);

    await service.accept(game.id, await createUser(db()));

    expect(await stateOf(game.id)).toMatchObject({ state: "live", livePullId: update, pendingPullId: null });
    expect(files.keys()).toContain(`files/${game.publicId}/${game.pullId}/index.html`);
  });
});

describe("sendBack", () => {
  it("asks the maker to fix something, and records who said so and why", async () => {
    const game = await readyGame();
    const staff = await createUser(db());
    await service.sendForReview(game.id, game.makerUserId);

    await service.sendBack(game.id, staff, "  The clip is sideways.  ");

    expect(await stateOf(game.id)).toMatchObject({
      state: "sent_back",
      stateReason: "The clip is sideways.",
      pendingPullId: null,
      livePullId: null,
    });
    expect(await db().gameReview.findMany({ where: { gameId: game.id } })).toMatchObject([
      { staffUserId: staff, decision: "sent_back", reason: "The clip is sideways.", pullId: game.pullId },
    ]);
  });

  it.each(["", "   ", "x".repeat(501)])("refuses the reason %j, and changes nothing", async (reason) => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);

    await expect(service.sendBack(game.id, await createUser(db()), reason)).rejects.toMatchObject({
      code: "INVALID",
      message: "Say what the maker should fix.",
    });
    expect(await stateOf(game.id)).toMatchObject({ state: "waiting" });
    expect(await db().gameReview.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("takes a reason of 500 characters", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);

    await service.sendBack(game.id, await createUser(db()), "y".repeat(500));

    expect((await stateOf(game.id)).stateReason).toHaveLength(500);
  });

  it("leaves a live game live on its old files when its update is sent back", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);
    await service.accept(game.id, await createUser(db()));
    await addPull(game.id);
    await service.sendForReview(game.id, game.makerUserId);

    await service.sendBack(game.id, await createUser(db()), "Fix the menu.");

    expect(await stateOf(game.id)).toMatchObject({
      state: "live",
      livePullId: game.pullId,
      pendingPullId: null,
      stateReason: "Fix the menu.",
    });
  });

  it("says so when nothing is waiting", async () => {
    const game = await readyGame();

    await expect(service.sendBack(game.id, await createUser(db()), "Fix it.")).rejects.toMatchObject({
      code: "NOT_READY",
      message: "Nothing is waiting for review.",
    });
  });
});

describe("the review record", () => {
  it("is only ever added, and a sent-back row must carry a reason", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);
    await service.accept(game.id, await createUser(db()));

    await expect(db().$executeRaw`UPDATE "GameReview" SET "decision" = 'sent_back'`).rejects.toThrow(
      /GameReview is append-only/,
    );
    await expect(db().$executeRaw`DELETE FROM "GameReview"`).rejects.toThrow(/GameReview is append-only/);
    await expect(
      db().$executeRaw`
        INSERT INTO "GameReview" ("id", "gameId", "pullId", "staffUserId", "decision", "reason", "decidedAt")
        VALUES ('r1', ${game.id}, ${game.pullId}, ${game.makerUserId}, 'sent_back'::"ReviewDecision", '', now())`,
    ).rejects.toThrow(/GameReview_reason_check/);
  });
});

describe("pulling again", () => {
  it("replaces the files that wait, so staff always review the newest", async () => {
    const game = await readyGame();
    await connect(game.makerUserId);
    await service.sendForReview(game.id, game.makerUserId);
    clock.advance(60_000);

    const pull = await service.pullLatest(game.id);

    expect(await stateOf(game.id)).toMatchObject({
      pendingPullId: pull.id,
      pendingSince: new Date(clock.epochMs()),
      state: "waiting",
    });
  });

  it("does not send a game that was not waiting", async () => {
    const game = await newGame();
    await connect(game.makerUserId);

    await service.pullLatest(game.id);

    expect(await stateOf(game.id)).toMatchObject({ state: "draft", pendingPullId: null });
  });
});

describe("a live game's clips", () => {
  it("cannot be changed yet, and the old clip stays", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);
    await service.accept(game.id, await createUser(db()));
    const before = files.keys();

    await expect(
      service.saveClip(game.id, "wide", { contentType: "video/mp4", bytes: mp4Bytes() }),
    ).rejects.toMatchObject({ code: "NOT_READY", message: "A live game's videos can't be changed yet." });

    expect(files.keys()).toEqual(before);
    expect(await db().gameClip.count({ where: { gameId: game.id } })).toBe(2);
  });
});

describe("waitingGames", () => {
  it("lists the games with files waiting, the oldest first, with their maker's address", async () => {
    const first = await readyGame();
    const second = await readyGame();
    const idle = await readyGame();
    await service.sendForReview(second.id, second.makerUserId);
    clock.advance(60_000);
    await service.sendForReview(first.id, first.makerUserId);

    const waiting = (await service.waitingGames()).filter((game) =>
      [first.slug, second.slug, idle.slug].includes(game.slug),
    );

    expect(waiting.map((game) => game.slug)).toEqual([second.slug, first.slug]);
    expect(waiting[0]).toMatchObject({ name: "A game", sentAt: expect.any(Date) as Date });
    expect(waiting[0]?.makerEmail).toMatch(/@example\.test$/);
  });
});

describe("what the screens show", () => {
  it("gives a maker's list, with each game's state in words", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);

    expect(await service.gamesOf(game.makerUserId)).toEqual([
      { slug: game.slug, name: "A game", words: "Waiting for review" },
    ]);
    expect(await service.gamesOf(await createUser(db()))).toEqual([]);
  });

  it("gives staff's reason apart from the headline, and the list its next step", async () => {
    const game = await readyGame();
    expect(await service.gamesOf(game.makerUserId)).toEqual([
      { slug: game.slug, name: "A game", words: "Not sent yet. Send it for review." },
    ]);

    await service.sendForReview(game.id, game.makerUserId);
    await service.sendBack(game.id, await createUser(db()), "The clip is sideways.");

    expect(await service.gameForMaker(game.slug, game.makerUserId)).toMatchObject({
      headline: "Sent back",
      reason: "The clip is sideways.",
      words: "Sent back: The clip is sideways.",
    });
    expect(await service.gamesOf(game.makerUserId)).toEqual([
      { slug: game.slug, name: "A game", words: "Sent back. See what to fix." },
    ]);
  });

  it("gives a game's page to its maker only", async () => {
    const game = await readyGame();

    expect(await service.gameForMaker(game.slug, game.makerUserId)).toMatchObject({
      slug: game.slug,
      name: "A game",
      headline: "Not sent yet",
      words: "Not sent yet",
      repoFullName: "acme/game",
      newestPull: { id: game.pullId, fileCount: 3, totalBytes: 1000 },
      // What each video measured when it was added, never typed.
      clips: { upright: expect.any(Number) as number, wide: expect.any(Number) as number },
      reason: null,
    });
    expect(await service.gameForMaker(game.slug, await createUser(db()))).toBeNull();
    expect(await service.gameForMaker("no-such-game", game.makerUserId)).toBeNull();
  });

  it("gives staff the waiting files and the clips' keys", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);

    const seen = await service.gameForReview(game.slug);

    expect(seen).toMatchObject({
      slug: game.slug,
      pending: { id: game.pullId, fileCount: 3, totalBytes: 1000, connectHosts: [] },
    });
    expect(seen?.clipKeys.upright).toMatch(/^clips\/.*\/upright-/);
    expect(seen?.clipKeys.wide).toMatch(/^clips\/.*\/wide-/);
    expect(await service.gameForReview("no-such-game")).toBeNull();
  });
});
