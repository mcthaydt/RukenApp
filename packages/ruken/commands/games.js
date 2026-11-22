import { extname } from "node:path";
import { ask, askOrTell } from "../lib/ask.js";
import { spinner } from "../lib/say.js";
import { Told } from "../lib/told.js";
import { agreement } from "../words/agreement.js";
import { games as words } from "../words/games.js";
import { general } from "../words/general.js";

/** @typedef {import("../lib/types.js").Ctx} Ctx */

/** The most a video may be, as Ruken counts it. Checked here first so a big file is never read, let alone sent. */
export const VIDEO_MAX_BYTES = 30_000_000;
/** @type {Record<string, string>} */
const TYPES = { ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime" };
const SHAPES = ["upright", "wide"];

/** @param {number} bytes */
function megabytes(bytes) {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** @param {string | undefined} name */
function needGame(name) {
  if (!name) throw new Told(words.needsGame);
  return encodeURIComponent(name);
}

/** @param {Ctx} ctx @param {string} shape @param {{ added: boolean, waitsForReview: boolean }} video */
function showVideo(ctx, shape, video) {
  ctx.out(words.videoLine(shape, video.added, video.waitsForReview));
}

/** @param {string[]} _args @param {Ctx} ctx */
async function list(_args, ctx) {
  const { games } = await askOrTell(ctx, "GET", "/api/v1/games");
  if (games.length === 0) {
    ctx.out(words.none);
    return;
  }
  for (const one of games) ctx.out(words.listLine(one.name, one.game, one.words));
}

/** @param {string[]} args @param {Ctx} ctx */
async function show([name], ctx) {
  const game = await askOrTell(ctx, "GET", `/api/v1/games/${needGame(name)}`);
  ctx.out(words.oneName(game.name, game.game));
  ctx.out(words.stateLine(game.words));
  if (game.reason) ctx.out(words.reasonLine(game.reason));
  if (game.oneLine) ctx.out(words.lineLine(game.oneLine));
  if (game.rating) ctx.out(words.ratingLine(game.rating, game.heldRating));
  if (game.files.repo) ctx.out(words.filesLine(game.files.repo, game.files.branch, game.files.folder));
  ctx.out(words.websitesLine(game.websites));
  if (game.state === "live") ctx.out(words.playerCountLine(game.playerCount));
  if (game.pullProblem) ctx.out(words.copyProblem(game.pullProblem));
  showVideo(ctx, "upright", game.videos.upright);
  showVideo(ctx, "wide", game.videos.wide);
  for (const one of game.toFix) ctx.out(words.fixLine(one.title, one.words));
  ctx.out(game.next ? words.nextQuestion(game.next) : words.nothingLeft);
  if (game.waitsForReview) ctx.out(words.waitsForReview);
}

/** @param {string[]} args @param {Ctx} ctx */
async function video([name, shape, file], ctx) {
  if (!name || !shape || !file) throw new Told(words.videoUsage);
  if (!SHAPES.includes(shape)) throw new Told(words.badShape);
  const type = TYPES[extname(file).toLowerCase()];
  if (type === undefined) throw new Told(words.notAVideo);
  let size;
  try {
    size = await ctx.sizeOf(file);
  } catch {
    throw new Told(words.cantFind(file));
  }
  if (size > VIDEO_MAX_BYTES) throw new Told(words.tooBig(megabytes(size), megabytes(VIDEO_MAX_BYTES)));
  let bytes;
  try {
    bytes = new Uint8Array(await ctx.readFile(file));
  } catch {
    throw new Told(words.cantRead(file));
  }
  const bar = spinner(ctx, words.sending(file, megabytes(size)));
  let game;
  try {
    game = await askOrTell(ctx, "PUT", `/api/v1/games/${needGame(name)}/videos/${shape}`, {
      bytes,
      type,
      onProgress: (sent, all) =>
        bar.update(`${words.sending(file, megabytes(size))}: ${Math.round((sent / all) * 100)}%`),
    });
  } finally {
    bar.stop();
  }
  const waits = game.videos[shape].waitsForReview;
  ctx.out((waits ? words.sentWaits : words.sentIn)(game.name, shape, game.game));
}

/** @param {string[]} args @param {Ctx} ctx */
async function keepOld([name, part], ctx) {
  if (!name || !part) throw new Told(words.keepOldUsage);
  if (!["upright", "wide", "age"].includes(part)) throw new Told(words.badPart);
  const game = await askOrTell(ctx, "DELETE", `/api/v1/games/${needGame(name)}/waiting/${part}`);
  ctx.out(words.keptOld(game.name));
}

/** Splits `--flag value` pairs from the words: answers the plain words and the flags. @param {string[]} args */
function flagged(args) {
  /** @type {string[]} */
  const rest = [];
  /** @type {Record<string, string>} */
  const flags = {};
  for (let at = 0; at < args.length; at += 1) {
    const word = args[at] ?? "";
    if (word.startsWith("--")) {
      flags[word.slice(2)] = args[at + 1] ?? "";
      at += 1;
    } else rest.push(word);
  }
  return { rest, flags };
}

/** @param {string} word */
function ageOf(word) {
  const number = word.replace("+", "");
  if (!["3", "7", "12", "16", "18"].includes(number)) throw new Told(words.badAge);
  return `age_${number}`;
}

/** @param {string} list */
function marksOf(list) {
  const named = {
    sex: "sex_or_nudity",
    nudity: "sex_or_nudity",
    sex_or_nudity: "sex_or_nudity",
    gore: "gore",
    drugs: "drugs",
    none: "none",
  };
  return list
    .split(/[,\s]+/)
    .filter((word) => word !== "")
    .map((word) => {
      const mark = /** @type {Record<string, string>} */ (named)[word.toLowerCase()];
      if (mark === undefined) throw new Told(words.badMark(word));
      return mark;
    });
}

/** Says what a change did: what the game is called now, and that a live game's change waits. @param {Ctx} ctx @param {any} game */
function saidSaved(ctx, game) {
  ctx.out(words.saved(game.name, game.game));
  if (game.waitsForReview) ctx.out(words.waitsForReview);
}

/** @param {string[]} args @param {Ctx} ctx */
async function start(args, ctx) {
  const name = args.join(" ").trim();
  if (name === "") throw new Told(words.needsName);
  const game = await askOrTell(ctx, "POST", "/api/v1/games", { json: { name } });
  ctx.out(words.started(game.name, game.game));
}

/** @param {string[]} args @param {Ctx} ctx */
async function set(args, ctx) {
  const { rest, flags } = flagged(args);
  const [name, question, ...value] = rest;
  const game = needGame(name);
  if (!question) throw new Told(words.badQuestion);
  const text = value.join(" ").trim();
  if (text === "") throw new Told(words.needsValue);
  /** @type {Record<string, unknown>} */
  let json;
  if (question === "name") json = { name: text };
  else if (question === "line") json = { oneLine: text };
  else if (question === "websites")
    json = { websites: value.flatMap((one) => one.split(",")).filter((one) => one !== "") };
  else if (question === "marks") json = { contentMarks: marksOf(text) };
  else if (question === "age") {
    json = { ageRating: ageOf(text) };
    if (flags.marks !== undefined) json.contentMarks = marksOf(flags.marks);
  } else throw new Told(words.badQuestion);
  const { status, body } = await ask(ctx, "PATCH", `/api/v1/games/${game}`, { json });
  if (status >= 200 && status < 300) return saidSaved(ctx, body);
  // The browser sends a maker on to the marks question; a command has no next screen, so it says what to type.
  if (body?.field === "marks" && question === "age" && flags.marks === undefined) {
    throw new Told(words.needsMarks(decodeURIComponent(game)));
  }
  throw new Told(typeof body?.problem === "string" ? body.problem : general.strangeAnswer);
}

/** @param {string[]} args @param {Ctx} ctx */
async function files(args, ctx) {
  const { rest, flags } = flagged(args);
  const [name, repo] = rest;
  const game = needGame(name);
  if (!repo) throw new Told(words.filesUsage);
  const saved = await askOrTell(ctx, "PATCH", `/api/v1/games/${game}`, {
    json: { files: { repo, branch: flags.branch ?? null, folder: flags.folder ?? "" } },
  });
  saidSaved(ctx, saved);
}

/** @param {string[]} args @param {Ctx} ctx */
async function agree([name], ctx) {
  const maker = await askOrTell(ctx, "GET", "/api/v1/agreement");
  if (maker.agreed) {
    ctx.out(agreement.alreadyAgreed);
    return;
  }
  ctx.out(agreement.heading(maker.version));
  for (const point of maker.points) ctx.out(agreement.point(point.number, point.title, point.body));
  // Only a person's own yes counts: it is typed here, and nothing else can supply it.
  if ((await ctx.prompt(agreement.typeYes)).trim().toLowerCase() !== "yes")
    throw new Told(agreement.notAgreed);
  await askOrTell(ctx, "POST", "/api/v1/agreement");
  ctx.out(agreement.agreed(name));
}

/** @param {string[]} args @param {Ctx} ctx */
async function send([name], ctx) {
  const game = needGame(name);
  const { status, body } = await ask(ctx, "POST", `/api/v1/games/${game}/send`);
  if (status >= 200 && status < 300) {
    ctx.out(words.sentForReview(body.name, body.game));
    return;
  }
  const problem = typeof body?.problem === "string" ? body.problem : general.strangeAnswer;
  if (body?.agreement === true) throw new Told(words.agreeFirst(problem, decodeURIComponent(game)));
  if (body?.next === "update") {
    throw new Told(words.sendNewestInstead(problem, decodeURIComponent(game)));
  }
  if (typeof body?.question === "string") {
    throw new Told(words.openQuestion(problem, decodeURIComponent(game), body.question));
  }
  throw new Told(problem);
}

/** @param {string[]} args @param {Ctx} ctx */
async function update([name], ctx) {
  const game = needGame(name);
  const { status, body } = await ask(ctx, "POST", `/api/v1/games/${game}/new-version`);
  if (status >= 200 && status < 300) {
    ctx.out(words.sentNewVersion(body.name, body.game));
    return;
  }
  const problem = typeof body?.problem === "string" ? body.problem : general.strangeAnswer;
  throw new Told(body?.next === "send" ? words.sendAgainInstead(problem, decodeURIComponent(game)) : problem);
}

/** @param {string[]} args @param {Ctx} ctx */
async function playerCount([name, onOff], ctx) {
  const game = needGame(name);
  if (onOff !== "on" && onOff !== "off") throw new Told(words.badOnOff);
  const saved = await askOrTell(ctx, "PATCH", `/api/v1/games/${game}`, {
    json: { playerCount: onOff === "on" },
  });
  ctx.out(words.playerCountSet(saved.name, onOff === "on"));
}

/**
 * Asks the person to type the game's name before something that cannot be undone, as the screens ask on a screen of their
 * own. Anything else, or nothing, does nothing.
 * @param {Ctx} ctx @param {string | undefined} name
 */
async function confirmed(ctx, name) {
  const game = await askOrTell(ctx, "GET", `/api/v1/games/${needGame(name)}`);
  const typed = (await ctx.prompt(words.typeName(game.name))).trim().toLowerCase();
  if (typed !== game.name.toLowerCase() && typed !== game.game.toLowerCase()) {
    throw new Told(words.notConfirmed);
  }
  return game;
}

/** @param {string[]} args @param {Ctx} ctx */
async function takeOff([name], ctx) {
  const shown = await confirmed(ctx, name);
  await askOrTell(ctx, "POST", `/api/v1/games/${needGame(name)}/take-off`);
  ctx.out(words.tookOff(shown.name, shown.game));
}

/** @param {string[]} args @param {Ctx} ctx */
async function putBack([name], ctx) {
  const game = await askOrTell(ctx, "POST", `/api/v1/games/${needGame(name)}/put-back`);
  ctx.out(words.putBack(game.name, game.game));
}

/** @param {string[]} args @param {Ctx} ctx */
async function deleteFiles([name], ctx) {
  const shown = await confirmed(ctx, name);
  await askOrTell(ctx, "DELETE", `/api/v1/games/${needGame(name)}/files`);
  ctx.out(words.filesDeleted(shown.name));
}

/** @param {string[]} args @param {Ctx} ctx */
async function throwAway([name], ctx) {
  await confirmed(ctx, name);
  const gone = await askOrTell(ctx, "DELETE", `/api/v1/games/${needGame(name)}`);
  ctx.out(words.thrownAway(gone.name));
}

/** @type {import("../lib/types.js").Command[]} */
export const games = [
  {
    name: "games",
    usage: general.prefixed("games"),
    summary: "List your games and where each one is.",
    common: true,
    run: list,
  },
  {
    name: "game",
    usage: words.gameUsage,
    summary: "Show one game: where it is, what is left, what to fix.",
    common: true,
    run: show,
  },
  {
    name: "video",
    usage: words.videoUsage,
    summary: "Send a game's upright or wide video from a file.",
    common: true,
    run: video,
  },
  {
    name: "keep-old",
    usage: words.keepOldUsage,
    summary: "Drop a change that waits for review. Players keep what they see.",
    common: false,
    run: keepOld,
  },
  {
    name: "new",
    usage: words.newUsage,
    summary: "Start a game from its name.",
    common: true,
    run: start,
  },
  {
    name: "set",
    usage: words.setUsage,
    summary: "Answer a question about a game: its name, one line, age, marks or other websites.",
    common: true,
    run: set,
  },
  {
    name: "files",
    usage: words.filesUsage,
    summary: "Choose the GitHub folder a game is played from.",
    common: true,
    run: files,
  },
  {
    name: "agree",
    usage: words.agreeUsage,
    summary: "Read the maker agreement and agree to it by typing yes.",
    common: false,
    run: agree,
  },
  {
    name: "send",
    usage: words.sendUsage,
    summary: "Send a game for review.",
    common: true,
    run: send,
  },
  {
    name: "update",
    usage: words.updateUsage,
    summary: "Send a live game's newest files for review.",
    common: false,
    run: update,
  },
  {
    name: "player-count",
    usage: words.playerCountUsage,
    summary: "Show or hide the player count on a live game's page.",
    common: false,
    run: playerCount,
  },
  {
    name: "take-off",
    usage: words.takeOffUsage,
    summary: "Take a live game off Ruken. You can put it back.",
    common: false,
    run: takeOff,
  },
  {
    name: "put-back",
    usage: words.putBackUsage,
    summary: "Put a game you took off back, for review.",
    common: false,
    run: putBack,
  },
  {
    name: "delete-files",
    usage: words.deleteFilesUsage,
    summary: "Delete the files a game you took off left behind.",
    common: false,
    run: deleteFiles,
  },
  {
    name: "throw-away",
    usage: words.throwAwayUsage,
    summary: "Throw a game away for good.",
    common: false,
    run: throwAway,
  },
];
