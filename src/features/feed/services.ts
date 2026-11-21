import { systemClock } from "../../lib/clock.ts";
import { gamesServices } from "../games/games.ts";
import { pagesServices } from "../pages/pages.ts";
import { playServices } from "../play/play.ts";
import { createFeedService, type FeedService } from "./service.ts";

// Everything the feed needs, built once per server process. Routes call feedServices(); tests build their own service
// with createFeedService.

export interface FeedServices {
  service: FeedService;
}

let shared: FeedServices | undefined;

/** The process-wide feed services, created on first use. Each neighbour is asked for only when the feed is read. */
export function feedServices(): FeedServices {
  shared ??= {
    service: createFeedService({
      clock: systemClock,
      liveGames: () => gamesServices().service.liveGames(),
      memberBeatsByGame: (since, now) => playServices().service.memberBeatsByGame(since, now),
      makersOf: (userIds) => pagesServices().service.makersOf(userIds),
      media: (key) => gamesServices().media(key),
    }),
  };
  return shared;
}
