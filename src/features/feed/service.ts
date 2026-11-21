import { chicagoDayOf, type Clock } from "../../lib/clock.ts";
import type { ListedGame } from "../games/games.ts";
import { feedOrder } from "./order.ts";

// What the feed shows, in order. It is built from what it needs (the neighbours as plain functions) so a test hands it
// stand-ins and no database.

/** The most clips the feed answers. */
export const FEED_MAX = 50;
/** How far back a game's plays count towards its place in the feed. */
const PLAYED_DAYS = 7;

export interface FeedServiceDeps {
  clock: Clock;
  liveGames(): Promise<ListedGame[]>;
  memberBeatsByGame(since: Date, now: Date): Promise<Map<string, number>>;
  makersOf(
    userIds: readonly string[],
  ): Promise<Map<string, { handle: string; name: string; photoKey: string | null }>>;
  /** The whole address of a file in the bucket, from its key. */
  media(key: string): string;
}

/** One game's clip as the feed screen needs it: whole addresses, and who made it when they have a page. */
export interface FeedClip {
  slug: string;
  name: string;
  oneLine: string;
  upright: string;
  wide: string;
  maker: { handle: string; name: string; photo: string | null } | null;
}

export function createFeedService(deps: FeedServiceDeps) {
  /**
   * The clips, in order, at most `FEED_MAX`. A game rated 18+ is left out: the rules for who may see one are not built,
   * and a clip that plays by itself in front of anyone must not be one.
   */
  async function feed(): Promise<FeedClip[]> {
    const nowMs = deps.clock.epochMs();
    const games = (await deps.liveGames()).filter((game) => game.ageRating !== "age_18");
    if (games.length === 0) return [];

    const since = new Date(nowMs - PLAYED_DAYS * 24 * 60 * 60 * 1000);
    const beats = await deps.memberBeatsByGame(since, new Date(nowMs));
    // The day's seed is a Chicago day, so two opens on one day see one order.
    const ordered = feedOrder(
      games.map((game) => ({ game, id: game.id, liveSince: game.liveSince, beats: beats.get(game.id) ?? 0 })),
      nowMs,
      chicagoDayOf(nowMs),
    )
      .slice(0, FEED_MAX)
      .map((entry) => entry.game);

    const makers = await deps.makersOf(ordered.map((game) => game.makerUserId));
    return ordered.map((game) => {
      const maker = makers.get(game.makerUserId);
      return {
        slug: game.slug,
        name: game.name,
        oneLine: game.oneLine,
        upright: deps.media(game.clips.upright),
        wide: deps.media(game.clips.wide),
        maker:
          maker === undefined
            ? null
            : {
                handle: maker.handle,
                name: maker.name,
                photo: maker.photoKey === null ? null : deps.media(maker.photoKey),
              },
      };
    });
  }

  return { feed };
}

export type FeedService = ReturnType<typeof createFeedService>;
