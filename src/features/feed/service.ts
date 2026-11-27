import { chicagoDayOf, type Clock } from "../../lib/clock.ts";
import type { ListedGame } from "../games/games.ts";
import { CROWD, type Asking } from "./feed-public.ts";
import type { ClipMarks, FriendLikes } from "./marks.ts";
import { openRanker } from "./public-ranker.ts";
import {
  isRankedPageOrBadCursor,
  type FeedFacts,
  type RankedPage,
  type Ranker,
  type RankRequest,
  type Viewer,
} from "./ranker.ts";

export { FEED_MAX } from "./ranker.ts";
export { MORE_AT_LEAST } from "./public-ranker.ts";

// What the feed shows, in order. The order comes from a ranker (ranker.ts); this file reads what a ranker may see,
// picks the ranker, and turns its answer into clips. It is built from what it needs (the neighbours as plain functions)
// so a test hands it stand-ins and no database.

/** How far back a game's plays are read for the ranker. */
const PLAYED_DAYS = 7;
/** How long the private ranker has to answer before the open one answers instead. */
export const PRIVATE_WAIT_MS = 800;
/**
 * Every address the feed hands out says which ranker made it: `p.` the private one, `o.` the open one. A ranker is only
 * ever given back its own addresses.
 */
const PRIVATE_PREFIX = "p.";
const OPEN_PREFIX = "o.";

export interface FeedServiceDeps {
  clock: Clock;
  liveGames(): Promise<ListedGame[]>;
  memberBeatsByGame(since: Date, now: Date): Promise<Map<string, number>>;
  makersOf(
    userIds: readonly string[],
  ): Promise<Map<string, { handle: string; name: string; photoKey: string | null }>>;
  /** Which of these makers' accounts a person follows; left out, nobody follows anyone. */
  followedAmong?(followerId: string, makerIds: readonly string[]): Promise<Set<string>>;
  /** Every maker account a person follows, newest follow first; left out, nobody follows anyone. */
  followedMakerIds?(followerId: string): Promise<string[]>;
  /** The whole address of a file in the bucket, from its key. */
  media(key: string): string;
  /** What each game's clip shows of likes, saves and reposts for this viewer (null when signed out); left out, none. */
  marksOf?(
    viewerId: string | null,
    games: readonly { id: string; makerUserId: string }[],
  ): Promise<Map<string, ClipMarks>>;
  /** The viewer's friends who liked each of these games (none when signed out); left out, nobody. */
  friendLikesOf?(viewerId: string | null, gameIds: readonly string[]): Promise<Map<string, FriendLikes>>;
  /** The private ranker, when this app has one bound; left out or null, the open ranker answers every page. */
  privateRanker?: () => Ranker | null;
  /** The open ranker; left out, the feed's own (public-ranker.ts). */
  openRanker?: Ranker;
  /**
   * Notes that a person is being asked "Good pick?" about a game; false when they were asked before, and the card is
   * then left out. Left out, nobody is asked.
   */
  asking?: (userId: string, gameId: string) => Promise<boolean>;
  /** Where a line goes when the private ranker did not answer; left out, the Worker's log. */
  log?: (line: string) => void;
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
  /**
   * `following` and `mine` are about the person the page was made for: whether they follow this maker, and whether the
   * game is their own (they cannot follow themselves). Both are false for someone signed out.
   */
  maker: { handle: string; name: string; photo: string | null; following: boolean; mine: boolean } | null;
  /** The like count and what the viewer pressed. */
  marks: ClipMarks;
  /** The viewer's friends who liked the game: up to three faces, newest like first, and how many more. */
  friends: { faces: { name: string; photo: string | null }[]; more: number };
}

/**
 * A page of the feed, and the address of the one after it (null only when no game is live). `caughtUpAt` is there only
 * when the ranker gave it. `ask` is the Good pick card: shown on the clip `key`, about the game `slug`; only a person the
 * feed learns from is asked, and only once about a game.
 */
export interface FeedPage {
  clips: FeedClip[];
  next: string | null;
  caughtUpAt?: number;
  ask?: { key: string; slug: string; name: string };
}

/** A clip's marks when none were read for it. */
const NO_MARKS: ClipMarks = { likes: 0, liked: false, saved: false, reposted: false };
/** A clip no friend of the viewer liked. */
const NO_FRIENDS: FriendLikes = { faces: [], more: 0 };

/** Which ranker answers the feed, and what it says of its own settings. */
export interface FeedHealth {
  ranker: "private" | "open";
  health: "private" | "partial" | "defaults";
}

const isHealth = (value: unknown): value is FeedHealth["health"] =>
  value === "private" || value === "partial" || value === "defaults";

/** Why the private ranker's answer was not used. Never the viewer or anything they did. */
type Miss = "threw" | "slow" | "bad answer";

