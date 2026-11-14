import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";

// The games people want to be told about before Ruken opens. Built from what it needs (the database and the clock) so
// a test hands it a database of its own.

export interface WishlistDeps {
  db: PrismaClient;
  clock: Clock;
}

export type Wishlist = ReturnType<typeof createWishlist>;

/** Stub: the real service is written in the next commit. */
export function createWishlist(deps: WishlistDeps) {
  const notBuilt = (what: string) => new Error(`not built yet: ${what} at ${String(deps.clock.epochMs())}`);
  return {
    add(userId: string, gameId: string, launchNowMs: number): Promise<"added" | "open"> {
      return Promise.reject(notBuilt(`add ${userId} ${gameId} ${String(launchNowMs)}`));
    },
    remove(userId: string, gameId: string, launchNowMs: number): Promise<"removed" | "open"> {
      return Promise.reject(notBuilt(`remove ${userId} ${gameId} ${String(launchNowMs)}`));
    },
    slugsOf(userId: string): Promise<string[]> {
      return Promise.reject(notBuilt(`slugsOf ${userId}`));
    },
    countFor(gameId: string, makerUserId: string): Promise<number> {
      return Promise.reject(notBuilt(`countFor ${gameId} ${makerUserId}`));
    },
  };
}
