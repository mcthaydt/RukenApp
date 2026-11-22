import { redirect } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";
import { CONSENT_COOKIE, CONSENT_VERSION, hasConsent } from "./cookies.ts";
import { routeKind, type RouteKind } from "./routes.ts";

// The consent gate, one `handle` that runs after the database is reachable and before anything reads who sent the
// request. It does five things, so a route that forgot the rule fails loudly instead of collecting quietly:
// 1. tells the database whether this request may write (guard 2, in db.ts);
// 2. sends a browser with no yes away from a gated page to the notice, and refuses a gated post or fetch;
// 3. tells the page, through the page's own HTML, whether this browser agreed (the cookie is HttpOnly), which is what
//    switches framework storage on (guard 4, in app.html);
// 4. strips any cookie an answer to a browser with no yes tries to set (guard 1).

/** What a gated screen says it needs the yes for, by route: the notice's first line. */
export type GatedAction = "sign-in" | "sign-up" | "join" | "play" | "save" | "account";

/** The notice's reason for a gated route, or "account" for the rest of them. */
export function actionOfRoute(routeId: string | null): GatedAction {
  const id = routeId ?? "";
  if (id.startsWith("/sign-in") || id.startsWith("/forgot-password")) return "sign-in";
  if (id.startsWith("/sign-up")) return "sign-up";
  if (id.startsWith("/join")) return "join";
  if (id.startsWith("/g/")) return id.endsWith("wishlist") ? "save" : "play";
  return "account";
}

/** The marker in app.html that the gate flips from "no" to "yes" for a browser that agreed. */
export const CONSENT_MARKER = 'data-rk-consent="no"';

/** The cookie names set by a `Set-Cookie` line, and whether it is a deletion. */
function nameOf(line: string): string {
  return line.slice(0, line.indexOf("=")).trim();
}

/**
 * Removes every Set-Cookie line from an answer except `rk_consent` itself and deletions. Used only when the browser has no yes, so
 * a cookie a route set by mistake never leaves; one log line names it (never its value).
 */
export function stripCookies(response: Response, log: (line: string) => void): Response {
  const lines = response.headers.getSetCookie();
  // A deletion (Max-Age=0) leaves nothing behind, so it stays.
  const stray = lines.filter((line) => nameOf(line) !== CONSENT_COOKIE && !/;\s*max-age=0/i.test(line));
  if (stray.length === 0) return response;
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const line of lines.filter((one) => !stray.includes(one))) headers.append("set-cookie", line);
  for (const line of stray) log(`consent: dropped a cookie set before a yes: ${nameOf(line)}`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** True when the answer itself gives the yes (the agree action), so its other cookies, `rk_arrival`, are kept. */
function givesConsent(response: Response): boolean {
  return response.headers
    .getSetCookie()
    .some((line) => line.startsWith(`${CONSENT_COOKIE}=${CONSENT_VERSION}`) && !/max-age=0/i.test(line));
}

/**
 * `allowWrites` tells the database client of this request whether it may write. `log` takes the one line the cookie
 * guard writes; it never carries a cookie's value.
 */
export function consentGate(
  allowWrites: (allowed: boolean) => void,
  log: (line: string) => void = (line) => {
    console.error(line);
  },
): Handle {
  return async ({ event, resolve }) => {
    const agreed = hasConsent(event.cookies);
    const kind: RouteKind = routeKind(event.route.id);
    allowWrites(agreed || kind === "machine");

    if (kind === "gated" && !agreed) {
      const next = event.url.pathname + event.url.search;
      // A script's call (better-auth, the play beat) has no screen to show the notice on: it is refused.
      const id = event.route.id ?? "";
      if (id.startsWith("/api/") || id.endsWith("/beat")) {
        return new Response("Say yes to cookies first.", { status: 403 });
      }
      // A thrown redirect, so SvelteKit answers it in the form the caller expects: a page load, a form's post or the
      // data a client-side move asks for (which then lands on the notice without reloading the app).
      redirect(303, `/cookies?for=${actionOfRoute(event.route.id)}&next=${encodeURIComponent(next)}`);
    }

    const response = await resolve(event, {
      transformPageChunk: ({ html }) =>
        agreed ? html.replace(CONSENT_MARKER, 'data-rk-consent="yes"') : html,
    });
    return agreed || givesConsent(response) ? response : stripCookies(response, log);
  };
}
