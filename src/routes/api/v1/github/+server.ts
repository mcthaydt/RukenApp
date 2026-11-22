import { gamesServices } from "../../../../features/games/games.ts";
import { api, maker } from "../api.server.ts";
import type { RequestHandler } from "./$types";

// Whether this maker has connected GitHub, and how many repositories Ruken can see there. Connecting needs GitHub's own
// sign-in in a browser, so the answer says which address to open.
export const GET: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  const { service } = gamesServices();
  const connected = await service.hasConnectedGitHub(userId);
  const repos = connected ? (await service.repositoriesFor(userId)).length : 0;
  return Response.json({ connected, repos, connect: `${event.url.origin}/make/github` });
});
