import { redirect } from "@sveltejs/kit";
import { signedInOnly } from "../../../../features/accounts/accounts.ts";
import { GameError, gamesServices } from "../../../../features/games/games.ts";
import { gameSlugOf } from "../../game-slug.ts";
import type { RequestHandler } from "./$types";

// Where GitHub sends a maker back: after signing in, and after installing the app (the app is set to ask for sign-in
// during installation, so both arrive here with a `code`). The address is typed by whoever sends it, so nothing in it
// is believed: the state must open for this account, and what the maker can reach is asked of GitHub with the code,
// as the maker, never taken from the address.
//
// She goes back to the question she was on. The callback only redirects: a game that is not hers is the question's
// own 404, so nothing here needs to know whose game it is.
const FAILED = "/make?github=failed";

export const GET: RequestHandler = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const { connect, service } = gamesServices();

  const code = url.searchParams.get("code");
  const opened = connect.openState(url.searchParams.get("state") ?? undefined, userId);
  if (opened === undefined) redirect(303, FAILED);
  const game = gameSlugOf(opened.game);
  const filesQuestion = game === null ? "/make" : `/make/${game}/files`;
  // The question that asked says it did not work; with none, Your games does.
  const failed = game === null ? FAILED : `${filesQuestion}?github=failed`;
  if (code === null || code === "") redirect(303, failed);

  // GitHub refused the code (spent, or not for this app): the maker tries again. Anything else is ours to see.
  const found = await connect.connectionOf(code).catch((error: unknown) => {
    if (error instanceof GameError) redirect(303, failed);
    throw error;
  });
  // What GitHub listed, by account, with no repository names and no token: when a maker says Ruken can't see a game,
  // the site's log shows whether GitHub offered that account at all.
  console.info(
    `GitHub listed ${String(found.length)} installation(s): ${found
      .map((one) => `${one.accountLogin} (${String(one.repositories.length)} repos)`)
      .join(", ")}`,
  );
  await service.rememberConnection(userId, found);
  // Back from GitHub's sign-in (an install sends `installation_id` too): the list is fresh, so the question's link now
  // opens the install page, for a game GitHub still does not list.
  const signedIn = url.searchParams.get("installation_id") === null;
  redirect(303, signedIn && game !== null ? `${filesQuestion}?looked=1` : filesQuestion);
};
