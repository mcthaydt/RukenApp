import { authServices, signedInRedirect, signUpWithPassword } from "../../features/accounts/accounts.ts";
import type { Actions, PageServerLoad } from "./$types";

// A signed-in person is sent straight on; `next` reaches the page only after safeNextPath has
// checked it.
export const load: PageServerLoad = ({ locals, url }) => signedInRedirect(locals.caller, url);

export const actions: Actions = {
  default: (event) => signUpWithPassword(event, authServices().signUpDeps),
};
