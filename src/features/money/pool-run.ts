import { createHash } from "node:crypto";
import type { PrismaClient } from "../../lib/server/db.ts";
import { bringerOf, type Join } from "./bringing.ts";
import { canonicalJson } from "./canonical-json.ts";
import { accountBalance, lockLedger, postEntry, type MoneyTx } from "./journal.ts";
import { centsRoundedUp } from "./major-units.ts";
import { allocateMakersPool, type MemberMonth, type PoolOutcome } from "./makers-pool.ts";
import { addMonths, parsePeriod, type Period } from "./period.ts";
import { postPoolCarry, postPoolShares } from "./pool-posting.ts";
import { poolContributions, SERVICE_MONTHS } from "./pool-share.ts";

/**
 * A month's pool: who paid into it, what they played, and how it is shared. `poolFor` works it out and writes nothing,
 * so a screen can show a month before it is final with the very function that makes it final; `sharePool` posts it,
 * once.
 */

/** What reading and sharing a pool uses of a transaction. */
export type PoolTx = MoneyTx &
  Pick<
    PrismaClient,
    "paymentPosting" | "feePosting" | "playDay" | "membershipStart" | "poolRun" | "poolShare" | "game"
  >;

/** The longest plan pays for 12 months, so only a payment whose first month is within 11 of `period` can cover it. */
const LONGEST_PLAN_MONTHS_BACK = 11;

/**
 * Every member whose payments cover `period`, in member id order: the month's part of what they paid (every fee known
 * so far taken off, refunds not: they lower the pool instead, and so every share in proportion), who gets the bringing
 * bonus for them, and what they played in the month, by game.
 *
 * A refunded member keeps their weight (carried rule, design 6: refunds and chargebacks follow the carried rules). The
 * alternative, taking their contribution to nothing, would make the pool pay for money it was already refunded twice:
 * once in the lower pool and again in the lower weights.
 */
export async function membersOf(tx: PoolTx, period: Period): Promise<MemberMonth[]> {
  const postings = await tx.paymentPosting.findMany({
    where: { firstPeriod: { gte: addMonths(period, -LONGEST_PLAN_MONTHS_BACK), lte: period } },
    include: { payment: true },
  });
  const covering = postings.filter(
    (posting) => period < addMonths(parsePeriod(posting.firstPeriod), SERVICE_MONTHS[posting.payment.plan]),
  );
  const taken = await tx.feePosting.groupBy({
    by: ["stripeInvoiceId"],
    where: { kind: "payment", stripeInvoiceId: { in: covering.map((posting) => posting.stripeInvoiceId) } },
    _sum: { microCents: true },
  });
  const microCentsOf = new Map(taken.map((row) => [row.stripeInvoiceId, row._sum.microCents ?? 0n]));

  const contributions = new Map<string, bigint>();
  for (const posting of covering) {
    const { payment } = posting;
    const parts = poolContributions({
      plan: payment.plan,
      firstPeriod: parsePeriod(posting.firstPeriod),
      gross: payment.grossCents,
      tax: payment.taxCents,
      fees: payment.cardFeeCents + centsRoundedUp(microCentsOf.get(posting.stripeInvoiceId) ?? 0n),
    });
    const part = parts.find((candidate) => candidate.period === period)?.amount ?? 0n;
    contributions.set(payment.userId, (contributions.get(payment.userId) ?? 0n) + part);
  }
  const userIds = [...contributions.keys()].sort();

  const starts = await tx.membershipStart.findMany({ where: { userId: { in: userIds } } });
  const joinsOf = new Map<string, Join[]>();
  for (const start of starts) {
    const joins = joinsOf.get(start.userId) ?? [];
    joins.push({
      userId: start.userId,
      startedAtMs: start.startedAt.getTime(),
      broughtByUserId: start.broughtByUserId,
    });
    joinsOf.set(start.userId, joins);
  }

  // The days of the month are Chicago days, kept as plain dates.
  const days = await tx.playDay.groupBy({
    by: ["userId", "gameId"],
    where: {
      userId: { in: userIds },
      day: { gte: new Date(`${period}-01T00:00:00Z`), lt: new Date(`${addMonths(period, 1)}-01T00:00:00Z`) },
    },
    _sum: { seconds: true },
  });

  return userIds.map((userId) => ({
    userId,
    contribution: contributions.get(userId) ?? 0n,
    broughtBy: bringerOf(joinsOf.get(userId) ?? [], period),
    plays: days
      .filter((day) => day.userId === userId)
      .map((day) => ({ gameId: day.gameId, seconds: day._sum.seconds ?? 0 })),
  }));
}

