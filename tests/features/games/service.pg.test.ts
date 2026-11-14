import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPublicId } from "../../../src/features/games/ids.ts";
import { createGamesService, type GamesService } from "../../../src/features/games/service.ts";
import { systemClock } from "../../../src/lib/clock.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";

let database: TestDatabase | undefined;
const files = new MemoryFileStore();
let service: GamesService;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  service = createGamesService({ db: db(), clock: systemClock, files, github: {} });
});

afterAll(async () => {
  await database?.stop();
});

let made = 0;

/** A plain draft game. Its public id is its own, so its clips' keys can be told apart. */
async function newGame() {
  made += 1;
  return db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `game-${String(made)}`,
      makerUserId: await createUser(db()),
      name: "A game",
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
    },
  });
}

/** A clip's first bytes as an MP4 has them: four length bytes, then `ftyp`, then zeros. */
function mp4Bytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]);
  return bytes;
}

describe("saveClip", () => {
  it("stores a clip and remembers where", async () => {
    const game = await newGame();
    const before = files.keys();

    await service.saveClip(game.id, "upright", { contentType: "video/mp4", bytes: mp4Bytes() });

    const clip = await db().gameClip.findFirstOrThrow({ where: { gameId: game.id, shape: "upright" } });
    expect(clip.key).toMatch(new RegExp(`^clips/${game.publicId}/upright-[0-9a-f]{16}\\.mp4$`));
    expect(clip).toMatchObject({ contentType: "video/mp4", bytes: 32 });
    expect(files.keys()).toEqual([...before, clip.key]);
  });

  it("a new clip takes the old one's place and the old file goes", async () => {
    const game = await newGame();
    await service.saveClip(game.id, "wide", { contentType: "video/mp4", bytes: mp4Bytes() });
    const first = await db().gameClip.findFirstOrThrow({ where: { gameId: game.id, shape: "wide" } });

    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
    await service.saveClip(game.id, "wide", { contentType: "video/webm", bytes: webm });

    const rows = await db().gameClip.findMany({ where: { gameId: game.id, shape: "wide" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toMatch(/\.webm$/);
    expect(rows[0]?.key).not.toBe(first.key);
    expect(files.keys()).toContain(rows[0]?.key);
    expect(files.keys()).not.toContain(first.key);
  });

  it("keeps a game's two shapes apart", async () => {
    const game = await newGame();

    await service.saveClip(game.id, "upright", { contentType: "video/mp4", bytes: mp4Bytes() });
    await service.saveClip(game.id, "wide", { contentType: "video/mp4", bytes: mp4Bytes() });

    const shapes = (await db().gameClip.findMany({ where: { gameId: game.id } })).map((clip) => clip.shape);
    expect(shapes.sort()).toEqual(["upright", "wide"]);
  });

  // Review Focus 13: a page's bytes under a video's name never reach the bucket, so never the public.
  it("refuses a page named as a video and stores nothing", async () => {
    const game = await newGame();
    const before = files.keys();

    await expect(
      service.saveClip(game.id, "wide", {
        contentType: "video/mp4",
        bytes: new TextEncoder().encode("<html>"),
      }),
    ).rejects.toMatchObject({
      code: "INVALID",
      message: "That file doesn't look like a video. Export it as MP4 or WebM and try again.",
    });

    expect(files.keys()).toEqual(before);
    expect(await db().gameClip.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("refuses a file that is not a clip type, with the clip rules' words", async () => {
    const game = await newGame();

    await expect(
      service.saveClip(game.id, "upright", { contentType: "image/png", bytes: mp4Bytes() }),
    ).rejects.toMatchObject({ code: "INVALID", message: "Clips are MP4 or WebM video." });
  });

  it("says a game is not there when there is none, and stores nothing", async () => {
    const before = files.keys();

    await expect(
      service.saveClip("no-such-game", "wide", { contentType: "video/mp4", bytes: mp4Bytes() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(files.keys()).toEqual(before);
  });
});
