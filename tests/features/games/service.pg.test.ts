import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GitHub } from "../../../src/features/games/github.ts";
import { newPublicId, PUBLIC_ID } from "../../../src/features/games/ids.ts";
import { createGamesService, type GamesService } from "../../../src/features/games/service.ts";
import { systemClock } from "../../../src/lib/clock.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";
import { tarGz } from "../../support/tar.ts";

let database: TestDatabase | undefined;
const files = new MemoryFileStore();

/** The installation GitHub says holds each repository now. A test sets it to what GitHub would answer. */
const installations = new Map<string, bigint>();

// Saving a clip never reaches GitHub for files, so a call to it here is a mistake the test should show. Making a game
// does ask which installation holds the repository, and the maker's stored list must agree.
const installationOf: GitHub["installationOf"] = (repo) => Promise.resolve(installations.get(repo) ?? null);
const noGitHub: GitHub = {
  commitOf: () => Promise.reject(new Error("this test reaches for GitHub")),
  tarball: () => Promise.reject(new Error("this test reaches for GitHub")),
  installationOf,
};
let service: GamesService;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  service = createGamesService({ db: db(), clock: systemClock, files, github: noGitHub });
});

afterAll(async () => {
  await database?.stop();
});

let made = 0;
let installationsMade = 0;

/** What GitHub told the site a person can reach: one installation with these repositories, and GitHub agrees. */
async function connectMaker(userId: string, ...repos: string[]): Promise<void> {
  installationsMade += 1;
  const installationId = BigInt(1000 + installationsMade);
  await db().gitHubInstallation.create({
    data: {
      userId,
      installationId,
      accountLogin: "acme",
      repositories: { create: repos.map((fullName) => ({ fullName, defaultBranch: "main" })) },
    },
  });
  for (const repo of repos) installations.set(repo, installationId);
}

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
    ).rejects.toMatchObject({ code: "INVALID", message: "Videos are MP4 or WebM." });
  });

  it("says a game is not there when there is none, and stores nothing", async () => {
    const before = files.keys();

    await expect(
      service.saveClip("no-such-game", "wide", { contentType: "video/mp4", bytes: mp4Bytes() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(files.keys()).toEqual(before);
  });
});

/** What a maker's form says, made valid; a test changes the one thing it is about. */
async function startGame(changes: Partial<Parameters<GamesService["createGame"]>[0]> = {}) {
  const makerUserId = changes.makerUserId ?? (await createUser(db()));
  const repo = changes.repo ?? { fullName: "acme/game", branch: null, folder: "" };
  // The maker has connected GitHub and can reach the repository, as every maker who makes a game must.
  await connectMaker(makerUserId, repo.fullName);
  return service.createGame({
    name: "Tower Run",
    oneLine: "Climb fifty floors.",
    playsOn: "phone_and_computer",
    connectHosts: [],
    ...changes,
    makerUserId,
    repo,
  });
}

describe("createGame", () => {
  it("makes a draft game, with an address and a public id of its own", async () => {
    const maker = await createUser(db());
    const made = await startGame({
      makerUserId: maker,
      name: "  Floor Fifty  ",
      playsOn: "computer_only",
      repo: { fullName: "acme/floor-fifty", branch: "release", folder: "web/build" },
      connectHosts: ["api.example.com"],
    });

    expect(made.slug).toBe("floor-fifty");
    expect(made.publicId).toMatch(PUBLIC_ID);
    expect(await db().game.findUniqueOrThrow({ where: { id: made.id } })).toMatchObject({
      makerUserId: maker,
      name: "Floor Fifty",
      oneLine: "Climb fifty floors.",
      playsOn: "computer_only",
      state: "draft",
      freeToPlay: false,
      repoFullName: "acme/floor-fifty",
      repoBranch: "release",
      repoFolder: "web/build",
      connectHosts: ["api.example.com"],
      livePullId: null,
    });
  });

  it.each([
    ["", "A game needs a name."],
    ["   ", "A game needs a name."],
    ["x".repeat(61), "A game's name can be up to 60 characters."],
    ["!!", "Pick a name with at least three letters or numbers."],
    ["ab", "Pick a name with at least three letters or numbers."],
  ])("refuses the name %j", async (name, message) => {
    await expect(startGame({ name })).rejects.toMatchObject({
      name: "GameError",
      code: "INVALID",
      message,
      field: "name",
    });
  });

  it.each([
    ["", "A game needs one line about it."],
    ["  ", "A game needs one line about it."],
    ["y".repeat(101), "The one line can be up to 100 characters."],
  ])("refuses the one line %j", async (oneLine, message) => {
    await expect(startGame({ oneLine })).rejects.toMatchObject({
      code: "INVALID",
      message,
      field: "oneLine",
    });
  });

  it("takes a name of 60 characters and a line of 100", async () => {
    await expect(
      startGame({ name: `Sixty ${"z".repeat(54)}`, oneLine: "y".repeat(100) }),
    ).resolves.toBeDefined();
  });

  it("gives two games with one name addresses of their own", async () => {
    const first = await startGame({ name: "Cloud Nine" });
    const second = await startGame({ name: "Cloud Nine" });
    expect(first.slug).toBe("cloud-nine");
    expect(second.slug).toBe("cloud-nine-2");
  });

  it("cuts a 40-character address to 38 before it adds a number", async () => {
    const name = "b".repeat(40);
    expect((await startGame({ name })).slug).toBe(name);
    expect((await startGame({ name })).slug).toBe(`${"b".repeat(38)}-2`);
  });

  it("drops a hyphen the cut leaves at the end", async () => {
    const name = `${"c".repeat(37)} dd`;
    expect((await startGame({ name })).slug).toBe(`${"c".repeat(37)}-dd`);
    expect((await startGame({ name })).slug).toBe(`${"c".repeat(37)}-2`);
  });

  it("stops at -9 and says the name is taken", async () => {
    const slugs: string[] = [];
    for (let i = 0; i < 9; i += 1) slugs.push((await startGame({ name: "Popular Game" })).slug);
    expect(slugs).toEqual([
      "popular-game",
      ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `popular-game-${String(n)}`),
    ]);
    await expect(startGame({ name: "Popular Game" })).rejects.toMatchObject({
      code: "INVALID",
      message: "That name is taken. Pick another.",
      field: "name",
    });
  });

  // The form lists the maker's repositories and starts on none of them, so a maker who presses the button first is
  // told to choose, not that the empty box "doesn't look like a GitHub repository".
  it("asks a maker who chose no repository to choose one", async () => {
    await expect(startGame({ repo: { fullName: "", branch: null, folder: "" } })).rejects.toMatchObject({
      code: "INVALID",
      message: "Choose the repository your game is in.",
    });
  });

  // Review Focus 17: what a person typed is checked before it is kept or put in an address.
  it.each([
    ["a repository with a slash too many", { fullName: "acme/game/extra", branch: null, folder: "" }],
    ["a repository that climbs", { fullName: "../x", branch: null, folder: "" }],
    ["a branch with a space", { fullName: "acme/game", branch: "a b", folder: "" }],
    ["a folder that starts with a slash", { fullName: "acme/game", branch: null, folder: "/web" }],
    ["a folder that ends with a slash", { fullName: "acme/game", branch: null, folder: "web/" }],
    ["a folder that climbs", { fullName: "acme/game", branch: null, folder: "a/../b" }],
    ["a folder of 201 characters", { fullName: "acme/game", branch: null, folder: "f".repeat(201) }],
  ])("refuses %s, and makes no game", async (_why, repo) => {
    const before = await db().game.count();
    await expect(startGame({ repo })).rejects.toMatchObject({ code: "INVALID" });
    expect(await db().game.count()).toBe(before);
  });
});

