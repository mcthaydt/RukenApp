import { invalidate } from "$app/navigation";
import { TAB_DATA } from "./tab-data.ts";

/*
 * The feed's tabs slide in at once (the owner, 2026-11-28 06:33 UTC, choosing "Instant slide done carefully"): each tab
 * asks for the page of the tab beside it ahead (FeedTop.svelte), and a move to that tab, by a swipe, a press or a key,
 * shows that page straight away. A page asked for ahead says how things were when it was asked for, so:
 *
 * - the person's own likes, saves, reposts and follows made since show over it at once (`kept.marks`, `kept.follows`,
 *   each with the time it was made, against `arrival().since`, the time the page on screen was asked for);
 * - a follow made since throws the page away and asks again, since it changes which games Followed has
 *   (`followsChanged`);
 * - a tab shown from a page asked for more than FRESH_MS before asks the site again once it is in, quietly
 *   (`quietRefresh`): the clip on screen stays where it is, and what is new comes in after it (Feed.svelte).
 */

/** How old a page asked for ahead can be when it is shown and not be asked for again once the tab is in. */
export const FRESH_MS = 1000;

/** Any invalidation throws away the router's page asked for ahead; nothing loads with this name. */
const NOTHING = "ruken:asked-ahead";

/** A clip's marks, as `ClipMarks` in marks.ts (not imported: that file reaches server code, and this one is the browser's). */
interface ClipMarks {
  likes: number;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
}
type Mark = { marks: ClipMarks; at: number };
type Follow = { on: boolean; at: number };

export const kept: {
  quiet: boolean;
  stale: number;
  marks: Record<string, Mark | undefined>;
  follows: Record<string, Follow | undefined>;
  seenAt: number;
} = $state({
  /** While a quiet refresh is loading: the tab's new page is merged into the one on screen, not started again. */
  quiet: false,
  /** Counts each follow that threw away the page asked for ahead, so FeedTop asks again. */
  stale: 0,
  /** The person's own presses on a game's buttons, by game, with when each was made. */
  marks: {},
  /** The person's own presses on a maker's plus, by maker's address, with when each was made. */
  follows: {},
  /** When the person last saw the Your turn list (it marks it seen), so no tab's page from before shows its dot. */
  seenAt: 0,
});

/** When each tab's page was last asked for ahead, by its address. Not shown on any screen, so a plain map. */
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const askedAt = new Map<string, number>();
/** When the move under way set off: the page it comes with is at least as new as that. */
let setOff = 0;
/** When the last quiet refresh asked for its page. */
let refreshAsked = 0;
/** The tab the person last came to, and what Feed and FeedTop learn of it. */
let landed: { href: string; since: number; refresh: boolean } | null = null;

/** FeedTop asks for `href`'s page ahead. */
export function askedAhead(href: string): void {
  askedAt.set(href, performance.now());
}

/** A move sets off (FeedTop's beforeNavigate): whatever the router kept ahead is used by it or thrown away. */
export function settingOff(): void {
  setOff = performance.now();
  landed = null;
}

/**
 * The tab at `href` has come in: since when its page says how things are, and whether it must ask the site again. The
 * same answer for every caller until the next move, so Feed (which starts first) and its FeedTop agree.
 */
export function arrival(href: string): { since: number; refresh: boolean } {
  if (landed?.href !== href) {
    const at = askedAt.get(href);
    askedAt.clear();
    landed =
      at === undefined || at > setOff
        ? { href, since: setOff, refresh: false }
        : { href, since: at, refresh: performance.now() - at > FRESH_MS };
  }
  return landed;
}

/** The time the page from the last quiet refresh was asked for: Feed's `since` once it has merged it. */
export const refreshedSince = (): number => refreshAsked;

/** Asks the site again for the tab on screen, and lets the tab merge what comes into what it shows. */
export async function quietRefresh(): Promise<void> {
  if (landed !== null) landed.refresh = false;
  refreshAsked = performance.now();
  // The invalidation throws away any page asked for ahead too.
  askedAt.clear();
  kept.quiet = true;
  try {
    await invalidate(TAB_DATA);
    // What is on screen now says how things were when the refresh asked.
    if (landed !== null) landed.since = refreshAsked;
  } finally {
    kept.quiet = false;
  }
}

/** The person pressed a game's button: what it shows now. */
export function keepMark(slug: string, marks: ClipMarks): void {
  kept.marks[slug] = { marks, at: performance.now() };
}

/** What a game's buttons show on a page asked for at `since`: the person's own later press, or the page's own. */
export function marksSince(slug: string, own: ClipMarks, since: number): ClipMarks {
  const mark = kept.marks[slug];
  return mark !== undefined && mark.at > since ? mark.marks : own;
}

/** Whether the person follows a maker, on a page asked for at `since`. */
export function followingSince(handle: string, own: boolean, since: number): boolean {
  const follow = kept.follows[handle];
  return follow !== undefined && follow.at > since ? follow.on : own;
}

/** The person followed or unfollowed a maker in place: Followed's page asked for ahead is thrown away and asked again. */
export async function followsChanged(handle: string, on: boolean): Promise<void> {
  kept.follows[handle] = { on, at: performance.now() };
  await invalidate(NOTHING);
  askedAt.clear();
  kept.stale += 1;
}

/** The Your turn list was marked seen. */
export function sawYourTurn(): void {
  kept.seenAt = performance.now();
}

/** Whether the tab at `href` shows the Your turn dot: the page says friends sent new games, and none were seen since. */
export function newsShown(news: boolean, href: string): boolean {
  // While a quiet refresh is loading, any sight of the list hides the dot; once it is in, this is worked out again.
  if (kept.quiet) return news && kept.seenAt === 0;
  return news && !(kept.seenAt > arrival(href).since);
}
