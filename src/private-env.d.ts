import type { Ranker } from "./features/feed/feed.ts";
import type { SendLimits } from "./features/sends/sends.ts";

// The private Worker `ruken-private`, bound as PRIVATE in the deploy only. `wrangler types` reads the top-level
// wrangler.jsonc, which `wrangler dev` and the journeys use and which has no such binding, so it is declared here, by
// hand, and optional: the app runs without it, on its open order.
declare global {
  namespace Cloudflare {
    interface Env {
      // `sendLimits` is optional too: a private Worker deployed before it answers them leaves the stand-ins in place.
      PRIVATE?: { feed: Ranker; sendLimits?: () => Promise<SendLimits> };
    }
  }
}

export {};
