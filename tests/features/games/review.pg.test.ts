import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { GitHub } from "../../../src/features/games/github.ts";
import { newPublicId } from "../../../src/features/games/ids.ts";
import { createGamesService, type GamesService } from "../../../src/features/games/service.ts";
import type { AgeRating, ContentMark, PrismaClient } from "../../../src/lib/server/db.ts";
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
      // Every question is answered, because a game past draft must have every answer.
      ageRating: "age_12",
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

/**
 * Staff look at a game and press the button without changing anything on the page: what the check page does. The
 * rating and marks staff choose are the maker's own unless a test says otherwise.
 */
async function acceptAsSeen(
  game: { id: string; slug: string },
  staff: string,
  choose: { ageRating?: AgeRating; contentMarks?: ContentMark[] } = {},
): Promise<void> {
  const looked = await lookAt(game.slug);
  await service.accept(game.id, staff, {
    ageRating: choose.ageRating ?? looked.ageRating ?? "age_12",
    contentMarks: choose.contentMarks ?? looked.contentMarks,
    seen: looked.seen,
  });
}

/** The same for a send back: what was seen is what the page showed a moment ago. */
async function sendBackAsSeen(
  game: { id: string; slug: string },
  staff: string,
  parts: Parameters<GamesService["sendBack"]>[2],
): Promise<void> {
  await service.sendBack(game.id, staff, parts, (await lookAt(game.slug)).seen);
}

async function lookAt(slug: string) {
  const looked = await service.gameForReview(slug);
  if (looked === null) throw new Error(`${slug} is not there to look at`);
  return looked;
}

async function stateOf(gameId: string) {
  return db().game.findUniqueOrThrow({ where: { id: gameId } });
}

describe("sendForReview", () => {
  it.each([
    ["no files", false, true, true, "Add your game's files first."],
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

  it("refuses a game with an answer missing, in words, and changes nothing", async () => {
    const game = await readyGame();
    await db().game.update({ where: { id: game.id }, data: { ageRating: null } });

    await expect(service.sendForReview(game.id, game.makerUserId)).rejects.toMatchObject({
      name: "GameError",
      code: "NOT_READY",
      message: "Answer every question first.",
    });
    expect(await stateOf(game.id)).toMatchObject({ state: "draft", pendingPullId: null });
  });

  it("refuses an 18+ game that has not answered its marks", async () => {
    const game = await readyGame();
    await db().game.update({ where: { id: game.id }, data: { ageRating: "age_18" } });

    await expect(service.sendForReview(game.id, game.makerUserId)).rejects.toMatchObject({
      message: "Answer every question first.",
    });
  });

  it("refuses a game with something still to fix", async () => {
    const game = await readyGame();
    await db().game.update({ where: { id: game.id }, data: { toFix: ["name"] } });

    await expect(service.sendForReview(game.id, game.makerUserId)).rejects.toMatchObject({
      code: "NOT_READY",
      message: "Fix what was sent back first.",
    });
  });

  // A copy that was refused writes no pull, so the older passing pull is still the newest: it must not be sent.
  it("refuses a game whose last copy was refused, and sends nothing", async () => {
    const game = await readyGame();
    await db().game.update({
      where: { id: game.id },
      data: { state: "sent_back", pullProblem: "We couldn't find an index.html." },
    });

    await expect(service.sendForReview(game.id, game.makerUserId)).rejects.toMatchObject({
      code: "NOT_READY",
      message: "Your game's files need fixing first.",
    });
    expect(await stateOf(game.id)).toMatchObject({ state: "sent_back", pendingPullId: null });
  });

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
    await acceptAsSeen(game, await createUser(db()));
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

    await acceptAsSeen(game, staff);

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
        decidedAt: new Date(clock.epochMs()),
      },
    ]);
  });

  it("empties what was left to fix", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);
    await db().game.update({ where: { id: game.id }, data: { toFix: ["wide_video"] } });

    await acceptAsSeen(game, await createUser(db()));

    expect((await stateOf(game.id)).toFix).toEqual([]);
  });

  it("says so when nothing is waiting, and writes nothing", async () => {
    const game = await readyGame();

    await expect(acceptAsSeen(game, await createUser(db()))).rejects.toMatchObject({
      code: "NOT_READY",
      message: "Nothing is waiting for review.",
    });
    expect(await db().gameReview.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("puts a live game's update live on the new files, and the old files stay in the bucket", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);
    await acceptAsSeen(game, await createUser(db()));
    await files.put(`files/${game.publicId}/${game.pullId}/index.html`, new Uint8Array([1]));
    const update = await addPull(game.id);
    await service.sendForReview(game.id, game.makerUserId);

    await acceptAsSeen(game, await createUser(db()));

    expect(await stateOf(game.id)).toMatchObject({ state: "live", livePullId: update, pendingPullId: null });
    expect(files.keys()).toContain(`files/${game.publicId}/${game.pullId}/index.html`);
  });
});

