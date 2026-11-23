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

/** The move whose slide has not yet let its new page in, if there is one. */
let held: Promise<void> | null = null;

/**
 * The move still waiting on its slide, for a move that starts meanwhile (Back pressed mid-slide). The router puts a
 * page in when its move is let go, even after a later move has put its own page in, so the later move must wait for
 * it and come in last; it comes without a slide of its own.
 */
export function heldMove(): Promise<void> | null {
  return held;
}

/**
 * Plays one slide while the new page comes in, and answers once the new page may be put in. The new page must come
 * whatever the browser does with the slide: a slide it skips (Safari skipped one leaving the play screen in CI) lets
 * the move go on, and so does a slide that never starts, after a second at most.
 */
export function slideWhile(arrived: Promise<unknown>): Promise<void> {
  const move = new Promise<void>((resolve) => {
    const slide = document.startViewTransition(async () => {
      resolve();
      // A move that a later one overtook never arrives; its slide just ends.
      await arrived.catch(() => undefined);
    });
    slide.ready.catch(() => {
      resolve();
    });
    setTimeout(() => {
      resolve();
    }, 1000);
  });
  held = move;
  void move.then(() => {
    if (held === move) held = null;
  });
  return move;
}
