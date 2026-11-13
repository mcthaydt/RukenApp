import { authServices, signedInRedirect, signInWithPassword } from "../../features/accounts/accounts.ts";
import type { Actions, PageServerLoad } from "./$types";

// `reset` is set by /reset-password after a new password is saved: the page says so once.
export const load: PageServerLoad = ({ locals, url }) => ({
  ...signedInRedirect(locals.caller, url),
  reset: url.searchParams.get("reset") === "1",
});

export const actions: Actions = {
  default: (event) => signInWithPassword(event, authServices().formDeps),
};
