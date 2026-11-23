import type { GameState } from "../../lib/server/db.ts";

/**
 * Which copy of a game's files its maker test-plays before staff say yes, or null when there is nothing new to try.
 *
 * - Files waiting for review are what staff will look at, so they are what the maker tries, even while an older copy is
 *   live: players keep the live copy, the maker tries the new one.
 * - A live game whose waiting change is only a video or a rating has no new files (the waiting copy is the live one):
 *   there is nothing to test, and the game's own Play is the way in.
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
  if (game.pendingPullId !== null) return game.pendingPullId === game.livePullId ? null : game.pendingPullId;
  if (game.state === "draft" || game.state === "sent_back") return game.newestPullId;
  return null;
}
