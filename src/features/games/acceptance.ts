import type { Temporal } from "@js-temporal/polyfill";
import type { PrismaClient } from "../../lib/server/db.ts";

// How hard it is to get a game onto Ruken, measured from staff's decisions and never typed: each game counts once, by
// the day of its first decision, over the last 90 days, and it got in if any decision on it was a yes.

/** Below this many decided games a share would swing on one game, so the label says a plain line instead (Owner's card, 2026-11-17). */
export const ACCEPTANCE_FLOOR = 20;

/** How far back a game's first decision may be and still count. */
export const ACCEPTANCE_DAYS = 90;

/** Games decided in the window, and how many of them got in. */
export interface AcceptanceCounts {
  decided: number;
  accepted: number;
}

/** The whole percent that got in, or null while too few games are decided. One that got in is never said as 0%. */
export function acceptancePercent(counts: AcceptanceCounts): number | null {
  if (counts.decided < ACCEPTANCE_FLOOR) return null;
  const percent = Math.round((counts.accepted * 100) / counts.decided);
  return counts.accepted > 0 ? Math.max(percent, 1) : 0;
}

/** The label at the top of Your games. */
export function acceptanceWords(counts: AcceptanceCounts): string {
  const percent = acceptancePercent(counts);
  return percent === null ? "A person checks every game." : `${String(percent)}% of games get in.`;
}

/**
 * Counts the games whose first decision that took effect falls in the window ending `now`. A decision took effect when
 * it was made at once, or when its decision day went out and applied it (`tookEffect` in service.ts says the same for
 * Prisma); a held one is dated by the day it went out, a lapsed one never counts. An update never counts on its own,
 * because a game counts once, by its first decision.
 */
export async function countAcceptance(db: PrismaClient, now: Temporal.Instant): Promise<AcceptanceCounts> {
  const since = new Date(now.subtract({ hours: ACCEPTANCE_DAYS * 24 }).epochMilliseconds);
  const rows = await db.$queryRaw<{ decided: bigint; accepted: bigint }[]>`
    SELECT count(*) AS decided, count(*) FILTER (WHERE "gotIn") AS accepted
    FROM (
      SELECT min(COALESCE(day."wentOutAt", review."decidedAt")) AS "firstTookEffect",
             bool_or(review."decision" = 'accepted') AS "gotIn"
      FROM "GameReview" AS review
      LEFT JOIN "DecisionOutcome" AS outcome ON outcome."reviewId" = review."id"
      LEFT JOIN "DecisionDay" AS day ON day."day" = review."goesOutOn"
      WHERE review."goesOutOn" IS NULL OR outcome."result" = 'applied'
      GROUP BY review."gameId"
    ) AS games
    WHERE "firstTookEffect" >= ${since}`;
  const row = rows[0];
  return { decided: Number(row?.decided ?? 0n), accepted: Number(row?.accepted ?? 0n) };
}
