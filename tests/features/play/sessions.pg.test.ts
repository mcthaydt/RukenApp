import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { LiveGame } from "../../../src/features/games/games.ts";
import { newPublicId } from "../../../src/features/games/ids.ts";
import { checkPass, PASS_LIFE_MS, PASS_MIN_LEFT_MS } from "../../../src/features/play/pass.ts";
import {
  createPlayService,
  type PlayService,
  type StartedPlay,
} from "../../../src/features/play/sessions.ts";
import { createRateLimiter } from "../../../src/lib/server/rate-limit.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// Starting a play and counting its beats, against a real database. `passFor` is proved through `startPlay`, the only
// way a pass is handed out.

const SECRET = "s";
const START = "2026-11-14T12:00:00Z";

let database: TestDatabase | undefined;
let clock: TestClock;
let service: PlayService;

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
  clock = new TestClock(START);
  service = createPlayService({
    db: db(),
    clock,
    rateLimiter: createRateLimiter(db(), clock),
    passSecret: SECRET,
    address: (name) => `https://${name}.games.test`,
  });
});

let made = 0;

/** A client address no other test uses, so the rate limit of one test never reaches another. */
function newAddress(): string {
  made += 1;
  return `203.0.113.${String(made % 250)}-${String(made)}`;
}

/** A live game: its rows exist (a pass and a session point at them) and its `LiveGame` is what a page would hold. */
async function newGame(options: { freeToPlay?: boolean; connectHosts?: string[] } = {}): Promise<LiveGame> {
  made += 1;
  const makerUserId = await createUser(db());
  const connectHosts = options.connectHosts ?? [];
  const row = await db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `play-game-${String(made)}`,
      makerUserId,
      name: "A game",
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
      freeToPlay: options.freeToPlay ?? false,
    },
  });
  const game: LiveGame = {
    id: row.id,
    publicId: row.publicId,
    slug: row.slug,
    name: row.name,
    oneLine: row.oneLine,
    playsOn: row.playsOn,
    freeToPlay: row.freeToPlay,
    makerUserId,
    livePullId: "",
    connectHosts,
    clips: { upright: "clips/up.mp4", wide: "clips/wide.mp4" },
  };
  return withNewPull(game);
}

/** The same game once another pull of its files goes live. */
async function withNewPull(game: LiveGame): Promise<LiveGame> {
  const pull = await db().gamePull.create({
    data: {
      id: crypto.randomUUID(),
      gameId: game.id,
      commitSha: "a".repeat(40),
      fileCount: 3,
      totalBytes: 1000n,
      connectHosts: game.connectHosts,
      pulledAt: new Date(clock.epochMs()),
    },
  });
  return { ...game, livePullId: pull.id };
}

/** A signed-in person who is a member; `changes` makes them something else. */
async function newViewer(changes: { isStaff?: boolean; isMember?: boolean } = {}) {
  return { userId: await createUser(db()), isStaff: false, isMember: true, ...changes };
}

/** What a started play answers, or a failure that says why it was refused. */
function startedOf(result: StartedPlay) {
  if ("refused" in result) throw new Error(`the play was refused: ${result.refused}`);
  return result;
}

const frameUrlOf = (result: StartedPlay) => startedOf(result).frameUrl;

