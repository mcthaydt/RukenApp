import { createHash, timingSafeEqual } from "node:crypto";
import { optionalEnv } from "./env.ts";

type Settings = Record<string, string | undefined>;

/**
 * Whether the request carries the jobs' secret as `Authorization: Bearer <JOBS_SECRET>`. Both sides are hashed first,
 * so the compare takes the same time for a header of any length. With no secret set nobody is let in. The jobs'
 * addresses answer 404, not 401, to anyone who fails this, so they look like any address the site does not have.
 */
export function hasJobSecret(request: Request, source: Settings = process.env): boolean {
  const secret = optionalEnv("JOBS_SECRET", source);
  const header = request.headers.get("authorization");
  if (secret === undefined || header === null) return false;
  const digest = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
