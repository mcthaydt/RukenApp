import { expect } from "vitest";
import type { PrismaClient } from "../../src/lib/server/db.ts";
import type { Clock } from "../../src/lib/clock.ts";
import type { FeeRow } from "../../src/features/money/fee-rows.ts";
import { postUnpostedPayments } from "../../src/features/money/payments.ts";
import { postFeeRows } from "../../src/features/money/fees.ts";
import { createUser } from "./create-user.ts";
import { feeRow, type FakeMoneyStripe } from "./fake-money-stripe.ts";

/** Every account's balance, summed over every line the journal holds. An account nothing posted to is absent. */
export async function balancesOf(prisma: PrismaClient): Promise<Record<string, bigint>> {
  const rows = await prisma.$queryRaw<{ account: string; balance: bigint }[]>`
    SELECT "account", sum("amount")::bigint AS "balance" FROM "JournalLine" GROUP BY "account"`;
  return Object.fromEntries(rows.map((row) => [row.account, row.balance]));
}

/** How much each account moved while `action` ran. An account that did not move is left out. */
export async function movedBy(
  prisma: PrismaClient,
  action: () => Promise<unknown>,
): Promise<Record<string, bigint>> {
  const before = await balancesOf(prisma);
  await action();
  const after = await balancesOf(prisma);
  const moved: Record<string, bigint> = {};
  for (const [account, balance] of Object.entries(after)) {
    const change = balance - (before[account] ?? 0n);
    if (change !== 0n) moved[account] = change;
  }
  return moved;
}

/**
 * The books balance: every account adds up to something, and all of them together add up to nothing. The database
 * already refuses an entry that does not add up to zero, so this is the check a test makes at the end that nothing
 * went around it.
 */
export async function expectBooksBalanced(prisma: PrismaClient): Promise<void> {
  const balances = await balancesOf(prisma);
  const total = Object.values(balances).reduce((sum, balance) => sum + balance, 0n);
  expect(total).toBe(0n);
}

export interface PaymentSetup {
  /** The invoice's id, such as `in_1`. Its charge, payment intent and balance transaction take the same number. */
  readonly invoice: string;
  readonly gross: bigint;
  readonly tax: bigint;
  readonly cardFee: bigint;
  readonly plan: "monthly" | "annual";
  /** When it was paid, and the start of the month it pays for. Both default to 2 November 2026, 15:00 UTC. */
  readonly paidAt?: string;
  readonly periodStart?: string;
  /** Set to leave the payment out of the fake Stripe, as a payment whose charge Stripe has not made yet. */
  readonly notAtStripe?: boolean;
}

/**
 * A paid membership invoice as slice 1 keeps it: one `MembershipPayment` row from a new member, and (unless
 * `notAtStripe`) the three ids the fake Stripe answers for it. Answers the payer's id.
 */
export async function addMembershipPayment(
  prisma: PrismaClient,
  stripe: FakeMoneyStripe,
  setup: PaymentSetup,
): Promise<string> {
  const userId = await createUser(prisma);
  const paidAt = setup.paidAt ?? "2026-11-02T15:00:00Z";
  await prisma.membershipPayment.create({
    data: {
      stripeInvoiceId: setup.invoice,
      userId,
      stripeSubscriptionId: `sub_${setup.invoice}`,
      plan: setup.plan,
      periodStart: new Date(setup.periodStart ?? paidAt),
      paidAt: new Date(paidAt),
      grossCents: setup.gross,
      taxCents: setup.tax,
      cardFeeCents: setup.cardFee,
    },
  });
  if (setup.notAtStripe !== true) {
    const number = setup.invoice.replace(/^in_/, "");
    stripe.addPayment(setup.invoice, {
      chargeId: `ch_${number}`,
      paymentIntentId: `pi_${number}`,
      balanceTransactionId: `txn_${number}`,
    });
  }
  return userId;
}

