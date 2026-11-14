import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requestDeletion, purgeDueAccounts } from "../../../src/features/accounts/deletion.ts";
import { lockLedger, postEntry } from "../../../src/features/money/journal.ts";
import { parsePeriod } from "../../../src/features/money/period.ts";
import { sharePool } from "../../../src/features/money/pool-run.ts";
import { writeStatements } from "../../../src/features/money/statements.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { fakeMoneyStripe } from "../../support/fake-money-stripe.ts";
import { aMonth, balancesOf, expectBooksBalanced } from "../../support/ledger.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";
import { addGame } from "../../support/play.ts";
import { TestClock } from "../../support/test-clock.ts";

// A statement for every maker with something to show for a month, written when the month is made final. Each test works
// in a month of its own.

let database: TestDatabase | undefined;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.stop();
});

const stripe = fakeMoneyStripe();

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

/** Shares a month's pool and writes its statements, as making it final does. */
async function finish(period: string, at: string): Promise<string[]> {
  const nowMs = Date.parse(at);
  return db().$transaction(async (tx) => {
    await sharePool(tx, parsePeriod(period), nowMs);
    return (await writeStatements(tx, parsePeriod(period), nowMs)).makers;
  });
}

/** What a maker's statement lines add up to. */
async function linesTotal(statementId: string): Promise<bigint> {
  const { _sum } = await db().statementLine.aggregate({
    where: { statementId },
    _sum: { amountCents: true },
  });
  return _sum.amountCents ?? 0n;
}

describe("writeStatements", () => {
  it("gives each maker one statement whose lines add up to what the journal credited them", async () => {
    const one = await addGame(db());
    const two = await addGame(db());
    const clock = new TestClock("2028-02-20T12:00:00Z");
    await aMonth(db(), stripe, clock, [
      {
        payment: monthly("in_sa", "2028-02"),
        laterFeeCents: 12,
        broughtBy: one.makerUserId,
        plays: [
          { gameId: one.gameId, seconds: 7200 },
          { gameId: two.gameId, seconds: 3600 },
        ],
      },
      { payment: monthly("in_sb", "2028-02"), laterFeeCents: 12, broughtBy: "self", plays: [] },
    ]);
    const makers = await finish("2028-02", "2028-03-10T12:00:00Z");
    expect([...makers].sort()).toEqual([one.makerUserId, two.makerUserId].sort());

    const balances = await balancesOf(db());
    for (const maker of [one.makerUserId, two.makerUserId]) {
      const statement = await db().statement.findUniqueOrThrow({
        where: { makerUserId_period: { makerUserId: maker, period: "2028-02" } },
      });
      const owed = -(balances[`maker:${maker}:payable`] ?? 0n);
      expect(await linesTotal(statement.id)).toBe(owed);
      expect(statement.document).toMatchObject({ period: "2028-02", totals: { owed: String(owed) } });
      expect(statement.totalsHash).toMatch(/^[0-9a-f]{64}$/);
    }
    // X has the bonus and game 1's share; Y has game 2's.
    const xLines = await db().statementLine.findMany({
      where: { statement: { makerUserId: one.makerUserId, period: "2028-02" } },
      orderBy: { ref: "asc" },
    });
    expect(xLines.map((line) => [line.source, line.gameId])).toEqual([
      ["bringing", null],
      ["play", one.gameId],
    ]);
    await expectBooksBalanced(db());
  });

  it("gives a maker owed $24.99 a statement, whatever they earned this month", async () => {
    // Review Focus 11. They earned nothing from the pool; a correction credits them 2,499.
    const maker = await addGame(db());
    await db().$transaction(async (tx) => {
      await lockLedger(tx);
      await tx.ledgerPeriod.upsert({
        where: { period: "2028-04" },
        create: { period: "2028-04" },
        update: {},
      });
      await postEntry(tx, {
        key: `fix:${maker.makerUserId}`,
        period: parsePeriod("2028-04"),
        kind: "correction",
        lines: [
          { account: "platform:revenue:premium", amount: 2499n },
          { account: `maker:${maker.makerUserId}:payable`, amount: -2499n, makerUserId: maker.makerUserId },
        ],
      });
    });
    expect(await finish("2028-04", "2028-05-10T12:00:00Z")).toEqual([maker.makerUserId]);
    const statement = await db().statement.findUniqueOrThrow({
      where: { makerUserId_period: { makerUserId: maker.makerUserId, period: "2028-04" } },
    });
    expect(statement.document).toMatchObject({
      totals: { owed: "2499", earned: "2499", broughtForward: "0" },
    });
  });

  it("carries what stood before: next month's statement starts from this month's owed", async () => {
    const game = await addGame(db());
    for (const [month, invoice] of [
      ["2028-06", "in_sc1"],
      ["2028-07", "in_sc2"],
    ] as const) {
      const clock = new TestClock(`${month}-20T12:00:00Z`);
      await aMonth(db(), stripe, clock, [
        { payment: monthly(invoice, month), broughtBy: null, plays: [{ gameId: game.gameId, seconds: 600 }] },
      ]);
    }
    await finish("2028-06", "2028-07-10T12:00:00Z");
    await finish("2028-07", "2028-08-10T12:00:00Z");
    const july = await db().statement.findUniqueOrThrow({
      where: { makerUserId_period: { makerUserId: game.makerUserId, period: "2028-07" } },
    });
    expect(july.document).toMatchObject({ totals: { earned: "469", broughtForward: "469", owed: "938" } });
  });

  it("gives a maker whose account was deleted a statement too", async () => {
    // Review Focus 10
    const game = await addGame(db());
    const clock = new TestClock("2028-09-20T12:00:00Z");
    await aMonth(db(), stripe, clock, [
      {
        payment: monthly("in_sd", "2028-09"),
        broughtBy: null,
        plays: [{ gameId: game.gameId, seconds: 600 }],
      },
    ]);
    const asked = new TestClock("2028-09-21T12:00:00Z");
    await requestDeletion({ prisma: db(), clock: asked }, game.makerUserId);
    asked.advance(15 * 24 * 60 * 60 * 1000);
    await purgeDueAccounts({ prisma: db(), clock: asked, files: new MemoryFileStore() });
    expect(await finish("2028-09", "2028-10-10T12:00:00Z")).toEqual([game.makerUserId]);
    expect(await db().statement.count({ where: { makerUserId: game.makerUserId, period: "2028-09" } })).toBe(
      1,
    );
  });

  it("writes nothing the second time, and nothing for a maker with nothing this month and nothing owed", async () => {
    const game = await addGame(db());
    const idle = await addGame(db());
    const clock = new TestClock("2028-11-20T12:00:00Z");
    await aMonth(db(), stripe, clock, [
      {
        payment: monthly("in_se", "2028-11"),
        broughtBy: null,
        plays: [{ gameId: game.gameId, seconds: 600 }],
      },
    ]);
    expect(await finish("2028-11", "2028-12-10T12:00:00Z")).toEqual([game.makerUserId]);
    const count = await db().statement.count();
    expect(
      await db().$transaction((tx) =>
        writeStatements(tx, parsePeriod("2028-11"), Date.parse("2028-12-10T13:00:00Z")),
      ),
    ).toEqual({
      makers: [],
    });
    expect(await db().statement.count()).toBe(count);
    expect(await db().statement.count({ where: { makerUserId: idle.makerUserId } })).toBe(0);
  });

  it("keeps the books balanced", async () => {
    await expectBooksBalanced(db());
  });
});
