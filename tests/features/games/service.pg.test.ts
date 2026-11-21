import { decisionsOff } from "../../support/decisions-off.ts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GitHub } from "../../../src/features/games/github.ts";
import { newPublicId, PUBLIC_ID } from "../../../src/features/games/ids.ts";
import { createGamesService, type Answer, type GamesService } from "../../../src/features/games/service.ts";
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
  branchesOf: () => Promise.resolve([]),
  installationOf,
};
let service: GamesService;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  service = createGamesService({
    db: db(),
    clock: systemClock,
    files,
    github: noGitHub,
    schedule: decisionsOff,
  });
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
      ageRating: "age_12",
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

  // A Mac's screen recording is QuickTime (Owner, 2026-11-15: "Yes, take .mov").
  it("stores a QuickTime clip under a .mov key", async () => {
    const game = await newGame();
    const mov = new Uint8Array(32);
    mov.set([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]);

    await service.saveClip(game.id, "upright", { contentType: "video/quicktime", bytes: mov });

    const clip = await db().gameClip.findFirstOrThrow({ where: { gameId: game.id, shape: "upright" } });
    expect(clip.key).toMatch(new RegExp(`^clips/${game.publicId}/upright-[0-9a-f]{16}\\.mov$`));
    expect(clip).toMatchObject({ contentType: "video/quicktime", bytes: 32 });
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

  // A page's bytes under a video's name never reach the bucket, so never the public.
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
      message: "That file doesn't look like a video. Save it as MP4, WebM or MOV and try again.",
    });

    expect(files.keys()).toEqual(before);
    expect(await db().gameClip.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("refuses a file that is not a clip type, with the clip rules' words", async () => {
    const game = await newGame();

    await expect(
      service.saveClip(game.id, "upright", { contentType: "image/png", bytes: mp4Bytes() }),
    ).rejects.toMatchObject({ code: "INVALID", message: "Ruken takes MP4, WebM or MOV videos." });
  });

  it("says a game is not there when there is none, and stores nothing", async () => {
    const before = files.keys();

    await expect(
      service.saveClip("no-such-game", "wide", { contentType: "video/mp4", bytes: mp4Bytes() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(files.keys()).toEqual(before);
  });
});

const SHA = "0123456789abcdef0123456789abcdef01234567";

/** A GitHub that holds one repository's files, so an answer about the files really pulls them. */
function githubHolding(entries: { path: string; content: string }[]): GitHub {
  return {
    commitOf: () => Promise.resolve(SHA),
    branchesOf: () => Promise.resolve([]),
    installationOf,
    tarball: async () => new Blob([await tarGz(entries)]).stream(),
  };
}

const GOOD_FILES = [{ path: "top/index.html", content: "<html></html>" }];
const NO_INDEX = [{ path: "top/readme.txt", content: "no game here" }];
const NO_INDEX_WORDS = "Ruken starts your game from a file called index.html. We couldn't find one.";

/** The service as it is when GitHub holds a game that starts, and when it holds one that cannot. */
function serviceFor(entries: { path: string; content: string }[]): GamesService {
  return createGamesService({
    db: db(),
    clock: systemClock,
    files,
    github: githubHolding(entries),
    schedule: decisionsOff,
  });
}

/** A maker who has connected GitHub, and the game they have just named. */
let beginCount = 0;
async function begin(name = `Tower Run ${String(++beginCount)}`) {
  const makerUserId = await createUser(db());
  await connectMaker(makerUserId, "acme/game");
  const started = await service.startGame({ makerUserId, name });
  return { makerUserId, ...started };
}

/** Moves a game to `state` with every answer in place, as the database requires of any game past draft. */
async function setState(id: string, state: string): Promise<void> {
  await db().$executeRawUnsafe(
    `UPDATE "Game" SET "state" = '${state}', "oneLine" = COALESCE("oneLine", 'A line.'),
       "playsOn" = COALESCE("playsOn", 'phone_and_computer'), "repoFullName" = COALESCE("repoFullName", 'acme/game'),
       "ageRating" = COALESCE("ageRating", 'age_12') WHERE "id" = $1`,
    id,
  );
}

const FILES_ANSWER: Answer = {
  question: "files",
  repo: { fullName: "acme/game", branch: null, folder: "" },
};

describe("startGame", () => {
  it("makes a draft with only its name, an address and a public id of its own", async () => {
    const maker = await createUser(db());
    const made = await service.startGame({ makerUserId: maker, name: "  Floor Fifty  " });

    expect(made.slug).toBe("floor-fifty");
    expect(await db().game.findUniqueOrThrow({ where: { id: made.id } })).toMatchObject({
      makerUserId: maker,
      name: "Floor Fifty",
      oneLine: null,
      // Every game plays on phones and computers, so a new draft says so before it is asked anything.
      playsOn: "phone_and_computer",
      repoFullName: null,
      ageRating: null,
      contentMarks: [],
      toFix: [],
      state: "draft",
      freeToPlay: false,
      livePullId: null,
    });
    expect((await db().game.findUniqueOrThrow({ where: { id: made.id } })).publicId).toMatch(PUBLIC_ID);
  });

  it.each([
    ["", "A game needs a name."],
    ["   ", "A game needs a name."],
    ["x".repeat(61), "A game's name can be up to 60 characters."],
    ["!!", "Pick a name with at least three letters or numbers."],
    ["ab", "Pick a name with at least three letters or numbers."],
  ])("refuses the name %j", async (name, message) => {
    await expect(service.startGame({ makerUserId: await createUser(db()), name })).rejects.toMatchObject({
      name: "GameError",
      code: "INVALID",
      message,
      field: "name",
    });
  });

  it("gives two games with one name addresses of their own", async () => {
    const first = await service.startGame({ makerUserId: await createUser(db()), name: "Cloud Nine" });
    const second = await service.startGame({ makerUserId: await createUser(db()), name: "Cloud Nine" });
    expect(first.slug).toBe("cloud-nine");
    expect(second.slug).toBe("cloud-nine-2");
  });

  it("takes a name of 60 characters", async () => {
    await expect(
      service.startGame({ makerUserId: await createUser(db()), name: `Sixty ${"z".repeat(54)}` }),
    ).resolves.toBeDefined();
  });

  it("cuts a 40-character address to 38 before it adds a number", async () => {
    const name = "b".repeat(40);
    const maker = await createUser(db());
    expect((await service.startGame({ makerUserId: maker, name })).slug).toBe(name);
    expect((await service.startGame({ makerUserId: maker, name })).slug).toBe(`${"b".repeat(38)}-2`);
  });

  it("drops a hyphen the cut leaves at the end", async () => {
    const name = `${"c".repeat(37)} dd`;
    const maker = await createUser(db());
    expect((await service.startGame({ makerUserId: maker, name })).slug).toBe(`${"c".repeat(37)}-dd`);
    expect((await service.startGame({ makerUserId: maker, name })).slug).toBe(`${"c".repeat(37)}-2`);
  });

  it("stops at -9 and says the name is taken", async () => {
    const maker = await createUser(db());
    const slugs: string[] = [];
    for (let i = 0; i < 9; i += 1) {
      slugs.push((await service.startGame({ makerUserId: maker, name: "Popular Game" })).slug);
    }
    expect(slugs).toEqual([
      "popular-game",
      ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `popular-game-${String(n)}`),
    ]);
    await expect(service.startGame({ makerUserId: maker, name: "Popular Game" })).rejects.toMatchObject({
      code: "INVALID",
      message: "That name is taken. Pick another.",
      field: "name",
    });
  });
});

describe("saveAnswer", () => {
  it("keeps each answer on the game, one at a time", async () => {
    const { makerUserId, id } = await begin();

    await service.saveAnswer(id, makerUserId, { question: "line", oneLine: "  Climb fifty floors.  " });
    await service.saveAnswer(id, makerUserId, { question: "age", ageRating: "age_12" });

    expect(await db().game.findUniqueOrThrow({ where: { id } })).toMatchObject({
      oneLine: "Climb fifty floors.",
      playsOn: "phone_and_computer",
      ageRating: "age_12",
    });
  });

  it("refuses a bad answer in that answer's words, and keeps nothing", async () => {
    const { makerUserId, id } = await begin();

    await expect(
      service.saveAnswer(id, makerUserId, { question: "line", oneLine: "  " }),
    ).rejects.toMatchObject({
      code: "INVALID",
      message: "A game needs one line about it.",
      field: "oneLine",
    });
    await expect(
      service.saveAnswer(id, makerUserId, {
        question: "files",
        repo: { fullName: "acme/game", branch: "a b", folder: "" },
      }),
    ).rejects.toMatchObject({ code: "INVALID", message: "That doesn't look like a branch name." });
    await expect(
      service.saveAnswer(id, makerUserId, { question: "marks", contentMarks: [] }),
    ).rejects.toMatchObject({ code: "INVALID", message: "Choose at least one, or None of these." });

    expect(await db().game.findUniqueOrThrow({ where: { id } })).toMatchObject({
      oneLine: null,
      repoFullName: null,
    });
  });

  // The route checks the list as it was typed; the service checks it again, so a later caller cannot skip the check.
  it("refuses websites that are not websites, and keeps nothing", async () => {
    const { makerUserId, id } = await begin();

    await expect(
      service.saveAnswer(id, makerUserId, { question: "websites", connectHosts: ["not a website"] }),
    ).rejects.toMatchObject({
      code: "INVALID",
      message: "Write each website like api.example.com. Five at most.",
    });
    await expect(
      service.saveAnswer(id, makerUserId, {
        question: "websites",
        connectHosts: [
          "a.example.com",
          "b.example.com",
          "c.example.com",
          "d.example.com",
          "e.example.com",
          "f.example.com",
        ],
      }),
    ).rejects.toMatchObject({ code: "INVALID" });

    expect((await db().game.findUniqueOrThrow({ where: { id } })).connectHosts).toEqual([]);
  });

  it("keeps a list of websites in lower case, without blank lines", async () => {
    const { makerUserId, id } = await begin();

    await service.saveAnswer(id, makerUserId, {
      question: "websites",
      connectHosts: ["API.example.com", " ", "cdn.example.com"],
    });

    expect((await db().game.findUniqueOrThrow({ where: { id } })).connectHosts).toEqual([
      "api.example.com",
      "cdn.example.com",
    ]);
  });

  // The websites are part of a copy: staff review the list with the files, and a copy is never changed once it is
  // made (GamePull is add-only, so the database refuses to rewrite one). A new list is therefore a new copy.
  it("copies the game again when the websites are saved, so the newest copy carries the list", async () => {
    const { makerUserId, id } = await begin();
    await serviceFor(GOOD_FILES).saveAnswer(id, makerUserId, FILES_ANSWER);

    await serviceFor(GOOD_FILES).saveAnswer(id, makerUserId, {
      question: "websites",
      connectHosts: ["New.example.com"],
    });

    const copies = await db().gamePull.findMany({ where: { gameId: id }, orderBy: { pulledAt: "asc" } });
    expect(copies.map((copy) => copy.connectHosts)).toEqual([[], ["new.example.com"]]);
    expect((await db().game.findUniqueOrThrow({ where: { id } })).connectHosts).toEqual(["new.example.com"]);
  });

  // Someone else's game is simply not there, at every answer.
  it("says another maker's game is not there, for every answer", async () => {
    const { id } = await begin();
    const stranger = await createUser(db());
    const answers: Answer[] = [
      { question: "name", name: "Another" },
      { question: "line", oneLine: "A line." },
      FILES_ANSWER,
      { question: "age", ageRating: "age_12" },
      { question: "marks", contentMarks: ["gore"] },
      { question: "websites", connectHosts: [] },
    ];

    for (const answer of answers) {
      await expect(service.saveAnswer(id, stranger, answer), answer.question).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "We can't find that game.",
      });
    }
  });

  // Before a game was ever live, its address follows its name.
  it("moves a draft's address to its new name, and a name already taken gets a number", async () => {
    const { makerUserId, id, slug } = await begin("Tower");
    expect(slug).toBe("tower");

    expect(await service.saveAnswer(id, makerUserId, { question: "name", name: "Summit" })).toEqual({
      slug: "summit",
    });
    expect(await db().game.findUnique({ where: { slug: "tower" } })).toBeNull();

    await begin("Summit");
    expect(await service.saveAnswer(id, makerUserId, { question: "name", name: "Summit" })).toEqual({
      slug: "summit",
    });
  });

  it("keeps a game's address under a new name once staff have accepted it", async () => {
    const { makerUserId, id } = await begin("Skyline");
    await db().game.update({ where: { id }, data: { ageRating: "age_12" } });
    await db().gameReview.create({
      data: {
        gameId: id,
        pullId: await addPull(id),
        staffUserId: await createUser(db()),
        decision: "accepted",
        decidedAt: new Date(),
      },
    });

    const kept = await service.saveAnswer(id, makerUserId, { question: "name", name: "Skyline Two" });

    expect(kept.slug).toBe("skyline");
    expect((await db().game.findUniqueOrThrow({ where: { id } })).name).toBe("Skyline Two");
  });

  it("copies the game for the files answer, and keeps what was chosen", async () => {
    const { makerUserId, id } = await begin();
    const pulling = serviceFor(GOOD_FILES);

    await pulling.saveAnswer(id, makerUserId, FILES_ANSWER);

    expect(await db().game.findUniqueOrThrow({ where: { id } })).toMatchObject({
      repoFullName: "acme/game",
      pullProblem: null,
    });
    expect(await db().gamePull.count({ where: { gameId: id } })).toBe(1);
  });

  // The choice stays, so the screen that asked can show it beside the refusal.
  it("refuses files that cannot start, keeping the repository that was chosen", async () => {
    const { makerUserId, id } = await begin();
    const refusing = serviceFor(NO_INDEX);

    await expect(refusing.saveAnswer(id, makerUserId, FILES_ANSWER)).rejects.toMatchObject({
      code: "FILES_REFUSED",
    });

    expect(await db().game.findUniqueOrThrow({ where: { id } })).toMatchObject({
      repoFullName: "acme/game",
      pullProblem: expect.stringContaining("index.html") as string,
    });
    expect(NO_INDEX_WORDS).toContain("index.html");
  });

  // A 12+ game has no marks, and the counter goes back to seven.
  it("clears an 18+ game's marks when it is made younger", async () => {
    const { makerUserId, id } = await begin();
    await service.saveAnswer(id, makerUserId, { question: "age", ageRating: "age_18" });
    await service.saveAnswer(id, makerUserId, { question: "marks", contentMarks: ["gore"] });

    await service.saveAnswer(id, makerUserId, { question: "age", ageRating: "age_12" });

    expect((await db().game.findUniqueOrThrow({ where: { id } })).contentMarks).toEqual([]);
  });

  it("refuses marks on a game that is not 18+", async () => {
    const { makerUserId, id } = await begin();
    await service.saveAnswer(id, makerUserId, { question: "age", ageRating: "age_12" });

    await expect(
      service.saveAnswer(id, makerUserId, { question: "marks", contentMarks: ["gore"] }),
    ).rejects.toMatchObject({ code: "NOT_READY" });
  });

  // The database holds an 18+ game that is past draft to having its marks, so the rating and the marks are one write:
  // a rating alone would be refused by the database, and the maker would be told nothing.
  it.each(["waiting", "sent_back"])(
    "does not keep 18+ on a %s game without its marks, and the rating it had stays",
    async (state) => {
      const { makerUserId, id } = await begin();
      await setState(id, state);

      await expect(
        service.saveAnswer(id, makerUserId, { question: "age", ageRating: "age_18" }),
      ).rejects.toMatchObject({
        name: "GameError",
        code: "INVALID",
        message: "Choose at least one, or None of these.",
      });

      expect((await db().game.findUniqueOrThrow({ where: { id } })).ageRating).toBe("age_12");
    },
  );

  it.each(["waiting", "sent_back"])("keeps 18+ and its marks together on a %s game", async (state) => {
    const { makerUserId, id } = await begin();
    await setState(id, state);

    // The age answer takes its marks beside it.
    await service.saveAnswer(id, makerUserId, {
      question: "age",
      ageRating: "age_18",
      contentMarks: ["gore"],
    });

    expect(await db().game.findUniqueOrThrow({ where: { id } })).toMatchObject({
      ageRating: "age_18",
      contentMarks: ["gore"],
    });
  });

  it("still takes 18+ on a draft without its marks, which the marks question asks for next", async () => {
    const { makerUserId, id } = await begin();

    await service.saveAnswer(id, makerUserId, { question: "age", ageRating: "age_18" });

    expect((await db().game.findUniqueOrThrow({ where: { id } })).ageRating).toBe("age_18");
  });

  it("keeps only None of these when it is picked beside another mark", async () => {
    const { makerUserId, id } = await begin();
    await service.saveAnswer(id, makerUserId, { question: "age", ageRating: "age_18" });

    await service.saveAnswer(id, makerUserId, { question: "marks", contentMarks: ["gore", "none"] });

    expect((await db().game.findUniqueOrThrow({ where: { id } })).contentMarks).toEqual(["none"]);
  });

  it("lets a live game change its name and its line, and holds its rating for a yes", async () => {
    const { makerUserId, id } = await begin();
    const pulling = serviceFor(GOOD_FILES);
    await pulling.saveAnswer(id, makerUserId, FILES_ANSWER);
    await db().game.update({
      where: { id },
      data: { ageRating: "age_12", oneLine: "x", playsOn: "computer_only" },
    });
    await makeLive(id, (await db().gamePull.findFirstOrThrow({ where: { gameId: id } })).id);

    await service.saveAnswer(id, makerUserId, { question: "line", oneLine: "A better line." });
    // Where a game plays is no longer a question: even a hand-made answer is not the maker's to change.
    await expect(
      service.saveAnswer(id, makerUserId, {
        question: "plays-on",
        playsOn: "computer_only",
      } as unknown as Answer),
    ).rejects.toMatchObject({ code: "NOT_READY", message: "That can't be changed right now." });
    expect((await db().game.findUniqueOrThrow({ where: { id } })).playsOn).toBe("computer_only");
    // The rating is held apart for a yes and sent with the game's videos, so what players see does not move.
    for (const shape of ["upright", "wide"] as const)
      await db().gameClip.create({
        data: { gameId: id, shape, key: `clips/x/${shape}.mp4`, contentType: "video/mp4", bytes: 3 },
      });
    await service.saveAnswer(id, makerUserId, { question: "age", ageRating: "age_16" });
    expect(await db().game.findUniqueOrThrow({ where: { id } })).toMatchObject({
      ageRating: "age_12",
      heldAgeRating: "age_16",
    });
  });

  it("takes every answer of a draft, a waiting game and a sent-back game alike", async () => {
    const { makerUserId, id } = await begin();
    for (const state of ["waiting", "sent_back"] as const) {
      await setState(id, state);
      await service.saveAnswer(id, makerUserId, { question: "line", oneLine: `A line in ${state}.` });
    }
  });

  it("refuses a game that is taken off or down", async () => {
    const { makerUserId, id } = await begin();
    await setState(id, "taken_off");

    await expect(
      service.saveAnswer(id, makerUserId, { question: "line", oneLine: "x" }),
    ).rejects.toMatchObject({ code: "NOT_READY", message: "That can't be changed right now." });
  });
});

