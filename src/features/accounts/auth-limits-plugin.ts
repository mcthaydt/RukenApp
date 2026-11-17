import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import type { RateLimiter, RateLimitRule } from "../../lib/server/rate-limit.ts";
import { hashNumber } from "./phone.ts";

// The rate limits that count per phone number. better-auth's own limiter keys every rule by client
// address and path only (auth.ts `rateLimit`), so these rows live here, on the shared RateLimit
// table through the site's limiter:
// - password sign-in: 5 a minute per client address and number together;
// - asking for a code (sign-up, and forgot password): 3 per 15 minutes per client address and number together, 1
//   per 30 seconds per number, and 10 an hour per number from all client addresses;
// - ten wrong codes in an hour pause codes for the number for the rest of the hour.
//
// Why the code limits also hold the client address: counted per number alone, a stranger could ask for a person's
// code three times every 15 minutes and keep the person's own "Text me a code" answering "too many tries". Now each
// client address has its own three, so the stranger's asks do not use up the person's. The 10 an hour per number
// bounds the texts one number can be sent (text bombing, which costs money too). A stranger can still reach it, but
// only from several addresses at once, as better-auth allows each one 5 an hour.
//
// They count any number typed in, with or without an account, and refuse it the same way, so a limit reached says
// nothing about who has an account. The key holds the keyed hash of the number (`hashNumber`), never the number.
//
// This must be the first plugin with a "before" hook on these paths: a request refused here should not use up one of
// the number's ten password guesses (sign-in pause).

/** The error code a per-number limit answers with. The forms show their usual "too many tries" words for any 429. */
export const RATE_LIMITED = "RATE_LIMITED";
/** A second code asked for inside 30 seconds. The forms say "Give it a few seconds". */
export const CODE_TOO_SOON = "CODE_TOO_SOON";
/** Ten wrong codes for the number in the last hour. The forms say codes are paused. */
export const CODES_PAUSED = "CODES_PAUSED";

const ONE_SECOND_MS = 1000;
const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
const FIFTEEN_MINUTES_MS = 15 * ONE_MINUTE_MS;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

/**
 * Wrong codes counted for one number, whichever step they were typed at and whether or not the number has an
 * account. Ten in an hour pause codes: no more asked for, no more checked, until the hour that started with the
 * first one is over.
 */
export const WRONG_CODES: RateLimitRule = { max: 10, windowMs: ONE_HOUR_MS };

interface NumberLimit {
  rule: RateLimitRule;
  /** Whether the key also holds the client address (per client and number) or only the number. */
  perClientAddress: boolean;
  /** What the refusal says. */
  code: typeof RATE_LIMITED | typeof CODE_TOO_SOON;
  /** Keeps two limits that both key on the number alone from sharing a counter. */
  suffix?: string;
}

/**
 * The code requests' limits, checked in this order. The per-client one comes first, so a request it refuses is not
 * counted against the number's own ceilings.
 */
const CODE_LIMITS: readonly NumberLimit[] = [
  { rule: { max: 3, windowMs: FIFTEEN_MINUTES_MS }, perClientAddress: true, code: RATE_LIMITED },
  { rule: { max: 1, windowMs: 30 * ONE_SECOND_MS }, perClientAddress: false, code: CODE_TOO_SOON, suffix: "soon" },
  { rule: { max: 10, windowMs: ONE_HOUR_MS }, perClientAddress: false, code: RATE_LIMITED },
];

/** The limited paths, relative to /api/auth. */
const LIMITS: Readonly<Record<string, readonly NumberLimit[]>> = {
  "/sign-in/phone-number": [
    { rule: { max: 5, windowMs: ONE_MINUTE_MS }, perClientAddress: true, code: RATE_LIMITED },
  ],
  "/phone-number/send-otp": CODE_LIMITS,
  "/phone-number/request-password-reset": CODE_LIMITS,
};

/** The paths where a code is asked for or typed: the ones a pause on codes closes. */
const CODE_PATHS: ReadonlySet<string> = new Set([
  "/phone-number/send-otp",
  "/phone-number/request-password-reset",
  "/phone-number/verify",
  "/phone-number/reset-password",
]);

