// Moving between pages slides sideways, as it does in an app on a phone (the owner, 2026-11-22: "the page should
// transition like a swipe when we go from Feed, Submit Game, You; we should almost never have page reload
// transitions"). This file only decides which way a move goes; the layout starts the slide and look.css draws it.

/** Which way the new page comes in: "on" from the right, "back" from the left. */
export type Move = "on" | "back";

/** The bar's places, left to right: Home (the feed), Your games, You. */
const PLACES = ["/", "/make", "/me"] as const;

/** The place a path is in, as its position in the bar, or -1 for a page in none of them (a game's page, sign in). */
function placeOf(path: string): number {
  if (path === "/") return 0;
  return PLACES.findIndex((top) => top !== "/" && (path === top || path.startsWith(`${top}/`)));
}

/**
 * The way a move from one path to another goes, or null for no slide: the same page again (a form answered in
 * place), or a move inside the maker's area, which has its own step (src/routes/make/+layout.svelte).
 * `wentBack` is the browser's Back.
 */
export function moveBetween(from: string, to: string, wentBack: boolean): Move | null {
  if (from === to) return null;
  const was = placeOf(from);
  const goes = placeOf(to);
  const maker = PLACES.indexOf("/make");
  if (was === maker && goes === maker) return null;
  if (wentBack) return "back";
  // Between two of the bar's places the new page comes from the side its place is on, as a swipe would bring it.
  if (was !== -1 && goes !== -1 && was !== goes) return goes > was ? "on" : "back";
  // Home is always back, and so is up to the top of the place the person is in.
  if (to === "/") return "back";
  if (was === goes && to === PLACES[goes]) return "back";
  return "on";
}
