import { gamesServices, ownGameOr404 } from "../../../../../features/games/games.ts";
import { api, gameProblem, maker } from "../../api.server.ts";
import { gameView } from "../game-view.server.ts";
import type { RequestHandler } from "./$types";

// One game: where it stands, what is left, what was sent back, what waits for review. Someone else's game is a 404.
export const GET: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  try {
    return Response.json(gameView(await ownGameOr404(gamesServices().service, event.params.game, userId)));
  } catch (error) {
    return gameProblem(error);
  }
});
