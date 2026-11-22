import { GameError } from "./game-error.ts";
import type { GamesService, MakerGame } from "./service.ts";

/**
 * The maker's own game at this address, or a "not found" refusal that says nothing more: someone else's game, a game
 * thrown away and one that was never there all answer the same. The maker's screens and the maker's API both find their
 * game here, so a stranger can never tell a game exists by how a refusal reads.
 */
export async function ownGameOr404(
  service: Pick<GamesService, "gameForMaker">,
  slug: string,
  userId: string,
): Promise<MakerGame> {
  const game = await service.gameForMaker(slug, userId);
  if (game === null) throw new GameError("NOT_FOUND", "We can't find that game.");
  return game;
}
