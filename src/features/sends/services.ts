import { systemClock } from "../../lib/clock.ts";
import { prisma } from "../../lib/server/db.ts";
import { createRateLimiter } from "../../lib/server/rate-limit.ts";
import { gamesServices } from "../games/games.ts";
import { pagesServices } from "../pages/pages.ts";
import { sendLimitsFrom } from "./limits.ts";
import { createSends, type Sends } from "./service.ts";

// Everything the sends feature needs, built once per server process.

/** How to ask the private Worker for the send limits, when the host has it bound. Only src/hooks.server.ts sets it. */
let bound: () => (() => Promise<unknown>) | null = () => null;

export function setSendLimits(get: () => (() => Promise<unknown>) | null): void {
  bound = get;
}

let shared: Sends | undefined;

export function sendsServices(): Sends {
  shared ??= createSends({
    db: prisma(),
    clock: systemClock,
    limiter: createRateLimiter(prisma(), systemClock),
    limits: () => sendLimitsFrom(bound()),
    liveGames: () => gamesServices().service.liveGames(),
    makersOf: (userIds) => pagesServices().service.makersOf(userIds),
    media: (key) => gamesServices().media(key),
  });
  return shared;
}
