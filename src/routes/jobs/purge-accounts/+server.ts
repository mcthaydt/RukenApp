import { error } from "@sveltejs/kit";
import { purgeDueAccounts } from "../../../features/accounts/accounts.ts";
import { systemClock } from "../../../lib/clock.ts";
import { prisma } from "../../../lib/server/db.ts";
import { hasJobSecret } from "../../../lib/server/job-secret.ts";
import type { RequestHandler } from "./$types";

// The daily job's address (cloudflare/worker.js knocks on it). It answers 404, not 401, to anyone without the
// secret, so it looks like any address the site does not have. With no secret set nobody is let in.
export const POST: RequestHandler = async ({ request }) => {
  if (!hasJobSecret(request)) error(404, "Not found");
  const purged = await purgeDueAccounts({ prisma: prisma(), clock: systemClock });
  return Response.json({ purged });
};
