import { signedInOnly } from "../../features/accounts/accounts.ts";
import { gamesServices } from "../../features/games/games.ts";
import type { PageServerLoad } from "./$types";

// The maker's area: their games, each with where it stands in words. Signed out, to sign-in and back. A connection to
// GitHub that could not be finished and has no question to go back to (a state that did not open) says so here.
export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const games = gamesServices();
  return {
    // Each game's picture is its wide video's first frame, or nothing until it has one.
    games: (await games.service.gamesOf(userId)).map((game) => ({
      ...game,
      still: game.wideClipKey === null ? null : games.media(game.wideClipKey),
    })),
    githubFailed: url.searchParams.get("github") === "failed",
  };
};
