import { redirect } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";

// Every account is asked once for the name friends see (/me/name), and it makes the account's page. A signed-in account
// with no page yet (one made before the question existed) is sent to the question before any screen where people meet
// it: the feed, search, games, the account's own lists and the maker's area. The screens that must work without a name
// stay open: the question itself, signing in and out, the account's safety screens, the legal and help pages, a game's
// play screen, and every endpoint. A test (tests/hooks/people-screens.test.ts) reads every route folder and fails on a
// screen in neither list, so a new screen is placed here before CI passes. Names are SvelteKit route ids.

/** The screens a signed-in account with no page is sent away from, to the question first. */
export const PEOPLE_SCREENS: ReadonlySet<string> = new Set([
  "/",
  "/followed",
  "/your-turn",
  "/search",
  "/g/[game]",
  "/[handle=handle]",
  "/me",
  "/me/saved",
  "/me/reposts",
  "/me/link",
  "/settings/feed",
  "/settings/feed/parent",
  "/make",
  "/make/new",
  "/make/[game]",
  "/make/[game]/[question=question]",
  "/make/[game]/agreement",
  "/make/[game]/check",
  "/make/[game]/play",
  "/make/[game]/take-off",
  "/make/[game]/throw-away",
  "/make/page",
  "/make/page/[room]",
  "/make/page/links",
  "/make/page/links/[link]",
  "/make/page/links/[link]/where",
  "/make/page/links/add",
  "/make/page/links/add/where",
  "/make/page/take-down",
]);

/** The screens that answer whether or not the account has a page. Endpoints (a folder with only `+server.ts`) are open too. */
export const OPEN_SCREENS: ReadonlySet<string> = new Set([
  "/me/name",
  // A parent answering a teen's ask: the parent may hold any account, or none.
  "/parent/[token]",
  "/sign-in",
  "/sign-up",
  "/sign-out",
  "/forgot-password",
  "/me/delete",
  "/me/password",
  "/me/computers",
  "/join",
  "/join/done",
  "/legal/maker-agreement",
  "/terms",
  "/privacy",
  "/cookies",
  "/about",
  "/help",
  "/help/get-your-game-on-ruken",
  "/help/github",
  "/help/how-the-feed-works",
  "/help/record-screen",
  "/goodbye",
  "/g/[game]/play",
]);

/** The question's own address, carrying where the person was going so Save lands there. */
export function nameQuestionFor(next: string): string {
  return `/me/name?next=${encodeURIComponent(next)}`;
}

/**
 * The `handle` that sends a signed-in account with no page to the question. It runs after the caller is known, and
 * before any page loads, so a redirected request never counts a view or remembers an arrival. One indexed lookup, for
 * signed-in people on a people screen only. A thrown redirect, so SvelteKit answers a tap between screens (the data a
 * client-side move asks for) the same way as a full load.
 */
export function nameGate(hasPage: (userId: string) => Promise<boolean>): Handle {
  return async ({ event, resolve }) => {
    const caller = event.locals.caller;
    if (
      caller.kind === "user" &&
      PEOPLE_SCREENS.has(event.route.id ?? "") &&
      !(await hasPage(caller.userId))
    ) {
      redirect(303, nameQuestionFor(event.url.pathname + event.url.search));
    }
    return resolve(event);
  };
}
