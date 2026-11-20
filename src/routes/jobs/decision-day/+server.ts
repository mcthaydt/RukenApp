import { error } from "@sveltejs/kit";
import { gamesServices } from "../../../features/games/games.ts";
import { hasJobSecret } from "../../../lib/server/job-secret.ts";
import type { RequestHandler } from "./$types";

// The hourly job's address (cloudflare/worker.js knocks on it): sends out every decision day that is due. Like the
// other jobs it answers 404 to anyone without the secret. Running it when nothing is due changes nothing.
export const POST: RequestHandler = async ({ request }) => {
  if (!hasJobSecret(request)) error(404, "Not found");
  const says = await gamesServices().service.sendOutDecisionDays();
  return Response.json({ says: says.length === 0 ? "Nothing to send out." : says });
};
