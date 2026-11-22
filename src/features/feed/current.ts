// Which clip is on screen, and where a key takes a person. Pure, so the screen's script stays a thin layer over them.

/** The share of a clip that must be in the window for it to be the one a person is watching. */
export const CURRENT_AT = 0.6;

/**
 * The clip a person is on: the one that fills 60% or more of the window. Two clips cannot both do that, so there is
 * at most one. Between two clips (mid-swipe) nobody is on either, and the answer is null.
 */
export function currentOf(ratios: readonly (number | undefined)[]): number | null {
  const index = ratios.findIndex((ratio) => ratio !== undefined && ratio >= CURRENT_AT);
  return index === -1 ? null : index;
}

/**
 * How many clips a key moves: one down for the arrow, Page Down and Space, one up for the other arrow, Page Up and
 * Shift with Space (the browser's own way back), and none for any other key.
 */
export function stepFor(key: string, shift: boolean): -1 | 0 | 1 {
  if (key === " ") return shift ? -1 : 1;
  if (key === "ArrowDown" || key === "PageDown") return 1;
  if (key === "ArrowUp" || key === "PageUp") return -1;
  return 0;
}

/** The clip a step lands on: never before the first, never after the last. */
export function clampClip(index: number, count: number): number {
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}
