import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { RateLimiter } from "../../lib/server/rate-limit.ts";
import { stillOfClip } from "../../lib/stills.ts";
import type { ListedGame } from "../games/games.ts";
import type { Friend } from "./friend.ts";
import type { SendLimits } from "./limits.ts";
import type { StoppedPerson } from "./stopped.ts";
import { canSend, friendPagesOf } from "./who.ts";

// Your turn: friends send each other games, and each person has a list of the games sent to them. Built from what it
// needs, so a test hands it a database, a clock and neighbours of its own. Only the receiver reads or changes their list;
// the sender is never told whether a game was seen, removed or stopped.

/** The most faces the share sheet shows. */
export const FRIENDS_MAX = 8;

export interface SendsDeps {
  db: PrismaClient;
  clock: Clock;
  limiter: RateLimiter;
  /** The limits a send counts against, asked for at each send (the private Worker's, or the stand-ins). */
  limits(): Promise<SendLimits>;
  liveGames(): Promise<ListedGame[]>;
  makersOf(
    userIds: readonly string[],
  ): Promise<Map<string, { handle: string; name: string; photoKey: string | null }>>;
  /** The whole address of a file in the bucket, from its key. */
  media(key: string): string;
}


/** One game on a person's Your turn list. */
export interface SentGame {
  id: string;
  slug: string;
  name: string;
  still: string | null;
  from: string | null;
  sentAt: Date;
}


export type SendOutcome = "sent" | "no game" | "no person" | "self" | "not friends" | { limited: number };

/** How wide a row's still is fetched: the smallest still made, about twice the 64px it is shown at. */
const THUMBNAIL_WIDTH = 240;

function thumbnailOf(clip: string): string | null {
  const still = stillOfClip(clip);
  return still === null ? null : `${still.address}?at=0&width=${String(THUMBNAIL_WIDTH)}`;
}

export type Sends = ReturnType<typeof createSends>;

export type { Friend, StoppedPerson };

