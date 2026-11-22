import type { RequestEvent } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";
import type { StaffRole } from "../../lib/server/db.ts";
import type { SessionInfo } from "./auth.ts";
import type { Caller } from "./caller.ts";
import { copyAuthCookies, type CookiePolicy } from "./cookies.ts";

// Decides who sent each request and puts it on `event.locals.caller` before any route runs. Routes
// never read cookies themselves.
//
// A signed-in session whose account is `active` gives a `user` caller with their staff roles. Anyone
// else is `none`: a person who is signed out, whose account is waiting to be deleted, or whose
// account is gone. The session cookie of such an account stops working at once, even though the
// Session row may still exist.

export interface HandleDeps {
  cookies: CookiePolicy;
  getSession(headers: Headers): Promise<SessionInfo | null>;
  staffRolesOf(userId: string): Promise<StaffRole[]>;
  /** Who an `Authorization` header's computer key is, or null (computer-keys.ts `readKey`). */
  computerKey(authorization: string | null): Promise<{ userId: string; keyId: string } | null>;
}

type CallerEvent = Pick<RequestEvent, "request" | "url" | "locals" | "cookies">;

/**
 * The health probe must answer without touching the database, and without needing the sign-in
 * settings, so it can report a broken database even when a setting is missing.
 */
const HEALTH_PATH = "/healthz";
/** better-auth's own routes (routes/api/auth), which answer with their own session cookie. */
const AUTH_ROUTE_PREFIX = "/api/auth/";
/**
 * The maker's API (routes/api/v1). The one place a computer's key is read, and there it is the only thing read: the
 * session cookie is ignored, so a browser tab can never act through it, and everywhere else the header is ignored.
 */
export const API_PREFIX = "/api/v1/";

/**
 * The SvelteKit `handle` hook. `getDeps` is called on the first request that needs it, so a
 * process with missing sign-in settings still answers the health probe.
 */
export function createHandle(getDeps: () => HandleDeps): Handle {
  return async ({ event, resolve }) => {
    if (event.url.pathname === HEALTH_PATH) event.locals.caller = { kind: "none" };
    else if (event.url.pathname.startsWith(API_PREFIX))
      event.locals.caller = await resolveKey(event, getDeps());
    else event.locals.caller = await resolveCaller(event, getDeps());
    return resolve(event);
  };
}

async function resolveKey(event: CallerEvent, deps: HandleDeps): Promise<Caller> {
  const key = await deps.computerKey(event.request.headers.get("authorization"));
  return key === null ? { kind: "none" } : { kind: "computer", ...key };
}

async function resolveCaller(event: CallerEvent, deps: HandleDeps): Promise<Caller> {
  const session = await deps.getSession(event.request.headers);
  if (session === null || session.userStatus !== "active") return { kind: "none" };

  // A session a day old comes back with a new cookie; sending it on keeps the 30 days rolling.
  // Not on better-auth's own routes: SvelteKit adds the hook's cookies after the route's own
  // Set-Cookie lines, so the browser would keep this one over the cookie a sign-out or sign-in just
  // sent. The row is still extended; the next page sends the longer cookie.
  if (!event.url.pathname.startsWith(AUTH_ROUTE_PREFIX))
    copyAuthCookies(event.cookies, session.setCookies ?? []);
  return {
    kind: "user",
    userId: session.userId,
    sessionId: session.sessionId,
    staffRoles: await deps.staffRolesOf(session.userId),
  };
}
