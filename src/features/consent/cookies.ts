import type { Cookies } from "@sveltejs/kit";

// The one cookie that says this browser agreed to what Ruken keeps. Until it is here Ruken sets no other cookie,
// writes nothing to the browser and nothing about the visitor to its database (design: cookie consent).

export const CONSENT_COOKIE = "rk_consent";
/** Names the notice's wording. A change to what Ruken keeps bumps it, and everyone is asked again. */
export const CONSENT_VERSION = "v1";
/** The consent lasts 180 days, then the notice asks again. */
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

/** The cookie's value: the wording agreed to, then the day, so /cookies can say when ("v1.2026-11-22"). */
const valueOn = (day: string): string => `${CONSENT_VERSION}.${day}`;

/** True when this browser's request carries a yes to the current wording (or the answer being made just gave it). */
export function hasConsent(cookies: Pick<Cookies, "get">): boolean {
  const value = cookies.get(CONSENT_COOKIE);
  return value === CONSENT_VERSION || value?.startsWith(`${CONSENT_VERSION}.`) === true;
}

/** The day this browser said yes (`YYYY-MM-DD`), or null when it has not or the cookie names no day. */
export function consentDay(cookies: Pick<Cookies, "get">): string | null {
  const day = hasConsent(cookies)
    ? cookies.get(CONSENT_COOKIE)?.slice(CONSENT_VERSION.length + 1)
    : undefined;
  return day !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** Remembers the yes, on `day`. HttpOnly: only the server reads it, and the layout tells the page. */
export function agree(cookies: Pick<Cookies, "set">, secure: boolean, day: string): void {
  cookies.set(CONSENT_COOKIE, valueOn(day), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: CONSENT_MAX_AGE_SECONDS,
  });
}

/**
 * Every cookie Ruken sets, with the path it was set on (a cookie is only deleted on its own path). Session cookies are
 * named with and without `__Host-` (http on a developer's own machine has no prefix). The Wishlist button's and the follow plus's cookies are here too.
 */
const RUKEN_COOKIES: readonly { name: string; path: string }[] = [
  ...["", "__Host-"].flatMap((prefix) =>
    ["rk_session", "rk_session_data", "rk_dont_remember", "rk_account_data"].map((name) => ({
      name: `${prefix}${name}`,
      path: "/",
    })),
  ),
  { name: CONSENT_COOKIE, path: "/" },
  { name: "rk_arrival", path: "/" },
  { name: "rk_welcome_back", path: "/" },
  { name: "rk_wish_pressed", path: "/" },
  { name: "rk_mark_pressed", path: "/" },
  { name: "rk_follow_pressed", path: "/" },
  { name: "ruken_sign_up", path: "/sign-up" },
  { name: "thrown-away", path: "/make" },
  { name: "page-saved", path: "/make" },
];

/** The names of every cookie Ruken sets: a test checks each one the code sets is here. */
export const RUKEN_COOKIE_NAMES: readonly string[] = RUKEN_COOKIES.map((cookie) => cookie.name);

/** Deletes every Ruken cookie this browser sent, the consent last. */
export function takeBack(cookies: Pick<Cookies, "getAll" | "delete">): void {
  const sent = new Set(cookies.getAll().map((cookie) => cookie.name));
  const mine = RUKEN_COOKIES.filter((cookie) => sent.has(cookie.name));
  for (const cookie of [...mine].sort(
    (a, b) => Number(a.name === CONSENT_COOKIE) - Number(b.name === CONSENT_COOKIE),
  )) {
    cookies.delete(cookie.name, { path: cookie.path });
  }
}