describe("sendBack", () => {
  /** A game that is waiting for staff, and a staff member to answer it. */
  async function waitingGame() {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);
    return { game, staff: await createUser(db()) };
  }

  async function partRows(gameId: string) {
    return db().$queryRaw<{ part: string; reason: string; note: string | null }[]>`
      SELECT p."part"::text AS part, p."reason", p."note"
      FROM "GameReviewPart" p JOIN "GameReview" r ON r."id" = p."reviewId"
      WHERE r."gameId" = ${gameId} ORDER BY p."createdAt", p."part"`;
  }

  it("sends a game back part by part, and records each part with its reason", async () => {
    const { game, staff } = await waitingGame();

    await sendBackAsSeen(game, staff, [
      { part: "name", reason: "rude" },
      { part: "upright_video", reason: "sideways" },
    ]);

    expect(await stateOf(game.id)).toMatchObject({
      state: "sent_back",
      toFix: ["name", "upright_video"],
      pendingPullId: null,
      livePullId: null,
    });
    expect(await db().gameReview.findMany({ where: { gameId: game.id } })).toMatchObject([
      { staffUserId: staff, decision: "sent_back", pullId: game.pullId },
    ]);
    expect(await partRows(game.id)).toEqual([
      { part: "name", reason: "rude", note: null },
      { part: "upright_video", reason: "sideways", note: null },
    ]);
  });

  it("gives the maker each reason in plain words, with the game's name in it", async () => {
    const { game, staff } = await waitingGame();

    await sendBackAsSeen(game, staff, [
      { part: "name", reason: "rude" },
      { part: "upright_video", reason: "sideways" },
    ]);

    expect((await service.gameForMaker(game.slug, game.makerUserId))?.toFix).toEqual([
      {
        part: "name",
        title: "Name: A game",
        words: "We can't show this name on Ruken. It's rude. Pick another.",
        note: null,
      },
      {
        part: "upright_video",
        title: "Upright video",
        words: "It's sideways. Turn it the right way up.",
        note: null,
      },
    ]);
  });

  it("keeps staff's own line for Something else, and shows it as the words", async () => {
    const { game, staff } = await waitingGame();

    await sendBackAsSeen(game, staff, [
      { part: "one_line", reason: "something_else", note: "  Say what the game is.  " },
    ]);

    expect(await partRows(game.id)).toEqual([
      { part: "one_line", reason: "something_else", note: "Say what the game is." },
    ]);
    // The line is the card's words already; as a note too it would be printed twice.
    expect((await service.gameForMaker(game.slug, game.makerUserId))?.toFix[0]).toMatchObject({
      words: "Say what the game is.",
      note: null,
    });
  });

  it("shows staff's own line beside a reason from the list, as a note under the words", async () => {
    const { game, staff } = await waitingGame();

    await sendBackAsSeen(game, staff, [
      { part: "upright_video", reason: "too_dark", note: "The second level is hard to see." },
    ]);

    expect((await service.gameForMaker(game.slug, game.makerUserId))?.toFix[0]).toMatchObject({
      words: "It's too dark to see. Record it again, brighter.",
      note: "The second level is hard to see.",
    });
  });

  it.each([
    ["no part ticked", [], "Tick what's wrong first."],
    [
      "a reason from another part",
      [{ part: "name", reason: "sideways" }],
      "Pick a reason for each part you ticked.",
    ],
    [
      "a part twice",
      [
        { part: "name", reason: "rude" },
        { part: "name", reason: "not_this_game" },
      ],
      "Pick a reason for each part you ticked.",
    ],
    [
      "Something else with no line",
      [{ part: "name", reason: "something_else" }],
      "Say what's wrong in your own words.",
    ],
    [
      "Something else with a blank line",
      [{ part: "name", reason: "something_else", note: "   " }],
      "Say what's wrong in your own words.",
    ],
  ] as const)("refuses %s, and changes nothing", async (_why, parts, message) => {
    const { game, staff } = await waitingGame();

    await expect(
      sendBackAsSeen(game, staff, parts as unknown as Parameters<GamesService["sendBack"]>[2]),
    ).rejects.toMatchObject({ code: "INVALID", message });

    expect(await stateOf(game.id)).toMatchObject({ state: "waiting", toFix: [] });
    expect(await db().gameReview.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("leaves a live game live on its old files when its update is sent back", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);
    await acceptAsSeen(game, await createUser(db()));
    await addPull(game.id);
    await service.sendForReview(game.id, game.makerUserId);

    await sendBackAsSeen(game, await createUser(db()), [{ part: "files", reason: "breaks" }]);

    expect(await stateOf(game.id)).toMatchObject({
      state: "live",
      livePullId: game.pullId,
      pendingPullId: null,
      toFix: ["files"],
    });
  });

  it("says so when nothing is waiting", async () => {
    const game = await readyGame();

    await expect(
      sendBackAsSeen(game, await createUser(db()), [{ part: "name", reason: "rude" }]),
    ).rejects.toMatchObject({ code: "NOT_READY", message: "Nothing is waiting for review." });
  });

  // Review Focus 4: sent back for two things, one fixed, and the send is still refused.
  it("is not sendable again until every part is fixed, and fixing a video takes it off the list", async () => {
    const { game, staff } = await waitingGame();
    await sendBackAsSeen(game, staff, [
      { part: "name", reason: "rude" },
      { part: "upright_video", reason: "sideways" },
    ]);

    await service.saveAnswer(game.id, game.makerUserId, { question: "name", name: "Better name" });
    expect((await stateOf(game.id)).toFix).toEqual(["upright_video"]);
    await expect(service.sendForReview(game.id, game.makerUserId)).rejects.toMatchObject({
      message: "Fix what was sent back first.",
    });

    await addClip(game.id, "upright");
    expect((await stateOf(game.id)).toFix).toEqual([]);
    await service.sendForReview(game.id, game.makerUserId);
    expect(await stateOf(game.id)).toMatchObject({ state: "waiting" });
  });
});

