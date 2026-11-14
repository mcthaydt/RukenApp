// A member's play on a game on a day (stub: red step).
import type { DateText } from "./calendar.ts";

export interface SessionBeats {
  readonly startedAtMs: number;
  readonly beats: readonly { atMs: number; attentive: boolean }[];
}

export interface CountedInterval {
  readonly fromMs: number;
  readonly toMs: number;
}

export function countedIntervals(session: SessionBeats): CountedInterval[] {
  throw new Error(`not built yet: countedIntervals ${String(session.beats.length)}`);
}

export function playSecondsOnDay(sessions: readonly SessionBeats[], day: DateText): number {
  throw new Error(`not built yet: playSecondsOnDay ${String(sessions.length)} ${day}`);
}
