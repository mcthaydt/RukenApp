import { seededNumber } from "../../lib/random.ts";

/**
 * The feed's simple order (main design 5.1), until the learned feed replaces this one function: games that went live
 * under a week ago first, newest first; then every other game, most played first. Ties go by a number drawn from the
 * day's seed, so they change places from day to day but never between two opens on one day, then by id.
 */

export const NEW_GAME_DAYS = 7;
const NEW_GAME_MS = NEW_GAME_DAYS * 24 * 60 * 60 * 1000;

/** What the order needs to know about a game: when it went live and how much it was played lately. */
export interface Orderable {
  id: string;
  liveSince: Date;
  /** Attentive beats from members over the last week (`memberBeatsByGame`). */
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
