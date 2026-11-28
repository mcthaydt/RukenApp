import type { Handle } from "@sveltejs/kit/hooks";
import { isThisMachine } from "../../lib/this-machine.ts";

// Making or changing your own page waits for the Pages slice (the owner, 2026-11-28: "Remove all maker pages things
// until we reach the slice", meaning "the create a page that all users have"). Until then the editor is closed on the
// real site: no screen links to it and its addresses are the missing page. Pages that already exist stay up, and
// follows and sends, which find people by their page, keep working.
//
// The editor's code and journeys are kept for the Pages slice. The journeys' site sets PAGES_TEST_SWITCH=on and keeps
// the editor open, so those journeys run as before; one cookie, `rk_test_pages=closed`, makes one browser see the real
// site's closed editor.

/** The cookie a journey sets to see the page editor closed, as the real site has it. */
export const TEST_PAGES_COOKIE = "rk_test_pages";

/**
 * Whether a request may see the page editor, from the cookies it came with.
 *
 * On the real site (no switch) it is always closed, and a cookie is never read. The switch on with any other value, or
 * on a site whose own address is not this machine, throws, so a real site that has it set by mistake fails its pages
 * instead of opening the editor. An empty value counts as not set, as every other setting does.
 */
export function createEditorOpen(settings: {
  PAGES_TEST_SWITCH?: string | undefined;
  BETTER_AUTH_URL?: string | undefined;
}): (cookies: { get(name: string): string | undefined }) => boolean {
  const flag = settings.PAGES_TEST_SWITCH;
  if (flag === undefined || flag === "") return () => false;

  if (flag !== "on" || !isThisMachine(settings.BETTER_AUTH_URL)) {
    throw new Error("PAGES_TEST_SWITCH is for tests on this machine. Remove it from this site's settings.");
  }
  return (cookies) => cookies.get(TEST_PAGES_COOKIE) !== "closed";
}

let shared: ((cookies: { get(name: string): string | undefined }) => boolean) | undefined;

/** The process-wide answer, read from the settings on first use. */
export function pageEditorOpen(cookies: { get(name: string): string | undefined }): boolean {
  shared ??= createEditorOpen(process.env);
  return shared(cookies);
}

/** True for the editor's own addresses: /make/page and everything under it. */
export function isEditorPath(pathname: string): boolean {
  return pathname === "/make/page" || pathname.startsWith("/make/page/");
}

/**
 * Refuses a form sent to the closed editor, before any of its actions can run: a layout's load does not run before
 * an action, so the screens' own missing page (src/routes/make/page/+layout.server.ts) cannot stop one. A look at a
 * screen goes on to that missing page, drawn like every other.
 */
export function pageEditorGate(): Handle {
  return ({ event, resolve }) => {
    const looking = event.request.method === "GET" || event.request.method === "HEAD";
    if (!looking && isEditorPath(event.url.pathname) && !pageEditorOpen(event.cookies)) {
      return new Response("Not found", { status: 404 });
    }
    return resolve(event);
  };
}
