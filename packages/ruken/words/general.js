import { PREFIX } from "./prefix.js";

// The words every command shares: help, a missing key, a network that is down, a refusal Ruken's own words do not cover.
export const general = {
  helpTop: "Ruken from your computer. The commands you will use most:",
  /** @param {string} prefix */
  helpMore: (prefix) => `For every command: ${prefix} help all. For one: ${prefix} help <command>.`,
  /** @param {string} usage @param {string} summary */
  helpOne: (usage, summary) => `${usage}\n  ${summary}`,
  /** @param {string} word */
  unknownCommand: (word) => `I don't know "${word}". Type ${PREFIX} to see the commands.`,
  notSignedIn: `You're not signed in. Type: ${PREFIX} sign-in`,
  signInAgain: `Sign in again: ${PREFIX} sign-in`,
  cantReach: "Can't reach Ruken. Check your internet and try again.",
  strangeAnswer: "Ruken answered something we didn't expect. Try again in a moment.",
  /** @param {string} address */
  notSecure: (address) => `${address} isn't a secure address. Ruken only talks over https.`,
  /** @param {string} rest */
  prefixed: (rest) => `${PREFIX} ${rest}`,
  /** @param {string} usage */
  needsMore: (usage) => `Something is missing. Type it like this: ${usage}`,
};
