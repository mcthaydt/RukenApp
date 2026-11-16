import { WELCOME_BACK_COOKIE } from "../features/accounts/accounts.ts";
import { isStaff } from "../features/admin/admin.ts";
import type { LayoutServerLoad } from "./$types";

// Signing in undid a waiting deletion if the sign-in left this cookie (accounts/auth.ts). Every page says so once:
// the cookie is read here, on the server, and deleted at once, so it can be HttpOnly and a reload shows nothing.
// Whether this person is staff who check games is read here too, because three screens offer staff a door to "Games to
// check" (home, Your account, and the error page inside /admin) and the site's one error page has no load of its own. Only
// a yes or no goes to the browser, never a role.
export const load: LayoutServerLoad = ({ cookies, locals }) => {
  const welcomeBack = cookies.get(WELCOME_BACK_COOKIE) === "1";
  if (welcomeBack) cookies.delete(WELCOME_BACK_COOKIE, { path: "/" });
  return { welcomeBack, staff: isStaff(locals.caller) };
};
