import { redirect } from "@sveltejs/kit";
import { signedInOnly } from "../../../features/accounts/accounts.ts";
import { gamesServices } from "../../../features/games/games.ts";
import { gameSlugOf } from "../game-slug.ts";
import type { RequestHandler } from "./$types";

// "Connect GitHub": sends a maker to GitHub, which sends them back to /make/github/callback. It sets nothing but a
// fresh state, which only this account's callback can open. `?choose=1` goes to GitHub's own page for choosing which
// repositories the app may read, for a maker who has already connected and wants to change the list. `?game=<address>`
// is the game whose files question she is answering: it goes into the state, so she comes back to that question.
//
// A maker who is already connected may reach a game through an organisation she cannot install the app on (Floor
// Fifty). GitHub's install page offers her only her own account and never sends her back, so Ruken's list of her games
// would never be asked again. So her first `?choose=1` goes through GitHub's sign-in, which always comes back and
// refreshes the list; the question then links with `&install=1`, for a game GitHub still does not list.
export const GET: RequestHandler = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const { connect, service } = gamesServices();
  const state = connect.sealState(userId, gameSlugOf(url.searchParams.get("game")));
  const install =
    url.searchParams.get("choose") === "1" &&
    (url.searchParams.get("install") === "1" || !(await service.hasConnectedGitHub(userId)));
  const target = install ? connect.installUrl(state) : connect.signInUrl(state);
  // SvelteKit refuses a redirect to another site unless it is told which one. Only GitHub's own address, the one just
  // built from the app's settings, is allowed.
  redirect(303, target, { external: [new URL(target).origin] });
};
