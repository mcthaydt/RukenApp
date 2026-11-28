// Where a gamepad's direction takes the focus: to the control that lies that way on the screen and is nearest,
// the way a console's menus move. Pure (boxes in, an index out), so it is tested without a browser.

/** A control's place on the screen, as `getBoundingClientRect` gives it. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export type Way = "up" | "down" | "left" | "right";

/** Two boxes this close are touching, not one past the other: borders and rounding leave a pixel or two. */
const TOUCHING = 2;
/** Being off to the side counts this many times more than being further on. */
const SIDEWAYS_COST = 2;

/** How far `to` lies past `from` going `way` (from edge to edge), or null when it does not lie that way at all. */
function ahead(from: Box, to: Box, way: Way): number | null {
  const gap =
    way === "down"
      ? to.top - from.bottom
      : way === "up"
        ? from.top - to.bottom
        : way === "right"
          ? to.left - from.right
          : from.left - to.right;
  if (gap >= -TOUCHING) return Math.max(gap, 0);
  // Overlapping boxes still count when the other one's middle is clearly that way: by more than half the smaller one's
  // size (a small button inside a big link's row). A button only a few pixels further on, in the next row, is not.
  const along = way === "up" || way === "down";
  const middleFrom = along ? (from.top + from.bottom) / 2 : (from.left + from.right) / 2;
  const middleTo = along ? (to.top + to.bottom) / 2 : (to.left + to.right) / 2;
  const further = way === "down" || way === "right" ? middleTo - middleFrom : middleFrom - middleTo;
  const size = along
    ? Math.min(from.bottom - from.top, to.bottom - to.top)
    : Math.min(from.right - from.left, to.right - to.left);
  return further > size / 2 ? 0 : null;
}

/** How far off to the side `to` is from `from`'s row (left and right) or column (up and down): 0 when they share it. */
function sideways(from: Box, to: Box, way: Way): number {
  const [a1, a2, b1, b2] =
    way === "up" || way === "down"
      ? [from.left, from.right, to.left, to.right]
      : [from.top, from.bottom, to.top, to.bottom];
  if (b2 < a1) return a1 - b2;
  if (b1 > a2) return b1 - a2;
  return 0;
}

/** How much of their height two boxes share. */
function shared(from: Box, to: Box): number {
  return Math.min(from.bottom, to.bottom) - Math.max(from.top, to.top);
}

/**
 * The index of the box the focus goes to from `from` going `way`, of those that lie that way. Left and right keep to
 * the row: a box in the same row comes first, the nearest of them, and only when none lies that way does the move go
 * aslant. Up and down take the box with the least distance on plus twice the distance off to the side, so a near
 * button a few pixels off the column comes before a far one straight below (the Change buttons on Check and send).
 * Between equals, the first in the list (reading order). -1 when nothing lies that way.
 */
export function nextBox(from: Box, boxes: readonly Box[], way: Way): number {
  const keepToRow = way === "left" || way === "right";
  let best = -1;
  let bestRank: [number, number] = [Infinity, Infinity];
  boxes.forEach((box, index) => {
    const on = ahead(from, box, way);
    if (on === null) return;
    const off = sideways(from, box, way);
    // Lines that only touch (one ends where the next starts) are not one row.
    const rank: [number, number] = [
      keepToRow && (off > 0 || shared(from, box) <= TOUCHING) ? 1 : 0,
      on + SIDEWAYS_COST * off,
    ];
    if (rank[0] < bestRank[0] || (rank[0] === bestRank[0] && rank[1] < bestRank[1])) {
      best = index;
      bestRank = rank;
    }
  });
  return best;
}
