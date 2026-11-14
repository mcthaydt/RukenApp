import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { isOpen } from "./switch.ts";

// The games people want to be told about before Ruken opens. Built from what it needs (the database and the clock) so
// a test hands it a database of its own.
//
// Every call is handed the launch time (see now.ts) and answers "open" once it has passed: after launch there is no
// wishlist (design), so nothing is added and nothing is removed.

export interface WishlistDeps {
  db: PrismaClient;
  clock: Clock;
}

export type Wishlist = ReturnType<typeof createWishlist>;

export function createWishlist(deps: WishlistDeps) {
  const { db, clock } = deps;

  return {
    /**
     * Puts a game on a person's list. A game already there stays as it is, and two presses at the same moment make
     * one row and no error (`skipDuplicates` lets the unique key settle it).
     */
    async add(userId: string, gameId: string, launchNowMs: number): Promise<"added" | "open"> {
      if (isOpen(launchNowMs)) return "open";
      await db.wishlist.createMany({
        data: [{ userId, gameId, addedAt: new Date(clock.epochMs()) }],
        skipDuplicates: true,
      });
      return "added";
    },

    /** Takes a game off a person's list. A game that is not there is not an error. */
    async remove(userId: string, gameId: string, launchNowMs: number): Promise<"removed" | "open"> {
      if (isOpen(launchNowMs)) return "open";
      await db.wishlist.deleteMany({ where: { userId, gameId } });
      return "removed";
    },

    /** The slugs of the games on a person's list, in the order they were added. */
    async slugsOf(userId: string): Promise<string[]> {
      const rows = await db.wishlist.findMany({
        where: { userId },
        orderBy: { addedAt: "asc" },
        select: { game: { select: { slug: true } } },
      });
      return rows.map((row) => row.game.slug);
    },

    /** How many people want a game. The maker's own row is left out, as the maker's own play is. */
    countFor(gameId: string, makerUserId: string): Promise<number> {
      return db.wishlist.count({ where: { gameId, userId: { not: makerUserId } } });
    },
  };
}
