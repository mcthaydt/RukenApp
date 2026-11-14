import type { Cookies } from "@sveltejs/kit";

// The name and options of the sign-in session cookie.
//
// Why these settings:
// - HttpOnly: page scripts cannot read it, so a script injected into a page cannot steal a session.
//   Games run on separate origins and can never read it either.
// - SameSite=Lax: the browser does not send it on cross-site POSTs (a basic CSRF guard), but does on
//   top-level navigation, so following a link to Ruken keeps you signed in.
// - `__Host-` prefix + Secure on https: the browser accepts a `__Host-` cookie only when it is
//   Secure, has Path=/ and has no Domain. That means a page on another subdomain (games run on
//   their own origins) cannot set or overwrite it, which blocks session fixation.
// - A plain name on http://localhost, because browsers refuse `__Host-` cookies without https.
//   Secure follows the origin: https in every deployed environment.
// better-auth sets the cookie itself (auth.ts, `advanced`); this file only says what to call it.

export interface CookiePolicy {
  secure: boolean;
  sessionCookieName: string;
}

/** The cookie policy for the site's own origin (BETTER_AUTH_URL). */
export function cookiePolicy(webOrigin: string): CookiePolicy {
  const secure = new URL(webOrigin).protocol === "https:";
  return { secure, sessionCookieName: `${secure ? "__Host-" : ""}rk_session` };
}

/**
 * Copies the Set-Cookie lines better-auth answered with onto SvelteKit's response, as they were sent.
 * SvelteKit would otherwise add `Secure` to a cookie that better-auth sent without it (plain-http
 * localhost; better-auth already adds it on https), and would make every cookie HttpOnly.
 */
export function copyAuthCookies(
  cookies: Pick<Cookies, "set" | "parse">,
  setCookieLines: readonly string[],
): void {
  for (const line of setCookieLines) {
    const { name, value, ...options } = cookies.parse(line);
    cookies.set(name, value ?? "", {
      path: "/",
      ...options,
      secure: options.secure ?? false,
      httpOnly: options.httpOnly ?? false,
    });
  }
}

/** Set when signing in undid a waiting deletion, so the next page can say so once (the root layout reads and clears it). */
export const WELCOME_BACK_COOKIE = "rk_welcome_back";

/** Five minutes: long enough to survive the redirect after sign-in, short enough that it cannot show up days later. */
export const WELCOME_BACK_MAX_AGE_SECONDS = 5 * 60;