/** The two where a code is typed: the ones whose wrong answers are counted. */
const TYPING_PATHS: ReadonlySet<string> = new Set(["/phone-number/verify", "/phone-number/reset-password"]);

/** What the answer of a wrong code carries: better-auth's `INVALID_OTP`, or `TOO_MANY_ATTEMPTS` once the three tries are used. */
const WRONG_CODE_ANSWERS: ReadonlySet<string> = new Set(["INVALID_OTP", "TOO_MANY_ATTEMPTS"]);

export interface WrongCodeDeps {
  limiter: RateLimiter;
  /** BETTER_AUTH_SECRET, the key for the number hash. */
  secret: string;
}

const wrongCodeKey = (deps: WrongCodeDeps, number: string): string =>
  `api:auth:wrong-code:${hashNumber(number, deps.secret)}`;

/**
 * Counts one wrong code for the number. The plugin calls it for the two routes that check a code; the sign-up form
 * calls it too for a number that already has an account, whose code never goes through `verify` (forms.ts), so a
 * number with an account and one without pause at the same count.
 */
export async function countWrongCode(deps: WrongCodeDeps, number: string): Promise<void> {
  await deps.limiter.hit(wrongCodeKey(deps, number), WRONG_CODES);
}

/** Whether ten wrong codes have been counted for the number inside the last hour. Counts nothing itself. */
export async function codesPausedFor(deps: WrongCodeDeps, number: string): Promise<boolean> {
  return (await deps.limiter.count(wrongCodeKey(deps, number), WRONG_CODES)) >= WRONG_CODES.max;
}

export function codesPausedError(): APIError {
  return new APIError("TOO_MANY_REQUESTS", {
    message: "Too many wrong codes. Codes are paused for an hour for this number.",
    code: CODES_PAUSED,
  });
}

export interface AuthLimitsOptions extends WrongCodeDeps {
  /** The header auth.ts trusts for the client address. Every route overwrites it. */
  clientIpHeader: string;
}

/** The number a request names, or undefined when the body has none (the endpoint's own validation refuses that). */
function numberOf(body: unknown): string | undefined {
  const number = (body as { phoneNumber?: unknown } | undefined)?.phoneNumber;
  return typeof number === "string" && number.trim() !== "" ? number : undefined;
}

export function authLimitsPlugin(options: AuthLimitsOptions): BetterAuthPlugin {
  const { limiter, secret, clientIpHeader } = options;
  return {
    id: "auth-number-limits",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path !== undefined && ctx.path in LIMITS,
          handler: createAuthMiddleware(async (ctx) => {
            const limits = LIMITS[ctx.path];
            const number = numberOf(ctx.body);
            if (limits === undefined || number === undefined) return;

            const numberKey = hashNumber(number, secret);
            const clientAddress = ctx.headers?.get(clientIpHeader) ?? "unknown";
            for (const limit of limits) {
              const key = limit.perClientAddress
                ? `api:auth:${ctx.path}:${clientAddress}:${numberKey}`
                : `api:auth:${ctx.path}:${numberKey}${limit.suffix === undefined ? "" : `:${limit.suffix}`}`;
              const result = await limiter.hit(key, limit.rule);
              if (!result.allowed) {
                throw new APIError("TOO_MANY_REQUESTS", {
                  message:
                    limit.code === CODE_TOO_SOON
                      ? "Give it a few seconds, then try again."
                      : "Too many tries. Wait a little, then try again.",
                  code: limit.code,
                });
              }
            }
          }),
        },
        {
          // Asking for a code and typing one are closed while codes are paused. A request refused here has used up
          // nothing else.
          matcher: (ctx) => ctx.path !== undefined && CODE_PATHS.has(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            const number = numberOf(ctx.body);
            if (number === undefined) return;
            if (await codesPausedFor({ limiter, secret }, number)) throw codesPausedError();
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path !== undefined && TYPING_PATHS.has(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            const number = numberOf(ctx.body);
            const returned = ctx.context.returned;
            if (number === undefined || !isAPIError(returned)) return;
            const code = (returned.body as { code?: unknown } | undefined)?.code;
            if (typeof code === "string" && WRONG_CODE_ANSWERS.has(code)) {
              await countWrongCode({ limiter, secret }, number);
            }
          }),
        },
      ],
    },
  };
}
