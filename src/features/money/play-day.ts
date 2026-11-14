import { addDays, startOfDayMs, type DateText } from "./calendar.ts";
import { DAILY_PLAY_CAP_SECONDS } from "./rules.ts";
import { LONGEST_COUNTED_GAP_MS } from "../play/play.ts";

/** One play session, with its beats, as slice 2 stores them. A session lives 24 hours and can cross midnight. */
export interface SessionBeats {
  readonly startedAtMs: number;
  readonly beats: readonly { atMs: number; attentive: boolean }[];
}

/** A stretch of real time, from `fromMs` up to `toMs`. */
export interface CountedInterval {
  readonly fromMs: number;
  readonly toMs: number;
}

/**
 * The stretches slice 2's `countedMs` counts, as stretches instead of a total: beats in time order; an attentive beat
 * counts from the beat before it (or the start), and when that is longer than `LONGEST_COUNTED_GAP_MS`, only the last
 * `LONGEST_COUNTED_GAP_MS` before the beat; a beat that is not attentive counts nothing; every beat is the "before" of
 * the next. Their lengths always add up to `countedMs(session.startedAtMs, session.beats)`.
 *
 * The money needs the stretches, not the total, because two things cut a total apart: Chicago midnight (a session can
 * cross it) and a second tab (two sessions can cover the same moment).
 */
export function countedIntervals(session: SessionBeats): CountedInterval[] {
  const stretches: CountedInterval[] = [];
  let before = session.startedAtMs;
  for (const beat of [...session.beats].sort((a, b) => a.atMs - b.atMs)) {
    if (beat.attentive) {
      const counted = Math.min(Math.max(beat.atMs - before, 0), LONGEST_COUNTED_GAP_MS);
      if (counted > 0) stretches.push({ fromMs: beat.atMs - counted, toMs: beat.atMs });
    }
    before = beat.atMs;
  }
  return stretches;
}

/**
 * How many whole seconds a member played one game on one Chicago day: every session's stretches, cut to the day, joined
 * so that a moment covered by two sessions counts once, added up, rounded down, and `DAILY_PLAY_CAP_SECONDS` at most.
 * The caller passes one member's sessions of one game.
 *
 * The day runs from its own midnight to the next day's, so it is 23 or 25 hours long when the clocks change, and every
 * real second is counted once.
 */
export function playSecondsOnDay(sessions: readonly SessionBeats[], day: DateText): number {
  const dayStart = startOfDayMs(day);
  const dayEnd = startOfDayMs(addDays(day, 1));

  const cut = sessions
    .flatMap(countedIntervals)
    .map((part) => ({ fromMs: Math.max(part.fromMs, dayStart), toMs: Math.min(part.toMs, dayEnd) }))
    .filter((part) => part.fromMs < part.toMs)
    .sort((a, b) => a.fromMs - b.fromMs);

  // Walk the stretches in order, counting only the part of each that lies beyond what is already counted.
  let totalMs = 0;
  let countedUpTo = dayStart;
  for (const part of cut) {
    const from = Math.max(part.fromMs, countedUpTo);
    if (part.toMs > from) {
      totalMs += part.toMs - from;
      countedUpTo = part.toMs;
    }
  }
  return Math.min(Math.floor(totalMs / 1000), DAILY_PLAY_CAP_SECONDS);
}
