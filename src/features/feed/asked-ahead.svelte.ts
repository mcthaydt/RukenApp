import { invalidate } from "$app/navigation";

/**
 * The feed asks for the tab beside it ahead of a swipe (FeedTop), and the router keeps that page until the next move.
 * A follow made in place on a clip changes what Followed shows, so the page asked for ahead would show the follows from
 * before (the #447 review). `stale` counts each such change, so FeedTop asks again.
 */
export const askedAhead = $state({ stale: 0 });

/** Throws away the page asked for ahead (any invalidation does), then has FeedTop ask for it again. */
export async function followsChanged(): Promise<void> {
  // Nothing loads with this name, so no page on screen loads again: only the page asked for ahead goes.
  await invalidate("ruken:asked-ahead");
  askedAhead.stale += 1;
}
