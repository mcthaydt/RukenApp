const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "1 minute", "2 minutes": a count and its word, the word singular only for one. */
function counted(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * How long a game has waited for staff, as the list says it: "Waiting 3 hours". It starts with a capital because it ends a
 * line of dots on a card and has to read as a short sentence. Whole numbers, rounded down; under an hour it counts minutes
 * (never less than one), under 48 hours it counts hours, after that days.
 */
export function waitedWords(sentAt: Date, nowMs: number): string {
  const waitedMs = Math.max(0, nowMs - sentAt.getTime());
  if (waitedMs < HOUR_MS)
    return `Waiting ${counted(Math.max(1, Math.floor(waitedMs / MINUTE_MS)), "minute")}`;
  if (waitedMs < 48 * HOUR_MS) return `Waiting ${counted(Math.floor(waitedMs / HOUR_MS), "hour")}`;
  return `Waiting ${counted(Math.floor(waitedMs / DAY_MS), "day")}`;
}