export function createFeedService(deps: FeedServiceDeps) {
  const open = deps.openRanker ?? openRanker;
  const privateRanker = deps.privateRanker ?? (() => null);
  const log =
    deps.log ??
    ((line: string) => {
      console.warn(line);
    });

  /** What a call to the private ranker answered within PRIVATE_WAIT_MS, or why it did not. */
  async function within(call: () => Promise<unknown>): Promise<{ answer: unknown } | "slow" | "threw"> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const slow = new Promise<"slow">((resolve) => {
      timer = setTimeout(() => {
        resolve("slow");
      }, PRIVATE_WAIT_MS);
    });
    try {
      return await Promise.race([call().then((answer) => ({ answer })), slow]);
    } catch {
      return "threw";
    } finally {
      clearTimeout(timer);
    }
  }

  /** The private ranker's page, or why there is none. Its answer is checked before anything is built from it. */
  async function askPrivate(ranker: Ranker, request: RankRequest): Promise<RankedPage | "bad-cursor" | Miss> {
    const result = await within(() => ranker.page(request));
    if (result === "slow" || result === "threw") return result;
    return isRankedPageOrBadCursor(result.answer) ? result.answer : "bad answer";
  }

  /**
   * Which ranker the feed is using now, and what that ranker says of its own settings: what /healthz/feed answers, so a
   * check on the live site can see the private ranker answering, or the open order standing in for it.
   */
  async function health(): Promise<FeedHealth> {
    const bound = privateRanker();
    if (bound !== null) {
      const result = await within(() => bound.health());
      if (result !== "slow" && result !== "threw" && isHealth(result.answer))
        return { ranker: "private", health: result.answer };
      log(
        `feed: the private ranker did not answer its health (${result === "slow" || result === "threw" ? result : "bad answer"}).`,
      );
    }
    return { ranker: "open", health: await open.health() };
  }

  /**
   * A page of the feed: with `after` null, the first; otherwise the page at that address, or null for an address the
   * feed did not make. An address made by a ranker that is not answering now gives a fresh first page. A game rated 18+
   * is left out: the rules for who may see one are not built, and a clip that plays by itself in front of anyone must
   * not be one. `viewerId` is the signed-in person the page is for, whatever the ranker is told: it only marks which
   * makers they follow.
   */
  async function page(after: null, asking?: Asking, viewerId?: string | null): Promise<FeedPage>;
  async function page(after: string, asking?: Asking, viewerId?: string | null): Promise<FeedPage | null>;
  async function page(
    after: string | null,
    asking: Asking = CROWD,
    viewerId: string | null = null,
  ): Promise<FeedPage | null> {
    let cursor: { made: "private" | "open"; rest: string } | null = null;
    if (after !== null) {
      if (after.startsWith(PRIVATE_PREFIX))
        cursor = { made: "private", rest: after.slice(PRIVATE_PREFIX.length) };
      else if (after.startsWith(OPEN_PREFIX))
        cursor = { made: "open", rest: after.slice(OPEN_PREFIX.length) };
      else return null;
    }

    const nowMs = deps.clock.epochMs();
    const games = (await deps.liveGames()).filter((game) => game.ageRating !== "age_18");

    const since = nowMs - PLAYED_DAYS * 24 * 60 * 60 * 1000;
    const beats = await deps.memberBeatsByGame(new Date(since), new Date(nowMs));
    const facts: FeedFacts = {
      games: games.map((game) => ({
        id: game.id,
        slug: game.slug,
        makerId: game.makerUserId,
        liveSince: game.liveSince.getTime(),
        ageRating: game.ageRating,
        slots: 1,
      })),
      memberBeats: Object.fromEntries(beats),
      memberBeatsSince: since,
    };
    const seed = chicagoDayOf(nowMs);
    const viewer: Viewer =
      asking.kind === "crowd" ? { kind: "crowd", seed } : { kind: "full", seed, id: asking.id };
    const request = (from: string | null): RankRequest => ({ v: 1, viewer, after: from, asOf: nowMs, facts });

    let ranked: RankedPage | "bad-cursor";
    let prefix: string;
    const bound = privateRanker();
    if (bound === null) {
      // No private ranker here: a private address is from before, and starts the feed again.
      ranked = await open.page(request(cursor?.made === "open" ? cursor.rest : null));
      prefix = OPEN_PREFIX;
    } else {
      // An open address is from while the private ranker was not answering: it starts the private feed again.
      const answer = await askPrivate(bound, request(cursor?.made === "private" ? cursor.rest : null));
      if (answer === "slow" || answer === "threw" || answer === "bad answer") {
        log(`feed: the private ranker did not answer (${answer}); the open order was used.`);
        // An open address goes on in the open order, so a lasting outage still scrolls; a private one starts it fresh.
        ranked = await open.page(request(cursor?.made === "open" ? cursor.rest : null));
        prefix = OPEN_PREFIX;
      } else {
        ranked = answer;
        prefix = PRIVATE_PREFIX;
      }
    }
    if (ranked === "bad-cursor") return null;

    // A ranker may name a game that is no longer live (or one this viewer may not see): it is left out.
    const byId = new Map(games.map((game) => [game.id, game]));
    const shown = ranked.items.flatMap((item) => {
      const game = byId.get(item.gameId);
      return game === undefined ? [] : [{ key: item.key, game }];
    });
    const shownGames = [...new Map(shown.map(({ game }) => [game.id, game])).values()];
    const makerIds = [...new Set(shownGames.map((game) => game.makerUserId))];
    const [makers, marks, friends] = await Promise.all([
      shown.length === 0
        ? new Map<string, { handle: string; name: string; photoKey: string | null }>()
        : deps.makersOf(makerIds),
      deps.marksOf?.(viewerId, shownGames) ?? new Map<string, ClipMarks>(),
      friendLikesOf(viewerId, shownGames),
    ]);
    const followed =
      viewerId === null || deps.followedAmong === undefined || makers.size === 0
        ? new Set<string>()
        : await deps.followedAmong(viewerId, [...makers.keys()]);
    const result: FeedPage = {
      next: ranked.next === null ? null : `${prefix}${ranked.next}`,
      clips: shown.map(({ key, game }) =>
        clipOf(
          key,
          game,
          makers.get(game.makerUserId),
          followed.has(game.makerUserId),
          viewerId,
          marks,
          friends,
        ),
      ),
    };
    if (ranked.caughtUpAt !== null) result.caughtUpAt = ranked.caughtUpAt;
    const ask = ranked.ask;
    if (ask !== null && asking.kind === "full" && deps.asking !== undefined) {
      const asked = byId.get(ask.gameId);
      const at = ranked.items[ask.index]?.key;
      if (asked !== undefined && at !== undefined && shown.some((one) => one.key === at)) {
        if (await deps.asking(asking.id, asked.id))
          result.ask = { key: at, slug: asked.slug, name: asked.name };
      }
    }
    return result;
  }

  /**
   * The Followed tab: every live game by the makers a person follows, the maker they followed last first and each
   * maker's newest game first, all on one page (a person follows a few makers, not the whole of Ruken), so it ends.
   * `following` is how many makers they follow (0 says so on the screen), so the screen can say so; no game of theirs live is an empty page.
   */
  async function followedPage(viewerId: string): Promise<{ following: number; page: FeedPage }> {
    const makerIds = deps.followedMakerIds === undefined ? [] : await deps.followedMakerIds(viewerId);
    if (makerIds.length === 0) return { following: 0, page: { clips: [], next: null } };
    const order = new Map(makerIds.map((id, index) => [id, index]));
    const games = (await deps.liveGames())
      .filter((game) => game.ageRating !== "age_18" && order.has(game.makerUserId))
      .sort(
        (a, b) =>
          (order.get(a.makerUserId) ?? 0) - (order.get(b.makerUserId) ?? 0) ||
          b.liveSince.getTime() - a.liveSince.getTime() ||
          a.slug.localeCompare(b.slug, "en"),
      );
    const [makers, marks, friends] =
      games.length === 0
        ? [
            new Map<string, { handle: string; name: string; photoKey: string | null }>(),
            new Map<string, ClipMarks>(),
            new Map<string, FriendLikes>(),
          ]
        : await Promise.all([
            deps.makersOf([...new Set(games.map((game) => game.makerUserId))]),
            deps.marksOf?.(viewerId, games) ?? new Map<string, ClipMarks>(),
            friendLikesOf(viewerId, games),
          ]);
    return {
      following: makerIds.length,
      page: {
        next: null,
        clips: games.map((game) =>
          clipOf(
            `followed-${game.publicId}`,
            game,
            makers.get(game.makerUserId),
            true,
            viewerId,
            marks,
            friends,
          ),
        ),
      },
    };
  }

  function clipOf(
    key: string,
    game: ListedGame,
    maker: { handle: string; name: string; photoKey: string | null } | undefined,
    following: boolean,
    viewerId: string | null,
    marks: ReadonlyMap<string, ClipMarks>,
    friends: ReadonlyMap<string, FriendLikes>,
  ): FeedClip {
    const liked = friends.get(game.id) ?? NO_FRIENDS;
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
              following,
              mine: game.makerUserId === viewerId,
            },
      marks: marks.get(game.id) ?? NO_MARKS,
      friends: {
        faces: liked.faces.map((face) => ({
          name: face.name,
          photo: face.photoKey === null ? null : deps.media(face.photoKey),
        })),
        more: liked.more,
      },
    };
  }

  /** The friends who liked these games, or nobody when signed out, nothing was shown, or no reader was given. */
  async function friendLikesOf(
    viewerId: string | null,
    games: readonly { id: string }[],
  ): Promise<Map<string, FriendLikes>> {
    if (viewerId === null || games.length === 0 || deps.friendLikesOf === undefined) return new Map();
    return deps.friendLikesOf(
      viewerId,
      games.map((game) => game.id),
    );
  }

  return { page, followedPage, health };
}

export type FeedService = ReturnType<typeof createFeedService>;
