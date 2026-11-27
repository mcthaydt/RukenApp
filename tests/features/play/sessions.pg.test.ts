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
import { countedMs } from "../../../src/features/play/time.ts";
import { medianMs } from "../../../src/features/games/games.ts";
import { packPlays } from "../../../src/features/feed/service.ts";
import { createRateLimiter } from "../../../src/lib/server/rate-limit.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { queriesAsked } from "../../support/count-queries.ts";
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
    oneLine: row.oneLine ?? "",
    showsPlayerCount: false,
    ageRating: "age_12",
    contentMarks: [],
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

  // The first beat is never too soon.
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

describe("reviewLook", () => {
  /** A pull that waits for a yes: a pull row, not live. */
  async function pendingPull(game: LiveGame, connectHosts: string[]) {
    const live = await withNewPull({ ...game, connectHosts });
    return { id: live.livePullId, connectHosts };
  }

  it("gives the address of the waiting files under a pass for the staff account, and records no play", async () => {
    const game = await newGame();
    const pull = await pendingPull(game, ["api.example.com"]);
    const staffUserId = await createUser(db());

    const address = await service.reviewLook({ game, pull, staffUserId });

    expect(address.startsWith(`https://g-${game.publicId}.games.test/`)).toBe(true);
    expect(address.endsWith("/")).toBe(true);
    const claims = checkPass(new URL(address).pathname.split("/")[1] ?? "", SECRET, clock.epochMs());
    expect(claims).toMatchObject({ game: game.publicId, pull: pull.id, connect: ["api.example.com"] });
    expect(await db().playPass.findUniqueOrThrow({ where: { id: claims?.id ?? "" } })).toMatchObject({
      userId: staffUserId,
      gameId: game.id,
      pullId: pull.id,
    });
    expect(await db().playSession.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("gives the same address when asked twice", async () => {
    const game = await newGame();
    const pull = await pendingPull(game, []);
    const staffUserId = await createUser(db());

    const first = await service.reviewLook({ game, pull, staffUserId });

    expect(await service.reviewLook({ game, pull, staffUserId })).toBe(first);
  });
});

describe("testPlay", () => {
  it("gives the maker the address of files that are not live under a pass of their own, and records no play", async () => {
    const game = await newGame();
    const waiting = await withNewPull({ ...game, connectHosts: ["api.example.com"] });
    const pull = { id: waiting.livePullId, connectHosts: ["api.example.com"] };

    const address = await service.testPlay({ game, pull, makerUserId: game.makerUserId });

    const claims = checkPass(new URL(address).pathname.split("/")[1] ?? "", SECRET, clock.epochMs());
    expect(claims).toMatchObject({ game: game.publicId, pull: pull.id, connect: ["api.example.com"] });
    expect(await db().playPass.findUniqueOrThrow({ where: { id: claims?.id ?? "" } })).toMatchObject({
      userId: game.makerUserId,
      pullId: pull.id,
    });
    expect(await db().playSession.count({ where: { gameId: game.id } })).toBe(0);
  });
});

describe("sittingOf", () => {
  const NOW = new Date("2026-11-14T12:00:00Z");

  /** A play of a game that counts `minutes` of attentive time (a beat every 15 seconds), started `daysAgo` days back. */
  async function addPlay(
    game: LiveGame,
    options: {
      minutes?: number;
      basis?: "member" | "free_game" | "staff" | "own_game";
      daysAgo?: number;
      attentive?: boolean;
    },
  ): Promise<void> {
    const startedAt = new Date(NOW.getTime() - (options.daysAgo ?? 1) * 86_400_000);
    const pass = await db().playPass.create({
      data: {
        id: crypto.randomUUID().replaceAll("-", "").slice(0, 22),
        gameId: game.id,
        pullId: game.livePullId,
        userId: null,
        madeAt: startedAt,
        expiresAt: new Date(NOW.getTime() + 86_400_000),
      },
    });
    const session = await db().playSession.create({
      data: {
        id: crypto.randomUUID(),
        gameId: game.id,
        pullId: game.livePullId,
        passId: pass.id,
        userId: (options.basis ?? "member") === "free_game" ? null : await createUser(db()),
        basis: options.basis ?? "member",
        tokenHash: "0".repeat(64),
        startedAt,
      },
    });
    const beats = options.minutes === undefined ? 0 : options.minutes * 4;
    for (let i = 1; i <= beats; i += 1) {
      await db().playBeat.create({
        data: {
          sessionId: session.id,
          receivedAt: new Date(startedAt.getTime() + i * 15_000),
          attentive: options.attentive ?? true,
        },
      });
    }
  }

  it("is null under 20 counted plays, then their median", async () => {
    const game = await newGame();
    for (let i = 0; i < 19; i += 1) await addPlay(game, { minutes: 12 });
    expect(await service.sittingOf(game.id, NOW)).toBeNull();
    await addPlay(game, { minutes: 12 });
    expect(await service.sittingOf(game.id, NOW)).toBe(12 * 60_000);
  });

  it("does not count staff, the maker's own play, a play with no beat, one that only looked away, or one 31 days old", async () => {
    const game = await newGame();
    for (let i = 0; i < 19; i += 1) await addPlay(game, { minutes: 12 });
    await addPlay(game, { minutes: 12, basis: "staff" });
    await addPlay(game, { minutes: 12, basis: "own_game" });
    await addPlay(game, {});
    await addPlay(game, { minutes: 12, attentive: false });
    await addPlay(game, { minutes: 12, daysAgo: 31 });
    expect(await service.sittingOf(game.id, NOW)).toBeNull();
  });
  // Old against new: the Prisma read that came before the one-statement read, kept here as the yardstick. On the same
  // plays, made from a fixed seed, the two must give the same answer.
  it("agrees with the read it replaced, on many mixed plays", async () => {
    async function oldSittingOf(gameId: string, now: Date): Promise<number | null> {
      const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sessions = await db().playSession.findMany({
        where: { gameId, basis: { in: ["member", "free_game"] }, startedAt: { gte: since, lte: now } },
        orderBy: { startedAt: "desc" },
        take: 500,
        select: { startedAt: true, beats: { select: { receivedAt: true, attentive: true } } },
      });
      const counted = sessions
        .map((session) =>
          countedMs(
            session.startedAt.getTime(),
            session.beats.map((beat) => ({ atMs: beat.receivedAt.getTime(), attentive: beat.attentive })),
          ),
        )
        .filter((ms) => ms > 0);
      return counted.length < 20 ? null : medianMs(counted);
    }
    let seed = 7;
    const next = (below: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      // The high bits: the low bits of this kind of generator repeat in short cycles.
      return Math.floor((seed / 2_147_483_648) * below);
    };
    const bases = ["member", "member", "free_game", "free_game", "staff", "own_game"] as const;
    const game = await newGame();
    for (let i = 0; i < 70; i += 1) {
      await addPlay(game, {
        minutes: next(4) === 0 ? 0 : 1 + next(20),
        basis: bases[next(bases.length)] ?? "member",
        daysAgo: next(34),
        attentive: next(5) !== 0,
      });
      if (i % 10 === 9) expect(await service.sittingOf(game.id, NOW)).toBe(await oldSittingOf(game.id, NOW));
    }
    expect(await oldSittingOf(game.id, NOW)).not.toBeNull();
  });

  // A game's page waits on this, and each statement is a wait on the site: the plays and their beats come together.
  it("asks the database once", async () => {
    const game = await newGame();
    for (let i = 0; i < 20; i += 1) await addPlay(game, { minutes: 12 });
    let sitting: number | null = null;

    const asked = await queriesAsked(database?.url ?? "", async (counted) => {
      sitting = await createPlayService({
        db: counted,
        clock,
        rateLimiter: createRateLimiter(counted, clock),
        passSecret: SECRET,
        address: (name) => `https://${name}.games.test`,
      }).sittingOf(game.id, NOW);
    });

    expect(sitting).toBe(12 * 60_000);
    expect(asked).toHaveLength(1);
  });
});

describe("playersThisWeek", () => {
  const NOW = new Date("2026-11-14T12:00:00Z");

  /** One play of a game by `userId` (null: nobody), started `daysAgo` days back, with one beat. */
  async function addPlay(
    game: LiveGame,
    options: {
      userId: string | null;
      basis?: "member" | "free_game" | "staff" | "own_game";
      daysAgo?: number;
      beat?: "attentive" | "looked_away" | "none";
    },
  ): Promise<void> {
    const startedAt = new Date(NOW.getTime() - (options.daysAgo ?? 1) * 86_400_000);
    const pass = await db().playPass.create({
      data: {
        id: crypto.randomUUID().replaceAll("-", "").slice(0, 22),
        gameId: game.id,
        pullId: game.livePullId,
        userId: null,
        madeAt: startedAt,
        expiresAt: new Date(NOW.getTime() + 86_400_000),
      },
    });
    const session = await db().playSession.create({
      data: {
        id: crypto.randomUUID(),
        gameId: game.id,
        pullId: game.livePullId,
        passId: pass.id,
        userId: options.userId,
        basis: options.basis ?? "member",
        tokenHash: "0".repeat(64),
        startedAt,
      },
    });
    if ((options.beat ?? "attentive") === "none") return;
    await db().playBeat.create({
      data: {
        sessionId: session.id,
        receivedAt: new Date(startedAt.getTime() + 15_000),
        attentive: (options.beat ?? "attentive") === "attentive",
      },
    });
  }

  it("counts each account once, however many times it played", async () => {
    const game = await newGame();
    const one = await createUser(db());
    const two = await createUser(db());
    await addPlay(game, { userId: one });
    await addPlay(game, { userId: one, daysAgo: 3 });
    await addPlay(game, { userId: two, basis: "free_game" });
    expect(await service.playersThisWeek(game.id, NOW)).toBe(2);
  });

  it("does not count staff, the maker's own play, free play by nobody, a play 8 days old, or one with no attentive beat", async () => {
    const game = await newGame();
    await addPlay(game, { userId: await createUser(db()) });
    await addPlay(game, { userId: await createUser(db()), basis: "staff" });
    await addPlay(game, { userId: await createUser(db()), basis: "own_game" });
    await addPlay(game, { userId: null, basis: "free_game" });
    await addPlay(game, { userId: await createUser(db()), daysAgo: 8 });
    await addPlay(game, { userId: await createUser(db()), beat: "none" });
    await addPlay(game, { userId: await createUser(db()), beat: "looked_away" });
    expect(await service.playersThisWeek(game.id, NOW)).toBe(1);
  });

  it("is zero for a game nobody played", async () => {
    expect(await service.playersThisWeek((await newGame()).id, NOW)).toBe(0);
  });
});

describe("memberBeatsByGame", () => {
  const NOW = new Date("2026-11-14T12:00:00Z");
  const SINCE = new Date(NOW.getTime() - 7 * 86_400_000);

  /** A play of a game that started at `startedAt`, with one beat for each entry of `beats`. */
  async function addPlay(
    game: LiveGame,
    options: {
      basis?: "member" | "free_game" | "staff" | "own_game";
      startedAt: Date;
      beats: { at: Date; attentive?: boolean }[];
    },
  ): Promise<void> {
    const pass = await db().playPass.create({
      data: {
        id: crypto.randomUUID().replaceAll("-", "").slice(0, 22),
        gameId: game.id,
        pullId: game.livePullId,
        userId: null,
        madeAt: options.startedAt,
        expiresAt: new Date(NOW.getTime() + 86_400_000),
      },
    });
    const session = await db().playSession.create({
      data: {
        id: crypto.randomUUID(),
        gameId: game.id,
        pullId: game.livePullId,
        passId: pass.id,
        userId: await createUser(db()),
        basis: options.basis ?? "member",
        tokenHash: "0".repeat(64),
        startedAt: options.startedAt,
      },
    });
    for (const beat of options.beats) {
      await db().playBeat.create({
        data: { sessionId: session.id, receivedAt: beat.at, attentive: beat.attentive ?? true },
      });
    }
  }

  const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

  it("adds up each game's attentive beats from members, and leaves out a game with none", async () => {
    const busy = await newGame();
    const quiet = await newGame();
    const nobody = await newGame();
    await addPlay(busy, { startedAt: hoursAgo(5), beats: [{ at: hoursAgo(5) }, { at: hoursAgo(4) }] });
    await addPlay(busy, { startedAt: hoursAgo(3), beats: [{ at: hoursAgo(3) }] });
    await addPlay(quiet, { startedAt: hoursAgo(2), beats: [{ at: hoursAgo(2) }] });

    const beats = await service.memberBeatsByGame(SINCE, NOW);

    expect(beats.get(busy.id)).toBe(3);
    expect(beats.get(quiet.id)).toBe(1);
    expect(beats.has(nobody.id)).toBe(false);
  });

  it("does not count free play, staff, a maker's own play, or a beat of someone who looked away", async () => {
    const game = await newGame();
    for (const basis of ["free_game", "staff", "own_game"] as const) {
      await addPlay(game, { basis, startedAt: hoursAgo(2), beats: [{ at: hoursAgo(2) }] });
    }
    await addPlay(game, { startedAt: hoursAgo(2), beats: [{ at: hoursAgo(2), attentive: false }] });

    expect((await service.memberBeatsByGame(SINCE, NOW)).has(game.id)).toBe(false);
  });

  it("counts a beat received inside the window from a session that started before it, and nothing outside", async () => {
    const game = await newGame();
    // Started 7 days and 2 hours back, still beating inside the week: its beat counts.
    await addPlay(game, { startedAt: hoursAgo(7 * 24 + 2), beats: [{ at: hoursAgo(7 * 24 - 1) }] });
    // A beat before the window, and one after `now`, do not.
    await addPlay(game, {
      startedAt: hoursAgo(7 * 24 + 5),
      beats: [{ at: hoursAgo(7 * 24 + 4) }, { at: new Date(NOW.getTime() + 60_000) }],
    });

    expect((await service.memberBeatsByGame(SINCE, NOW)).get(game.id)).toBe(1);
  });

  it("does not count a beat of a session that started more than a day before the window", async () => {
    const game = await newGame();
    // A session lives one day, so one that started over a day before `since` cannot honestly have a beat inside the
    // window; the read leaves it out, which is what keeps the query to recent sessions.
    await addPlay(game, { startedAt: hoursAgo(7 * 24 + 30), beats: [{ at: hoursAgo(7 * 24 - 1) }] });

    expect((await service.memberBeatsByGame(SINCE, NOW)).has(game.id)).toBe(false);
  });
});

describe("playDays", () => {
  // 18:00 UTC is noon in Chicago, so a few hours either side stays on one Chicago day unless a test means to cross.
  const NOW = new Date("2026-11-14T18:00:00Z");
  const SINCE = new Date(NOW.getTime() - 7 * 86_400_000);

  async function addPlay(
    game: LiveGame,
    options: {
      userId?: string | null;
      basis?: "member" | "free_game" | "staff" | "own_game";
      startedAt: Date;
      beats: { at: Date; attentive?: boolean }[];
    },
  ): Promise<string | null> {
    const userId = options.userId === undefined ? await adult() : options.userId;
    const pass = await db().playPass.create({
      data: {
        id: crypto.randomUUID().replaceAll("-", "").slice(0, 22),
        gameId: game.id,
        pullId: game.livePullId,
        userId: null,
        madeAt: options.startedAt,
        expiresAt: new Date(NOW.getTime() + 86_400_000),
      },
    });
    const session = await db().playSession.create({
      data: {
        id: crypto.randomUUID(),
        gameId: game.id,
        pullId: game.livePullId,
        passId: pass.id,
        userId,
        basis: options.basis ?? "member",
        tokenHash: "0".repeat(64),
        startedAt: options.startedAt,
      },
    });
    for (const beat of options.beats) {
      await db().playBeat.create({
        data: { sessionId: session.id, receivedAt: beat.at, attentive: beat.attentive ?? true },
      });
    }
    return userId;
  }

  /** A person known to be 18 or over, with Learn from what I do on: the only kind the read answers about. */
  async function adult(data: { adultOn?: Date | null; feedPersonal?: boolean; feedResetAt?: Date } = {}) {
    const id = await createUser(db());
    await db().user.update({ where: { id }, data: { adultOn: new Date("2000-01-01T00:00:00Z"), ...data } });
    return id;
  }

  const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);
  const rowsOf = async (gameId: string) =>
    (await service.playDays(SINCE, NOW, [gameId])).sort(
      (one, other) => one.day.localeCompare(other.day) || one.userId.localeCompare(other.userId),
    );

  it("answers each person's attentive beats per game and Chicago day, with how they played", async () => {
    const game = await newGame();
    const member = await addPlay(game, {
      startedAt: hoursAgo(3),
      beats: [{ at: hoursAgo(3) }, { at: hoursAgo(2) }, { at: hoursAgo(1), attentive: false }],
    });
    const free = await addPlay(game, {
      basis: "free_game",
      startedAt: hoursAgo(2),
      beats: [{ at: hoursAgo(2) }],
    });
    // A second sitting the same day adds to the same row.
    await addPlay(game, { userId: member, startedAt: hoursAgo(1), beats: [{ at: hoursAgo(1) }] });

    expect(await rowsOf(game.id)).toEqual(
      expect.arrayContaining([
        { userId: member, gameId: game.id, day: "2026-11-14", beats: 3, basis: "member" },
        { userId: free, gameId: game.id, day: "2026-11-14", beats: 1, basis: "free_game" },
      ]),
    );
    expect(await rowsOf(game.id)).toHaveLength(2);
  });

  it("puts a sitting that crosses Chicago's midnight on both days", async () => {
    const game = await newGame();
    // 05:30 and 06:30 UTC on the 14th are 23:30 on the 13th and 00:30 on the 14th in Chicago.
    const at = (iso: string) => new Date(iso);
    const member = await addPlay(game, {
      startedAt: at("2026-11-14T05:20:00Z"),
      beats: [
        { at: at("2026-11-14T05:30:00Z") },
        { at: at("2026-11-14T05:50:00Z") },
        { at: at("2026-11-14T06:30:00Z") },
      ],
    });

    expect(await rowsOf(game.id)).toEqual([
      { userId: member, gameId: game.id, day: "2026-11-13", beats: 2, basis: "member" },
      { userId: member, gameId: game.id, day: "2026-11-14", beats: 1, basis: "member" },
    ]);
  });

  it("leaves out staff, a maker's own play, play by nobody, and beats outside the window", async () => {
    const game = await newGame();
    for (const basis of ["staff", "own_game"] as const) {
      await addPlay(game, { basis, startedAt: hoursAgo(2), beats: [{ at: hoursAgo(2) }] });
    }
    await addPlay(game, {
      userId: null,
      basis: "free_game",
      startedAt: hoursAgo(2),
      beats: [{ at: hoursAgo(2) }],
    });
    await addPlay(game, {
      startedAt: hoursAgo(7 * 24 + 5),
      beats: [{ at: hoursAgo(7 * 24 + 4) }, { at: new Date(NOW.getTime() + 60_000) }],
    });

    expect(await rowsOf(game.id)).toEqual([]);
  });

  it("leaves out anyone under 18 or of unknown age, anyone with learning off, and play before Start over", async () => {
    const game = await newGame();
    const play = async (userId: string) => {
      await addPlay(game, {
        userId,
        startedAt: hoursAgo(3),
        beats: [{ at: hoursAgo(3) }, { at: hoursAgo(1) }],
      });
    };
    // 18 tomorrow in Chicago, so still 17 today.
    await play(await adult({ adultOn: new Date("2026-11-15T00:00:00Z") }));
    await play(await adult({ adultOn: null }));
    await play(await adult({ feedPersonal: false }));
    const restarted = await adult({ feedResetAt: hoursAgo(2) });
    await play(restarted);
    // 18 today counts.
    const birthday = await adult({ adultOn: new Date("2026-11-14T00:00:00Z") });
    await play(birthday);

    expect(await rowsOf(game.id)).toEqual(
      [
        { userId: restarted, gameId: game.id, day: "2026-11-14", beats: 1, basis: "member" },
        { userId: birthday, gameId: game.id, day: "2026-11-14", beats: 2, basis: "member" },
      ].sort((one, other) => one.userId.localeCompare(other.userId)),
    );
  });

  // A10: the read and what it sends, at launch scale (250 games, 1,000 players, 20,000 play days), measured and printed.
  // The ranking itself is timed in the private Worker's own budget test. The feed keeps a read for five minutes
  // (PLAYS_KEPT_MS), so only the first page in each five minutes waits for it.
  it("reads 20,000 play days, measured and printed, and sends them small", async () => {
    const maker = await createUser(db());
    const users = Array.from({ length: 1_000 }, (_, n) => ({
      id: `scale-user-${String(n)}`,
      name: "Person",
      email: `scale-${String(n)}@example.test`,
      adultOn: new Date("2000-01-01T00:00:00Z"),
    }));
    await db().user.createMany({ data: users });
    const games = Array.from({ length: 250 }, (_, n) => ({
      id: `scale-game-${String(n)}`,
      publicId: newPublicId(),
      slug: `scale-game-${String(n)}`,
      makerUserId: maker,
      name: "A game",
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer" as const,
      repoFullName: "acme/game",
    }));
    await db().game.createMany({ data: games });
    await db().gamePull.createMany({
      data: games.map((game) => ({
        id: `${game.id}-pull`,
        gameId: game.id,
        commitSha: "a".repeat(40),
        fileCount: 3,
        totalBytes: 1000n,
        connectHosts: [],
        pulledAt: SINCE,
      })),
    });
    const passOf = new Map(
      games.map((game) => [game.id, crypto.randomUUID().replaceAll("-", "").slice(0, 22)]),
    );
    await db().playPass.createMany({
      data: games.map((game) => ({
        id: passOf.get(game.id) ?? "",
        gameId: game.id,
        pullId: `${game.id}-pull`,
        userId: null,
        madeAt: SINCE,
        expiresAt: new Date(NOW.getTime() + 86_400_000),
      })),
    });
    // 20,000 different person, game and day sittings over 29 days, each of 20 beats (five minutes).
    const sittings = new Map<string, { userId: string; gameId: string; daysAgo: number }>();
    let n = 0;
    while (sittings.size < 20_000) {
      n += 1;
      const userId = `scale-user-${String((n * 7919) % 1_000)}`;
      const gameId = `scale-game-${String((n * 104_729) % 250)}`;
      const daysAgo = (n * 31) % 29;
      sittings.set(`${userId}~${gameId}~${String(daysAgo)}`, { userId, gameId, daysAgo });
    }
    await db().playSession.createMany({
      data: [...sittings.values()].map((sitting, index) => ({
        id: `scale-session-${String(index)}`,
        gameId: sitting.gameId,
        pullId: `${sitting.gameId}-pull`,
        passId: passOf.get(sitting.gameId) ?? "",
        userId: sitting.userId,
        basis: index % 5 === 0 ? ("free_game" as const) : ("member" as const),
        tokenHash: "0".repeat(64),
        startedAt: new Date(NOW.getTime() - sitting.daysAgo * 86_400_000 - 2 * 3_600_000),
      })),
    });
    await db().$executeRaw`
      INSERT INTO "PlayBeat" ("sessionId", "receivedAt", attentive)
      SELECT s.id, s."startedAt" + k * interval '15 seconds', true
      FROM "PlaySession" s, generate_series(1, 20) k
      WHERE s.id LIKE 'scale-session-%'`;
    await db().$executeRaw`ANALYZE`;

    const since = new Date(NOW.getTime() - 30 * 86_400_000);
    const gameIds = games.map((game) => game.id);
    const times: number[] = [];
    let sent = "";
    let rows = 0;
    for (let run = 0; run < 5; run += 1) {
      const start = performance.now();
      const read = await service.playDays(since, NOW, gameIds);
      sent = JSON.stringify(packPlays(read, gameIds, "scale-user-7", since.getTime(), NOW.getTime()));
      times.push(performance.now() - start);
      rows = read.length;
    }
    const warm = times.slice(1).sort((one, other) => one - other);
    const median = ((warm[1] ?? 0) + (warm[2] ?? 0)) / 2;
    console.info(
      `play read: ${String(rows)} rows, warm median ${median.toFixed(1)} ms (first ${(times[0] ?? 0).toFixed(1)} ms), sent ${String(Math.round(sent.length / 1024))} KB`,
    );
    expect(rows).toBe(20_000);
    // The time is printed, not held to a number: it depends on how busy the machine is (155 ms alone here, about
    // 340 ms beside the other test files), which is why the feed keeps a read for five minutes.
    expect(sent.length).toBeLessThan(400_000);
  }, 120_000);

  it("reads only the games it is asked about, in one statement", async () => {
    const wanted = await newGame();
    const other = await newGame();
    await addPlay(wanted, { startedAt: hoursAgo(2), beats: [{ at: hoursAgo(2) }] });
    await addPlay(other, { startedAt: hoursAgo(2), beats: [{ at: hoursAgo(2) }] });

    let gameIds: string[] = [];
    const asked = await queriesAsked(database?.url ?? "", async (counted) => {
      const rows = await createPlayService({
        db: counted,
        clock,
        rateLimiter: createRateLimiter(counted, clock),
        passSecret: SECRET,
        address: (name) => `https://${name}.games.test`,
      }).playDays(SINCE, NOW, [wanted.id]);
      gameIds = rows.map((row) => row.gameId);
    });

    expect(gameIds).toEqual([wanted.id]);
    expect(asked).toHaveLength(1);
    expect(await service.playDays(SINCE, NOW, [])).toEqual([]);
  });
});