/** A payment made and posted into the books, on a clock that stands at the moment it is posted. */
export async function postedPayment(
  prisma: PrismaClient,
  stripe: FakeMoneyStripe,
  clock: Clock,
  setup: PaymentSetup,
): Promise<void> {
  await addMembershipPayment(prisma, stripe, setup);
  await postUnpostedPayments({ db: prisma, clock, stripe });
}

let fakeRuns = 0;

/**
 * A fee report run stored at `storedAt`, holding these rows (each filled in as Stripe would write it). Each run is
 * for a stretch of time of its own, so a test can store as many as it likes.
 */
export async function storedFeeRows(
  prisma: PrismaClient,
  rows: readonly Partial<FeeRow>[],
  storedAt: string,
): Promise<void> {
  fakeRuns += 1;
  const startSec = 10_000_000 + fakeRuns * 10_000;
  const run = await prisma.stripeFeeRun.create({
    data: {
      intervalStart: new Date(startSec * 1000),
      intervalEnd: new Date((startSec + 5_000) * 1000),
      stripeReportRunId: `frr_stored_${String(fakeRuns)}`,
      state: "stored",
      rowCount: rows.length,
      requestedAt: new Date(storedAt),
      storedAt: new Date(storedAt),
    },
  });
  await prisma.stripeFeeRow.createMany({
    data: rows.map((row, index) => ({ ...feeRow(row), runId: run.id, rowNumber: index + 1 })),
  });
}

/** One member of a month, as `aMonth` makes them. */
export interface MonthMember {
  /** What they paid. Its `paidAt` (2 November 2026 unless said) is the month. */
  readonly payment: PaymentSetup;
  /** Billing and Tax fees that came after the payment, in cents. */
  readonly laterFeeCents?: number;
  /** The maker whose link they joined through, `"self"` for their own, or null for nobody. */
  readonly broughtBy: string | null;
  /** When they first joined, if not when they paid. */
  readonly joinedAt?: string;
  /** What they played in the month, by game. */
  readonly plays: readonly { gameId: string; seconds: number }[];
}

/**
 * Members who paid, were brought (or not) and played, all in the books as the daily job would have left them: each
 * payment posted, each later fee taken off the top, each join and each day's play kept. The clock stands in the month.
 * Answers the members' ids in the order given.
 */
export async function aMonth(
  prisma: PrismaClient,
  stripe: FakeMoneyStripe,
  clock: Clock,
  members: readonly MonthMember[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const member of members) {
    const userId = await addMembershipPayment(prisma, stripe, member.payment);
    ids.push(userId);
    const paidAt = member.payment.paidAt ?? "2026-11-02T15:00:00Z";
    const brought = member.broughtBy === "self" ? userId : member.broughtBy;
    await prisma.membershipStart.create({
      data: {
        checkoutIntentId: crypto.randomUUID(),
        userId,
        stripeSubscriptionId: `sub_${member.payment.invoice}`,
        plan: member.payment.plan === "annual" ? "annual" : "monthly",
        startedAt: new Date(member.joinedAt ?? paidAt),
        broughtByUserId: brought,
        arrivalPath: brought === null ? null : "/a-game",
        arrivedAt: brought === null ? null : new Date(member.joinedAt ?? paidAt),
      },
    });
    for (const play of member.plays) {
      await prisma.playDay.create({
        data: {
          day: new Date(`${paidAt.slice(0, 10)}T00:00:00Z`),
          userId,
          gameId: play.gameId,
          seconds: play.seconds,
        },
      });
    }
  }
  await postUnpostedPayments({ db: prisma, clock, stripe });
  for (const member of members) {
    const cents = member.laterFeeCents ?? 0;
    if (cents === 0) continue;
    const amountText = `${String(Math.floor(cents / 100))}.${String(cents % 100).padStart(2, "0")}`;
    const incurredAt = (member.payment.paidAt ?? "2026-11-02T15:00:00Z").slice(0, 10) + " 12:00:00";
    await storedFeeRows(
      prisma,
      [{ incurredBy: member.payment.invoice, amountText, incurredAt }],
      new Date(clock.epochMs()).toISOString(),
    );
  }
  await postFeeRows({ db: prisma, clock });
  return ids;
}
