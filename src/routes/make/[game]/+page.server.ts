import { redirect } from "@sveltejs/kit";
import { answersOf, firstUnanswered, nextStepWords } from "../../../features/games/games.ts";
import { ownGame } from "../own-game.server.ts";
import type { PageServerLoad } from "./$types";

// A game's own address. A draft is not a screen of its own: it leads on to the first question not answered, or to
// the last step when none is left. Every other state is a screen that says where the game stands.
export const load: PageServerLoad = async (event) => {
  const { game } = await ownGame(event);
  if (game.state === "draft") {
    redirect(303, `/make/${game.slug}/${firstUnanswered(answersOf(game)) ?? "check"}`);
  }
  return {
    name: game.name,
    headline: game.headline,
    nextStep: nextStepWords({
      state: game.state,
      stateReason: game.reason,
      hasPending: game.hasPending,
      filesProblem: game.pullProblem !== null,
      upright: game.clips.upright !== null,
      wide: game.clips.wide !== null,
    }),
  };
};
