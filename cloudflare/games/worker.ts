// What Cloudflare runs as the game gate: a Worker of its own, on addresses of its own, so a game never runs on
// Ruken's address. It holds no logic; the gate is src/features/play/gate.ts and the bucket is the site's.
//
// It imports those two files directly and nothing else. `play.ts`, the play feature's entry, brings the database
// with it, and this Worker has none.
import { handleGameRequest } from "../../src/features/play/gate.ts";
import { r2FileStore } from "../../src/lib/files/r2-store.ts";

interface Env {
  /** The bucket the site writes games and clips to. The gate only reads it. */
  GAME_FILES: R2Bucket;
  /** The secret the site signs play passes with, set on this Worker too. */
  PLAY_PASS_SECRET: string;
  /** Ruken's own address, the only one allowed to put a game in a frame. */
  SITE_ORIGIN: string;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleGameRequest(request, {
      files: r2FileStore(env.GAME_FILES),
      passSecret: env.PLAY_PASS_SECRET,
      siteOrigin: env.SITE_ORIGIN,
      // The one place besides the site's `systemClock` where the real clock is read: the edge, where time comes in.
      nowMs: Date.now(),
    });
  },
};
