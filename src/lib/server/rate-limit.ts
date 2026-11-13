import { randomUUID } from "node:crypto";
import type { Clock } from "../clock.ts";
import type { PrismaClient } from "./db.ts";

/** At most `max` requests per fixed window of `windowMs`. */
export interface RateLimitRule {
  max: number;
  windowMs: number;
}

/**
 * How long a counter row may be kept after its window started. Many keys are one-offs (a client
 * address, say), so a cleanup of old rows will want a number. A day is the longest window any rule
 * uses; `hit` refuses a longer rule, because a cleanup could then delete a counter whose window is
 * still open.
 */
export const RATE_LIMIT_ROWS_KEPT_MS = 24 * 60 * 60_000;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface RateLimiter {
  /** Counts one request against `key` and says whether it may go ahead. */
  hit(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
}

/**
 * Fixed-window counters on the shared `RateLimit` table. better-auth uses the same table with its
 * own keys; ours start with `api:`. For our keys `lastRequest` holds the start of the current window
 * (epoch ms), not the time of the last request.
 *
 * One SQL statement does the whole check, so concurrent requests cannot both read "2 of 3" and both
 * go ahead: Postgres applies `ON CONFLICT DO UPDATE` to the row one request at a time.
 * - No row yet: insert count 1 with the window starting now.
 * - The window has ended: restart it at now with count 1.
 * - Otherwise: add one to the count.
 * Refused requests are counted too; that changes nothing, because the window start stays put.
 */
export function createRateLimiter(prisma: PrismaClient, clock: Clock): RateLimiter {
  return {
    async hit(key, rule) {
      if (rule.windowMs > RATE_LIMIT_ROWS_KEPT_MS) {
        throw new Error(
          `a rate-limit window of ${String(rule.windowMs)} ms outlives the time counters are kept`,
        );
      }
      const now = clock.epochMs();
      const windowEndedBefore = BigInt(now - rule.windowMs);
      const rows = await prisma.$queryRaw<{ count: number; lastRequest: bigint }[]>`
        INSERT INTO "RateLimit" (id, key, count, "lastRequest")
        VALUES (${randomUUID()}, ${key}, 1, ${BigInt(now)})
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN "RateLimit"."lastRequest" <= ${windowEndedBefore} THEN 1 ELSE "RateLimit".count + 1 END,
          "lastRequest" = CASE WHEN "RateLimit"."lastRequest" <= ${windowEndedBefore} THEN ${BigInt(now)} ELSE "RateLimit"."lastRequest" END
        RETURNING count, "lastRequest"`;
      const row = rows[0];
      if (row === undefined) throw new Error("rate limit upsert returned no row");
      if (row.count <= rule.max) return { allowed: true };
      const windowEndsAt = Number(row.lastRequest) + rule.windowMs;
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowEndsAt - now) / 1000)) };
    },
  };
}
