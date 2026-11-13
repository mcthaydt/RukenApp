import type { BetterAuthPlugin } from "better-auth";
import type { RateLimiter } from "../../lib/server/rate-limit.ts";

/** The error code a per-address limit answers with. The forms show their usual "too many tries" words for any 429. */
export const RATE_LIMITED = "RATE_LIMITED";

export interface AuthLimitsOptions {
  limiter: RateLimiter;
  /** BETTER_AUTH_SECRET, the key for the address hash. */
  secret: string;
  /** The header auth.ts trusts for the client address. Every route overwrites it. */
  clientIpHeader: string;
}

export function authLimitsPlugin(options: AuthLimitsOptions): BetterAuthPlugin {
  throw new Error(`not built yet (${options.clientIpHeader})`);
}
