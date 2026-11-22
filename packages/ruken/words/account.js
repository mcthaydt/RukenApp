import { PREFIX } from "./prefix.js";

export const account = {
  /** @param {string} where @param {string} code */
  openAndPress: (where, code) => `Open ${where} and press Yes. Your code is ${code}.`,
  waiting: "Waiting for you to press Yes...",
  /** @param {string} who */
  signedInAs: (who) => `Signed in as ${who}. You can close the browser.`,
  alreadyEnded: `That code ran out. Run ${PREFIX} sign-in again.`,
  keyFromEnvironment:
    "This computer signs in with the RUKEN_KEY setting, so there is no saved sign-in to remove here. Remove RUKEN_KEY, and remove the computer on ruken.io/me/computers.",
  /** @param {string} who */
  whoami: (who) => `You're signed in as ${who}.`,
  /** @param {string} ending */
  whoIsAccount: (ending) => `the account ending ${ending}`,
  /** @param {string} handle */
  whoIsHandle: (handle) => `@${handle}`,
  signedOut: "Signed out. This computer can't use your Ruken any more.",
  notSignedInHere: "You're not signed in on this computer.",
  /** @param {string} where */
  accountScreen: (where) => `Your account, your membership and your password are on ${where}.`,
  nameless: "A computer",
  prefix: PREFIX,
};
