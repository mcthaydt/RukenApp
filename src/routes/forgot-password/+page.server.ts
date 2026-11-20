import { authServices, finishReset, OPEN_COUNTRIES, requestReset } from "../../features/accounts/accounts.ts";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({ countries: OPEN_COUNTRIES });

// Open to anyone, signed in or not. The first screen answers the same whether or not the number has an account
// (forms.ts), so the page cannot be used to find out who has one.
export const actions: Actions = {
  start: (event) => requestReset(event, authServices().formDeps),
  // "Text it again" on the code screen.
  again: (event) => requestReset(event, authServices().formDeps),
  finish: (event) => finishReset(event, authServices().resetDeps),
};
