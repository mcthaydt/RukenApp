import { chicagoDayOf } from "../../lib/clock.ts";
import { seededNumber } from "../../lib/random.ts";
import { FEED_MAX, type FeedGame, type RankedPage, type Ranker, type RankRequest } from "./ranker.ts";

// The open ranker: the feed's simple order, in public, for anyone who runs the app without the private one, and for
// everyone whenever the private one does not answer. The "How the feed works" help page describes
// this order in plain words.
//
// Round 0 is the simple order: games that went live under a week ago first, newest first; then every other game, most
// played first. Ties go by a number drawn from the day's seed, so they change places from day to day but never between
// two opens on one day, then by id. The feed never ends: after round 0 it goes round again in a new shuffle each round.

export const NEW_GAME_DAYS = 7;
const NEW_GAME_MS = NEW_GAME_DAYS * 24 * 60 * 60 * 1000;
/**
 * The fewest clips a later page answers. With only a few games live a round is short, so a page takes several rounds;
 * otherwise the screen would ask again after every few clips.
 */
export const MORE_AT_LEAST = 10;
/**
 * The address of a later page: the Chicago day the feed was opened, the round, where in it, whether that round's first
 * two games changed places (1) or not (0), and the game the page before ended on.
 */
const NEXT = /^(\d{4}-\d{2}-\d{2})~(\d{1,6})~(\d{1,6})~([01])~([a-z0-9-]{1,100})$/;

/** What the order needs to know about a game: when it went live and how much it was played lately. */
export interface Orderable {
  id: string;
  liveSince: Date;
  /** Attentive beats from members over the last week. */
  beats: number;
}

export function feedOrder<Game extends Orderable>(
  games: readonly Game[],
  nowMs: number,
  seed: string,
): Game[] {
  const isNew = (game: Game) => nowMs - game.liveSince.getTime() < NEW_GAME_MS;
  const tieBreak = (one: Game, other: Game) =>
    seededNumber(seed, one.id) - seededNumber(seed, other.id) ||
    (one.id < other.id ? -1 : one.id > other.id ? 1 : 0);

  const fresh = games
    .filter(isNew)
    .sort((one, other) => other.liveSince.getTime() - one.liveSince.getTime() || tieBreak(one, other));
  const rest = games
    .filter((game) => !isNew(game))
    .sort((one, other) => other.beats - one.beats || tieBreak(one, other));
  return [...fresh, ...rest];
}

/**
 * The order of one round. Round 0 is the feed's order. Every later round is a shuffle drawn from the day, the round and
 * the games alone, so it is the same on every request. `swapped` puts its first two games the other way round: a round
 * whose first game is the one the person just saw starts with the second instead, and the address remembers that for
 * the rest of the round.
 */
function roundOrder<Game extends { id: string }>(
  first: readonly Game[],
  day: string,
  round: number,
  swapped: boolean,
): Game[] {
  if (round === 0) return [...first];
  const seed = `${day}~${String(round)}`;
  const order = [...first].sort(
    (one, other) =>
      seededNumber(seed, one.id) - seededNumber(seed, other.id) ||
      (one.id < other.id ? -1 : one.id > other.id ? 1 : 0),
  );
  if (swapped && order.length >= 2) [order[0], order[1]] = [order[1] as Game, order[0] as Game];
  return order;
}

/**
 * A page: with `after` null, the first, which is round 0 up to `FEED_MAX`; otherwise the page at that address, or
 * "bad-cursor" for an address this ranker did not make.
 */
function openPage(request: RankRequest): RankedPage | "bad-cursor" {
  const { after, asOf: nowMs, facts } = request;
  let day: string;
  let round = 0;
  let offset = 0;
  let swapped = false;
  // The game the person saw last, so the next one is never the same game.
  let last: string | null = null;
  if (after === null) {
    // The day's seed is a Chicago day, so two opens on one day see one order.
    day = chicagoDayOf(nowMs);
  } else {
    const found = NEXT.exec(after);
    if (found === null) return "bad-cursor";
    // A page goes on in the order of the day the feed was opened, so it does not change order at midnight.
    day = found[1] as string;
    round = Number(found[2]);
    offset = Number(found[3]);
    swapped = found[4] === "1";
    last = found[5] as string;
  }

  if (facts.games.length === 0) return { items: [], next: null, caughtUpAt: null, ask: null };

  const first = feedOrder(
    facts.games.map((game) => ({
      game,
      id: game.id,
      liveSince: new Date(game.liveSince),
      beats: facts.memberBeats[game.id] ?? 0,
    })),
    nowMs,
    day,
  ).map((entry) => entry.game);

  // The first page is round 0 alone, so it never shows a game twice. A later page goes on through rounds until it has
  // at least MORE_AT_LEAST clips, and never more than FEED_MAX.
  const want = after === null ? 1 : MORE_AT_LEAST;
  const picked: { key: string; game: FeedGame }[] = [];
  let order = roundOrder(first, day, round, swapped);
  // A round starts: if its first game is the one just seen, its first two change places.
  const startRound = () => {
    swapped = order.length >= 2 && order[0]?.slug === last;
    if (swapped) order = roundOrder(first, day, round, true);
  };
  for (;;) {
    if (offset >= order.length) {
      // The round is over (or fewer games are live than when the address was made): the next one starts.
      round += 1;
      offset = 0;
      order = roundOrder(first, day, round, false);
      if (picked.length >= want) break;
      startRound();
    }
    // Round 0 is put in order again on each request, from plays that may have moved since the page before: a game
    // that moved up to where the page goes on may be the one just seen, and it is passed over rather than shown twice.
    if (round === 0 && offset > 0 && order.length >= 2 && order[offset]?.slug === last) {
      offset += 1;
      continue;
    }
    const game = order[offset] as FeedGame;
    picked.push({ key: `${String(round)}~${game.slug}`, game });
    last = game.slug;
    offset += 1;
    if (picked.length >= FEED_MAX) break;
    if (after === null && offset >= order.length) {
      round += 1;
      offset = 0;
      order = roundOrder(first, day, round, false);
      break;
    }
  }
  // A page that ends where a round starts decides that round's first game now, against the game it ended on.
  if (offset === 0) startRound();

  return {
    items: picked.map(({ key, game }) => ({ gameId: game.id, slot: 0, key })),
    next: `${day}~${String(round)}~${String(offset)}~${swapped ? "1" : "0"}~${last ?? ""}`,
    caughtUpAt: null,
    ask: null,
  };
}

/** The open ranker. It has no notes for makers and no settings: its health is always "defaults". */
export const openRanker: Ranker = {
  page: (request) => Promise.resolve(openPage(request)),
  notes: (request) => Promise.resolve(Object.fromEntries(request.gameIds.map((id) => [id, null]))),
  health: () => Promise.resolve("defaults"),
};