export function createSends(deps: SendsDeps) {
  const { db, clock, limiter } = deps;

  /** Counts one send against every limit; the seconds to wait when one says no. */
  async function overLimit(userId: string): Promise<number | null> {
    for (const { name, rule } of (await deps.limits()).rules) {
      const result = await limiter.hit(`api:send:${name}:${userId}`, rule);
      if (!result.allowed) return result.retryAfterSeconds;
    }
    return null;
  }

  /** The live games among these ids that this person may see: an 18+ one only for a known adult. */
  async function visibleGames(
    ids: readonly string[],
    isAdult: () => Promise<boolean>,
  ): Promise<Map<string, ListedGame>> {
    if (ids.length === 0) return new Map();
    const wanted = new Set(ids);
    const live = (await deps.liveGames()).filter((game) => wanted.has(game.id));
    const adult = live.some((game) => game.ageRating === "age_18") && (await isAdult());
    return new Map(live.filter((game) => adult || game.ageRating !== "age_18").map((game) => [game.id, game]));
  }

  /** The pages of these accounts, asking nothing when there are none. */
  async function pagesOf(userIds: readonly string[]): Promise<Map<string, { name: string }>> {
    return userIds.length === 0 ? new Map() : deps.makersOf([...new Set(userIds)]);
  }

  return {
    canSend: (fromId: string, toId: string) => canSend(db, fromId, toId),

    /** The faces for the share sheet: this person's friends who have a page, newest friendship first. */
    async friendsOf(userId: string): Promise<Friend[]> {
      const pages = await friendPagesOf(db, userId, FRIENDS_MAX);
      return pages.map((page) => ({
        handle: page.handle,
        name: page.name,
        photo: page.photoKey === null ? null : deps.media(page.photoKey),
      }));
    },

    /**
     * Sends a live game to the person at this address. Sending it again is the same row, and two sends at the same
     * moment make one (`skipDuplicates` lets the unique key settle it). A receiver who stopped the sender gets nothing,
     * and the sender is told it went.
     */
    async send(fromId: string, gameSlug: string, toHandle: string): Promise<SendOutcome> {
      const [game, page] = await Promise.all([
        db.game.findFirst({ where: { slug: gameSlug, state: "live", livePullId: { not: null } }, select: { id: true } }),
        db.makerPage.findUnique({ where: { handle: toHandle }, select: { userId: true } }),
      ]);
      if (game === null) return "no game";
      if (page === null) return "no person";
      const toId = page.userId;
      if (toId === fromId) return "self";
      if (!(await canSend(db, fromId, toId))) return "not friends";
      const wait = await overLimit(fromId);
      if (wait !== null) return { limited: wait };
      const stopped = await db.sendStop.count({ where: { stopperId: toId, stoppedId: fromId } });
      if (stopped > 0) return "sent";
      await db.gameSend.createMany({
        data: [{ fromId, toId, gameId: game.id, sentAt: new Date(clock.epochMs()) }],
        skipDuplicates: true,
      });
      return "sent";
    },

    /** The games sent to this person that they may see, newest first. */
    async listOf(toId: string, isAdult: () => Promise<boolean>): Promise<SentGame[]> {
      const rows = await db.gameSend.findMany({
        where: { toId },
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        select: { id: true, fromId: true, gameId: true, sentAt: true },
      });
      const games = await visibleGames(
        rows.map((row) => row.gameId),
        isAdult,
      );
      const shown = rows.flatMap((row) => {
        const game = games.get(row.gameId);
        return game === undefined ? [] : [{ row, game }];
      });
      const senders = await pagesOf(shown.map(({ row }) => row.fromId));
      return shown.map(({ row, game }) => {
        return {
          id: row.id,
          slug: game.slug,
          name: game.name,
          still: thumbnailOf(deps.media(game.clips.upright)),
          from: senders.get(row.fromId)?.name ?? null,
          sentAt: row.sentAt,
        };
      });
    },

    /** Whether games came in that this person has not looked at and may see: what the Your turn tab's dot shows. */
    async hasNew(toId: string, isAdult: () => Promise<boolean>): Promise<boolean> {
      const rows = await db.gameSend.findMany({ where: { toId, seenAt: null }, select: { gameId: true } });
      if (rows.length === 0) return false;
      return (await visibleGames([...new Set(rows.map((row) => row.gameId))], isAdult)).size > 0;
    },

    /** Marks every game on this person's list as seen, keeping the first time each was. */
    async markSeen(toId: string): Promise<void> {
      await db.gameSend.updateMany({ where: { toId, seenAt: null }, data: { seenAt: new Date(clock.epochMs()) } });
    },

    /** Takes one game off this person's list. Someone else's row is "not found", and nothing changes. */
    async remove(toId: string, sendId: string): Promise<"removed" | "not found"> {
      const gone = await db.gameSend.deleteMany({ where: { id: sendId, toId } });
      return gone.count === 1 ? "removed" : "not found";
    },

    /**
     * Stops the person who sent this row: every game they sent this person goes, and nothing they send reaches them
     * again. Stopping twice is one row. Someone else's row is "not found", and nothing changes.
     */
    async stop(stopperId: string, sendId: string): Promise<"stopped" | "not found"> {
      const row = await db.gameSend.findFirst({ where: { id: sendId, toId: stopperId }, select: { fromId: true } });
      if (row === null) return "not found";
      await db.$transaction([
        db.sendStop.createMany({
          data: [{ stopperId, stoppedId: row.fromId, stoppedAt: new Date(clock.epochMs()) }],
          skipDuplicates: true,
        }),
        db.gameSend.deleteMany({ where: { fromId: row.fromId, toId: stopperId } }),
      ]);
      return "stopped";
    },

    /** The people this person stopped, the latest first, by their page's name (null when their page has gone). */
    async stoppedBy(stopperId: string): Promise<StoppedPerson[]> {
      const rows = await db.sendStop.findMany({
        where: { stopperId },
        orderBy: [{ stoppedAt: "desc" }, { id: "desc" }],
        select: { id: true, stoppedId: true },
      });
      const pages = await pagesOf(rows.map((row) => row.stoppedId));
      return rows.map((row) => ({
        id: row.id,
        name: pages.get(row.stoppedId)?.name ?? null,
      }));
    },

    /** Lets a stopped person's games through again. Someone else's stop is "not found", and nothing changes. */
    async undo(stopperId: string, stopId: string): Promise<"undone" | "not found"> {
      const gone = await db.sendStop.deleteMany({ where: { id: stopId, stopperId } });
      return gone.count === 1 ? "undone" : "not found";
    },
  };
}
