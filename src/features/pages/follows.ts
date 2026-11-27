import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";

// Who follows which maker. A person follows a maker by their page's address; the row keeps the maker's account, so the
// Following feed can find their games. Built from what it needs (the database and the clock) so a test hands it a
// database of its own.

export interface FollowsDeps {
  db: PrismaClient;
  clock: Clock;
}

export type Follows = ReturnType<typeof createFollows>;

export function createFollows(deps: FollowsDeps) {
  const { db, clock } = deps;

  /** The account behind a page's address, or null when no page has it. */
  async function makerOf(handle: string): Promise<string | null> {
    const page = await db.makerPage.findUnique({ where: { handle }, select: { userId: true } });
    return page?.userId ?? null;
  }

  return {
    /**
     * Follows the maker at this address. Following again changes nothing, and two presses at the same moment make one
     * row and no error (`skipDuplicates` lets the unique key settle it).
     */
    async follow(followerId: string, handle: string): Promise<"followed" | "no page" | "own"> {
      const makerId = await makerOf(handle);
      if (makerId === null) return "no page";
      if (makerId === followerId) return "own";
      await db.makerFollow.createMany({
        data: [{ followerId, makerId, followedAt: new Date(clock.epochMs()) }],
        skipDuplicates: true,
      });
      return "followed";
    },

    /** Stops following the maker at this address. Someone not followed is not an error. */
    async unfollow(followerId: string, handle: string): Promise<"unfollowed" | "no page"> {
      const makerId = await makerOf(handle);
      if (makerId === null) return "no page";
      await db.makerFollow.deleteMany({ where: { followerId, makerId } });
      return "unfollowed";
    },

    /** Which of these makers' accounts the person follows. */
    async followedAmong(followerId: string, makerIds: readonly string[]): Promise<Set<string>> {
      if (makerIds.length === 0) return new Set();
      const rows = await db.makerFollow.findMany({
        where: { followerId, makerId: { in: [...makerIds] } },
        select: { makerId: true },
      });
      return new Set(rows.map((row) => row.makerId));
    },

    /** The accounts of every maker the person follows, the newest follow first: what the Following feed reads. */
    async followedMakerIds(followerId: string): Promise<string[]> {
      const rows = await db.makerFollow.findMany({
        where: { followerId },
        orderBy: [{ followedAt: "desc" }, { id: "desc" }],
        select: { makerId: true },
      });
      return rows.map((row) => row.makerId);
    },
  };
}
