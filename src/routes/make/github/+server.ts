import { redirect } from "@sveltejs/kit";
import { signedInOnly } from "../../../features/accounts/accounts.ts";
import { gamesServices } from "../../../features/games/games.ts";
import type { RequestHandler } from "./$types";

// "Connect GitHub": sends a maker to GitHub, which sends them back to /make/github/callback. It sets nothing but a
// fresh state, which only this account's callback can open. `?choose=1` goes to GitHub's own page for choosing which
// repositories the app may read, for a maker who has already connected and wants to change the list.
export const GET: RequestHandler = ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const { connect } = gamesServices();
  const state = connect.sealState(userId);
  const target =
    url.searchParams.get("choose") === "1" ? connect.installUrl(state) : connect.signInUrl(state);
  // SvelteKit refuses a redirect to another site unless it is told which one. Only GitHub's own address, the one just
  // built from the app's settings, is allowed.
  redirect(303, target, { external: [new URL(target).origin] });
};
