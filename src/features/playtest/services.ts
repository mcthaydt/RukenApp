import { systemClock } from "../../lib/clock.ts";
import { prisma } from "../../lib/server/db.ts";
import { gamesServices } from "../games/games.ts";
import { pagesServices } from "../pages/pages.ts";
import { sendsServices } from "../sends/sends.ts";
import { createPlaytest, type Playtest } from "./service.ts";

// Everything the playtest feature needs, built once per server process.

let shared: { service: Playtest } | undefined;

export function playtestServices(): { service: Playtest } {
  shared ??= {
    service: createPlaytest({
      db: prisma(),
      clock: systemClock,
      liveGames: () => gamesServices().service.liveGames(),
      makersOf: (userIds) => pagesServices().service.makersOf(userIds),
      media: (key) => gamesServices().media(key),
      canSend: (fromId, toId) => sendsServices().canSend(fromId, toId),
      friendsOf: (userId) => sendsServices().friendsOf(userId),
    }),
  };
  return shared;
}
