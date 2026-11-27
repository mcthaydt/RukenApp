// The feed's tabs, in the order the top bar shows them. Swiping sideways and a gamepad's shoulder buttons step through
// this list (the owner, 2026-11-27: "Swiping left and right should go between fresh, followed, and your turn"), so a new
// tab is one more line here.

export const TABS = [
  { key: "fresh", name: "Fresh", href: "/" },
  { key: "followed", name: "Followed", href: "/followed" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

/** How far a finger goes sideways, in CSS pixels, before it counts as a swipe to the next tab. */
export const SWIPE_DISTANCE = 60;

/** The tab `step` places from `on` (+1 the next, to the right; -1 the one before), or null past either end. */
export function tabFrom(on: TabKey, step: 1 | -1): (typeof TABS)[number] | null {
  const here = TABS.findIndex((tab) => tab.key === on);
  return TABS[here + step] ?? null;
}

/**
 * The step a finger's move asks for: a move to the left brings in the tab on the right, as turning a page does. Only a
 * move that is clearly sideways counts, so a swipe up to the next clip that drifts a little is never a tab change.
 */
export function stepOfSwipe(dx: number, dy: number): 1 | -1 | null {
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < 2 * Math.abs(dy)) return null;
  return dx < 0 ? 1 : -1;
}

/**
 * How near the screen's left or right edge, in CSS pixels, a finger starts the browser's own Back or Forward swipe
 * (Safari on a phone, and Android's back gesture). A swipe that starts there is the browser's: it slides the page
 * itself, so the feed taking it as a tab step too would move twice for one swipe (the owner, 2026-11-27: "The feed like
 * does a double swipe on page transition out", "When I leave it and swipe").
 */
export const BROWSER_EDGE = 40;

/** Whether a finger that started `x` pixels from the left of a window `width` wide started on the browser's edge. */
export function onBrowserEdge(x: number, width: number): boolean {
  return x < BROWSER_EDGE || x > width - BROWSER_EDGE;
}

/** The standard gamepad's shoulder buttons: LB (4) steps left, RB (5) steps right. */
export const LB = 4;
export const RB = 5;
