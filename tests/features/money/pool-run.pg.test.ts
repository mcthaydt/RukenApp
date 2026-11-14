import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requestDeletion, purgeDueAccounts } from "../../../src/features/accounts/deletion.ts";
import { parsePeriod } from "../../../src/features/money/period.ts";
import { poolFor, sharePool } from "../../../src/features/money/pool-run.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { fakeMoneyStripe } from "../../support/fake-money-stripe.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";
import { addGame } from "../../support/play.ts";
import { aMonth, balancesOf, expectBooksBalanced, type MonthMember } from "../../support/ledger.ts";
import { TestClock } from "../../support/test-clock.ts";

// Sharing a month's pool, through the database. Each test works in a month of its own (the pool is the month's), and
// the first one is Task 8's worked month: the same members, the same cents, now read from the rows the daily job left.

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

/** Shares a month at a moment, the way making it final does. */
function share(period: string, at: string) {
  return db().$transaction((tx) => sharePool(tx, parsePeriod(period), Date.parse(at)));
}

/** A monthly payment of $10.81 (82 cents of it tax, a 61-cent card fee), paid on the 2nd of the month. */
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

describe("sharePool", () => {
  it("shares the worked month exactly as the pure functions say", async () => {
    // Task 8's three members. A: monthly, brought by X, played X's game 1 for 2 hours and Y's game 2 for 1 hour. B:
    // yearly, brought by nobody, played game 2 for half an hour. C: monthly, brought themselves, played nothing.
    const one = await addGame(db());
    const two = await addGame(db());
    const clock = new TestClock("2026-11-20T12:00:00Z");
    const yearly = {
      invoice: "in_wb",
      gross: 10_717n,
      tax: 817n,
      cardFee: 341n,
      plan: "annual",
      paidAt: "2026-11-02T15:00:00Z",
    } as const;
    await aMonth(db(), stripe, clock, [
      {
        payment: monthly("in_wa", "2026-11"),
        laterFeeCents: 12,
        broughtBy: one.makerUserId,
        plays: [
          { gameId: one.gameId, seconds: 7200 },
          { gameId: two.gameId, seconds: 3600 },
        ],
      },
      { payment: yearly, laterFeeCents: 46, broughtBy: null, plays: [{ gameId: two.gameId, seconds: 1800 }] },
      { payment: monthly("in_wc", "2026-11"), laterFeeCents: 12, broughtBy: "self", plays: [] },
    ]);
    expect((await balancesOf(db()))["pool:premium:2026-11"]).toBe(-1323n);

    expect(await share("2026-11", "2026-12-10T12:00:00Z")).toEqual({ shared: true });
    const balances = await balancesOf(db());
    // X is owed the bonus (231) and game 1 (419); Y is owed game 2 (673). The pool is empty.
    expect(balances[`maker:${one.makerUserId}:payable`]).toBe(-650n);
    expect(balances[`maker:${two.makerUserId}:payable`]).toBe(-673n);
    expect(balances["pool:premium:2026-11"] ?? 0n).toBe(0n);
    expect(await db().poolRun.findUniqueOrThrow({ where: { period: "2026-11" } })).toMatchObject({
      poolCents: 1323n,
      carryCents: 0n,
      members: 3,
    });
    const shares = await db().poolShare.findMany({
      where: { period: "2026-11" },
      orderBy: { amountCents: "asc" },
    });
    expect(shares.map((row) => [row.kind, row.amountCents, row.seconds, row.members])).toEqual([
      ["bringing", 231n, null, 1],
      ["play", 419n, 7200, null],
      ["play", 673n, 5400, null],
    ]);
    await expectBooksBalanced(db());
  });

  it("pays the bringer only in a member's first twelve months, and never for bringing yourself", async () => {
    // Review Focus 7. In March 2027: M1 joined December 2026 (month four of twelve), M2 joined March 2026 (month
    // thirteen), M3 brought themselves, M4's first join had no maker and a later one named Y.
    const x = await addGame(db());
    const y = await addGame(db());
    const clock = new TestClock("2027-03-20T12:00:00Z");
    const member = (invoice: string, broughtBy: string | "self" | null, joinedAt: string): MonthMember => ({
      payment: monthly(invoice, "2027-03"),
      broughtBy,
      joinedAt,
      plays: [{ gameId: x.gameId, seconds: 600 }],
    });
    await aMonth(db(), stripe, clock, [
      member("in_b1", x.makerUserId, "2026-12-05T12:00:00Z"),
      member("in_b2", x.makerUserId, "2026-03-05T12:00:00Z"),
      member("in_b3", "self", "2027-01-05T12:00:00Z"),
      member("in_b4", y.makerUserId, "2027-02-05T12:00:00Z"),
    ]);
    // M4's earlier join, with no maker: the later one, through Y, starts nothing.
    const m4 = await db().membershipStart.findFirstOrThrow({ where: { stripeSubscriptionId: "sub_in_b4" } });
    await db().membershipStart.create({
      data: {
        checkoutIntentId: crypto.randomUUID(),
        userId: m4.userId,
        stripeSubscriptionId: "sub_in_b4_first",
        plan: "monthly",
        startedAt: new Date("2026-11-05T12:00:00Z"),
      },
    });

    await share("2027-03", "2027-04-10T12:00:00Z");
    const bringing = await db().poolShare.findMany({ where: { period: "2027-03", kind: "bringing" } });
    expect(bringing.map((row) => [row.makerUserId, row.members])).toEqual([[x.makerUserId, 1]]);
  });

  it("pays bonuses and carries the rest when nobody played, and shares the carry by play next month", async () => {
    // Review Focus 8 and 19. May 2027: one member paid, was brought by X, and nobody played anything.
    const x = await addGame(db());
    const may = new TestClock("2027-05-20T12:00:00Z");
    await aMonth(db(), stripe, may, [
      { payment: monthly("in_c1", "2027-05"), broughtBy: x.makerUserId, plays: [] },
    ]);
    // 469 in the pool: half is the bonus, half has nowhere to go. The odd cent goes to the bonus: 235 and 234.
    await share("2027-05", "2027-06-10T12:00:00Z");
    expect(await db().poolRun.findUniqueOrThrow({ where: { period: "2027-05" } })).toMatchObject({
      poolCents: 469n,
      carryCents: 234n,
    });
    let balances = await balancesOf(db());
    expect(balances[`maker:${x.makerUserId}:payable`]).toBe(-235n);
    expect(balances["pool:premium:2027-05"] ?? 0n).toBe(0n);
    expect(balances["pool:premium:2027-06"]).toBe(-234n);

    // June: a member nobody brought pays and plays one game. The carry is shared by play, and no bringer's share grows.
    const game = await addGame(db());
    const june = new TestClock("2027-06-20T12:00:00Z");
    await aMonth(db(), stripe, june, [
      {
        payment: monthly("in_c2", "2027-06"),
        broughtBy: null,
        plays: [{ gameId: game.gameId, seconds: 900 }],
      },
    ]);
    await share("2027-06", "2027-07-10T12:00:00Z");
    balances = await balancesOf(db());
    expect(balances[`maker:${game.makerUserId}:payable`]).toBe(-703n); // 469 paid in June and 234 carried
    expect(balances[`maker:${x.makerUserId}:payable`]).toBe(-235n); // unchanged
    expect(await db().poolShare.count({ where: { period: "2027-06", kind: "bringing" } })).toBe(0);
    expect(balances["pool:premium:2027-06"] ?? 0n).toBe(0n);
  });

  it("still works out the share of a game whose maker's account was deleted", async () => {
    // Review Focus 10
    const game = await addGame(db());
    const clock = new TestClock("2027-08-20T12:00:00Z");
    await aMonth(db(), stripe, clock, [
      {
        payment: monthly("in_d1", "2027-08"),
        broughtBy: null,
        plays: [{ gameId: game.gameId, seconds: 600 }],
      },
    ]);
    // The maker asks to be deleted; 15 days on, the daily job removes their details and leaves the row.
    const asked = new TestClock("2027-08-21T12:00:00Z");
    await requestDeletion({ prisma: db(), clock: asked }, game.makerUserId);
    asked.advance(15 * 24 * 60 * 60 * 1000);
    await purgeDueAccounts({ prisma: db(), clock: asked, files: new MemoryFileStore() });
    expect((await db().user.findUniqueOrThrow({ where: { id: game.makerUserId } })).status).toBe("deleted");

    const before = await db().journalLine.count();
    await share("2027-08", "2027-09-10T12:00:00Z");
    expect((await balancesOf(db()))[`maker:${game.makerUserId}:payable`]).toBe(-469n);
    expect(await db().journalLine.count()).toBeGreaterThan(before);
    // Another day's job: the purge removes no money row.
    await purgeDueAccounts({ prisma: db(), clock: asked, files: new MemoryFileStore() });
    expect((await balancesOf(db()))[`maker:${game.makerUserId}:payable`]).toBe(-469n);
    expect(await db().poolShare.count({ where: { makerUserId: game.makerUserId } })).toBe(1);
  });

  it("shares a month once", async () => {
    const game = await addGame(db());
    const clock = new TestClock("2027-10-20T12:00:00Z");
    await aMonth(db(), stripe, clock, [
      {
        payment: monthly("in_e1", "2027-10"),
        broughtBy: null,
        plays: [{ gameId: game.gameId, seconds: 600 }],
      },
    ]);
    expect(await share("2027-10", "2027-11-10T12:00:00Z")).toEqual({ shared: true });
    const entries = await db().journalEntry.count({ where: { period: "2027-10", kind: "pool_share" } });
    expect(await share("2027-10", "2027-11-10T13:00:00Z")).toEqual({ shared: false });
    expect(await db().journalEntry.count({ where: { period: "2027-10", kind: "pool_share" } })).toBe(entries);
  });

  it("never takes from Ruken's half, and shows the same numbers before the month is shared as after", async () => {
    // Review Focus 17
    const game = await addGame(db());
    const clock = new TestClock("2027-12-20T12:00:00Z");
    await aMonth(db(), stripe, clock, [
      {
        payment: monthly("in_f1", "2027-12"),
        broughtBy: null,
        plays: [{ gameId: game.gameId, seconds: 600 }],
      },
    ]);
    const revenueBefore = (await balancesOf(db()))["platform:revenue:premium"];
    const planned = await db().$transaction((tx) => poolFor(tx, parsePeriod("2027-12")));
    await share("2027-12", "2028-01-10T12:00:00Z");
    expect((await balancesOf(db()))["platform:revenue:premium"]).toBe(revenueBefore);

    expect(planned.outcome.kind).toBe("shared");
    const shares = await db().poolShare.findMany({ where: { period: "2027-12" } });
    const shown =
      planned.outcome.kind === "shared" ? planned.outcome.games.map((g) => [g.gameId, g.amount]) : [];
    expect(shares.map((row) => [row.gameId, row.amountCents])).toEqual(shown);
    expect(await db().poolRun.findUniqueOrThrow({ where: { period: "2027-12" } })).toMatchObject({
      inputsHash: planned.inputsHash,
    });
  });

  it("keeps the books balanced", async () => {
    await expectBooksBalanced(db());
  });
});
