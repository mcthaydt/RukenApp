import { authServices, requestPasswordReset } from "../../features/accounts/accounts.ts";
import type { Actions } from "./$types";

// Open to anyone, signed in or not. The action mails a link when the address has an account and
// answers the same either way (forms.ts), so the page cannot be used to find out who has one.
export const actions: Actions = {
  default: (event) => requestPasswordReset(event, authServices().formDeps),
};
