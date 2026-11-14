// What counts as time played (stub: the rule comes after its tests have been seen failing).

/** A page tells the server it is still being played this often. */
export const BEAT_EVERY_MS = 15_000;
/** A beat closer than this to the one before is dropped. */
export const BEAT_TOO_SOON_MS = 5_000;
/** The most one beat may add: three beats' worth, so two lost beats are forgiven and no more. */
export const LONGEST_COUNTED_GAP_MS = 45_000;
/** A session takes beats for a day. */
export const PLAY_SESSION_LIFE_MS = 24 * 60 * 60 * 1000;

export function countedMs(
  startedAtMs: number,
  beats: readonly { atMs: number; attentive: boolean }[],
): number {
  throw new Error(`not built yet: countedMs ${String(startedAtMs)} ${String(beats.length)}`);
}
