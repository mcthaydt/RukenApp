// The Menu tab on the play screen (spec 4.1): where a tab let go comes to rest, how the arrow keys move it, and what
// is kept of where it was left. Pure, so none of it needs a browser; the page's script only measures and calls these.

/** The tab's size in CSS pixels, as the stylesheet draws it. */
export const TAB_WIDTH = 48;
export const TAB_HEIGHT = 56;

/** A press that moves more than this is a drag; one that moves less is a press, and opens the menu. */
export const PRESS_MOVE_PX = 8;

/** One arrow key moves the tab a tenth of the window. */
export const KEY_STEP = 0.1;

/** Where a tab rests: against the left or the right edge, with its top at `height` of the window's height. */
export interface TabPlace {
  side: "left" | "right";
  height: number;
}

/** The first time on a device: at the left edge, a quarter of the way down. */
export const FIRST_PLACE: TabPlace = { side: "left", height: 0.25 };

/** Whether a press that went from one point to another was a drag. */
export function isDrag(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > PRESS_MOVE_PX;
}

/** The highest and lowest the tab's top may rest, as shares of the window, kept clear of the top and bottom insets. */
export function heightRange(
  windowHeight: number,
  insets: { top: number; bottom: number },
): { least: number; most: number } {
  const least = insets.top / windowHeight;
  const most = Math.max(least, (windowHeight - insets.bottom - TAB_HEIGHT) / windowHeight);
  return { least, most };
}

function clamp(value: number, least: number, most: number): number {
  return Math.min(Math.max(value, least), most);
}

/**
 * Where a tab let go with its centre at `centreX` and its top at `top` comes to rest: against the nearer side, at the
 * height it was let go, kept clear of the insets.
 */
export function tabRest(input: {
  centreX: number;
  top: number;
  windowWidth: number;
  windowHeight: number;
  insets: { top: number; bottom: number };
}): TabPlace {
  const { least, most } = heightRange(input.windowHeight, input.insets);
  return {
    side: input.centreX < input.windowWidth / 2 ? "left" : "right",
    height: clamp(input.top / input.windowHeight, least, most),
  };
}

/** What an arrow key does to a tab at rest: left and right go to that side, up and down a tenth of the window. */
export function tabByKey(
  place: TabPlace,
  key: string,
  range: { least: number; most: number },
): TabPlace | null {
  if (key === "ArrowLeft") return { ...place, side: "left" };
  if (key === "ArrowRight") return { ...place, side: "right" };
  if (key === "ArrowUp") return { ...place, height: clamp(place.height - KEY_STEP, range.least, range.most) };
  if (key === "ArrowDown")
    return { ...place, height: clamp(place.height + KEY_STEP, range.least, range.most) };
  return null;
}

/** The place kept on the device (`rk_menu_tab`), or null for anything that is not exactly a side and a share. */
export function readPlace(stored: string | null): TabPlace | null {
  if (stored === null) return null;
  try {
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null) return null;
    const { side, height } = value as { side?: unknown; height?: unknown };
    if (side !== "left" && side !== "right") return null;
    if (typeof height !== "number" || !Number.isFinite(height) || height < 0 || height > 1) return null;
    return { side, height };
  } catch {
    return null;
  }
}
