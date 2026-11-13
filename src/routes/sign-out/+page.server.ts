import { authServices, signOut } from "../../features/accounts/accounts.ts";
import type { Actions } from "./$types";

// No page of its own: the "Sign out" buttons post here, and the person lands back on the page they
// were on, signed out.
export const actions: Actions = {
  default: (event) => signOut(event, authServices().formDeps),
};