/**
 * What the month's pool is and how it would be shared. `pool` is minus the balance of `pool:premium:<period>`: the
 * money as it stands now, after refunds and chargebacks, and with whatever an earlier month carried in. The part that
 * month carried (`carryCents` of its pool run) is shared by play alone, so it never feeds a bonus.
 */
export async function poolFor(
  tx: PoolTx,
  period: Period,
): Promise<{ pool: bigint; members: MemberMonth[]; outcome: PoolOutcome; inputsHash: string }> {
  const pool = -(await accountBalance(tx, `pool:premium:${period}`));
  const members = await membersOf(tx, period);
  const before = await tx.poolRun.findUnique({
    where: { period: addMonths(period, -1) },
    select: { carryCents: true },
  });
  // A month that carried a negative pool (refunds took back more than came in) has no money to share by play; its debt
  // is already in this pool's balance.
  const carriedIn = before !== null && before.carryCents > 0n ? before.carryCents : 0n;
  return {
    pool,
    members,
    outcome: allocateMakersPool(pool, members, carriedIn),
    inputsHash: createHash("sha256")
      .update(canonicalJson({ period, pool, carriedIn, members }))
      .digest("hex"),
  };
}

/**
 * Shares the month's pool: one entry for each game with a share (to that game's maker as the game says now), one for
 * each bringer, and one carry entry when part moves on; one `PoolRun`, and a `PoolShare` for each share above zero. A
 * month with a pool run answers `shared: false` and posts nothing. It takes the ledger's lock, as everything that posts
 * does, so two runs take turns.
 *
 * It never touches `platform:revenue:premium`: only the makers' half is shared.
 */
export async function sharePool(tx: PoolTx, period: Period, nowMs: number): Promise<{ shared: boolean }> {
  await lockLedger(tx);
  if ((await tx.poolRun.findUnique({ where: { period } })) !== null) return { shared: false };

  const { pool, members, outcome, inputsHash } = await poolFor(tx, period);
  // The month's row exists before a run points at it, even when nothing was posted into it.
  await tx.ledgerPeriod.upsert({ where: { period }, create: { period }, update: {} });

  const gameIds = outcome.kind === "shared" ? outcome.games.map((game) => game.gameId) : [];
  const games = await tx.game.findMany({
    where: { id: { in: gameIds } },
    select: { id: true, makerUserId: true },
  });
  const makerOf = new Map(games.map((game) => [game.id, game.makerUserId]));

  const entries =
    outcome.kind === "shared"
      ? postPoolShares(period, outcome, makerOf)
      : postPoolCarry(period, outcome.amount);
  for (const entry of entries) {
    await postEntry(tx, {
      key: entry.key,
      period,
      kind: entry.kind,
      gameId: entry.gameId,
      lines: entry.lines,
    });
  }

  await tx.poolRun.create({
    data: {
      period,
      poolCents: pool,
      carryCents: outcome.kind === "shared" ? outcome.carry : outcome.amount,
      members: members.filter((member) => member.contribution > 0n).length,
      inputsHash,
      sharedAt: new Date(nowMs),
    },
  });

  if (outcome.kind === "shared") {
    const secondsOn = new Map<string, number>();
    for (const member of members) {
      for (const play of member.plays) {
        secondsOn.set(play.gameId, (secondsOn.get(play.gameId) ?? 0) + play.seconds);
      }
    }
    await tx.poolShare.createMany({
      data: [
        ...outcome.games
          .filter((game) => game.amount > 0n)
          .map((game) => ({
            period,
            kind: "play" as const,
            makerUserId: makerOf.get(game.gameId) ?? "",
            gameId: game.gameId,
            weight: game.weight,
            amountCents: game.amount,
            seconds: secondsOn.get(game.gameId) ?? 0,
          })),
        ...outcome.bringers
          .filter((bringer) => bringer.amount > 0n)
          .map((bringer) => ({
            period,
            kind: "bringing" as const,
            makerUserId: bringer.makerUserId,
            weight: bringer.weight,
            amountCents: bringer.amount,
            members: bringer.members,
          })),
      ],
    });
  }
  return { shared: true };
}
