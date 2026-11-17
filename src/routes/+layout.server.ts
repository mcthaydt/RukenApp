import { WELCOME_BACK_COOKIE } from "../features/accounts/accounts.ts";
import type { LayoutServerLoad } from "./$types";

// Signing in undid a waiting deletion if the sign-in left this cookie (accounts/auth.ts). Every page says so once:
// the cookie is read here, on the server, and deleted at once, so it can be HttpOnly and a reload shows nothing.
export const load: LayoutServerLoad = ({ cookies }) => {
  const welcomeBack = cookies.get(WELCOME_BACK_COOKIE) === "1";
  if (welcomeBack) cookies.delete(WELCOME_BACK_COOKIE, { path: "/" });
  return { welcomeBack };
};
