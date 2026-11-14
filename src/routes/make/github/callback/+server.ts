import { redirect } from "@sveltejs/kit";
import { signedInOnly } from "../../../../features/accounts/accounts.ts";
import { GameError, gamesServices } from "../../../../features/games/games.ts";
import type { RequestHandler } from "./$types";

// Where GitHub sends a maker back: after signing in, and after installing the app (the app is set to ask for sign-in
// during installation, so both arrive here with a `code`). The address is typed by whoever sends it, so nothing in it
// is believed: the state must open for this account, and what the maker can reach is asked of GitHub with the code,
// as the maker, never taken from the address.
const FAILED = "/make/new?github=failed";

export const GET: RequestHandler = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const { connect, service } = gamesServices();

  const code = url.searchParams.get("code");
  if (code === null || code === "") redirect(303, FAILED);
  if (!connect.openState(url.searchParams.get("state") ?? undefined, userId)) redirect(303, FAILED);

  // GitHub refused the code (spent, or not for this app): the maker tries again. Anything else is ours to see.
  const found = await connect.connectionOf(code).catch((error: unknown) => {
    if (error instanceof GameError) redirect(303, FAILED);
    throw error;
  });
  await service.rememberConnection(userId, found);
  redirect(303, "/make/new");
};
