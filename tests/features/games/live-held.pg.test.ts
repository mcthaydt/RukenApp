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
  it("is held apart, goes for review in the same save, and the video players see does not move", async () => {
    const game = await liveGame();
    const live = await db().gameClip.findUniqueOrThrow({
      where: { gameId_shape: { gameId: game.id, shape: "wide" } },
    });

    const held = await newVideo(game);

    expect(held.key).not.toBe(live.key);
    expect(await db().gameClip.findUniqueOrThrow({ where: { id: live.id } })).toMatchObject({
      key: live.key,
    });
    expect((await stateOf(game.id)).pendingPullId).not.toBeNull();
    expect((await service.waitingGames()).map((one) => one.slug)).toContain(game.slug);
    expect(files.keys()).toEqual(expect.arrayContaining([live.key, held.key]));
  });

  it("replaces the one that was held before, and deletes that file", async () => {
    const game = await liveGame();
    const first = await newVideo(game);

    const second = await newVideo(game);

    expect(await db().gameHeldClip.count({ where: { gameId: game.id } })).toBe(1);
    expect(second.key).not.toBe(first.key);
    expect(files.keys()).not.toContain(first.key);
    expect(files.keys()).toContain(second.key);
  });

  it("goes live on staff's yes, and the clip it replaced is deleted", async () => {
    const game = await liveGame();
    const old = await db().gameClip.findUniqueOrThrow({
      where: { gameId_shape: { gameId: game.id, shape: "wide" } },
    });
    const held = await newVideo(game);

    await service.accept(game.id, await createUser(db()), await lookOf(game.slug));

    expect(
      (await db().gameClip.findUniqueOrThrow({ where: { gameId_shape: { gameId: game.id, shape: "wide" } } }))
        .key,
    ).toBe(held.key);
    expect(await db().gameHeldClip.count({ where: { gameId: game.id } })).toBe(0);
    expect(files.keys()).not.toContain(old.key);
    expect(files.keys()).toContain(held.key);
    expect(await stateOf(game.id)).toMatchObject({ state: "live", pendingPullId: null });
  });
});

