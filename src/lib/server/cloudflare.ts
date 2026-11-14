import { env, waitUntil } from "cloudflare:workers";
import type { Platform } from "./platform.ts";

// The only file that imports `cloudflare:workers`, and only src/hooks.server.ts imports this one, so no test
// needs Cloudflare. `env` and `waitUntil` belong to the request that is running (a Worker has no `platform`
// handed to each request by this adapter), so nothing has to carry them from the hook.

/** The database comes through Hyperdrive, Cloudflare's connection pool in front of Neon. */
export const cloudflarePlatform: Platform = {
  databaseUrl: () => env.HYPERDRIVE.connectionString,
  waitUntil,
};
