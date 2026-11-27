import { systemClock } from "../../lib/clock.ts";
import { prisma } from "../../lib/server/db.ts";
import { optionalEnv } from "../../lib/server/env.ts";
import type { Caller } from "../accounts/accounts.ts";
import { gamesServices } from "../games/games.ts";
import { pagesServices } from "../pages/pages.ts";
import { playServices } from "../play/play.ts";
import { askingFor, readFeedPublic, type Asking, type FeedPublic } from "./feed-public.ts";
import { createMarks, type Marks } from "./marks.ts";
import type { Ranker } from "./ranker.ts";
import { createSearch, type Search } from "./search.ts";
import { createFeedService, type FeedService } from "./service.ts";

// Everything the feed needs, built once per server process. Routes call feedServices(); tests build their own service
// with createFeedService.

export interface FeedServices {
  service: FeedService;
  /** Like, Save and Repost. */
  marks: Marks;
  /** The live games a person saved (or reposted), the latest first, as Saved and Your reposts list them. */
  listOf(userId: string, kind: "save" | "repost"): Promise<MarkedGame[]>;
  /** Search from the feed's top bar: live games and their makers. */
  search: Search;
  /** Who the ranker is told is asking, from who sent the request and FEED_PUBLIC. */
  askingOf(caller: Caller): Asking;
  /** The signed-in person a page is for, so it can mark the makers they follow and what they pressed; null for anyone else. */
  viewerOf(caller: Caller): string | null;
}

/** A game on Saved or Your reposts. */
export interface MarkedGame {
  slug: string;
  name: string;
  oneLine: string;
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
  if (shared !== undefined) return shared;
  const marks = createMarks({ db: prisma(), clock: systemClock });
  shared = {
    marks,
    async listOf(userId, kind) {
      const [ids, live] = await Promise.all([
        marks.gameIdsOf(userId, kind),
        gamesServices().service.liveGames(),
      ]);
      const byId = new Map(live.map((game) => [game.id, game]));
      // A game that is no longer live is left off the list; its row stays until the person or the account goes.
      return ids.flatMap((id) => {
        const game = byId.get(id);
        return game === undefined ? [] : [{ slug: game.slug, name: game.name, oneLine: game.oneLine }];
      });
    },
    service: createFeedService({
      clock: systemClock,
      liveGames: () => gamesServices().service.liveGames(),
      memberBeatsByGame: (since, now) => playServices().service.memberBeatsByGame(since, now),
      makersOf: (userIds) => pagesServices().service.makersOf(userIds),
      followedAmong: (followerId, makerIds) => pagesServices().follows.followedAmong(followerId, makerIds),
      media: (key) => gamesServices().media(key),
      marksOf: (viewerId, games) => marks.ofClips(viewerId, games),
      privateRanker: () => bound(),
    }),
    search: createSearch({
      liveGames: () => gamesServices().service.liveGames(),
      makersOf: (userIds) => pagesServices().service.makersOf(userIds),
      media: (key) => gamesServices().media(key),
    }),
    viewerOf: (caller) => (caller.kind === "user" ? caller.userId : null),
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
      });
    },
  };
  return shared;
}
