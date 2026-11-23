import { WELCOME_BACK_COOKIE } from "../features/accounts/accounts.ts";
import { hasConsent } from "../features/consent/consent.ts";
import type { LayoutServerLoad } from "./$types";

// Signing in undid a waiting deletion if the sign-in left this cookie (accounts/auth.ts). Every page says so once:
// the cookie is read here, on the server, and deleted at once, so it can be HttpOnly and a reload shows nothing.
// Only for a browser that said yes to cookies: a deletion of the cookie is a cookie answer too, and the sign-in that
// left it needed the yes. `consented` tells the screen whether to show the notice and whether it may keep things.
export const load: LayoutServerLoad = ({ cookies }) => {
  const consented = hasConsent(cookies);
  const welcomeBack = consented && cookies.get(WELCOME_BACK_COOKIE) === "1";
  if (welcomeBack) cookies.delete(WELCOME_BACK_COOKIE, { path: "/" });
  return { welcomeBack, consented };
};
