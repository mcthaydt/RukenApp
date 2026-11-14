import type { PoolOutcome } from "./makers-pool.ts";
import { addMonths, type Period } from "./period.ts";
import type { PostingLine } from "./posting.ts";

/** One journal entry the sharing of a pool makes: its idempotency key, its kind, the game it pays for, and its lines. */
export interface PoolEntry {
  readonly key: string;
  readonly kind: "pool_share" | "pool_carry";
  /** The game a share pays for; null for a bringing bonus and for a carry. */
  readonly gameId: string | null;
  readonly lines: readonly PostingLine[];
}

/** A pool's share, paid out of the month's pool to a maker. */
function shareLines(period: Period, makerUserId: string, amount: bigint): PostingLine[] {
  return [
    { account: `pool:premium:${period}`, amount },
    { account: `maker:${makerUserId}:payable`, amount: -amount, makerUserId },
  ];
}

/**
 * Every entry that shares a month's pool out: one per game with a share above zero, paying that game's maker (key
 * `pool:<period>:game:<gameId>`); one per bringer with a share above zero (key `pool:<period>:bring:<makerUserId>`, no
 * game); and one carry entry when part of the pool moves on to next month. `makerOf` says whose game each is; a game
 * missing from it is a bug in the caller, so it throws rather than leave that game's money in the pool.
 *
 * The keys make posting the same run twice impossible.
 */
export function postPoolShares(
  period: Period,
  outcome: Extract<PoolOutcome, { kind: "shared" }>,
  makerOf: ReadonlyMap<string, string>,
): PoolEntry[] {
  const entries: PoolEntry[] = [];
  for (const { gameId, amount } of outcome.games) {
    if (amount === 0n) continue;
    const makerUserId = makerOf.get(gameId);
    if (makerUserId === undefined) throw new RangeError(`No maker given for game "${gameId}"`);
    entries.push({
      key: `pool:${period}:game:${gameId}`,
      kind: "pool_share",
      gameId,
      lines: shareLines(period, makerUserId, amount),
    });
  }
  for (const { makerUserId, amount } of outcome.bringers) {
    if (amount === 0n) continue;
    entries.push({
      key: `pool:${period}:bring:${makerUserId}`,
      kind: "pool_share",
      gameId: null,
      lines: shareLines(period, makerUserId, amount),
    });
  }
  entries.push(...postPoolCarry(period, outcome.carry));
  return entries;
}

/**
 * What moves from `period`'s pool into the next month's pool, in one entry; nothing for zero. The month is made final
 * on the 10th, when the next month is already open, so both sides post together. A negative pool (refunds took back more
 * than came in) carries the same way with the signs turned round, so this month's pool still ends at zero.
 */
export function postPoolCarry(period: Period, amount: bigint): PoolEntry[] {
  if (amount === 0n) return [];
  return [
    {
      key: `carry:${period}`,
      kind: "pool_carry",
      gameId: null,
      lines: [
        { account: `pool:premium:${period}`, amount },
        { account: `pool:premium:${addMonths(period, 1)}`, amount: -amount },
      ],
    },
  ];
}
