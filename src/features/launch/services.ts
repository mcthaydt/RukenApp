import { systemClock } from "../../lib/clock.ts";
import { prisma } from "../../lib/server/db.ts";
import { createLaunchNow } from "./now.ts";
import { createWishlist, type Wishlist } from "./wishlist.ts";

// Everything the launch feature needs, built once per server process from the settings.

export interface LaunchServices {
  /** The launch time this request sees (see createLaunchNow). */
  now(cookies: { get(name: string): string | undefined }): number;
  wishlist: Wishlist;
}

let shared: LaunchServices | undefined;

/**
 * The process-wide launch services, created on first use. A site with the test switch wrongly set throws here, the
 * first time anything asks for the launch time.
 */
export function launchServices(): LaunchServices {
  shared ??= {
    now: createLaunchNow(process.env, systemClock),
    wishlist: createWishlist({ db: prisma(), clock: systemClock }),
  };
  return shared;
}
