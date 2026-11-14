import { createHash, timingSafeEqual } from "node:crypto";
import { error, json } from "@sveltejs/kit";
import { purgeDueAccounts } from "../../../features/accounts/accounts.ts";
import { systemClock } from "../../../lib/clock.ts";
import { prisma } from "../../../lib/server/db.ts";
import { optionalEnv } from "../../../lib/server/env.ts";
import type { RequestHandler } from "./$types";

/** Whether `header` is `Bearer <secret>`. Both sides are hashed first, so the compare takes the same time for any length. */
function carriesSecret(header: string | null, secret: string | undefined): boolean {
  if (secret === undefined || header === null) return false;
  const digest = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

// The daily job's address (cloudflare/worker.js knocks on it). It answers 404, not 401, to anyone without the
// secret, so it looks like any address the site does not have. With no secret set nobody is let in.
export const POST: RequestHandler = async ({ request }) => {
  if (!carriesSecret(request.headers.get("authorization"), optionalEnv("JOBS_SECRET")))
    error(404, "Not found");
  const purged = await purgeDueAccounts({ prisma: prisma(), clock: systemClock });
  return json({ purged });
};
