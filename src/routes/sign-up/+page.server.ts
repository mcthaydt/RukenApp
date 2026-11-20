import {
  authServices,
  finishSignUp,
  OPEN_COUNTRIES,
  resendCode,
  signedInRedirect,
  startSignUp,
} from "../../features/accounts/accounts.ts";
import type { Actions, PageServerLoad } from "./$types";

// A signed-in person is sent straight on; `next` reaches the page only after safeNextPath has
// checked it.
export const load: PageServerLoad = ({ locals, url }) => ({
  ...signedInRedirect(locals.caller, url),
  countries: OPEN_COUNTRIES,
});

export const actions: Actions = {
  // The first screen: checks the form, keeps the password and the birthday for this browser, asks for a code.
  default: (event) => startSignUp(event, authServices().signUpDeps),
  // The code screen: "Join Ruken".
  finish: (event) => finishSignUp(event, authServices().signUpDeps),
  // The code screen: "Text it again".
  again: (event) => resendCode(event, authServices().signUpDeps),
};
