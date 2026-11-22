import { extname } from "node:path";
import { askOrTell } from "../lib/ask.js";
import { spinner } from "../lib/say.js";
import { Told } from "../lib/told.js";
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
];
