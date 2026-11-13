// The accounts feature's entry: what routes, the request hook and other features may import.
// Anything not exported here is internal to the feature.
export type { Caller } from "./caller.ts";
export { createHandle } from "./handle.ts";
export { forwardToAuth } from "./forward.ts";
export {
  FORM_MESSAGES,
  readForm,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from "./forms.ts";
export { signedInOnly, signedInRedirect } from "./pages.ts";
export { staffRolesOf } from "./staff.ts";
export { authServices } from "./services.ts";