describe("a part that is not one of a game's eight", () => {
  it("is refused in words, and nothing changes", async () => {
    const { game, staff } = await waitingGame();

    await expect(
      sendBackAsSeen(game, staff, [
        { part: "password" as unknown as "name", reason: "something_else", note: "Because." },
      ]),
    ).rejects.toMatchObject({ code: "INVALID", message: "Pick a reason for each part you ticked." });
    expect((await stateOf(game.id)).state).toBe("waiting");
  });
});

describe("a live game's update that was sent back", () => {
  /** A live game whose update waited and was sent back, for the parts given. */
  async function liveGameSentBack(parts: Parameters<GamesService["sendBack"]>[2]) {
    const game = await readyGame();
    await connect(game.makerUserId);
    await service.sendForReview(game.id, game.makerUserId);
    await acceptAsSeen(game, await createUser(db()));
    await addPull(game.id);
    await service.sendForReview(game.id, game.makerUserId);
    await sendBackAsSeen(game, await createUser(db()), parts);
    return game;
  }

  // The files are the update, and a live game's maker fixes them on GitHub: a copy that passes is the fix.
  it("takes the files off what was sent back when a copy passes", async () => {
    const game = await liveGameSentBack([{ part: "files", reason: "breaks" }]);
    expect((await stateOf(game.id)).toFix).toEqual(["files"]);

    await service.pullLatest(game.id);

    expect((await stateOf(game.id)).toFix).toEqual([]);
  });

  it("can send a new version after the files are copied again", async () => {
    const game = await liveGameSentBack([{ part: "files", reason: "breaks" }]);

    await service.pullLatest(game.id);
    await service.sendForReview(game.id, game.makerUserId);

    expect(await stateOf(game.id)).toMatchObject({ state: "live", toFix: [] });
    expect((await stateOf(game.id)).pendingPullId).not.toBeNull();
  });

  it("keeps the files to fix when the copy is refused", async () => {
    const game = await liveGameSentBack([{ part: "files", reason: "breaks" }]);
    const noIndexHtml: GitHub = {
      ...github,
      tarball: async () => new Blob([await tarGz([{ path: "top/readme.txt", content: "hello" }])]).stream(),
    };
    const refusing = createGamesService({ db: db(), clock, files, github: noIndexHtml });

    await expect(refusing.pullLatest(game.id)).rejects.toMatchObject({ code: "FILES_REFUSED" });

    expect((await stateOf(game.id)).toFix).toEqual(["files"]);
  });

  // The maker's Send it again is offered only when staff's newest word on the game was a send back.
  it("says whether staff's newest word on a game was a send back", async () => {
    const game = await readyGame();
    const sentBackLast = async () => (await service.gameForMaker(game.slug, game.makerUserId))?.sentBackLast;
    await service.sendForReview(game.id, game.makerUserId);
    expect(await sentBackLast()).toBe(false);
    await acceptAsSeen(game, await createUser(db()));
    expect(await sentBackLast()).toBe(false);

    await addPull(game.id);
    await service.sendForReview(game.id, game.makerUserId);
    await sendBackAsSeen(game, await createUser(db()), [
      { part: "one_line", reason: "something_else", note: "Say more." },
    ]);
    expect(await sentBackLast()).toBe(true);

    // Mended and sent again: staff have not said anything new yet, so it still reads as sent back until they do.
    await db().game.update({ where: { id: game.id }, data: { toFix: [] } });
    await service.sendForReview(game.id, game.makerUserId);
    expect(await sentBackLast()).toBe(true);
    // Reviews are told apart by when they were decided, so staff's yes comes a moment after their no.
    clock.advance(1_000);
    await acceptAsSeen(game, await createUser(db()));
    expect(await sentBackLast()).toBe(false);
  });

  it("takes a copy for another part off nothing else", async () => {
    const game = await liveGameSentBack([{ part: "one_line", reason: "something_else", note: "Say more." }]);

    await service.pullLatest(game.id);

    expect((await stateOf(game.id)).toFix).toEqual(["one_line"]);
  });

  // These four a live game's maker cannot change by herself (slice 4), so sending its update back for one would leave
  // it stuck for good.
  it.each(["upright_video", "wide_video", "age_rating", "other_websites"] as const)(
    "refuses to send an update back for %s, and changes nothing",
    async (part) => {
      const game = await readyGame();
      await service.sendForReview(game.id, game.makerUserId);
      await acceptAsSeen(game, await createUser(db()));
      await addPull(game.id);
      await service.sendForReview(game.id, game.makerUserId);

      await expect(
        sendBackAsSeen(game, await createUser(db()), [{ part, reason: "something_else", note: "No." }]),
      ).rejects.toMatchObject({
        code: "INVALID",
        message: "A live game can only be sent back for its name, its line, where it plays or its files.",
      });

      expect((await stateOf(game.id)).pendingPullId).not.toBeNull();
      expect(await stateOf(game.id)).toMatchObject({ state: "live", toFix: [] });
      expect(await db().gameReview.count({ where: { gameId: game.id, decision: "sent_back" } })).toBe(0);
    },
  );

  it("still sends a game that is not live back for any part", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);

    await sendBackAsSeen(game, await createUser(db()), [
      { part: "wide_video", reason: "something_else", note: "Again." },
    ]);

    expect(await stateOf(game.id)).toMatchObject({ state: "sent_back", toFix: ["wide_video"] });
  });
});

