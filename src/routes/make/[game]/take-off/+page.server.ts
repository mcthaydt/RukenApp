import { error, fail, redirect } from "@sveltejs/kit";
import { GameError, gamesServices } from "../../../../features/games/games.ts";
import { ownGame } from "../../own-game.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// The last question before a live game is taken off Ruken (the agreement's first point). Its maker can put it back; it
// then goes through review again.
// Only a live game can be: a draft, a waiting game, a sent-back game and a game already off are a 404, as is anyone
// else's, so the question is never asked twice.
export const load: PageServerLoad = async (event) => {
  const { game } = await ownGame(event);
  if (game.state !== "live") error(404, "Not found");
  return { name: game.name, slug: game.slug };
};

export const actions: Actions = {
  takeOff: async (event) => {
    const { userId, game } = await ownGame(event);
    if (game.state !== "live") error(404, "Not found");
    try {
      await gamesServices().service.takeOff(game.id, userId);
    } catch (problem) {
      if (problem instanceof GameError) return fail(400, { problem: problem.message });
      // Deleting the files stopped: the game is already off, and its screen says files are left and offers to delete them.
      if ((await ownGame(event)).game.state !== "taken_off") throw problem;
    }
    // Its own page now says that it is off, in its own words.
    redirect(303, `/make/${game.slug}`);
  },
};