describe("throwAway", () => {
  /** A sent-back game with files and two clips in the bucket. */
  async function sentBackGame() {
    const { makerUserId, id } = await begin("Doomed Game");
    const pulling = serviceFor(GOOD_FILES);
    await pulling.saveAnswer(id, makerUserId, FILES_ANSWER);
    await service.saveClip(id, "upright", { contentType: "video/mp4", bytes: mp4Bytes() });
    await service.saveClip(id, "wide", { contentType: "video/mp4", bytes: mp4Bytes() });
    await setState(id, "sent_back");
    const game = await db().game.findUniqueOrThrow({ where: { id } });
    return { makerUserId, id, publicId: game.publicId };
  }

  it("deletes the files and both videos, drops the game from every list and frees its name", async () => {
    const { makerUserId, id, publicId } = await sentBackGame();
    expect(files.keys().some((key) => key.includes(publicId))).toBe(true);

    expect(await service.throwAway(id, makerUserId)).toEqual({ name: "Doomed Game" });

    expect(files.keys().filter((key) => key.includes(publicId))).toEqual([]);
    expect(await db().gameClip.count({ where: { gameId: id } })).toBe(0);
    expect((await service.gamesOf(makerUserId)).map((row) => row.name)).not.toContain("Doomed Game");
    expect(await service.gameForMaker("doomed-game", makerUserId)).toBeNull();
    expect((await service.startGame({ makerUserId, name: "Doomed Game" })).slug).toBe("doomed-game");
  });

  it("throws a draft away too", async () => {
    const { makerUserId, id } = await begin("Short Draft");
    await expect(service.throwAway(id, makerUserId)).resolves.toEqual({ name: "Short Draft" });
  });

  it("refuses a waiting game and a live game, and changes nothing", async () => {
    for (const state of ["waiting", "live"]) {
      const { makerUserId, id } = await begin();
      await db().$executeRawUnsafe(`UPDATE "Game" SET "state" = 'draft' WHERE "id" = $1`, id);
      const pullId = await addPull(id);
      await db().game.update({
        where: { id },
        data: { ageRating: "age_12", oneLine: "x", playsOn: "computer_only", repoFullName: "acme/game" },
      });
      if (state === "live") await makeLive(id, pullId);
      else await db().game.update({ where: { id }, data: { state: "waiting", pendingPullId: pullId } });

      await expect(service.throwAway(id, makerUserId), state).rejects.toMatchObject({
        code: "NOT_READY",
        message: "This game can't be thrown away.",
      });
      expect((await db().game.findUniqueOrThrow({ where: { id } })).state).toBe(state);
    }
  });

  it("says another maker's game is not there", async () => {
    const { id } = await begin();
    await expect(service.throwAway(id, await createUser(db()))).rejects.toMatchObject({ code: "NOT_FOUND" });
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
      ageRating: "age_12",
      contentMarks: [],
      freeToPlay: false,
      showsPlayerCount: false,
      makerUserId: game.makerUserId,
      livePullId: pullId,
      connectHosts: ["api.example.com"],
      clips: { upright: keyOf("upright"), wide: keyOf("wide") },
    });
  });
});