describe("the review record", () => {
  it("is only ever added", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);
    await acceptAsSeen(game, await createUser(db()));

    await expect(db().$executeRaw`UPDATE "GameReview" SET "decision" = 'sent_back'`).rejects.toThrow(
      /GameReview is append-only/,
    );
    await expect(db().$executeRaw`DELETE FROM "GameReview"`).rejects.toThrow(/GameReview is append-only/);
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
    await acceptAsSeen(game, await createUser(db()));
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
      {
        slug: game.slug,
        name: "A game",
        wideClipKey: expect.stringMatching(/^clips\/.*\/wide-/) as string,
        words: "Waiting for review",
      },
    ]);
    expect(await service.gamesOf(await createUser(db()))).toEqual([]);
  });

  it("tells the list where a draft stands, and what a game sent back needs", async () => {
    const game = await readyGame();
    expect(await service.gamesOf(game.makerUserId)).toMatchObject([
      { slug: game.slug, name: "A game", words: "Ready to send." },
    ]);

    await db().game.update({ where: { id: game.id }, data: { ageRating: null } });
    expect(await service.gamesOf(game.makerUserId)).toMatchObject([
      { words: "Not finished. Go on from question 7." },
    ]);

    await db().game.update({ where: { id: game.id }, data: { ageRating: "age_12" } });
    await service.sendForReview(game.id, game.makerUserId);
    await sendBackAsSeen(game, await createUser(db()), [{ part: "upright_video", reason: "sideways" }]);
    expect(await service.gamesOf(game.makerUserId)).toMatchObject([{ words: "Sent back. See what to fix." }]);
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
      clips: {
        upright: { key: expect.stringMatching(/^clips\//) as string, bytes: 32 },
        wide: { key: expect.stringMatching(/^clips\//) as string, bytes: 32 },
      },
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      ageRating: "age_12",
      contentMarks: [],
      everLive: false,
      toFix: [],
    });
    expect(await service.gameForMaker(game.slug, await createUser(db()))).toBeNull();
    expect(await service.gameForMaker("no-such-game", game.makerUserId)).toBeNull();
  });

  it("says a game was live once, for good", async () => {
    const game = await readyGame();
    await service.sendForReview(game.id, game.makerUserId);
    await acceptAsSeen(game, await createUser(db()));

    expect((await service.gameForMaker(game.slug, game.makerUserId))?.everLive).toBe(true);
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

/** A game waiting for staff's first yes, and a staff member to answer it. */
async function waitingGame() {
  const game = await readyGame();
  await service.sendForReview(game.id, game.makerUserId);
  return { game, staff: await createUser(db()) };
}

const CHANGED_WHILE_LOOKING = "This game changed while you were looking. Look again.";

describe("accept, with the rating staff choose", () => {
  it("lets staff change who it is for with the yes, and keeps what they chose", async () => {
    const { game, staff } = await waitingGame();

    await acceptAsSeen(game, staff, { ageRating: "age_16" });

    expect(await stateOf(game.id)).toMatchObject({ state: "live", ageRating: "age_16", contentMarks: [] });
  });

  it("keeps the rating and the marks of an 18+ game together", async () => {
    const { game, staff } = await waitingGame();

    await acceptAsSeen(game, staff, { ageRating: "age_18", contentMarks: ["gore", "drugs"] });

    expect(await stateOf(game.id)).toMatchObject({
      state: "live",
      ageRating: "age_18",
      contentMarks: ["gore", "drugs"],
    });
  });

  it("keeps no marks for a game that is not 18+, even if some come with it", async () => {
    const { game, staff } = await waitingGame();

    await acceptAsSeen(game, staff, { ageRating: "age_12", contentMarks: ["gore"] });

    expect((await stateOf(game.id)).contentMarks).toEqual([]);
  });

  it("makes None of these stand alone", async () => {
    const { game, staff } = await waitingGame();

    await acceptAsSeen(game, staff, { ageRating: "age_18", contentMarks: ["none"] });

    expect((await stateOf(game.id)).contentMarks).toEqual(["none"]);
  });

  it.each([
    ["18+ with no mark", [] as ContentMark[], "Choose at least one, or None of these."],
    [
      "18+ with None of these and another mark",
      ["none", "gore"] as ContentMark[],
      "Choose None of these on its own, or choose the marks that are in it.",
    ],
  ])(
    "refuses %s, in words, and the game still waits (Review Focus 5)",
    async (_what, contentMarks, words) => {
      const { game, staff } = await waitingGame();

      await expect(acceptAsSeen(game, staff, { ageRating: "age_18", contentMarks })).rejects.toMatchObject({
        code: "INVALID",
        message: words,
      });
      expect(await stateOf(game.id)).toMatchObject({
        state: "waiting",
        ageRating: "age_12",
        contentMarks: [],
      });
      expect(await db().gameReview.count({ where: { gameId: game.id } })).toBe(0);
    },
  );

  it("refuses a rating that is not one of the five, and nothing changes", async () => {
    const { game, staff } = await waitingGame();
    const looked = await lookAt(game.slug);

    await expect(
      service.accept(game.id, staff, {
        ageRating: "age_99" as unknown as AgeRating,
        contentMarks: [],
        seen: looked.seen,
      }),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect((await stateOf(game.id)).state).toBe("waiting");
  });
});

describe("a game that changed after staff looked (audit S-1)", () => {
  it("is not accepted: a new name after the look means the look is stale", async () => {
    const { game, staff } = await waitingGame();
    const looked = await lookAt(game.slug);
    await service.saveAnswer(game.id, game.makerUserId, { question: "name", name: "A changed name" });

    await expect(
      service.accept(game.id, staff, { ageRating: "age_12", contentMarks: [], seen: looked.seen }),
    ).rejects.toMatchObject({ code: "NOT_READY", message: CHANGED_WHILE_LOOKING });
    expect((await stateOf(game.id)).state).toBe("waiting");
    expect(await db().gameReview.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("is not accepted: a new video after the look means the look is stale", async () => {
    const { game, staff } = await waitingGame();
    const looked = await lookAt(game.slug);
    await addClip(game.id, "upright");

    await expect(
      service.accept(game.id, staff, { ageRating: "age_12", contentMarks: [], seen: looked.seen }),
    ).rejects.toMatchObject({ code: "NOT_READY", message: CHANGED_WHILE_LOOKING });
    expect((await stateOf(game.id)).state).toBe("waiting");
  });

  it("is accepted once staff look again", async () => {
    const { game, staff } = await waitingGame();
    // A new name is a new address, so staff look at the game where it is now.
    const renamed = await service.saveAnswer(game.id, game.makerUserId, {
      question: "name",
      name: "A changed name",
    });

    await acceptAsSeen({ id: game.id, slug: renamed.slug }, staff);

    expect(await stateOf(game.id)).toMatchObject({ state: "live", name: "A changed name" });
  });

  it("is not sent back on reasons chosen for a game that has changed", async () => {
    const { game, staff } = await waitingGame();
    const looked = await lookAt(game.slug);
    await addClip(game.id, "wide");

    await expect(
      service.sendBack(game.id, staff, [{ part: "wide_video", reason: "sideways" }], looked.seen),
    ).rejects.toMatchObject({ code: "NOT_READY", message: CHANGED_WHILE_LOOKING });
    expect(await stateOf(game.id)).toMatchObject({ state: "waiting", toFix: [] });
    expect(await db().gameReview.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("holds for a live game's update too, which a new copy of the files replaces", async () => {
    const { game, staff } = await waitingGame();
    await acceptAsSeen(game, staff);
    await addPull(game.id);
    await service.sendForReview(game.id, game.makerUserId);
    const looked = await lookAt(game.slug);
    await addPull(game.id);
    await service.sendForReview(game.id, game.makerUserId);

    await expect(
      service.accept(game.id, staff, { ageRating: "age_12", contentMarks: [], seen: looked.seen }),
    ).rejects.toMatchObject({ message: CHANGED_WHILE_LOOKING });
  });
});

describe("a waiting game whose new files were refused (audit S-6)", () => {
  const FIXING = "Its maker is fixing its files. It comes back when they're fixed.";

  it("is not accepted on its older files, and stays in the queue", async () => {
    const { game, staff } = await waitingGame();
    await db().game.update({ where: { id: game.id }, data: { pullProblem: "index.html is missing." } });

    await expect(acceptAsSeen(game, staff)).rejects.toMatchObject({ code: "NOT_READY", message: FIXING });
    expect(await stateOf(game.id)).toMatchObject({ state: "waiting", pendingPullId: game.pullId });
    expect(await db().gameReview.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("can still be sent back", async () => {
    const { game, staff } = await waitingGame();
    await db().game.update({ where: { id: game.id }, data: { pullProblem: "index.html is missing." } });

    await sendBackAsSeen(game, staff, [{ part: "files", reason: "breaks" }]);

    expect((await stateOf(game.id)).state).toBe("sent_back");
  });

  it("is accepted once its files are mended", async () => {
    const { game, staff } = await waitingGame();
    await db().game.update({ where: { id: game.id }, data: { pullProblem: "index.html is missing." } });
    await db().game.update({ where: { id: game.id }, data: { pullProblem: null } });

    await acceptAsSeen(game, staff);

    expect((await stateOf(game.id)).state).toBe("live");
  });
});

describe("what staff's list and page are made of", () => {
  it("says a first send is a game and a live game's update is an update", async () => {
    const first = await readyGame();
    const live = await readyGame();
    await service.sendForReview(first.id, first.makerUserId);
    await service.sendForReview(live.id, live.makerUserId);
    await acceptAsSeen(live, await createUser(db()));
    await addPull(live.id);
    await service.sendForReview(live.id, live.makerUserId);

    const rows = (await service.waitingGames()).filter((one) => [first.slug, live.slug].includes(one.slug));

    expect(Object.fromEntries(rows.map((one) => [one.slug, one.kind]))).toEqual({
      [first.slug]: "game",
      [live.slug]: "update",
    });
  });

  it("gives the page its maker's address, when it was sent, and what was seen", async () => {
    const { game } = await waitingGame();

    const looked = await lookAt(game.slug);

    expect(looked.makerEmail).toMatch(/@example\.test$/);
    expect(looked.sentAt).toEqual(new Date(clock.epochMs()));
    expect(looked.seen).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives the same sign of what was seen until something staff judge changes", async () => {
    const { game } = await waitingGame();
    const before = (await lookAt(game.slug)).seen;

    // Not the maker's to judge: the state of the room, not of the game.
    clock.advance(5 * 60_000);
    expect((await lookAt(game.slug)).seen).toBe(before);

    await service.saveAnswer(game.id, game.makerUserId, { question: "line", oneLine: "A new line." });
    expect((await lookAt(game.slug)).seen).not.toBe(before);
  });
});
