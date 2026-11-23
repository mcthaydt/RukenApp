import { GameError } from "../games/games.ts";
import type { GamesService } from "../games/games.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { hasAgreed } from "./agreement.ts";

/** What a maker is told when the agreement stands between them and sending. One place, so every way in says the same. */
export const AGREE_FIRST = "You need to agree to Ruken's maker agreement first.";

/**
 * Sends a first-time game for review once its maker has agreed to the maker agreement. It lives here, not in the games
 * service, because the agreement belongs to `make` and a send is also what putting a game back and a live game's saved
 * change do, neither of which asks again. It is called only where the browser asks: Check and send, and the maker's API
 * for a game that is still a draft. The database and the service come from the caller, so a test can give its own.
 */
export async function sendWhenAgreed(
  db: PrismaClient,
  service: Pick<GamesService, "sendForReview">,
  gameId: string,
  userId: string,
): Promise<void> {
  if (!(await hasAgreed(db, userId))) throw new GameError("NOT_READY", AGREE_FIRST);
  await service.sendForReview(gameId, userId);
}