/** A pull row for a game, as a passing pull leaves it. */
async function addPull(gameId: string, connectHosts: string[] = []): Promise<string> {
  const pull = await db().gamePull.create({
    data: {
      id: crypto.randomUUID(),
      gameId,
      commitSha: "a".repeat(40),
      fileCount: 3,
      totalBytes: 1000n,
      connectHosts,
      pulledAt: new Date(),
    },
  });
  return pull.id;
}

async function addBothClips(gameId: string): Promise<void> {
  await service.saveClip(gameId, "upright", { contentType: "video/mp4", bytes: mp4Bytes() });
  await service.saveClip(gameId, "wide", { contentType: "video/mp4", bytes: mp4Bytes() });
}

/** Puts a game live on a pull, as an accepted review leaves it (review.pg.test.ts proves the review itself). */
async function makeLive(gameId: string, pullId: string): Promise<void> {
  await db().game.update({ where: { id: gameId }, data: { state: "live", livePullId: pullId } });
}

describe("liveGameBySlug", () => {
  it("is null for a draft and for an address that is nobody's", async () => {
    const game = await newGame();
    expect(await service.liveGameBySlug(game.slug)).toBeNull();
    expect(await service.liveGameBySlug("nobody-has-this")).toBeNull();
  });

  it("answers the game, its clips' keys and the live pull's servers", async () => {
    const game = await newGame();
    await addBothClips(game.id);
    const pullId = await addPull(game.id, ["api.example.com"]);
    await makeLive(game.id, pullId);
    const clips = await db().gameClip.findMany({ where: { gameId: game.id } });
    const keyOf = (shape: string) => clips.find((clip) => clip.shape === shape)?.key;

    expect(await service.liveGameBySlug(game.slug)).toEqual({
      id: game.id,
      publicId: game.publicId,
      slug: game.slug,
      name: "A game",
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      freeToPlay: false,
      makerUserId: game.makerUserId,
      livePullId: pullId,
      connectHosts: ["api.example.com"],
      clips: { upright: keyOf("upright"), wide: keyOf("wide") },
    });
  });
});

describe("pullLatest", () => {
  it("pulls with the service's own GitHub and bucket", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const github: GitHub = {
      commitOf: () => Promise.resolve(sha),
      installationOf,
      tarball: async () =>
        new Blob([await tarGz([{ path: "top/index.html", content: "<html></html>" }])]).stream(),
    };
    const pulling = createGamesService({ db: db(), clock: systemClock, files, github });
    const game = await newGame();
    await connectMaker(game.makerUserId, "acme/game");

    const pull = await pulling.pullLatest(game.id);

    expect(pull).toMatchObject({ commitSha: sha, fileCount: 1 });
    expect(files.keys()).toContain(`files/${game.publicId}/${pull.id}/index.html`);
  });
});
