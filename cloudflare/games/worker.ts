// What Cloudflare runs as the game gate: a Worker of its own, on addresses of its own, so a game never runs on
// Ruken's address. It holds no logic; the gate is src/features/play/gate.ts and the bucket is the site's. A game's
// files and a game's videos are served only under a pass the site signed, so nothing here asks Cloudflare's cache to
// keep an answer (no `caches`, no outgoing `fetch`): a pass that has run out must stop working at once.
//
// It imports those two files directly and nothing else. `play.ts`, the play feature's entry, brings the database
// with it, and this Worker has none.
import { handleGameRequest } from "../../src/features/play/gate.ts";
import { r2FileStore } from "../../src/lib/files/r2-store.ts";

interface Env {
  /** The bucket the site writes games and clips to. The gate only reads it. */
  GAME_FILES: R2Bucket;
  /** The secret the site signs play passes and video passes with, set on this Worker too. */
  PLAY_PASS_SECRET: string;
  /** Ruken's own address, the only one allowed to put a game in a frame. */
  SITE_ORIGIN: string;
  /**
   * Set only on a local run (the path-form browser test): the one host on which the game is in the path. The deployed
   * gate has none, so every game is served from a name of its own.
   */
  PATH_HOST?: string;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    // Trimmed and in lower case, so a value pasted with a space or a capital still matches the request's host.
    const pathHost = env.PATH_HOST?.trim().toLowerCase();
    return handleGameRequest(request, {
      files: r2FileStore(env.GAME_FILES),
      passSecret: env.PLAY_PASS_SECRET,
      siteOrigin: env.SITE_ORIGIN,
      ...(pathHost === undefined || pathHost === "" ? {} : { pathHost }),
      // The one place besides the site's `systemClock` where the real clock is read: the edge, where time comes in.
      nowMs: Date.now(),
    });
  },
};