describe("moreLiveGamesBy", () => {
  /** A live game for this maker, with both clips. */
  async function liveGameOf(makerUserId: string) {
    const game = await db().game.create({
      data: {
        publicId: newPublicId(),
        slug: `more-${String((made += 1))}`,
        makerUserId,
        name: "Another",
        oneLine: "x",
        playsOn: "phone_and_computer",
        repoFullName: "acme/game",
        ageRating: "age_7",
      },
    });
    await addBothClips(game.id);
    await makeLive(game.id, await addPull(game.id, []));
    return game;
  }

  it("lists the maker's other live games, newest accepted first, at most six, and never the game itself", async () => {
    const mine = await newGame();
    const makerUserId = mine.makerUserId;
    await makeLive(mine.id, await addPull(mine.id, []));
    const others = [];
    for (let i = 0; i < 7; i += 1) others.push(await liveGameOf(makerUserId));

    const more = await service.moreLiveGamesBy(makerUserId, mine.slug);

    expect(more).toHaveLength(6);
    expect(more.map((one) => one.slug)).toEqual(
      others
        .slice(1)
        .reverse()
        .map((one) => one.slug),
    );
    expect(more.some((one) => one.slug === mine.slug)).toBe(false);
  });

  it("orders by when each game first went live, not by when its files were copied", async () => {
    const mine = await newGame();
    const makerUserId = mine.makerUserId;
    await makeLive(mine.id, await addPull(mine.id, []));
    const day = 86_400_000;
    const ago = (days: number) => new Date(Date.now() - days * day);
    const accept = async (game: { id: string }, decidedAt: Date, held?: Date) => {
      const pullId = await addPull(game.id, []);
      const goesOutOn = held === undefined ? null : new Date(held.toISOString().slice(0, 10));
      const review = await db().gameReview.create({
        data: {
          gameId: game.id,
          pullId,
          staffUserId: makerUserId,
          decision: "accepted",
          decidedAt,
          goesOutOn,
        },
      });
      if (held !== undefined && goesOutOn !== null) {
        await db().decisionDay.upsert({
          where: { day: goesOutOn },
          update: {},
          create: { day: goesOutOn, seats: 10, wentOutAt: held },
        });
        await db().decisionOutcome.create({ data: { reviewId: review.id, result: "applied" } });
      }
    };
    // Created (so their files were copied) in this order, which is the opposite of the order they got in.
    const newest = await liveGameOf(makerUserId);
    const held = await liveGameOf(makerUserId);
    const second = await liveGameOf(makerUserId);
    const first = await liveGameOf(makerUserId);
    await accept(first, ago(10));
    // A later yes on an update must not move a game up.
    await accept(first, ago(0));
    await accept(second, ago(5));
    // Decided long ago, but held: it went live when its decision day went out.
    await accept(held, ago(20), ago(2));
    await accept(newest, ago(1));

    const more = await service.moreLiveGamesBy(makerUserId, mine.slug);

    expect(more.map((one) => one.slug)).toEqual([newest.slug, held.slug, second.slug, first.slug]);
  });

  it("leaves out games that are not live and other makers' games", async () => {
    const mine = await newGame();
    await db().game.create({
      data: {
        publicId: newPublicId(),
        slug: `more-${String((made += 1))}`,
        makerUserId: mine.makerUserId,
        name: "Draft",
      },
    });
    await liveGameOf(await createUser(db()));

    expect(await service.moreLiveGamesBy(mine.makerUserId, mine.slug)).toEqual([]);
  });
});

