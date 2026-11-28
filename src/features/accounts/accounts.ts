// The accounts feature's entry: what routes, the request hook and other features may import.
// Anything not exported here is internal to the feature.
export type { Caller } from "./caller.ts";
export { createHandle } from "./handle.ts";
export { httpsOnly } from "./https-only.ts";
export { forwardToAuth } from "./forward.ts";
export { changePassword, type ChangeFormData } from "./credentials.ts";
export {
  finishReset,
  finishSignUp,
  FORM_MESSAGES,
  readForm,
  requestReset,
  changeNumber,
  resendCode,
  signInWithPassword,
  signOut,
  startSignUp,
} from "./forms.ts";
export { hashNumber, OPEN_COUNTRIES, shownAs, typedNumber } from "./phone.ts";
export { setPaperEmail } from "./paper.ts";
export { setMoneyCheck } from "./changed-hands.ts";
export { ageCheck, isAdultOn, type BirthDate } from "./age.ts";
export { signedInOnly, signedInRedirect } from "./pages.ts";
export {
  attachPhoneToAccount,
  firstGameStaff,
  GAME_STAFF_ROLES,
  grantFirstOwner,
  staffRolesOf,
  type AttachPhoneOutcome,
  type FirstOwnerOutcome,
} from "./staff.ts";
export { authServices } from "./services.ts";
export {
  DELETION_WAIT_DAYS,
  purgeDueAccounts,
  requestDeletion,
  restoreOnSignIn,
  type DeletionDeps,
  type PurgeDeps,
} from "./deletion.ts";
export { WELCOME_BACK_COOKIE } from "./cookies.ts";
export { ADULTS_ONLY, adultsOnlyRefusal, isKnownAdultCaller } from "./adults.ts";
export {
  answerSignIn,
  CODE_LIFETIME_MS,
  computersOf,
  finishSignIn,
  lookAtSignIn,
  MAX_COMPUTERS,
  placeWarning,
  placeWords,
  removeComputer,
  renameComputer,
  startSignIn,
  WORDS as COMPUTER_WORDS,
} from "./computer-keys.ts";