describe("startPlay", () => {
  it("gives a member a frame address under a pass for that game's live files, and records why they could play", async () => {
    const game = await newGame({ connectHosts: ["api.example.com"] });
    const member = await newViewer();

    const started = await service.startPlay({ game, viewer: member, clientAddress: newAddress() });

    const url = new URL(frameUrlOf(started));
    expect(url.origin).toBe(`https://g-${game.publicId}.games.test`);
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
    const claims = checkPass(url.pathname.split("/")[1] ?? "", SECRET, clock.epochMs());
    expect(claims).toMatchObject({
      game: game.publicId,
      pull: game.livePullId,
      connect: ["api.example.com"],
      expiresAtMs: clock.epochMs() + PASS_LIFE_MS,
    });
    // A leaked address traces to one member.
    expect(await db().playPass.findUniqueOrThrow({ where: { id: claims?.id ?? "" } })).toMatchObject({
      userId: member.userId,
      gameId: game.id,
      pullId: game.livePullId,
    });
    expect(await db().playSession.findMany({ where: { gameId: game.id } })).toMatchObject([
      {
        userId: member.userId,
        gameId: game.id,
        pullId: game.livePullId,
        passId: claims?.id,
        basis: "member",
      },
    ]);
  });

  // Review Focus 21.
  it("gives the same member the same address for that game all day", async () => {
    const game = await newGame();
    const member = await newViewer();
    const address = newAddress();
    const first = frameUrlOf(await service.startPlay({ game, viewer: member, clientAddress: address }));

    clock.advance(PASS_LIFE_MS - PASS_MIN_LEFT_MS);
    expect(frameUrlOf(await service.startPlay({ game, viewer: member, clientAddress: address }))).toBe(first);

    // Under four hours left: a new pass, so no Play starts on one about to run out.
    clock.advance(1);
    expect(frameUrlOf(await service.startPlay({ game, viewer: member, clientAddress: address }))).not.toBe(
      first,
    );
  });

  it("never gives two members the same address", async () => {
    const game = await newGame();
    const [one, two] = [await newViewer(), await newViewer()];

    const first = frameUrlOf(await service.startPlay({ game, viewer: one, clientAddress: newAddress() }));
    const second = frameUrlOf(await service.startPlay({ game, viewer: two, clientAddress: newAddress() }));

    expect(second).not.toBe(first);
    expect(await db().playPass.count({ where: { gameId: game.id } })).toBe(2);
  });

  it("gives a new address once the game's files change", async () => {
    const game = await newGame();
    const member = await newViewer();
    const address = newAddress();
    const before = frameUrlOf(await service.startPlay({ game, viewer: member, clientAddress: address }));

    const updated = await withNewPull(game);
    const after = frameUrlOf(
      await service.startPlay({ game: updated, viewer: member, clientAddress: address }),
    );

    expect(after).not.toBe(before);
  });

  it("hands no pass to a member whose membership ended, however recent their last one", async () => {
    const game = await newGame();
    const member = await newViewer();
    const address = newAddress();
    await service.startPlay({ game, viewer: member, clientAddress: address });

    const result = await service.startPlay({
      game,
      viewer: { ...member, isMember: false },
      clientAddress: address,
    });

    expect(result).toEqual({ refused: "join" });
    expect(await db().playPass.count({ where: { gameId: game.id } })).toBe(1);
  });

  it("shares one pass for a free game among everyone signed out", async () => {
    const game = await newGame({ freeToPlay: true });

    const first = frameUrlOf(await service.startPlay({ game, viewer: null, clientAddress: newAddress() }));
    const second = frameUrlOf(await service.startPlay({ game, viewer: null, clientAddress: newAddress() }));
    const member = frameUrlOf(
      await service.startPlay({ game, viewer: await newViewer(), clientAddress: newAddress() }),
    );

    expect(second).toBe(first);
    expect(member).not.toBe(first);
    const shared = await db().playPass.findMany({ where: { gameId: game.id, userId: null } });
    expect(shared).toHaveLength(1);
  });

  it("stores nothing for someone who may not play", async () => {
    const game = await newGame();

    expect(await service.startPlay({ game, viewer: null, clientAddress: newAddress() })).toEqual({
      refused: "join",
    });
    expect(
      await service.startPlay({
        game,
        viewer: await newViewer({ isMember: false }),
        clientAddress: newAddress(),
      }),
    ).toEqual({ refused: "join" });

    expect(await db().playPass.count({ where: { gameId: game.id } })).toBe(0);
    expect(await db().playSession.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("records a free game played by nobody", async () => {
    const game = await newGame({ freeToPlay: true });

    await service.startPlay({ game, viewer: null, clientAddress: newAddress() });

    expect(await db().playSession.findMany({ where: { gameId: game.id } })).toMatchObject([
      { userId: null, basis: "free_game" },
    ]);
  });

  it("records staff, and a maker on their own game, for what they are", async () => {
    const game = await newGame();
    const staff = await newViewer({ isStaff: true });
    const maker = { userId: game.makerUserId, isStaff: false, isMember: false };

    await service.startPlay({ game, viewer: staff, clientAddress: newAddress() });
    await service.startPlay({ game, viewer: maker, clientAddress: newAddress() });

    const bases = (await db().playSession.findMany({ where: { gameId: game.id } })).map((row) => row.basis);
    expect(bases.sort()).toEqual(["own_game", "staff"]);
  });

  it("never stores the token itself", async () => {
    const game = await newGame();

    const started = startedOf(
      await service.startPlay({ game, viewer: await newViewer(), clientAddress: newAddress() }),
    );

    const row = await db().playSession.findUniqueOrThrow({ where: { id: started.session.id } });
    expect(Object.values(row).map(String)).not.toContain(started.session.token);
    expect(row.tokenHash).toBe(createHash("sha256").update(started.session.token).digest("hex"));
  });

  it("slows down an address that opens games too fast", async () => {
    const game = await newGame({ freeToPlay: true });
    const address = newAddress();
    for (let i = 0; i < 30; i += 1) {
      startedOf(await service.startPlay({ game, viewer: null, clientAddress: address }));
    }

    expect(await service.startPlay({ game, viewer: null, clientAddress: address })).toEqual({
      refused: "busy",
    });

    // A minute on, the window is open again.
    clock.advance(60_001);
    startedOf(await service.startPlay({ game, viewer: null, clientAddress: address }));
  });
});

/** A started play, ready for beats. */
async function startedPlay() {
  const game = await newGame();
  const started = startedOf(
    await service.startPlay({ game, viewer: await newViewer(), clientAddress: newAddress() }),
  );
  return { game, ...started.session };
}

describe("recordBeat", () => {
  // Review Focus 7.
  it("takes a beat from the session's own token only", async () => {
    const a = await startedPlay();
    const b = await startedPlay();

    expect(await service.recordBeat({ sessionId: a.id, token: b.token, attentive: true })).toBe("unknown");
    expect(await service.recordBeat({ sessionId: "nope", token: a.token, attentive: true })).toBe("unknown");
    expect(await db().playBeat.count({ where: { sessionId: a.id } })).toBe(0);
  });

  it("stamps a beat with the server's clock", async () => {
    const play = await startedPlay();
    clock.advance(15_000);

    expect(await service.recordBeat({ sessionId: play.id, token: play.token, attentive: true })).toBe(
      "recorded",
    );

    const beat = await db().playBeat.findFirstOrThrow({ where: { sessionId: play.id } });
    expect(beat.receivedAt).toEqual(new Date(clock.epochMs()));
    expect(beat.attentive).toBe(true);
  });

  // Review Focus 24: the first beat is never too soon.
  it("takes the first beat at once, and drops one that comes too soon after the last", async () => {
    const play = await startedPlay();

    expect(await service.recordBeat({ sessionId: play.id, token: play.token, attentive: true })).toBe(
      "recorded",
    );
    clock.advance(1_000);
    expect(await service.recordBeat({ sessionId: play.id, token: play.token, attentive: true })).toBe(
      "too_soon",
    );

    expect(await db().playBeat.count({ where: { sessionId: play.id } })).toBe(1);
    clock.advance(4_000);
    expect(await service.recordBeat({ sessionId: play.id, token: play.token, attentive: true })).toBe(
      "recorded",
    );
  });

  it("stops taking beats a day after the session started", async () => {
    const play = await startedPlay();

    clock.advance(24 * 60 * 60 * 1000);
    expect(await service.recordBeat({ sessionId: play.id, token: play.token, attentive: true })).toBe(
      "recorded",
    );
    clock.advance(1);
    expect(await service.recordBeat({ sessionId: play.id, token: play.token, attentive: true })).toBe("over");
  });
});

describe("playSummary", () => {
  it("adds up what counted", async () => {
    const play = await startedPlay();
    for (const attentive of [true, false, true]) {
      clock.advance(15_000);
      await service.recordBeat({ sessionId: play.id, token: play.token, attentive });
    }

    // 15 s for the first beat, nothing for the one that looked away, 15 s for the third.
    expect(await service.playSummary(play.game.id)).toEqual({ sessions: 1, beats: 3, countedSeconds: 30 });
  });

  it("says nothing was played for a game nobody played", async () => {
    const game = await newGame();
    expect(await service.playSummary(game.id)).toEqual({ sessions: 0, beats: 0, countedSeconds: 0 });
  });

  it("sums every session of the game, and no other game's", async () => {
    const one = await startedPlay();
    const other = await startedPlay();
    clock.advance(15_000);
    await service.recordBeat({ sessionId: one.id, token: one.token, attentive: true });
    await service.recordBeat({ sessionId: other.id, token: other.token, attentive: true });

    expect(await service.playSummary(one.game.id)).toEqual({ sessions: 1, beats: 1, countedSeconds: 15 });
  });
});
