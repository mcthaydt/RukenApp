import { chicagoDayOf, type Clock } from "../../lib/clock.ts";
import type { ListedGame } from "../games/games.ts";
import { seededNumber } from "../../lib/random.ts";
import { feedOrder } from "./order.ts";

// What the feed shows, in order. It is built from what it needs (the neighbours as plain functions) so a test hands it
// stand-ins and no database.

/** The most clips one page of the feed answers. */
export const FEED_MAX = 50;
/**
 * The fewest clips a later page answers. With only a few games live a round is short, so a page takes several rounds;
 * otherwise the screen would ask again after every few clips.
 */
export const MORE_AT_LEAST = 10;
/** The address of a later page: the Chicago day the feed was opened, the round, and where in it. */
const NEXT = /^(\d{4}-\d{2}-\d{2})~(\d{1,6})~(\d{1,6})$/;
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

/**
 * One game's clip as the feed screen needs it: whole addresses, and who made it when they have a page. `key` is its own
 * in the whole feed, because the feed goes round and shows a game again.
 */
export interface FeedClip {
  key: string;
  slug: string;
  name: string;
  oneLine: string;
  upright: string;
  wide: string;
  maker: { handle: string; name: string; photo: string | null } | null;
}

/** A page of the feed, and the address of the one after it (null only when no game is live). */
export interface FeedPage {
  clips: FeedClip[];
  next: string | null;
}

/**
 * The order of one round. Round 0 is the feed's order. The feed never ends, so when every game has been shown it goes
 * round again in a new shuffle drawn from the day and the round, with the game that ended the round before never first.
 * One or two games keep round 0's order, which already never repeats a game back to back.
 */
function roundOrder<Game extends { id: string }>(first: readonly Game[], day: string, round: number): Game[] {
  if (round === 0 || first.length <= 2) return [...first];
  const shuffled = (which: number): Game[] =>
    [...first].sort(
      (one, other) =>
        seededNumber(`${day}~${String(which)}`, one.id) - seededNumber(`${day}~${String(which)}`, other.id) ||
        (one.id < other.id ? -1 : one.id > other.id ? 1 : 0),
    );
  const order = shuffled(round);
  // With three or more games the swap below never moves a round's last game, so the round before's last is its shuffle's.
  const before = round === 1 ? first.at(-1) : shuffled(round - 1).at(-1);
  if (order[0]?.id === before?.id) [order[0], order[1]] = [order[1] as Game, order[0] as Game];
  return order;
}

export function createFeedService(deps: FeedServiceDeps) {
  /**
   * A page of the feed: with `after` null, the first, which is the feed's order up to `FEED_MAX`; otherwise the page at
   * that address, or null for an address the feed did not make. A game rated 18+ is left out: the rules for who may see
   * one are not built, and a clip that plays by itself in front of anyone must not be one.
   */
  async function page(after: null): Promise<FeedPage>;
  async function page(after: string): Promise<FeedPage | null>;
  async function page(after: string | null): Promise<FeedPage | null> {
    let day: string;
    let round = 0;
    let offset = 0;
    const nowMs = deps.clock.epochMs();
    if (after === null) {
      // The day's seed is a Chicago day, so two opens on one day see one order.
      day = chicagoDayOf(nowMs);
    } else {
      const found = NEXT.exec(after);
      if (found === null) return null;
      // A page goes on in the order of the day the feed was opened, so it does not change order at midnight.
      day = found[1] as string;
      round = Number(found[2]);
      offset = Number(found[3]);
    }

    const games = (await deps.liveGames()).filter((game) => game.ageRating !== "age_18");
    if (games.length === 0) return { clips: [], next: null };

    const since = new Date(nowMs - PLAYED_DAYS * 24 * 60 * 60 * 1000);
    const beats = await deps.memberBeatsByGame(since, new Date(nowMs));
    const first = feedOrder(
      games.map((game) => ({ game, id: game.id, liveSince: game.liveSince, beats: beats.get(game.id) ?? 0 })),
      nowMs,
      day,
    ).map((entry) => entry.game);

    // The first page is round 0 alone, so it never shows a game twice. A later page goes on through rounds until it has
    // at least MORE_AT_LEAST clips, and never more than FEED_MAX.
    const want = after === null ? 1 : MORE_AT_LEAST;
    const picked: { key: string; game: (typeof first)[number] }[] = [];
    let order = roundOrder(first, day, round);
    for (;;) {
      if (offset >= order.length) {
        // The round is over (or fewer games are live than when the address was made): the next one starts.
        round += 1;
        offset = 0;
        order = roundOrder(first, day, round);
        if (picked.length >= want) break;
      }
      const game = order[offset] as (typeof first)[number];
      picked.push({ key: `${String(round)}~${game.slug}`, game });
      offset += 1;
      if (picked.length >= FEED_MAX) break;
      if (after === null && offset >= order.length) {
        round += 1;
        offset = 0;
        break;
      }
    }

    const makers = await deps.makersOf([...new Set(picked.map(({ game }) => game.makerUserId))]);
    return {
      next: `${day}~${String(round)}~${String(offset)}`,
      clips: picked.map(({ key, game }) => {
        const maker = makers.get(game.makerUserId);
        return {
          key,
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
      }),
    };
  }

  return { page };
}

export type FeedService = ReturnType<typeof createFeedService>;
