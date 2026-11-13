import { authServices, resetPassword } from "../../features/accounts/accounts.ts";
import type { Actions, PageServerLoad } from "./$types";

// Where the link in the reset mail lands. better-auth checks the link first and sends the person here
// with `?token=` when it is good, or `?error=INVALID_TOKEN` when it has expired or was already used.
// Open to anyone, signed in or not: the link itself is the proof.
export const load: PageServerLoad = ({ url }) => {
  const token = url.searchParams.get("token") ?? "";
  return { token, linkFailed: token === "" || url.searchParams.has("error") };
};

export const actions: Actions = {
  default: (event) => resetPassword(event, authServices().formDeps),
};
