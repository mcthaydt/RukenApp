import { env, waitUntil } from "cloudflare:workers";
import { r2FileStore } from "../files/r2-store.ts";
import type { FileStore } from "../files/store.ts";
import type { MakeFrame } from "./frames.ts";
import type { Place, Platform } from "./platform.ts";

// The only file that imports `cloudflare:workers`, and only src/hooks.server.ts imports this one, so no test
// needs Cloudflare. `env` and `waitUntil` belong to the request that is running (a Worker has no `platform`
// handed to each request by this adapter), so nothing has to carry them from the hook.

/** The database comes through Hyperdrive, Cloudflare's connection pool in front of Neon. */
export const cloudflarePlatform: Platform = {
  databaseUrl: () => env.HYPERDRIVE.connectionString,
  waitUntil,
  placeOf,
};

/** The edge puts the visitor's city and country (a two-letter code) on `request.cf`; the code is turned into words. */
function placeOf(request: Request): Place {
  const cf = (request as { cf?: { city?: unknown; country?: unknown } }).cf;
  const city = typeof cf?.city === "string" && cf.city !== "" ? cf.city : null;
  const code = typeof cf?.country === "string" && cf.country !== "" ? cf.country : null;
  let country = code;
  if (code !== null) {
    try {
      country = new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
    } catch {
      country = code;
    }
  }
  return { city, country };
}

/**
 * The private Worker's feed ranker, or null when this Worker has no PRIVATE binding (dev, the journeys, anyone's own
 * copy of the app).
 */
export const cloudflarePrivateFeed = () => env.PRIVATE?.feed ?? null;

/** Games and clips live in one R2 bucket, bound as GAME_FILES (wrangler.jsonc). */
export const cloudflareFiles = (): FileStore => r2FileStore(env.GAME_FILES);

/**
 * A video's still, made by Cloudflare's media tool (bound as MEDIA, wrangler.jsonc). `wrangler dev --local` has no copy
 * of the tool: the binding is there, but every call throws ("needs to be run remotely"). The caller catches that, marks
 * the still as failed and shows the video without it.
 */
export const cloudflareFrames = (): MakeFrame | null => {
  const media = (env as { MEDIA?: MediaBinding }).MEDIA;
  if (media === undefined) return null;
  return async (video, { second, width }) => {
    const result = media
      .input(video)
      .transform({ width })
      .output({ mode: "frame", time: `${String(second)}s`, format: "jpg" });
    return new Uint8Array(await (await result.response()).arrayBuffer());
  };
};
