import { PREFIX } from "./prefix.js";

export const agreement = {
  /** @param {string} version */
  heading: (version) => `Ruken maker agreement, version ${version}`,
  /** @param {number} number @param {string} title @param {string} body */
  point: (number, title, body) => `${String(number)}. ${title} ${body}`,
  typeYes: "Type yes to agree, or anything else to stop:",
  notAgreed: "You did not agree, so nothing was saved.",
  /** @param {string | undefined} game */
  agreed: (game) =>
    game === undefined
      ? "Thank you. You have agreed to the maker agreement."
      : `Thank you. You have agreed. Now send it: ${PREFIX} send ${game}`,
  alreadyAgreed: "You have already agreed to this maker agreement.",
};
