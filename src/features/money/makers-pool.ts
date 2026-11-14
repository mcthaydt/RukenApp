import { lrr } from "./arithmetic.ts";
import { POOL_WEIGHT_SCALE } from "./rules.ts";

/** One member's month as the pool reads it. */
export interface MemberMonth {
  readonly userId: string;
  /**
   * The member's weight: the sum of the month's parts of their payments (every fee known so far taken off), each in
   * proportion to what was not refunded or disputed. A member who was handed everything back weighs nothing. The
   * refund also shrinks the pool itself (see `allocateMakersPool`).
   */
  readonly contribution: bigint;
  /** The maker who gets the bringing bonus for this member this month, or null. */
  readonly broughtBy: string | null;
  /** The month's seconds of play by game (the `PlayDay` rows, added up). A game listed twice is added up. */
  readonly plays: readonly { gameId: string; seconds: number }[];
}

/**
 * What sharing a pool decided.
 *
 * - `shared`: the pool goes to games, to bringers, and (when members paid and nobody played) partly on to next month.
 *   Games and bringers are listed in id order; a share that rounds to nothing stays in the list.
 * - `carry`: nothing can be shared, so `amount` moves on whole. It is the pool as it stood, so it can be zero (nothing
 *   to move) or negative (refunds took back more than came in).
 */
export type PoolOutcome =
  | {
      readonly kind: "shared";
      readonly games: readonly { gameId: string; weight: bigint; amount: bigint }[];
      readonly bringers: readonly { makerUserId: string; weight: bigint; members: number; amount: bigint }[];
      readonly carry: bigint;
    }
  | { readonly kind: "carry"; readonly amount: bigint };

/**
 * Shares the month's pool (`pool`, in cents) so that each member's money goes to the games that member played, with
 * the bringing bonus taken first. Weights are in billionths of a cent (`POOL_WEIGHT_SCALE`), so each part is rounded
 * down by less than a billionth of a cent and the only real rounding is the one `lrr` at the end:
 *
 * 1. A member who put nothing in is left out. For each other member, `whole = contribution × scale`. With a `broughtBy`
 *    the bonus is half of that, rounded down, and goes to that maker's weight; the rest is the member's play part.
 * 2. A member who played: their play part splits over their games by seconds. A member who did not: their play part
 *    joins the idle total, which follows everyone else's play.
 * 3. `carriedIn` (cents that an earlier month with no play carried into this pool, and part of `pool`) is added to the
 *    idle total too, so carried money is shared by play only and never feeds a bonus (Owner, 2026-11-14: "Only by
 *    play"). The idle total splits over every game by all paying members' seconds. With no seconds at all it becomes
 *    the weight of a carry.
 * 4. The pool as it stands is shared once by `lrr` over the games' weights, the bringers' weights and the carry. A pool
 *    of zero or less, or no weight but the carry's, carries on whole.
 *
 * The weights come from what members paid in, but the amount shared is the pool as it stands when the month is made
 * final, so a refund or chargeback that took money back out lowers every share in proportion.
 */
