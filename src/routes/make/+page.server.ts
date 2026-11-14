import { signedInOnly } from "../../features/accounts/accounts.ts";
import { gamesServices } from "../../features/games/games.ts";
import type { PageServerLoad } from "./$types";

// The maker's area: their games, each with where it stands in words. Signed out, to sign-in and back.
export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  return { games: await gamesServices().service.gamesOf(userId) };
};
