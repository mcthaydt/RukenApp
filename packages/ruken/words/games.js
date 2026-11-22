import { PREFIX } from "./prefix.js";

export const games = {
  none: `You have no games yet. Start one on ruken.io/make/new.`,
  /** @param {string} name @param {string} address @param {string} words */
  listLine: (name, address, words) => `${name} (${address}): ${words}`,
  /** @param {string} name @param {string} address */
  oneName: (name, address) => `${name} (${address})`,
  /** @param {string} words */
  stateLine: (words) => `Where it is: ${words}`,
  /** @param {string} reason */
  reasonLine: (reason) => `Why: ${reason}`,
  /** @param {string} question */
  nextQuestion: (question) => `Next to answer: ${question}`,
  nothingLeft: "Every question is answered.",
  /** @param {string} title @param {string} words */
  fixLine: (title, words) => `To fix: ${title}. ${words}`,
  /** @param {string} shape @param {boolean} added @param {boolean} waits */
  videoLine: (shape, added, waits) =>
    `${shape === "upright" ? "Upright" : "Wide"} video: ${added ? (waits ? "added, waiting for review" : "added") : "not added yet"}`,
  waitsForReview: "It is waiting for review.",
  needsGame: `Say which game. ${PREFIX} games lists them.`,
  videoUsage: `${PREFIX} video <game> upright|wide <file>`,
  keepOldUsage: `${PREFIX} keep-old <game> upright|wide|age`,
  gameUsage: `${PREFIX} game <game>`,
  badShape: "Say upright or wide.",
  badPart: "Say upright, wide or age.",
  notAVideo: "Ruken takes MP4, WebM or MOV videos.",
  /** @param {string} size @param {string} most */
  tooBig: (size, most) =>
    `That video is ${size}. Videos can be up to ${most}. Make it shorter or smaller, then try again.`,
  /** @param {string} file */
  cantFind: (file) => `I can't find ${file}.`,
  /** @param {string} file */
  cantRead: (file) => `I can't read ${file}.`,
  /** @param {string} file @param {string} size */
  sending: (file, size) => `Sending ${file} (${size})`,
  /** @param {string} name @param {string} shape @param {string} game */
  sentWaits: (name, shape, game) =>
    `Sent. ${name}'s new ${shape} video waits for review. See it with: ${PREFIX} game ${game}`,
  /** @param {string} name @param {string} shape @param {string} game */
  sentIn: (name, shape, game) => `Added. ${name}'s ${shape} video is in. See it with: ${PREFIX} game ${game}`,
  /** @param {string} name */
  keptOld: (name) => `Kept the old one. Players of ${name} still see what they saw.`,
  /** @param {string} name */
  keepNothing: (name) => `Nothing was waiting for ${name}.`,
};
