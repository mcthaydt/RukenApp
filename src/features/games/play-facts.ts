// The facts a game's page states from real play (spec 5), worked out by pure functions so the rounding is tested in
// one place. Nobody types a fact: the numbers come from Ruken's own play time.

const MINUTE_MS = 60_000;

/** The middle of a list of times; with two in the middle, the one halfway between them. Zero for an empty list. */
export function medianMs(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const high = sorted[middle] ?? 0;
  if (sorted.length % 2 === 1) return high;
  return Math.round(((sorted[middle - 1] ?? 0) + high) / 2);
}

/**
 * How long a sitting is, as words that finish "Most people play ... at a time." Under two minutes it is "a minute or
 * two"; up to 15 minutes, to the nearest minute; up to an hour, to the nearest five; beyond that, to the nearest half
 * hour. These thresholds are this design's call (spec 5).
 */
export function sittingWords(medianMs: number): string {
  if (medianMs < 2 * MINUTE_MS) return "a minute or two";
  const minutes = medianMs / MINUTE_MS;
  if (minutes <= 15) return `about ${Math.round(minutes).toString()} minutes`;
  if (minutes <= 60) {
    const rounded = Math.round(minutes / 5) * 5;
    return rounded === 60 ? "about an hour" : `about ${rounded.toString()} minutes`;
  }
  const halfHours = Math.round(minutes / 30);
  if (halfHours === 2) return "about an hour";
  const hours = halfHours / 2;
  return Number.isInteger(hours)
    ? `about ${hours.toString()} hours`
    : `about ${Math.floor(hours).toString()}½ hours`;
}

/** "214 people played it this week." and "1 person played it this week." */
export function playersWords(count: number): string {
  return count === 1 ? "1 person played it this week." : `${count.toString()} people played it this week.`;
}