describe("liveGames", () => {
  /** A live game for this maker, with both clips. */
  async function liveGameOf(makerUserId: string) {
    const game = await db().game.create({
      data: {
        publicId: newPublicId(),
        slug: `listed-${String((made += 1))}`,
        makerUserId,
        name: "Listed",
        oneLine: "x",
        playsOn: "phone_and_computer",
        repoFullName: "acme/game",
        ageRating: "age_7",
      },
    });
    await addBothClips(game.id);
    await makeLive(game.id, await addPull(game.id, []));
    return game;
  }

  /** An accepted review that took effect at once, as a decision on the given day leaves it. */
  async function accept(gameId: string, decidedAt: Date, staffUserId: string, held?: Date) {
    const goesOutOn = held === undefined ? null : new Date(held.toISOString().slice(0, 10));
    const review = await db().gameReview.create({
      data: {
        gameId,
        pullId: await addPull(gameId, []),
        staffUserId,
        decision: "accepted",
        decidedAt,
        goesOutOn,
      },
    });
    if (held !== undefined && goesOutOn !== null) {
      await db().decisionDay.upsert({
        where: { day: goesOutOn },
        update: {},
        create: { day: goesOutOn, seats: 10, wentOutAt: held },
      });
      await db().decisionOutcome.create({ data: { reviewId: review.id, result: "applied" } });
    }
  }

  const day = 86_400_000;
  const ago = (days: number) => new Date(Date.now() - days * day);

  it("lists every live game of one maker as a live game plus when it went live, and no other", async () => {
    const maker = await createUser(db());
    const live = await liveGameOf(maker);
    await liveGameOf(await createUser(db()));
    await db().game.create({
      data: {
        publicId: newPublicId(),
        slug: `listed-${String((made += 1))}`,
        makerUserId: maker,
        name: "Draft",
      },
    });

    const listed = await service.liveGames({ makerUserId: maker });

    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ ...(await service.liveGameBySlug(live.slug)) });
    expect(listed[0]?.liveSince).toBeInstanceOf(Date);
  });

  it("lists the games of every maker when no maker is named", async () => {
    const one = await liveGameOf(await createUser(db()));
    const other = await liveGameOf(await createUser(db()));

    const slugs = (await service.liveGames()).map((game) => game.slug);

    expect(slugs).toEqual(expect.arrayContaining([one.slug, other.slug]));
  });

  it("leaves out a game that is waiting, sent back or taken off", async () => {
    const maker = await createUser(db());
    const live = await liveGameOf(maker);
    for (const state of ["waiting", "sent_back", "taken_off"] as const) {
      const game = await liveGameOf(maker);
      await db().game.update({ where: { id: game.id }, data: { state } });
    }

    expect((await service.liveGames({ makerUserId: maker })).map((game) => game.slug)).toEqual([live.slug]);
  });

  it("dates a game by its first accepted review, a held yes by its decision day, and a later yes moves nothing", async () => {
    const maker = await createUser(db());
    const first = await liveGameOf(maker);
    const held = await liveGameOf(maker);
    const setByHand = await liveGameOf(maker);
    const decidedAt = ago(10);
    await accept(first.id, decidedAt, maker);
    await accept(first.id, ago(0), maker);
    // A day of its own: decision days are one row per date, and the "More from" tests above use the date two days back.
    const wentOutAt = ago(7);
    await accept(held.id, ago(20), maker, wentOutAt);

    const listed = await service.liveGames({ makerUserId: maker });
    const since = (slug: string) => listed.find((game) => game.slug === slug)?.liveSince;
    const copy = await db().gamePull.findFirstOrThrow({ where: { gameId: setByHand.id } });

    expect(since(first.slug)).toEqual(decidedAt);
    expect(since(held.slug)).toEqual(wentOutAt);
    expect(since(setByHand.slug)).toEqual(copy.createdAt);
  });

  it("does not move a game's date when it is taken off and put back", async () => {
    const maker = await createUser(db());
    const game = await liveGameOf(maker);
    const decidedAt = ago(6);
    await accept(game.id, decidedAt, maker);
    await db().game.update({ where: { id: game.id }, data: { state: "taken_off" } });
    await db().game.update({ where: { id: game.id }, data: { state: "live" } });

    const [listed] = await service.liveGames({ makerUserId: maker });

    expect(listed?.liveSince).toEqual(decidedAt);
  });
});

