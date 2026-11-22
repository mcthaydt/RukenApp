import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GameError } from "../../../src/features/games/games.ts";
import type { GitHub } from "../../../src/features/games/github.ts";
import { newPublicId } from "../../../src/features/games/ids.ts";
import { createGamesService, type GamesService } from "../../../src/features/games/service.ts";
import { AGREE_FIRST, agree, sendWhenAgreed } from "../../../src/features/make/make.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { decisionsOff } from "../../support/decisions-off.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";
import { TestClock } from "../../support/test-clock.ts";

// The agreement stands before a first send, and only there (spec 5.3: sendWhenAgreed). Putting a game back and a live
// game's saved change send as they always did, with no agreement asked again.

let database: TestDatabase | undefined;
let clock: TestClock;
let service: GamesService;

const github: GitHub = {
  commitOf: () => Promise.reject(new Error("not asked")),
  branchesOf: () => Promise.resolve([]),
  installationOf: () => Promise.resolve(null),
  tarball: () => Promise.reject(new Error("not asked")),
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
  service = createGamesService({
    db: db(),
    clock,
    files: new MemoryFileStore(),
    github,
    schedule: decisionsOff,
  });
});

let made = 0;

/** A draft with every answer, a copy of its files and both videos, so only the agreement can stop its send. */
async function readyGame() {
  made += 1;
  const makerUserId = await createUser(db());
  const game = await db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `send-agreed-${String(made)}`,
      makerUserId,
      name: "A game",
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
      ageRating: "age_12",
    },
  });
  await db().gamePull.create({
    data: {
      id: crypto.randomUUID(),
      gameId: game.id,
      commitSha: "a".repeat(40),
      fileCount: 1,
      totalBytes: 100n,
      connectHosts: [],
      pulledAt: new Date(clock.epochMs()),
    },
  });
  for (const shape of ["upright", "wide"] as const) {
    await db().gameClip.create({
      data: {
        gameId: game.id,
        shape,
        key: `clips/${game.publicId}/${shape}.mp4`,
        bytes: 10,
        contentType: "video/mp4",
      },
    });
  }
  return { ...game, makerUserId };
}

describe("sendWhenAgreed", () => {
  it("refuses a maker who has not agreed, in the agreement's words, and sends nothing", async () => {
    const game = await readyGame();

    await expect(sendWhenAgreed(db(), service, game.id, game.makerUserId)).rejects.toThrow(AGREE_FIRST);

    expect((await db().game.findUniqueOrThrow({ where: { id: game.id } })).state).toBe("draft");
  });

  it("sends once they have agreed", async () => {
    const game = await readyGame();
    await agree(db(), clock, game.makerUserId);

    await sendWhenAgreed(db(), service, game.id, game.makerUserId);

    expect((await db().game.findUniqueOrThrow({ where: { id: game.id } })).state).toBe("waiting");
  });

  it("is the only send that asks: the games service itself sends a game whose maker never agreed", async () => {
    const game = await readyGame();

    await service.sendForReview(game.id, game.makerUserId);

    expect((await db().game.findUniqueOrThrow({ where: { id: game.id } })).state).toBe("waiting");
  });
});

describe("the state checks the maker's screens and commands share", () => {
  it("setShowsPlayerCount refuses a game that is not live", async () => {
    const game = await readyGame();

    await expect(service.setShowsPlayerCount(game.id, game.makerUserId, true)).rejects.toBeInstanceOf(
      GameError,
    );
    expect((await db().game.findUniqueOrThrow({ where: { id: game.id } })).showsPlayerCount).toBe(false);
  });

  it("makes a live 12+ game 18+ only with its marks in the same answer", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);
    await service.accept(game.id, await createUser(db()));

    const refusal = await service
      .saveAnswer(game.id, game.makerUserId, { question: "age", ageRating: "age_18" })
      .catch((thrown: unknown) => thrown);
    expect(refusal).toBeInstanceOf(GameError);
    expect((refusal as GameError).field).toBe("marks");

    await service.saveAnswer(game.id, game.makerUserId, {
      question: "age",
      ageRating: "age_18",
      contentMarks: ["gore"],
    });
    expect(await db().game.findUniqueOrThrow({ where: { id: game.id } })).toMatchObject({
      heldAgeRating: "age_18",
      heldContentMarks: ["gore"],
    });
  });
});
