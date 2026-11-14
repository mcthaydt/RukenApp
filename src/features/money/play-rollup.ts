import { chicagoDayOf, type Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { PLAY_SESSION_LIFE_MS } from "../play/play.ts";
import { addDays, startOfDayMs, type DateText } from "./calendar.ts";
import { lockLedger } from "./journal.ts";
import { playSecondsOnDay, type SessionBeats } from "./play-day.ts";

/**
 * Adding up each day's play. A statement must never read a month of beats, so each Chicago day is added up once, after
 * it has ended, into one row for each member and game (`PlayDay`). The pool then reads days, never beats.
 */

export interface RollupDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
}

/** A run that has fallen behind catches up this many days at a time, so one run stays small. */
const MOST_DAYS_PER_RUN = 40;

/**
 * Adds up every Chicago day that has ended and has not been added up, oldest first. It starts at the day after the
 * newest day done, or at the day of the oldest session when there is none yet. A day is done even when nobody played,
 * so it is never added up twice. Answers the days it did.
 *
 * A day is added up only after it ends, and a beat is stamped by the server's clock, so a finished day cannot gain a
 * beat later.
 */
export async function rollUpPlayDays(deps: RollupDeps): Promise<{ days: DateText[] }> {
  const nowMs = deps.clock.epochMs();
  const today = chicagoDayOf(nowMs);
  let day = await firstDayToRoll(deps.db);
  const done: DateText[] = [];
  // Days written `YYYY-MM-DD` sort in time order, so a plain comparison finds the days that have ended.
  while (day !== null && day < today && done.length < MOST_DAYS_PER_RUN) {
    if (await rollDay(deps.db, day, nowMs)) done.push(day);
    day = addDays(day, 1);
  }
  return { days: done };
}

async function firstDayToRoll(db: PrismaClient): Promise<DateText | null> {
  const newest = await db.playDayRun.findFirst({ orderBy: { day: "desc" } });
  if (newest !== null) return addDays(newest.day.toISOString().slice(0, 10), 1);
  const oldest = await db.playSession.findFirst({
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });
  return oldest === null ? null : chicagoDayOf(oldest.startedAt.getTime());
}

/**
 * One day, in one transaction under the ledger's lock. The sessions that count are `member` sessions with a person on
 * them (free play, staff play and a maker's own play never count) whose person has no staff role (coordinator,
 * 2026-11-14: any staff member's play is staff play, whatever their role).
 *
 * A session takes beats for `PLAY_SESSION_LIFE_MS`, so one that started up to that long before the day began can still
 * play into it. The window is measured back from the day's own start, not from its end: on a 25-hour day, "24 hours
 * before the end" would miss the sessions of the day's first hour.
 */
async function rollDay(db: PrismaClient, day: DateText, nowMs: number): Promise<boolean> {
  const startMs = startOfDayMs(day);
  const endMs = startOfDayMs(addDays(day, 1));
  return db.$transaction(async (tx) => {
    await lockLedger(tx);
    const dayDate = new Date(`${day}T00:00:00Z`);
    if ((await tx.playDayRun.findUnique({ where: { day: dayDate } })) !== null) return false;

    const sessions = await tx.playSession.findMany({
      where: {
        basis: "member",
        userId: { not: null },
        startedAt: { gte: new Date(startMs - PLAY_SESSION_LIFE_MS), lt: new Date(endMs) },
        user: { staffAssignments: { none: {} } },
      },
      select: {
        userId: true,
        gameId: true,
        startedAt: true,
        beats: { select: { receivedAt: true, attentive: true } },
      },
    });

    const byPersonAndGame = new Map<string, { userId: string; gameId: string; sessions: SessionBeats[] }>();
    for (const session of sessions) {
      if (session.userId === null) continue;
      const key = `${session.userId}\n${session.gameId}`;
      const group = byPersonAndGame.get(key) ?? {
        userId: session.userId,
        gameId: session.gameId,
        sessions: [],
      };
      group.sessions.push({
        startedAtMs: session.startedAt.getTime(),
        beats: session.beats.map((beat) => ({ atMs: beat.receivedAt.getTime(), attentive: beat.attentive })),
      });
      byPersonAndGame.set(key, group);
    }

    const rows = [...byPersonAndGame.values()]
      .map(({ userId, gameId, sessions: theirs }) => ({
        day: dayDate,
        userId,
        gameId,
        seconds: playSecondsOnDay(theirs, day),
      }))
      .filter((row) => row.seconds >= 1);
    await tx.playDay.createMany({ data: rows });
    await tx.playDayRun.create({ data: { day: dayDate, rolledAt: new Date(nowMs) } });
    return true;
  });
}
