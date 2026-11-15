import { fail, redirect } from "@sveltejs/kit";
import { signedInOnly } from "../../../features/accounts/accounts.ts";
import { GameError, gamesServices } from "../../../features/games/games.ts";
import type { Actions, PageServerLoad } from "./$types";

// The first question of a game that does not exist yet: its name. The game is made when the name is given, and
// everything after is answered on the game itself (`/make/<game>/<question>`).

export const load: PageServerLoad = ({ locals, url }) => {
  signedInOnly(locals.caller, url);
  return {};
};

export const actions: Actions = {
  answer: async ({ locals, request, url }) => {
    const { userId } = signedInOnly(locals.caller, url);
    const typed = (await request.formData()).get("name");
    const name = typeof typed === "string" ? typed : "";
    let slug: string;
    try {
      slug = (await gamesServices().service.startGame({ makerUserId: userId, name })).slug;
    } catch (problem) {
      // What was typed comes back with the refusal, so nobody types it twice.
      if (problem instanceof GameError) return fail(400, { problem: problem.message, value: name });
      throw problem;
    }
    redirect(303, `/make/${slug}/line`);
  },
};
