import { gamesServices, ownGameOr404 } from "../../../../features/games/games.ts";
import { api, gameProblem, maker, problem, readJson } from "../api.server.ts";
import { gameView } from "./game-view.server.ts";
import type { RequestHandler } from "./$types";

// The maker's games, newest first, each with where it stands in words: Your games, as the command line shows it.
export const GET: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  const games = await gamesServices().service.gamesOf(userId);
  return Response.json({
    games: games.map((game) => ({ game: game.slug, name: game.name, words: game.words })),
  });
});

// A new game, from its name: the same start as the browser's first question. It answers the game as it stands.
export const POST: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  const body = await readJson(event.request);
  if (typeof body?.name !== "string") return problem(400, "Say the game's name.");
  const { service } = gamesServices();
  try {
    const { slug } = await service.startGame({ makerUserId: userId, name: body.name });
    return Response.json(gameView(await ownGameOr404(service, slug, userId)), { status: 201 });
  } catch (error) {
    return gameProblem(error);
  }
});
