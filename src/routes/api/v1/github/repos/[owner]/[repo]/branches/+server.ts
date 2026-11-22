import { gamesServices } from "../../../../../../../../features/games/games.ts";
import { api, maker, problem } from "../../../../../api.server.ts";
import type { RequestHandler } from "./$types";

// The branches of one of this maker's repositories. A repository that is not theirs is a 404, as a game that is not
// theirs is: it says nothing about whether it exists.
export const GET: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  const { service } = gamesServices();
  const repo = `${event.params.owner}/${event.params.repo}`;
  if (!(await service.repositoriesFor(userId)).some((one) => one.fullName === repo)) {
    return problem(404, "We can't find that repository.");
  }
  return Response.json({ repo, branches: await service.branchesFor(userId, repo) });
});