describe("a live game's new rating", () => {
  it("is held with its marks as a pair, and goes live as a pair", async () => {
    const game = await liveGame();

    await service.saveAnswer(game.id, game.makerUserId, {
      question: "age",
      ageRating: "age_18",
      contentMarks: ["gore"],
    });

    expect(await stateOf(game.id)).toMatchObject({
      ageRating: "age_12",
      contentMarks: [],
      heldAgeRating: "age_18",
      heldContentMarks: ["gore"],
    });

    await service.accept(game.id, await createUser(db()), await lookOf(game.slug));

    expect(await stateOf(game.id)).toMatchObject({
      ageRating: "age_18",
      contentMarks: ["gore"],
      heldAgeRating: null,
      heldContentMarks: [],
    });
  });

  it("holds a marks-only change of a game that is already 18+", async () => {
    const game = await liveGame();
    await db().game.update({
      where: { id: game.id },
      data: { ageRating: "age_18", contentMarks: ["gore"] },
    });

    await service.saveAnswer(game.id, game.makerUserId, { question: "marks", contentMarks: ["drugs"] });

    expect(await stateOf(game.id)).toMatchObject({
      ageRating: "age_18",
      contentMarks: ["gore"],
      heldAgeRating: "age_18",
      heldContentMarks: ["drugs"],
    });
  });

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

  it("takes a yes with no look when nothing is held, as it always did", async () => {
    const game = await liveGame();
    clock.advance(1_000);
    await db().gamePull.create({
      data: {
        id: crypto.randomUUID(),
        gameId: game.id,
        commitSha: "b".repeat(40),
        fileCount: 3,
        totalBytes: 1000n,
        connectHosts: [],
        pulledAt: new Date(clock.epochMs()),
      },
    });
    await service.sendForReview(game.id, game.makerUserId);

    await service.accept(game.id, await createUser(db()));

    expect(await stateOf(game.id)).toMatchObject({ state: "live", pendingPullId: null });
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

describe("staff sending a live game's update back", () => {
  it("is for a held part, and the maker's fix is to pick another or keep the old one", async () => {
    const game = await liveGame();
    await newVideo(game);

    await service.sendBack(game.id, await createUser(db()), [{ part: "wide_video", reason: "too_dark" }]);

    expect(await stateOf(game.id)).toMatchObject({
      state: "live",
      toFix: ["wide_video"],
      pendingPullId: null,
    });
    // Picking another video takes it off the list, and sends it.
    await newVideo(game);
    expect(await stateOf(game.id)).toMatchObject({ toFix: [] });
    expect((await stateOf(game.id)).pendingPullId).not.toBeNull();
  });

  it("refuses a part that holds nothing, though another part does", async () => {
    const game = await liveGame();
    await newVideo(game);

    await expect(
      service.sendBack(game.id, await createUser(db()), [{ part: "upright_video", reason: "too_dark" }]),
    ).rejects.toMatchObject({ code: "INVALID" });
  });
});

describe("Keep the old one", () => {
  it("drops a held video and its file, takes it off what to fix, and withdraws the send when nothing else waits", async () => {
    const game = await liveGame();
    const held = await newVideo(game);
    await service.sendBack(game.id, await createUser(db()), [{ part: "wide_video", reason: "too_dark" }]);

    await service.keepTheOldOne(game.id, game.makerUserId, "wide_video");

    expect(await db().gameHeldClip.count({ where: { gameId: game.id } })).toBe(0);
    expect(files.keys()).not.toContain(held.key);
    expect(await stateOf(game.id)).toMatchObject({ state: "live", toFix: [], pendingPullId: null });
    expect((await service.waitingGames()).map((one) => one.slug)).not.toContain(game.slug);
  });

  it("drops a held rating with its marks", async () => {
    const game = await liveGame();
    await service.saveAnswer(game.id, game.makerUserId, {
      question: "age",
      ageRating: "age_18",
      contentMarks: ["gore"],
    });

    await service.keepTheOldOne(game.id, game.makerUserId, "age_rating");

    expect(await stateOf(game.id)).toMatchObject({
      ageRating: "age_12",
      heldAgeRating: null,
      heldContentMarks: [],
      pendingPullId: null,
    });
  });

  it("sends the rest again when another change is still held", async () => {
    const game = await liveGame();
    await newVideo(game);
    await service.saveAnswer(game.id, game.makerUserId, { question: "age", ageRating: "age_16" });
    await service.sendBack(game.id, await createUser(db()), [{ part: "wide_video", reason: "too_dark" }]);

    await service.keepTheOldOne(game.id, game.makerUserId, "wide_video");

    const after = await stateOf(game.id);
    expect(after).toMatchObject({ toFix: [], heldAgeRating: "age_16" });
    expect(after.pendingPullId).not.toBeNull();
  });

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
  // Audit 5 note N1: a live game whose only send back was for a held part, and whose maker kept the old one, is plain
  // live again, so its line is "Live" and not "Your update is fixed. Send it again."
  it("says Live, with nothing to send, in the plain-live-again case", async () => {
    const game = await liveGame();
    await newVideo(game);
    await service.sendBack(game.id, await createUser(db()), [{ part: "wide_video", reason: "too_dark" }]);
    clock.advance(1_000);
    const row = async () => (await service.gamesOf(game.makerUserId)).find((one) => one.slug === game.slug);
    expect((await row())?.words).toBe("Live. Your update was sent back. See what to fix.");

    await service.keepTheOldOne(game.id, game.makerUserId, "wide_video");

    expect((await row())?.words).toBe("Live");
    expect((await service.gameForMaker(game.slug, game.makerUserId))?.sentBackLast).toBe(false);
  });

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

describe("a copy GitHub refused", () => {
  it("keeps a held save and does not send it", async () => {
    const game = await liveGame();
    await db().game.update({
      where: { id: game.id },
      data: { pullProblem: "Your game's files had no index.html." },
    });

    await newVideo(game);

    expect(await db().gameHeldClip.count({ where: { gameId: game.id } })).toBe(1);
    expect((await stateOf(game.id)).pendingPullId).toBeNull();
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
