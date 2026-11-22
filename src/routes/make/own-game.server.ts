import { error, type RequestEvent } from "@sveltejs/kit";
import { signedInOnly } from "../../features/accounts/accounts.ts";
import { GameError, gamesServices, ownGameOr404 } from "../../features/games/games.ts";

/**
 * The signed-in maker and their game for this page's address. Every page and action in the maker's area finds its
 * game here, among the signed-in maker's own: someone else's game, or none, is a 404 that says nothing, never a
 * refusal that tells a stranger the game exists.
 */
export async function ownGame(event: Pick<RequestEvent, "locals" | "url"> & { params: { game: string } }) {
  const { userId } = signedInOnly(event.locals.caller, event.url);
  try {
    return { userId, game: await ownGameOr404(gamesServices().service, event.params.game, userId) };
  } catch (problem) {
    if (problem instanceof GameError && problem.code === "NOT_FOUND") error(404, "Not found");
    throw problem;
  }
}
