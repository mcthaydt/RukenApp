import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";

// Like, Save and Repost on a game's clip (learned-feed spec, unit G). One row per person, game and kind; pressing again
// takes it back. A maker may mark their own game too (the owner, 2026-11-27). Built from what it needs (the database and the clock) so a test hands it
// a database of its own.

export const MARK_KINDS = ["like", "save", "repost"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

export function isMarkKind(value: unknown): value is MarkKind {
  return typeof value === "string" && (MARK_KINDS as readonly string[]).includes(value);
}

/** What a clip shows for one game: how many people like it, and what this viewer pressed. */
export interface ClipMarks {
  likes: number;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
}

export interface MarksDeps {
  db: PrismaClient;
  clock: Clock;
}

export type Marks = ReturnType<typeof createMarks>;

export function createMarks(deps: MarksDeps) {
  const { db, clock } = deps;

  return {
    /**
     * Turns one mark on or off for a person and game, and answers the game's like count after it. Pressing twice at once makes one row and no error (`skipDuplicates` lets the
     * unique key settle it); taking off a mark that is not there is not an error.
     */
    async set(
      userId: string,
      game: { id: string; makerUserId: string },
      kind: MarkKind,
      on: boolean,
    ): Promise<{ on: boolean; likes: number }> {
      if (on) {
        await db.gameMark.createMany({
          data: [{ userId, gameId: game.id, kind, madeAt: new Date(clock.epochMs()) }],
          skipDuplicates: true,
        });
      } else {
        await db.gameMark.deleteMany({ where: { userId, gameId: game.id, kind } });
      }
      const likes = await db.gameMark.count({ where: { gameId: game.id, kind: "like" } });
      return { on, likes };
    },

    /** What each game's clip shows for this viewer (null when signed out): two reads, whatever the number of games. */
    async ofClips(
      viewerId: string | null,
      games: readonly { id: string; makerUserId: string }[],
    ): Promise<Map<string, ClipMarks>> {
      const ids = games.map((game) => game.id);
      const [likes, mine] = await Promise.all([
        ids.length === 0
          ? []
          : db.gameMark.groupBy({
              by: ["gameId"],
              where: { gameId: { in: ids }, kind: "like" },
              _count: { _all: true },
            }),
        viewerId === null || ids.length === 0
          ? []
          : db.gameMark.findMany({
              where: { userId: viewerId, gameId: { in: ids } },
              select: { gameId: true, kind: true },
            }),
      ]);
      const likesOf = new Map(likes.map((row) => [row.gameId, row._count._all]));
      const has = (gameId: string, kind: MarkKind) =>
        mine.some((row) => row.gameId === gameId && row.kind === kind);
      return new Map(
        games.map((game) => [
          game.id,
          {
            likes: likesOf.get(game.id) ?? 0,
            liked: has(game.id, "like"),
            saved: has(game.id, "save"),
            reposted: has(game.id, "repost"),
          },
        ]),
      );
    },

    /** Takes a person's mark off a game, by its address, whether or not the game is still live. */
    async takeOff(userId: string, slug: string, kind: MarkKind): Promise<void> {
      await db.gameMark.deleteMany({ where: { userId, kind, game: { slug } } });
    },

    /** The ids of the games a person saved (or reposted), the latest first. */
    async gameIdsOf(userId: string, kind: "save" | "repost"): Promise<string[]> {
      const rows = await db.gameMark.findMany({
        where: { userId, kind },
        orderBy: { madeAt: "desc" },
        select: { gameId: true },
      });
      return rows.map((row) => row.gameId);
    },
  };
}
