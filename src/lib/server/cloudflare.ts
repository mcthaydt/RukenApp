import { env, waitUntil } from "cloudflare:workers";
import { r2FileStore } from "../files/r2-store.ts";
import type { FileStore } from "../files/store.ts";
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

/** Games and clips live in one R2 bucket, bound as GAME_FILES (wrangler.jsonc). */
export const cloudflareFiles = (): FileStore => r2FileStore(env.GAME_FILES);
