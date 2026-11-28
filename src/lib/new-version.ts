// A tab left open keeps running the version of Ruken it first loaded, so a change that has gone live never reaches it
// until the page is loaded again (the owner, 2026-11-28: "It's not live", about Reposted, on a phone tab still running
// a version from before it). SvelteKit notices a newer version when the tab comes back into view, on its regular check
// and on each page's answer (`updated` in `$app/state`); these say what the layout does then.

/** The feed's tabs: nothing is typed or under way on them, so loading one again costs the person nothing. */
const FEED_TABS: readonly string[] = ["/", "/followed", "/your-turn"];

/**
 * Whether a tab that comes back into view on this screen, with a newer version out, loads the screen again at once.
 * Only the feed's tabs do: on any other screen (a game being played, a form half filled) the newer version waits for
 * the person's next move instead.
 */
export function loadsAgainOnReturn(routeId: string | null): boolean {
  return routeId !== null && FEED_TABS.includes(routeId);
}

/**
 * Whether a move inside the app is made as a whole page load instead, so it arrives in the newer version. A move the
 * browser already makes as a page load, a move to another site, and Back or Forward (a page load there would add a
 * step to the tab's history) go as they are; the next move after Back loads the newer version. A move to the screen the
 * person is on (Search as they type, an answer that comes back to the same screen) goes as it is too: a page load there
 * would lose the keys typed meanwhile and add a step to the history.
 */
export function movesAsPageLoad(
  newerVersionOut: boolean,
  move: { willUnload: boolean; type: string; to: URL | null; here: URL },
): boolean {
  return (
    newerVersionOut &&
    !move.willUnload &&
    move.type !== "popstate" &&
    move.to !== null &&
    move.to.origin === move.here.origin &&
    move.to.pathname !== move.here.pathname
  );
}
