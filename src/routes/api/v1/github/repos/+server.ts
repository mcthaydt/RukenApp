import { gamesServices } from "../../../../../features/games/games.ts";
import { api, maker } from "../../api.server.ts";
import type { RequestHandler } from "./$types";

// The repositories Ruken can see for this maker, from what GitHub last said. It asks GitHub nothing.
export const GET: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  const repos = await gamesServices().service.repositoriesFor(userId);
  return Response.json({
    repos: repos.map((one) => ({ repo: one.fullName, defaultBranch: one.defaultBranch })),
  });
});
