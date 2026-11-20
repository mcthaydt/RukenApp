import { signedInOnly } from "../../../../features/accounts/accounts.ts";
import { gamesServices } from "../../../../features/games/games.ts";
import type { RequestHandler } from "./$types";

// The branches of one of the signed-in maker's own repositories, for the branch list on the files question. A
// repository that is not theirs gives an empty list, the same as one GitHub does not answer for.
export const GET: RequestHandler = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const repo = url.searchParams.get("repo") ?? "";
  return Response.json(await gamesServices().service.branchesFor(userId, repo));
};
