import { signedInOnly } from "../../features/accounts/accounts.ts";
import { gamesServices } from "../../features/games/games.ts";
import type { PageServerLoad } from "./$types";

// The maker's area: their games, each with where it stands in words. Signed out, to sign-in and back. A connection to
// GitHub that could not be finished and has no question to go back to (a state that did not open) says so here.
export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  return {
    games: await gamesServices().service.gamesOf(userId),
    githubFailed: url.searchParams.get("github") === "failed",
  };
};
