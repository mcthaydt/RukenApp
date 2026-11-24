import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { RateLimiter } from "../../lib/server/rate-limit.ts";
import type { ReportLimits } from "./limits.ts";
import { REASON_WORDS, type ReportInput } from "./reasons.ts";

// Players' reports on games: one per person and game, which they can read back, change and take back. Built from what
// it needs, so a test hands it a database and a clock of its own.

export interface ReportsDeps {
  db: PrismaClient;
  clock: Clock;
  limiter: RateLimiter;
  limits: ReportLimits;
}

/** The game a report is about: who made it, so its maker cannot report it. */
export interface ReportedGame {
  id: string;
  makerUserId: string;
}

export type SaveOutcome = "made" | "changed" | "own" | { limited: number };

/** One reported game as the review command shows it: most reported first, newest report first inside it. */
export interface ReportedForReview {
  game: string;
  name: string;
  state: string;
  count: number;
  reports: { reason: string; note: string | null; at: string }[];
}

export type Reports = ReturnType<typeof createReports>;

export function createReports(deps: ReportsDeps) {
  const { db, clock, limiter, limits } = deps;

  /** Counts one send against every limit; the seconds to wait when one says no. */
  async function overLimit(userId: string): Promise<number | null> {
    for (const { name, rule } of limits.rules) {
      const result = await limiter.hit(`api:report:${name}:${userId}`, rule);
      if (!result.allowed) return result.retryAfterSeconds;
    }
    return null;
  }

  return {
    /** This person's report on this game, or null when they have none. */
    async mine(userId: string, gameId: string): Promise<ReportInput | null> {
      const row = await db.gameReport.findUnique({
        where: { userId_gameId: { userId, gameId } },
        select: { reason: true, note: true },
      });
      return row === null ? null : { reason: row.reason, note: row.note };
    },

    /**
     * Makes the person's report, or changes the one they have. Two sends at the same moment make one row:
     * `skipDuplicates` lets the unique key settle which one makes it, and the other changes it.
     */
    async save(userId: string, game: ReportedGame, input: ReportInput): Promise<SaveOutcome> {
      if (userId === game.makerUserId) return "own";
      const wait = await overLimit(userId);
      if (wait !== null) return { limited: wait };
      const now = new Date(clock.epochMs());
      const made = await db.gameReport.createMany({
        data: [
          { userId, gameId: game.id, reason: input.reason, note: input.note, madeAt: now, changedAt: now },
        ],
        skipDuplicates: true,
      });
      if (made.count === 1) return "made";
      await db.gameReport.update({
        where: { userId_gameId: { userId, gameId: game.id } },
        data: { reason: input.reason, note: input.note, changedAt: now },
      });
      return "changed";
    },

    /** Takes the person's report back. Having none is not an error, and it is not counted against the limits. */
    async withdraw(userId: string, gameId: string): Promise<void> {
      await db.gameReport.deleteMany({ where: { userId, gameId } });
    },

    /** Every reported game for the review command. It names no reporter. */
    async forReview(): Promise<ReportedForReview[]> {
      const rows = await db.gameReport.findMany({
        orderBy: { changedAt: "desc" },
        select: {
          reason: true,
          note: true,
          changedAt: true,
          game: { select: { id: true, slug: true, name: true, state: true } },
        },
      });
      const byGame = new Map<string, ReportedForReview>();
      for (const row of rows) {
        const entry = byGame.get(row.game.id) ?? {
          game: row.game.slug,
          name: row.game.name,
          state: row.game.state,
          count: 0,
          reports: [],
        };
        entry.count += 1;
        entry.reports.push({
          reason: REASON_WORDS[row.reason],
          note: row.note,
          at: row.changedAt.toISOString(),
        });
        byGame.set(row.game.id, entry);
      }
      // Map keeps the order games were first met (newest report first), so a stable sort keeps that among equal counts.
      return [...byGame.values()].sort((a, b) => b.count - a.count);
    },
  };
}
