// What counts as time played. The server's own clock decides, never the page's: a page says only "still here", and
// the server adds up the time between those messages. Nobody types a time.

/** A page tells the server it is still being played this often. */
export const BEAT_EVERY_MS = 15_000;
/** A beat closer than this to the one before is dropped. */
export const BEAT_TOO_SOON_MS = 5_000;
/** The most one beat may add: three beats' worth, so two lost beats are forgiven and no more. */
export const LONGEST_COUNTED_GAP_MS = 45_000;
/** A session takes beats for a day. */
export const PLAY_SESSION_LIFE_MS = 24 * 60 * 60 * 1000;

/**
 * The time a session counts: each attentive beat adds the time since the beat before it (or since the start), at
 * most `LONGEST_COUNTED_GAP_MS`. A beat that says the person looked away adds nothing, and every beat becomes the
 * "before" of the next, so time starts being counted again from it. A flood of beats can never count more than the
 * clock saw, because each adds only the gap to the one before.
 */
export function countedMs(
  startedAtMs: number,
  beats: readonly { atMs: number; attentive: boolean }[],
): number {
  let before = startedAtMs;
  let counted = 0;
  for (const beat of [...beats].sort((a, b) => a.atMs - b.atMs)) {
    if (beat.attentive) counted += Math.min(Math.max(beat.atMs - before, 0), LONGEST_COUNTED_GAP_MS);
    before = beat.atMs;
  }
  return counted;
}