describe("pullLatest", () => {
  it("pulls with the service's own GitHub and bucket", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const github: GitHub = {
      commitOf: () => Promise.resolve(sha),
      branchesOf: () => Promise.resolve([]),
      installationOf,
      tarball: async () =>
        new Blob([await tarGz([{ path: "top/index.html", content: "<html></html>" }])]).stream(),
    };
    const pulling = createGamesService({
      db: db(),
      clock: systemClock,
      files,
      github,
      schedule: decisionsOff,
    });
    const game = await newGame();
    await connectMaker(game.makerUserId, "acme/game");

    const pull = await pulling.pullLatest(game.id);

    expect(pull).toMatchObject({ commitSha: sha, fileCount: 1 });
    expect(files.keys()).toContain(`files/${game.publicId}/${pull.id}/index.html`);
  });
});

describe("setShowsPlayerCount", () => {
  const shows = async (gameId: string) =>
    (await db().game.findUniqueOrThrow({ where: { id: gameId } })).showsPlayerCount;

  it("is off for a new game, and its maker turns it on and off", async () => {
    const game = await newGame();
    expect(await shows(game.id)).toBe(false);
    await service.setShowsPlayerCount(game.id, game.makerUserId, true);
    expect(await shows(game.id)).toBe(true);
    await service.setShowsPlayerCount(game.id, game.makerUserId, false);
    expect(await shows(game.id)).toBe(false);
  });

  it("refuses another account and changes nothing", async () => {
    const game = await newGame();
    await expect(service.setShowsPlayerCount(game.id, await createUser(db()), true)).rejects.toMatchObject({
      name: "GameError",
      code: "NOT_FOUND",
    });
    expect(await shows(game.id)).toBe(false);
  });
});
