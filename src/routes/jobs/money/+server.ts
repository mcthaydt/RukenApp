import { error } from "@sveltejs/kit";
import { hasJobSecret } from "../../../lib/server/job-secret.ts";
import { moneyServices } from "../../../features/money/money.ts";
import type { RequestHandler } from "./$types";

// The daily money job's address (cloudflare/worker.js knocks on it after the purge). Like the purge's, it answers 404,
// not 401, to anyone without the secret, so it looks like any address the site does not have.
//
// It answers 200 with the report whatever the steps did, so a person who runs it by hand reads what failed. The Worker's
// daily knock reads `problems` and fails the run when there are any.
export const POST: RequestHandler = async ({ request }) => {
  if (!hasJobSecret(request)) error(404, "Not found");
  return Response.json(await moneyServices().runJob());
};
