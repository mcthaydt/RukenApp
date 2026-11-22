import { PREFIX } from "./prefix.js";

export const games = {
  none: `You have no games yet. Start one with: ${PREFIX} new "<name>"`,
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
  /** @param {string} line */
  lineLine: (line) => `One line: ${line}`,
  /** @param {string} rating @param {string | null} held */
  ratingLine: (rating, held) =>
    `Who it is for: ${rating}${held === null ? "" : `. Waiting for review: ${held}`}`,
  /** @param {string} repo @param {string | null} branch @param {string} folder */
  filesLine: (repo, branch, folder) =>
    `Files: ${repo}${branch === null ? "" : `, branch ${branch}`}${folder === "" ? "" : `, folder ${folder}`}`,
  /** @param {string[]} hosts */
  websitesLine: (hosts) => `Other websites: ${hosts.length === 0 ? "none" : hosts.join(", ")}`,
  /** @param {boolean} on */
  playerCountLine: (on) => `Player count on its page: ${on ? "on" : "off"}`,
  /** @param {string} problem */
  copyProblem: (problem) => `Last copy from GitHub: ${problem}`,
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
  newUsage: `${PREFIX} new "<name>"`,
  setUsage: `${PREFIX} set <game> name|line|age|marks|websites <value>`,
  filesUsage: `${PREFIX} files <game> <owner/repo> [--branch <branch>] [--folder <folder>]`,
  agreeUsage: `${PREFIX} agree <game>`,
  sendUsage: `${PREFIX} send <game>`,
  updateUsage: `${PREFIX} update <game>`,
  playerCountUsage: `${PREFIX} player-count <game> on|off`,
  takeOffUsage: `${PREFIX} take-off <game>`,
  putBackUsage: `${PREFIX} put-back <game>`,
  deleteFilesUsage: `${PREFIX} delete-files <game>`,
  throwAwayUsage: `${PREFIX} throw-away <game>`,
  needsName: `Say the game's name, like: ${PREFIX} new "Floor Fifty"`,
  badQuestion: "Say what to set: name, line, age, marks or websites.",
  needsValue: "Say what to set it to.",
  badAge: "Who is it for? Say 3, 7, 12, 16 or 18.",
  /** @param {string} word */
  badMark: (word) => `I don't know the mark "${word}". Say sex, gore, drugs or none.`,
  badOnOff: "Say on or off.",
  /** @param {string} name @param {string} game */
  started: (name, game) =>
    `Started ${name}. Its address is ${game}. Next: ${PREFIX} set ${game} line "<what it is, in one line>"`,
  /** @param {string} name @param {string} game */
  saved: (name, game) => `Saved. See ${name} with: ${PREFIX} game ${game}`,
  /** @param {string} game */
  needsMarks: (game) =>
    `Choose its 18+ marks too: ${PREFIX} set ${game} age 18 --marks <marks>. Marks are sex, gore, drugs or none.`,
  /** @param {string} name @param {boolean} on */
  playerCountSet: (name, on) => `Done. ${name} ${on ? "shows" : "no longer shows"} its player count.`,
  /** @param {string} name @param {string} game */
  sentForReview: (name, game) => `Sent. ${name} waits for review. See it with: ${PREFIX} game ${game}`,
  /** @param {string} name @param {string} game */
  sentNewVersion: (name, game) =>
    `Sent. ${name}'s new version waits for review. See it with: ${PREFIX} game ${game}`,
  /** @param {string} problem @param {string} game */
  sendAgainInstead: (problem, game) => `${problem} Send what you have again with: ${PREFIX} send ${game}`,
  /** @param {string} problem @param {string} game */
  sendNewestInstead: (problem, game) => `${problem} Send its newest files with: ${PREFIX} update ${game}`,
  /** @param {string} problem @param {string} game */
  agreeFirst: (problem, game) => `${problem} Read it and agree with: ${PREFIX} agree ${game}`,
  /** @param {string} problem @param {string} game @param {string} question */
  openQuestion: (problem, game, question) => {
    const how =
      question === "files"
        ? `${PREFIX} files ${game} <owner/repo>`
        : question === "upright" || question === "wide"
          ? `${PREFIX} video ${game} ${question} <file>`
          : `${PREFIX} set ${game} ${question} <value>`;
    return `${problem} Next: ${how}`;
  },
  /** @param {string} name @param {string} game */
  tookOff: (name, game) => `${name} is off Ruken. Put it back with: ${PREFIX} put-back ${game}`,
  /** @param {string} name @param {string} game */
  putBack: (name, game) => `Put back. ${name} waits for review. See it with: ${PREFIX} game ${game}`,
  /** @param {string} name */
  filesDeleted: (name) => `Deleted the files ${name} left behind.`,
  /** @param {string} name */
  thrownAway: (name) => `${name} is thrown away.`,
  /** @param {string} name */
  typeName: (name) => `Type the game's name (${name}) to go on:`,
  notConfirmed: "That wasn't the name, so nothing was done.",
  /** @param {string} name */
  keepNothing: (name) => `Nothing was waiting for ${name}.`,
};
