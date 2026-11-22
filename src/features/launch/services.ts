import { systemClock } from "../../lib/clock.ts";
import { prisma } from "../../lib/server/db.ts";
import { createLaunchNow } from "./now.ts";
import { isOpen, OPENS_WORDS } from "./switch.ts";
import { createWishlist, type Wishlist } from "./wishlist.ts";

// Everything the launch feature needs, built once per server process from the settings.

export interface LaunchServices {
  /** The launch time this request sees (see createLaunchNow). */
  now(cookies: { get(name: string): string | undefined }): number;
  wishlist: Wishlist;
  /** What a screen needs to draw Wishlist or Play for this request (see LaunchScreen). */
  screenFor(userId: string | null, cookies: { get(name: string): string | undefined }): Promise<LaunchScreen>;
}

/**
 * Before launch: the words for the day it opens and the slugs on this person's list (none for someone signed out). From
 * launch: Play, and nothing else to know.
 */
export type LaunchScreen = { before: false } | { before: true; opens: string; wished: string[] };

let shared: LaunchServices | undefined;

/**
 * The process-wide launch services, created on first use. A site with the test switch wrongly set throws here, the
 * first time anything asks for the launch time.
 */
export function launchServices(): LaunchServices {
  if (shared === undefined) {
    const now = createLaunchNow(process.env, systemClock);
    const wishlist = createWishlist({ db: prisma(), clock: systemClock });
    shared = {
      now,
      wishlist,
      async screenFor(userId, cookies) {
        if (isOpen(now(cookies))) return { before: false };
        return {
          before: true,
          opens: OPENS_WORDS,
          wished: userId === null ? [] : await wishlist.slugsOf(userId),
        };
      },
    };
  }
  return shared;
}
