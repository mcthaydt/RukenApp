import type { Clock } from "../clock.ts";
import type { PrismaClient } from "./db.ts";

/** At most `max` requests per fixed window of `windowMs`. */
export interface RateLimitRule {
  max: number;
  windowMs: number;
}

/**
 * How long a counter row may be kept after its window started. A day is the longest window any rule
 * uses; `hit` refuses a longer rule, because a cleanup of old rows could then delete a counter whose
 * window is still open.
 */
export const RATE_LIMIT_ROWS_KEPT_MS = 24 * 60 * 60_000;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface RateLimiter {
  /** Counts one request against `key` and says whether it may go ahead. */
  hit(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
}

/** Fixed-window counters on the shared `RateLimit` table. */
export function createRateLimiter(prisma: PrismaClient, clock: Clock): RateLimiter {
  throw new Error(`not built yet (${typeof prisma} ${typeof clock})`);
}
