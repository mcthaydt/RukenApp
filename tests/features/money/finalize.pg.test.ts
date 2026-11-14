import { describe, expect, it } from "vitest";
import { finalizeDuePeriods, finalizePeriod } from "../../../src/features/money/finalize.ts";
import { postFeeRows } from "../../../src/features/money/fees.ts";
import { postEntry } from "../../../src/features/money/journal.ts";
import { parsePeriod } from "../../../src/features/money/period.ts";
import { closeDuePeriods } from "../../../src/features/money/periods.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase } from "../../support/database.ts";
import { fakeMoneyStripe } from "../../support/fake-money-stripe.ts";
import { aMonth, balancesOf, expectBooksBalanced, storedFeeRows } from "../../support/ledger.ts";
import { addGame } from "../../support/play.ts";
import { TestClock } from "../../support/test-clock.ts";

// Making a month final: on the 10th, in Chicago, its pool is shared, every maker's statement is written, and the database
// stops taking entries for it. Each test has a database of its own, because months go in order and a test that leaves a
// month behind would be read by the next.

const stripe = fakeMoneyStripe();
const NOVEMBER = parsePeriod("2026-11");

function monthly(invoice: string, month: string) {
  return {
    invoice,
    gross: 1081n,
    tax: 82n,
    cardFee: 61n,
    plan: "monthly",
    paidAt: `${month}-02T15:00:00Z`,
  } as const;
}

/** A database with November closed: one member paid and played one game. Answers the game's maker. */
async function closedNovember(prisma: PrismaClient): Promise<string> {
  const game = await addGame(prisma);
  await aMonth(prisma, stripe, new TestClock("2026-11-20T12:00:00Z"), [
    { payment: monthly("in_n1", "2026-11"), broughtBy: null, plays: [{ gameId: game.gameId, seconds: 600 }] },
  ]);
  await closeDuePeriods({ db: prisma, clock: new TestClock("2026-12-09T12:00:00Z") });
  return game.makerUserId;
}

async function inOwnDatabase(run: (prisma: PrismaClient) => Promise<void>): Promise<void> {
  const own = await startTestDatabase();
  try {
    await run(own.prisma);
  } finally {
    await own.stop();
  }
}

