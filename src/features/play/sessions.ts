import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { RateLimiter, RateLimitRule } from "../../lib/server/rate-limit.ts";
import type { LiveGame } from "../games/games.ts";
import { playBasis, type PlayBasis, type PlayViewer } from "./may-play.ts";
import { checkPass } from "./pass.ts";
import { passFor } from "./passes.ts";
import { BEAT_TOO_SOON_MS, countedMs, PLAY_SESSION_LIFE_MS } from "./time.ts";

// Starting a play and counting its beats. The server's own clock decides what time counts; the page only says "still
// here". Every row is added and never changed, and the money slice reads them.

export interface PlayServiceDeps {
  db: PrismaClient;
  clock: Clock;
  rateLimiter: RateLimiter;
  /** The secret the play passes are signed with, which the game gate checks them with. */
  passSecret: string;
  /** A game's address from its name (`g-<public id>`). */
  address(name: string): string;
}

export type StartedPlay =
  { frameUrl: string; session: { id: string; token: string } } | { refused: "join" | "busy" };

export type BeatResult = "recorded" | "too_soon" | "over" | "unknown";

/** How fast one address may open games: a person tapping around never meets it, a script that opens games does. */
export const PLAY_STARTS_PER_ADDRESS: RateLimitRule = { max: 30, windowMs: 60_000 };

const sha256Hex = (text: string): string => createHash("sha256").update(text).digest("hex");

/** 32 random bytes in base64url: shown to the page once, and only its hash is kept. */
function newToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

export function createPlayService(deps: PlayServiceDeps) {
  /**
   * Starts a play: the address of the game's files under a pass made for this person, and a session whose token the
   * page keeps to send beats with. Someone who may not play (`playBasis` is null) gets `join`, and nothing is stored
   * and no pass is handed out. An address that opens games too fast gets `busy`.
   */
  async function startPlay(input: {
    game: LiveGame;
    viewer: PlayViewer | null;
    clientAddress: string;
  }): Promise<StartedPlay> {
    const { game, viewer } = input;
    const basis = playBasis({ game, viewer });
    if (basis === null) return { refused: "join" };

    const limit = await deps.rateLimiter.hit(
      `api:play-start:${input.clientAddress}`,
      PLAY_STARTS_PER_ADDRESS,
    );
    if (!limit.allowed) return { refused: "busy" };

    return openSession({
      game,
      pull: { id: game.livePullId, connectHosts: game.connectHosts },
      userId: viewer?.userId ?? null,
      basis,
    });
  }

  /**
   * Makes the pass for one pull of a game, and the session a play of it is counted in. The pass is made by this service,
   * so it reads back; the session names the row it was made from. The token is shown once and only its hash is kept.
   */
  async function openSession(input: {
    game: { id: string; publicId: string };
    pull: { id: string; connectHosts: string[] };
    userId: string | null;
    basis: PlayBasis;
  }): Promise<{ frameUrl: string; session: { id: string; token: string } }> {
    const pass = await passFor(deps, { game: input.game, pull: input.pull, userId: input.userId });
    const claims = checkPass(pass, deps.passSecret, deps.clock.epochMs());
    if (claims === null) throw new Error("a pass that was just made did not read back");

    const token = newToken();
    const id = randomUUID();
    await deps.db.playSession.create({
      data: {
        id,
        gameId: input.game.id,
        pullId: input.pull.id,
        passId: claims.id,
        userId: input.userId,
        basis: input.basis,
        tokenHash: sha256Hex(token),
        startedAt: new Date(deps.clock.epochMs()),
      },
    });
    return { frameUrl: `${deps.address(`g-${input.game.publicId}`)}/${pass}/`, session: { id, token } };
  }

  /**
   * Starts a play of files that are not live yet, for staff who check a game before they say yes. It is `startPlay` for a
   * pull of the game's own that waits: the pass carries that pull's own servers, read from its row, and the session's basis
   * is `staff`, so it never counts for pay. The caller has already checked that this is staff; a pull that is not this
   * game's is refused before any pass is made.
   */
  async function startReviewPlay(input: {
    game: { id: string; publicId: string };
    pullId: string;
    staffUserId: string;
  }): Promise<{ frameUrl: string; session: { id: string; token: string } }> {
    const pull = await deps.db.gamePull.findFirst({
      where: { id: input.pullId, gameId: input.game.id },
      select: { id: true, connectHosts: true },
    });
    if (pull === null) throw new Error("that pull is not this game's");
    return openSession({
      game: input.game,
      pull,
      userId: input.staffUserId,
      basis: "staff",
    });
  }

  /**
   * One "still here" from a page. It must carry the session's own token (the id alone is not enough, since the id is in
   * the page). A session takes beats for a day, and a beat that comes too soon after the last is dropped, so a page
   * cannot make time pass faster than the clock. The first beat is never too soon: measured from the start it would
   * refuse a first beat whose page clock runs ahead of the server's, and it adds no time the clock did not see.
   */
  async function recordBeat(input: {
    sessionId: string;
    token: string;
    attentive: boolean;
  }): Promise<BeatResult> {
    const session = await deps.db.playSession.findUnique({
      where: { id: input.sessionId },
      select: { tokenHash: true, startedAt: true },
    });
    if (session === null) return "unknown";
    // Compared in constant time, and of equal length (both are 64 hex characters of a SHA-256).
    const given = Buffer.from(sha256Hex(input.token));
    const expected = Buffer.from(session.tokenHash);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return "unknown";

    const nowMs = deps.clock.epochMs();
    if (nowMs > session.startedAt.getTime() + PLAY_SESSION_LIFE_MS) return "over";

    const last = await deps.db.playBeat.findFirst({
      where: { sessionId: input.sessionId },
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true },
    });
    if (last !== null && nowMs - last.receivedAt.getTime() < BEAT_TOO_SOON_MS) return "too_soon";

    // Two beats in the same instant may both be stored; `countedMs` gives the second one nothing.
    await deps.db.playBeat.create({
      data: { sessionId: input.sessionId, receivedAt: new Date(nowMs), attentive: input.attentive },
    });
    return "recorded";
  }

  /**
   * What a game's plays add up to: sessions, beats, and the seconds that counted, worked out from the beats. With `only`
   * it is one person's plays of one copy of the files, which is what staff mean by "you've played it": a check of waiting
   * files must not count players' time on the files that are live, or another staff member's.
   */
  async function playSummary(
    gameId: string,
    only?: { pullId: string; userId: string },
  ): Promise<{ sessions: number; beats: number; countedSeconds: number }> {
    const sessions = await deps.db.playSession.findMany({
      where: { gameId, ...(only === undefined ? {} : { userId: only.userId }) },
      select: { startedAt: true, beats: { select: { receivedAt: true, attentive: true } } },
    });
    let beats = 0;
    let counted = 0;
    for (const session of sessions) {
      beats += session.beats.length;
      counted += countedMs(
        session.startedAt.getTime(),
        session.beats.map((beat) => ({ atMs: beat.receivedAt.getTime(), attentive: beat.attentive })),
      );
    }
    return { sessions: sessions.length, beats, countedSeconds: Math.floor(counted / 1000) };
  }

  return { startPlay, startReviewPlay, recordBeat, playSummary };
}

export type PlayService = ReturnType<typeof createPlayService>;
