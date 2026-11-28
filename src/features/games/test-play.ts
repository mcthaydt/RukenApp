import type { GameState } from "../../lib/server/db.ts";

/**
 * Which copy of a game's files its maker test-plays, or null when there is none to try.
 *
 * - Files waiting for review are what staff will look at, so they are what the maker tries, even while an older copy is
 *   live: players keep the live copy, the maker tries the new one.
 * - A live game with no new files waiting (nothing waits, or only a video or a rating) tries its live copy. Its own page
 *   is not a way in: before launch Wishlist stands where Play goes, for its maker too.
 * - A draft, or a game sent back, has not been sent yet: its newest copy is what would be sent.
 * - A game taken off or taken down, or thrown away, is not played at all.
 */
export function testPlayPullId(game: {
  state: GameState;
  pendingPullId: string | null;
  livePullId: string | null;
  newestPullId: string | null;
}): string | null {
  if (game.state === "taken_off" || game.state === "taken_down" || game.state === "thrown_away") return null;
  if (game.pendingPullId !== null && game.pendingPullId !== game.livePullId) return game.pendingPullId;
  if (game.state === "live") return game.livePullId;
  if (game.state === "draft" || game.state === "sent_back") return game.newestPullId;
  return null;
}
