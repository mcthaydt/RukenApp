// Moving between pages slides sideways, as it does in an app on a phone (the owner, 2026-11-22: "the page should
// transition like a swipe when we go from Feed, Submit Game, You; we should almost never have page reload
// transitions"). This file only decides which way a move goes; the layout starts the slide and look.css draws it.

/**
 * How the new page comes in: "on" from the right, "back" from the left, or "grow": the page fades across while the
 * game's clip moves between the feed and its box on the game's page.
 */
export type Move = "on" | "back" | "grow";

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

// Opening a game from the feed, its clip grows from the feed into its box on the game's page, and going back to the feed
// it shrinks back (the owner, 2026-11-24: "the page transitions to the game page via the video moving into the
// container"). The feed's clip on screen and the game page's box each carry `data-grows` with the game's address name;
// for one move both are given the same view transition name, so the browser moves one into the other.
const GAME_PAGE = /^\/g\/([^/]+)$/;

/** The game whose clip moves on a move between the feed and that game's page, or null for any other move. */
export function grownGame(from: string, to: string): string | null {
  if (from === "/") return GAME_PAGE.exec(to)?.[1] ?? null;
  if (to === "/") return GAME_PAGE.exec(from)?.[1] ?? null;
  return null;
}

/** The view transition name the moving clip takes for its move (look.css draws it). */
const CLIP = "clip";

/** The element on screen now that stands for a game's clip, if the page has one. */
export function clipOf(game: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-grows="${CSS.escape(game)}"]`);
}

/**
 * The game whose clip last grew out of the feed, until the person is on the feed again. Going back to the feed, the clip
 * shrinks into it only for that game and only with the browser's Back, which puts the feed back on the clip that was
 * left (the game page's back arrow is that Back when it can be, see backToFeed); any other way to the feed (Home, a game
 * page opened from a link) opens the feed at its
 * top, where the clip on screen is another game's, so that move slides like any other.
 */
let openedFromFeed: string | null = null;

/** Whether a move between the feed and a game's page moves the clip. */
export function clipMoves(game: string, toFeed: boolean, wentBack: boolean): boolean {
  if (toFeed) return wentBack && openedFromFeed === game;
  return clipOf(game) !== null;
}

/** How many pages deep the person is in this visit's history: each page opened adds one, Back takes one away. */
let depth = 0;

/** The depth of the feed the game in `openedFromFeed` was opened from. */
let feedDepth = 0;

/**
 * Notes where a move went: the game opened from the feed, or none once the person is on the feed again. `steps` is how
 * far the move went in the history: one for a page opened, the browser's own count for Back or Forward.
 */
export function noteMove(game: string | null, to: string, steps = 1): void {
  depth += steps;
  if (game !== null && to !== "/") {
    openedFromFeed = game;
    feedDepth = depth - steps;
  } else if (to === "/") openedFromFeed = null;
}

/**
 * Whether the game's page now on screen was opened straight from the feed's clip, so its back arrow can be the browser's
 * Back: the feed comes back on the clip that was left and the clip shrinks into it (the owner, 2026-11-24: "it also
 * only transitions one way, not from game page back to feed"). A page opened any other way keeps the plain link.
 */
export function backToFeed(game: string): boolean {
  return openedFromFeed === game && depth === feedDepth + 1;
}

/** Each move that names a clip names it as its own, so a move that ends late never takes a later move's name away. */
let lastNaming = 0;

function name(element: HTMLElement, naming: number): void {
  element.style.viewTransitionName = CLIP;
  element.dataset.named = String(naming);
}

function unname(element: HTMLElement | null, naming: number): void {
  if (element === null || element.dataset.named !== String(naming)) return;
  element.style.viewTransitionName = "";
  delete element.dataset.named;
}

/**
 * The new page's clip, once the page has placed it. The feed coming back puts itself back on the clip that was left a
 * moment after it is in (src/features/feed/Feed.svelte, its snapshot), so it is looked for a few times, for at most a
 * fifth of a second, while the browser holds the picture still.
 */
async function arrivedClip(game: string): Promise<HTMLElement | null> {
  for (let tries = 0; tries < 12; tries++) {
    const found = clipOf(game);
    if (found !== null) return found;
    await new Promise((wait) => setTimeout(wait, 16));
  }
  return null;
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
export function slideWhile(arrived: Promise<unknown>, game: string | null = null): Promise<void> {
  // The clip that moves is named in the old page before the browser pictures it, and in the new page once it is in;
  // the old one loses its name first, since two elements with one name would make the browser drop the whole move.
  const naming = ++lastNaming;
  const old = game === null ? null : clipOf(game);
  if (old !== null) name(old, naming);
  const move = new Promise<void>((resolve) => {
    let fresh: HTMLElement | null = null;
    const slide = document.startViewTransition(async () => {
      resolve();
      // A move that a later one overtook never arrives; its slide just ends.
      await arrived.catch(() => undefined);
      unname(old, naming);
      fresh = game === null ? null : await arrivedClip(game);
      if (fresh !== null) name(fresh, naming);
    });
    void slide.finished
      .catch(() => undefined)
      .then(() => {
        unname(old, naming);
        unname(fresh, naming);
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
