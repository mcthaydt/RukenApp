import { general } from "../words/general.js";
import { readKey, rukenAddress } from "./settings.js";
import { Told } from "./told.js";

// One way to talk to Ruken. Every command calls through here, so a problem always reaches the person in Ruken's own plain
// words, and a message never holds the key.

/**
 * @typedef {import("./types.js").Ctx} Ctx
 */

/**
 * Asks Ruken something. `body` is JSON, or `file` is raw bytes to upload with a `type`. Answers `{ status, body }` for
 * anything Ruken answered in JSON; refuses with plain words for a network that is down or an answer that is not JSON.
 *
 * @param {Ctx} ctx
 * @param {string} method
 * @param {string} path
 * @param {{ json?: unknown, bytes?: Uint8Array, type?: string, signedIn?: boolean, onProgress?: (sent: number, all: number) => void }} [options]
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function ask(ctx, method, path, { json, bytes, type, signedIn = true, onProgress } = {}) {
  const address = rukenAddress(ctx.env);
  /** @type {Record<string, string>} */
  const headers = { accept: "application/json" };
  if (signedIn) {
    const key = await readKey(ctx.env);
    if (key === null) throw new Told(general.notSignedIn);
    headers.authorization = `Bearer ${key}`;
  }
  let body;
  /** @type {RequestInit & { duplex?: "half" }} */
  const init = { method, headers };
  // SvelteKit turns away a change that arrives with no content type as a possible form from another site, so one with
  // nothing to say still says it is JSON.
  if (json === undefined && bytes === undefined && method !== "GET") json = {};
  if (json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(json);
  } else if (bytes !== undefined) {
    headers["content-type"] = type ?? "application/octet-stream";
    headers["content-length"] = String(bytes.length);
    body = sliced(bytes, onProgress);
    init.duplex = "half";
  }
  let answer;
  try {
    answer = await ctx.fetch(`${address}${path}`, { ...init, ...(body === undefined ? {} : { body }) });
  } catch {
    throw new Told(general.cantReach);
  }
  let parsed;
  try {
    parsed = await answer.json();
  } catch {
    throw new Told(general.strangeAnswer);
  }
  return { status: answer.status, body: parsed };
}

/**
 * The bytes as a stream in 256 KB pieces, so a long upload can say how far it has got.
 *
 * @param {Uint8Array} bytes
 * @param {((sent: number, all: number) => void) | undefined} onProgress
 */
function sliced(bytes, onProgress) {
  const PIECE = 256 * 1024;
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent >= bytes.length) {
        controller.close();
        return;
      }
      const piece = bytes.subarray(sent, sent + PIECE);
      sent += piece.length;
      controller.enqueue(piece);
      onProgress?.(sent, bytes.length);
    },
  });
}

/**
 * Like `ask`, but any answer that is not a success is told to the person in Ruken's own words.
 *
 * @param {Ctx} ctx
 * @param {string} method
 * @param {string} path
 * @param {Parameters<typeof ask>[3]} [options]
 */
export async function askOrTell(ctx, method, path, options) {
  const { status, body } = await ask(ctx, method, path, options);
  if (status >= 200 && status < 300) return body;
  throw new Told(typeof body?.problem === "string" ? body.problem : general.strangeAnswer);
}