describe("finalizePeriod", () => {
  it("makes November final on the 10th of December, in Chicago", async () => {
    await inOwnDatabase(async (prisma) => {
      const maker = await closedNovember(prisma);
      // 05:59:59 UTC is still the 9th in Chicago.
      const early = new TestClock("2026-12-10T05:59:59Z");
      await expect(finalizePeriod({ db: prisma, clock: early }, NOVEMBER)).rejects.toThrow(RangeError);
      expect((await prisma.ledgerPeriod.findUniqueOrThrow({ where: { period: "2026-11" } })).state).toBe(
        "closed",
      );

      early.advance(1000);
      expect(await finalizePeriod({ db: prisma, clock: early }, NOVEMBER)).toEqual({
        final: true,
        makers: [maker],
      });
      expect(await prisma.ledgerPeriod.findUniqueOrThrow({ where: { period: "2026-11" } })).toMatchObject({
        state: "final",
        finalAt: new Date("2026-12-10T06:00:00Z"),
      });
      expect(await prisma.poolRun.count({ where: { period: "2026-11" } })).toBe(1);
      expect(await prisma.statement.count({ where: { period: "2026-11", makerUserId: maker } })).toBe(1);
    });
  });

  it("takes no entry into a final month, and a later fee does not move its statement", async () => {
    // Review Focus 3
    await inOwnDatabase(async (prisma) => {
      const maker = await closedNovember(prisma);
      const clock = new TestClock("2026-12-10T06:00:00Z");
      await finalizePeriod({ db: prisma, clock }, NOVEMBER);
      const before = await prisma.statement.findUniqueOrThrow({
        where: { makerUserId_period: { makerUserId: maker, period: "2026-11" } },
      });

      await expect(
        prisma.$transaction((tx) =>
          postEntry(tx, {
            key: "late:1",
            period: NOVEMBER,
            kind: "correction",
            lines: [
              { account: "platform:revenue:premium", amount: 1n },
              { account: "platform:cash", amount: -1n },
            ],
          }),
        ),
      ).rejects.toThrow(/final/);

      // A fee row for a November payment, stored on 12 December: posted into December.
      clock.set("2026-12-12T12:00:00Z");
      await storedFeeRows(
        prisma,
        [{ incurredBy: "in_n1", amountText: "0.12", incurredAt: "2026-11-25 10:00:00" }],
        "2026-12-12T11:00:00Z",
      );
      expect(await postFeeRows({ db: prisma, clock })).toMatchObject({ payment: 1 });
      const entry = await prisma.journalEntry.findFirstOrThrow({
        where: { kind: "payment_fee", stripeInvoiceId: "in_n1" },
      });
      expect(entry.period).toBe("2026-12");
      const after = await prisma.statement.findUniqueOrThrow({
        where: { makerUserId_period: { makerUserId: maker, period: "2026-11" } },
      });
      expect(after.document).toEqual(before.document);
      expect(after.totalsHash).toBe(before.totalsHash);
    });
  });

  it("goes month by month, oldest first, and refuses a month while an earlier one is not final", async () => {
    await inOwnDatabase(async (prisma) => {
      const october = await addGame(prisma);
      await aMonth(prisma, stripe, new TestClock("2026-10-20T12:00:00Z"), [
        {
          payment: monthly("in_o1", "2026-10"),
          broughtBy: null,
          plays: [{ gameId: october.gameId, seconds: 600 }],
        },
      ]);
      await closedNovember(prisma); // closes October too
      const clock = new TestClock("2026-12-10T06:00:00Z");
      await expect(finalizePeriod({ db: prisma, clock }, NOVEMBER)).rejects.toThrow(/2026-10 is not final/);
      expect(await finalizeDuePeriods({ db: prisma, clock })).toEqual(["2026-10", "2026-11"]);
    });
  });

  it("will not make a month final while a fee of that month cannot be read", async () => {
    // Review Focus 4
    await inOwnDatabase(async (prisma) => {
      await closedNovember(prisma);
      const clock = new TestClock("2026-12-10T06:00:00Z");
      // Stripe's fee that reached Ruken's balance in December does not hold November up; one in November does.
      await storedFeeRows(
        prisma,
        [{ amountText: "n/a", balanceTransactionAt: "2026-12-01 10:00:00" }],
        "2026-12-05T00:00:00Z",
      );
      expect(await postFeeRows({ db: prisma, clock })).toMatchObject({ unreadable: 1 });
      await storedFeeRows(
        prisma,
        [{ amountText: "n/a", balanceTransactionAt: "2026-11-20 10:00:00" }],
        "2026-12-05T00:00:00Z",
      );
      await expect(finalizePeriod({ db: prisma, clock }, NOVEMBER)).rejects.toThrow(
        /Stripe sent a fee this code cannot read/,
      );
      expect((await prisma.ledgerPeriod.findUniqueOrThrow({ where: { period: "2026-11" } })).state).toBe(
        "closed",
      );
      expect(await prisma.poolRun.count()).toBe(0);
    });
  });

  it("does not hold a month up for a fee that names nothing, or for one Stripe's credits paid", async () => {
    await inOwnDatabase(async (prisma) => {
      await closedNovember(prisma);
      const clock = new TestClock("2026-12-10T06:00:00Z");
      await storedFeeRows(
        prisma,
        [
          { incurredBy: "in_nobody", amountText: "0.10" },
          { incurredBy: "in_n1", amountText: "0.30", settledVia: "credit" },
          { incurredBy: "in_n1", amountText: "-0.10" },
        ],
        "2026-12-05T00:00:00Z",
      );
      await postFeeRows({ db: prisma, clock });
      expect((await finalizePeriod({ db: prisma, clock }, NOVEMBER)).final).toBe(true);
    });
  });

  it("undoes everything when the statements fail", async () => {
    await inOwnDatabase(async (prisma) => {
      await closedNovember(prisma);
      const clock = new TestClock("2026-12-10T06:00:00Z");
      const before = await balancesOf(prisma);
      // A statement line the database refuses, so writing the statements fails after the pool was shared.
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION refuse_statement_line() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'statement lines are refused in this test'; END $$`);
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER refuse_lines BEFORE INSERT ON "StatementLine" FOR EACH ROW EXECUTE FUNCTION refuse_statement_line()`,
      );
      await expect(finalizePeriod({ db: prisma, clock }, NOVEMBER)).rejects.toThrow(/refused in this test/);
      expect(await prisma.poolRun.count()).toBe(0);
      expect(await prisma.statement.count()).toBe(0);
      expect(await balancesOf(prisma)).toEqual(before);
      expect((await prisma.ledgerPeriod.findUniqueOrThrow({ where: { period: "2026-11" } })).state).toBe(
        "closed",
      );

      // Once what stopped it is gone, the next run makes the month final.
      await prisma.$executeRawUnsafe(`DROP TRIGGER refuse_lines ON "StatementLine"`);
      expect((await finalizePeriod({ db: prisma, clock }, NOVEMBER)).final).toBe(true);
      await expectBooksBalanced(prisma);
    });
  });

  it("is final once", async () => {
    await inOwnDatabase(async (prisma) => {
      await closedNovember(prisma);
      const clock = new TestClock("2026-12-10T06:00:00Z");
      expect(await finalizeDuePeriods({ db: prisma, clock })).toEqual(["2026-11"]);
      const entries = await prisma.journalEntry.count();
      expect(await finalizeDuePeriods({ db: prisma, clock })).toEqual([]);
      expect(await finalizePeriod({ db: prisma, clock }, NOVEMBER)).toEqual({ final: false, makers: [] });
      expect(await prisma.journalEntry.count()).toBe(entries);
    });
  });
});
