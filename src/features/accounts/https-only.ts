import type { Handle } from "@sveltejs/kit/hooks";

// On a site served over https, a visit by plain http is sent to the same address over https before anything else runs.
//
// Why: the sign-in cookie is `Secure` (cookies.ts), and a browser will not keep a `Secure` cookie from an http page.
// A phone that opened http://ruken.io could post the sign-in form, have the password accepted, and still come back
// signed out on the Sign in page, with no word of why (2026-11-22). Cloudflare passes plain-http visits through to
// the Worker, so the site itself has to refuse them.
//
// Strict-Transport-Security then tells the browser to use https for this address by itself from the next visit on.
// It names no subdomains: games are served from their own addresses, which this site does not speak for.

/** One year, the usual length for Strict-Transport-Security. */
export const HSTS_HEADER = "max-age=31536000";

/** The health probe answers on any scheme, without the sign-in settings (handle.ts). */
const HEALTH_PATH = "/healthz";

/**
 * `siteOrigin` is BETTER_AUTH_URL, read on the first request that needs it. When it is https, http requests are
 * redirected to https and every answer carries HSTS. When it is http (a machine running the site locally), nothing
 * changes.
 */
export function httpsOnly(siteOrigin: () => string): Handle {
  return async ({ event, resolve }) => {
    if (event.url.pathname === HEALTH_PATH) return resolve(event);
    if (new URL(siteOrigin()).protocol !== "https:") return resolve(event);

    if (cameByPlainHttp(event.url, event.request.headers)) {
      const secure = new URL(event.url);
      secure.protocol = "https:";
      // 308 keeps the method and the body, so a form posted over http is posted again over https, not dropped.
      return new Response(null, {
        status: 308,
        headers: { location: secure.href, "strict-transport-security": HSTS_HEADER },
      });
    }

    const response = await resolve(event);
    try {
      response.headers.set("strict-transport-security", HSTS_HEADER);
    } catch {
      // An answer passed through from elsewhere can have headers that cannot be changed; it goes out as it is.
    }
    return response;
  };
}

/**
 * Whether the visitor reached the site by plain http. The Worker sees the visitor's own scheme in its address; a proxy
 * in front of it says so in X-Forwarded-Proto instead.
 */
function cameByPlainHttp(url: URL, headers: Headers): boolean {
  return url.protocol === "http:" || headers.get("x-forwarded-proto") === "http";
}
