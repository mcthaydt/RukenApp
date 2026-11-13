import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { RateLimiter, RateLimitRule } from "../../lib/server/rate-limit.ts";
import { hashSignInEmail } from "./sign-in-guard.ts";

// The rate limits that count per email address. better-auth's own limiter keys every rule by client
// address and path only (auth.ts `rateLimit`), so these rows live here, on the shared RateLimit
// table through the site's limiter:
// - password sign-in: 5 a minute per client address and email together;
// - the reset request: 3 per 15 minutes per client address and email together, and 30 an hour per
//   email from all client addresses.
//
// Why the reset limits also hold the client address: counted per email alone, a stranger could ask
// for a person's reset three times every 15 minutes and keep the person's own "Forgot your
// password?" answering "too many tries". With their password sign-in paused as well
// (sign-in-pause-plugin.ts), the person would have no way in. Now each client address has its own
// three, so the stranger's requests do not use up the person's. The 30 an hour per email bounds the
// mail one address can be sent (mail bombing). A stranger can still reach it, but only from several
// addresses at once, as better-auth allows each one 10 an hour.
//
// They count any address typed in, with or without an account, and refuse it the same way, so a
// limit reached says nothing about who has an account. The key holds the keyed hash of the address
// (as the sign-in pause does), never the address itself.
//
// This must be the first plugin with a "before" hook on these paths: a request refused here should
// not use up one of the address's ten password guesses (sign-in pause).

/** The error code a per-address limit answers with. The forms show their usual "too many tries" words for any 429. */
export const RATE_LIMITED = "RATE_LIMITED";

const ONE_MINUTE_MS = 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * ONE_MINUTE_MS;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

interface AddressLimit {
  rule: RateLimitRule;
  /** Whether the key also holds the client address (per IP+email) or only the email. */
  perClientAddress: boolean;
}

/**
 * The reset request's limits, checked in this order. The per-client one comes first, so a request
 * it refuses is not counted against the address's hourly ceiling.
 */
const RESET_LIMITS: readonly AddressLimit[] = [
  { rule: { max: 3, windowMs: FIFTEEN_MINUTES_MS }, perClientAddress: true },
  { rule: { max: 30, windowMs: ONE_HOUR_MS }, perClientAddress: false },
];

/** The limited paths, relative to /api/auth. */
const LIMITS: Readonly<Record<string, readonly AddressLimit[]>> = {
  "/sign-in/email": [{ rule: { max: 5, windowMs: ONE_MINUTE_MS }, perClientAddress: true }],
  "/request-password-reset": RESET_LIMITS,
};

export interface AuthLimitsOptions {
  limiter: RateLimiter;
  /** BETTER_AUTH_SECRET, the key for the address hash. */
  secret: string;
  /** The header auth.ts trusts for the client address. Every route overwrites it. */
  clientIpHeader: string;
}

export function authLimitsPlugin(options: AuthLimitsOptions): BetterAuthPlugin {
  const { limiter, secret, clientIpHeader } = options;
  return {
    id: "auth-address-limits",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path !== undefined && ctx.path in LIMITS,
          handler: createAuthMiddleware(async (ctx) => {
            const limits = LIMITS[ctx.path];
            const email = (ctx.body as { email?: unknown } | undefined)?.email;
            // A body without an address is left for the endpoint's own validation to refuse.
            if (limits === undefined || typeof email !== "string" || email.trim() === "") return;

            const emailKey = hashSignInEmail(email, secret);
            const clientAddress = ctx.headers?.get(clientIpHeader) ?? "unknown";
            for (const limit of limits) {
              const key = limit.perClientAddress
                ? `api:auth:${ctx.path}:${clientAddress}:${emailKey}`
                : `api:auth:${ctx.path}:${emailKey}`;
              const result = await limiter.hit(key, limit.rule);
              if (!result.allowed) {
                throw new APIError("TOO_MANY_REQUESTS", {
                  message: "Too many tries. Wait a little, then try again.",
                  code: RATE_LIMITED,
                });
              }
            }
          }),
        },
      ],
    },
  };
}
