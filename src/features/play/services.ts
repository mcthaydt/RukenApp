import { systemClock, type Clock } from "../../lib/clock.ts";
import { prisma, type PrismaClient } from "../../lib/server/db.ts";
import { requireEnv } from "../../lib/server/env.ts";
import { createRateLimiter } from "../../lib/server/rate-limit.ts";
import { gamesServices } from "../games/games.ts";
import { createPlayService, type PlayService } from "./sessions.ts";

// Everything the play feature needs, built once per server process from the settings. Routes call playServices();
// tests build their own with createPlayServices.

export interface PlayServices {
  service: PlayService;
}

/**
 * Reads the setting first, so a missing one stops the start with its name before anything is connected. `parts` are
 * what the play feature borrows from the site: the database, the clock and the address a game is played at.
 */
export function createPlayServices(
  source: Readonly<Record<string, string | undefined>>,
  parts: { db: PrismaClient; clock: Clock; address(name: string): string },
): PlayServices {
  // The secret the game gate (a separate Worker) checks passes with. It is not the site's own sign-in secret, so
  // a game's gate never holds the means to sign a person in.
  const passSecret = requireEnv("PLAY_PASS_SECRET", source);
  const service = createPlayService({
    db: parts.db,
    clock: parts.clock,
    rateLimiter: createRateLimiter(parts.db, parts.clock),
    passSecret,
    address: (name) => parts.address(name),
  });
  return { service };
}

let shared: PlayServices | undefined;

/** The process-wide play services, created on first use. */
export function playServices(): PlayServices {
  shared ??= createPlayServices(process.env, {
    db: prisma(),
    clock: systemClock,
    // Looked up each time, so this file asks the games feature for nothing until a game's address is needed.
    address: (name) => gamesServices().address(name),
  });
  return shared;
}
