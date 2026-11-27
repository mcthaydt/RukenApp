import { systemClock } from "../../lib/clock.ts";
import { prisma } from "../../lib/server/db.ts";
import { optionalEnv } from "../../lib/server/env.ts";
import type { Caller } from "../accounts/accounts.ts";
import { gamesServices } from "../games/games.ts";
import { pagesServices } from "../pages/pages.ts";
import { playServices } from "../play/play.ts";
import { askingFor, readFeedPublic, type Asking, type FeedPublic } from "./feed-public.ts";
import type { Ranker } from "./ranker.ts";
import { createFeedService, type FeedService } from "./service.ts";
import { createTaste, type Taste } from "./taste.ts";

// Everything the feed needs, built once per server process. Routes call feedServices(); tests build their own service
// with createFeedService.

export interface FeedServices {
  service: FeedService;
  /** What a person tells the feed: Your feed's chips and switch, More or Less like this, Good pick. */
  taste: Taste;
  /** Who the ranker is told is asking, from who sent the request and FEED_PUBLIC. */
  askingOf(caller: Caller): Asking;
}

let shared: FeedServices | undefined;
let settings: FeedPublic | undefined;
/** The private ranker, when the host has one bound. Only src/hooks.server.ts sets it; in dev, CI and tests it is absent. */
let bound: () => Ranker | null = () => null;

/** Hands the feed the private ranker the host binds, read on each page so a binding is never cached as missing. */
export function setPrivateRanker(get: () => Ranker | null): void {
  bound = get;
}

/** The process-wide feed services, created on first use. Each neighbour is asked for only when the feed is read. */
export function feedServices(): FeedServices {
  shared ??= buildServices(createTaste({ db: prisma(), clock: systemClock }));
  return shared;
}

function buildServices(taste: Taste): FeedServices {
  return {
    taste,
    service: createFeedService({
      clock: systemClock,
      liveGames: () => gamesServices().service.liveGames(),
      memberBeatsByGame: (since, now) => playServices().service.memberBeatsByGame(since, now),
      makersOf: (userIds) => pagesServices().service.makersOf(userIds),
      media: (key) => gamesServices().media(key),
      privateRanker: () => bound(),
      asking: (userId, gameId) => taste.asking(userId, gameId),
    }),
    askingOf: (caller) => {
      settings ??= readFeedPublic(optionalEnv("FEED_PUBLIC"), (line) => {
        console.warn(line);
      });
      // The cookie yes, the age and a parent's yes are read with the learned feed, which is the first ranker that can use
      // them: until then everyone is the crowd, whatever FEED_PUBLIC says.
      return askingFor(settings, {
        userId: caller.kind === "user" ? caller.userId : null,
        consented: false,
        adult: false,
        parentSaidYes: false,
        learnFromMe: true,
      });
    },
  };
}
