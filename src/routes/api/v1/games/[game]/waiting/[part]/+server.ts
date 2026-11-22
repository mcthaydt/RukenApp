import { gamesServices, ownGameOr404 } from "../../../../../../../features/games/games.ts";
import { api, gameProblem, maker, problem } from "../../../../api.server.ts";
import { gameView } from "../../../game-view.server.ts";
import type { RequestHandler } from "./$types";

/** The words the command line says, and the part of a live game each one is. */
const PARTS = { upright: "upright_video", wide: "wide_video", age: "age_rating" } as const;

// "Keep the old one": what a live game's maker changed is dropped, and players keep what they see. Asked twice, the
// second changes nothing.
export const DELETE: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  const { service } = gamesServices();
  const { part } = event.params;
  try {
    if (!Object.hasOwn(PARTS, part)) return problem(404, "We can't find that game.");
    const game = await ownGameOr404(service, event.params.game, userId);
    await service.keepTheOldOne(game.id, userId, PARTS[part as keyof typeof PARTS]);
    return Response.json(gameView(await ownGameOr404(service, game.slug, userId)));
  } catch (error) {
    if (error instanceof Response) return error;
    return gameProblem(error);
  }
});
