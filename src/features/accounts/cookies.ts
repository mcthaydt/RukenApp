import type { Cookies } from "@sveltejs/kit";

export interface CookiePolicy {
  secure: boolean;
  sessionCookieName: string;
}

export function cookiePolicy(webOrigin: string): CookiePolicy {
  throw new Error(`not built yet (${webOrigin})`);
}

export function copyAuthCookies(
  cookies: Pick<Cookies, "set" | "parse">,
  setCookieLines: readonly string[],
): void {
  throw new Error(`not built yet (${typeof cookies} ${setCookieLines.join(",")})`);
}
