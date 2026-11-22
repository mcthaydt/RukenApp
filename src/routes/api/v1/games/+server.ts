import { gamesServices } from "../../../../features/games/games.ts";
import { api, maker } from "../api.server.ts";
import type { RequestHandler } from "./$types";

// The maker's games, newest first, each with where it stands in words: Your games, as the command line shows it.
export const GET: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  const games = await gamesServices().service.gamesOf(userId);
  return Response.json({
    games: games.map((game) => ({ game: game.slug, name: game.name, words: game.words })),
  });
});