export function allocateMakersPool(
  pool: bigint,
  members: readonly MemberMonth[],
  carriedIn = 0n,
): PoolOutcome {
  requireRealInput(members, carriedIn);

  const gameWeights = new Map<string, bigint>();
  const bringerWeights = new Map<string, { weight: bigint; members: number }>();
  const allSecondsByGame = new Map<string, bigint>();
  let idleTotal = carriedIn * POOL_WEIGHT_SCALE;

  for (const member of members) {
    if (member.contribution === 0n) continue;
    const whole = member.contribution * POOL_WEIGHT_SCALE;
    let playPart = whole;
    if (member.broughtBy !== null) {
      const bonus = whole / 2n;
      playPart = whole - bonus;
      const bringer = bringerWeights.get(member.broughtBy) ?? { weight: 0n, members: 0 };
      bringerWeights.set(member.broughtBy, { weight: bringer.weight + bonus, members: bringer.members + 1 });
    }

    const secondsByGame = sumSecondsByGame(member.plays);
    const memberSeconds = sumValues(secondsByGame);
    if (memberSeconds === 0n) {
      idleTotal += playPart;
      continue;
    }
    for (const [gameId, seconds] of secondsByGame) {
      addTo(gameWeights, gameId, (playPart * seconds) / memberSeconds);
      addTo(allSecondsByGame, gameId, seconds);
    }
  }

  // The idle total follows what everyone else played; with no play at all it is the weight of a carry.
  const allSeconds = sumValues(allSecondsByGame);
  let carryWeight = 0n;
  if (allSeconds > 0n) {
    for (const [gameId, seconds] of allSecondsByGame)
      addTo(gameWeights, gameId, (idleTotal * seconds) / allSeconds);
  } else {
    carryWeight = idleTotal;
  }

  // Ties between equal remainders go to the lower key, so a bringer's `bring:` comes before the `carry`, and that before a `game:`.
  const items: { key: string; weight: bigint }[] = [];
  for (const [gameId, weight] of gameWeights) if (weight > 0n) items.push({ key: `game:${gameId}`, weight });
  const bringerIds = [...bringerWeights.keys()].sort();
  for (const makerUserId of bringerIds) {
    const weight = bringerWeights.get(makerUserId)?.weight ?? 0n;
    if (weight > 0n) items.push({ key: `bring:${makerUserId}`, weight });
  }
  if (pool <= 0n || items.length === 0) return { kind: "carry", amount: pool };
  if (carryWeight > 0n) items.push({ key: "carry", weight: carryWeight });

  const shares = lrr(pool, items);
  return {
    kind: "shared",
    games: [...gameWeights.keys()]
      .sort()
      .filter((gameId) => (gameWeights.get(gameId) ?? 0n) > 0n)
      .map((gameId) => ({
        gameId,
        weight: gameWeights.get(gameId) ?? 0n,
        amount: shares.get(`game:${gameId}`) ?? 0n,
      })),
    bringers: bringerIds
      .filter((makerUserId) => (bringerWeights.get(makerUserId)?.weight ?? 0n) > 0n)
      .map((makerUserId) => ({
        makerUserId,
        weight: bringerWeights.get(makerUserId)?.weight ?? 0n,
        members: bringerWeights.get(makerUserId)?.members ?? 0,
        amount: shares.get(`bring:${makerUserId}`) ?? 0n,
      })),
    carry: shares.get("carry") ?? 0n,
  };
}

function addTo(totals: Map<string, bigint>, key: string, amount: bigint): void {
  totals.set(key, (totals.get(key) ?? 0n) + amount);
}

/** A member's seconds by game, with repeated games added up and zero-second games dropped. */
function sumSecondsByGame(plays: MemberMonth["plays"]): Map<string, bigint> {
  const secondsByGame = new Map<string, bigint>();
  for (const { gameId, seconds } of plays) {
    if (seconds === 0) continue;
    addTo(secondsByGame, gameId, BigInt(seconds));
  }
  return secondsByGame;
}

function sumValues(values: ReadonlyMap<string, bigint>): bigint {
  let total = 0n;
  for (const value of values.values()) total += value;
  return total;
}

/**
 * The rows come from the ledger and the daily play rollup, so none of these can happen on real data. If one does,
 * something upstream is broken, and sharing money on it would hide the fault.
 */
function requireRealInput(members: readonly MemberMonth[], carriedIn: bigint): void {
  if (carriedIn < 0n) throw new RangeError("Money carried in can't be negative");
  const seen = new Set<string>();
  for (const { userId, contribution, plays } of members) {
    if (seen.has(userId)) throw new RangeError(`Member "${userId}" appears twice`);
    seen.add(userId);
    if (contribution < 0n) throw new RangeError(`Member "${userId}" has a negative contribution`);
    for (const { gameId, seconds } of plays) {
      if (!Number.isSafeInteger(seconds) || seconds < 0) {
        throw new RangeError(`Member "${userId}" has ${String(seconds)} seconds on game "${gameId}"`);
      }
    }
  }
}
