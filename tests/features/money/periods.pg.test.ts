import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postEntry } from "../../../src/features/money/journal.ts";
import { parsePeriod } from "../../../src/features/money/period.ts";
import { closeDuePeriods, closePeriod } from "../../../src/features/money/periods.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// A month closes once, on the first run at or after midnight starting the 8th of the next month in Chicago. This file
// has a database of its own, because closeDuePeriods reads every month that is open.

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

async function monthRow(period: string) {
  return db().ledgerPeriod.findUnique({ where: { period } });
}

describe("closePeriod", () => {
  it("does not close a month before the 8th's midnight in Chicago, and does at it", async () => {
    const november = parsePeriod("2026-11");
    const justBefore = new TestClock("2026-12-08T05:59:59Z");
    await expect(closePeriod({ db: db(), clock: justBefore }, november)).rejects.toThrow(RangeError);
    expect(await monthRow("2026-11")).toBeNull();

    const atMidnight = new TestClock("2026-12-08T06:00:00Z");
    expect(await closePeriod({ db: db(), clock: atMidnight }, november)).toEqual({ closed: true });
    expect(await monthRow("2026-11")).toMatchObject({
      state: "closed",
      closedAt: new Date("2026-12-08T06:00:00Z"),
    });
  });

  it("closes a month once: a second call changes nothing", async () => {
    const august = parsePeriod("2026-08");
    await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES ('2026-08')`;
    const first = new TestClock("2026-09-08T05:00:00Z");
    expect(await closePeriod({ db: db(), clock: first }, august)).toEqual({ closed: true });

    const later = new TestClock("2026-09-12T12:00:00Z");
    expect(await closePeriod({ db: db(), clock: later }, august)).toEqual({ closed: false });
    expect(await monthRow("2026-08")).toMatchObject({
      state: "closed",
      closedAt: new Date("2026-09-08T05:00:00Z"),
    });
  });

  it("makes a month nothing has posted into yet, and closes it", async () => {
    const clock = new TestClock("2026-08-08T05:00:00Z");
    expect(await closePeriod({ db: db(), clock }, parsePeriod("2026-07"))).toEqual({ closed: true });
    expect(await monthRow("2026-07")).toMatchObject({ state: "closed" });
  });

  it("leaves a final month final", async () => {
    await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES ('2026-05')`;
    await db()
      .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed', "closedAt" = now() WHERE "period" = '2026-05'`;
    await db()
      .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'final', "finalAt" = now() WHERE "period" = '2026-05'`;
    const clock = new TestClock("2026-07-01T12:00:00Z");
    expect(await closePeriod({ db: db(), clock }, parsePeriod("2026-05"))).toEqual({ closed: false });
    expect((await monthRow("2026-05"))?.state).toBe("final");
  });

  it("leaves a closed month open to entries (its pool is shared after it closes), and a final one shut", async () => {
    const april = parsePeriod("2026-04");
    await closePeriod({ db: db(), clock: new TestClock("2026-05-08T05:00:00Z") }, april);
    const carry = (key: string) => ({
      key,
      period: april,
      kind: "pool_carry" as const,
      lines: [
        { account: "pool:premium:2026-04", amount: 10n },
        { account: "pool:premium:2026-05", amount: -10n },
      ],
    });
    await expect(db().$transaction((tx) => postEntry(tx, carry("carry:2026-04")))).resolves.toBe("posted");

    await db()
      .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'final', "finalAt" = now() WHERE "period" = '2026-04'`;
    await expect(db().$transaction((tx) => postEntry(tx, carry("carry:2026-04:again")))).rejects.toThrow(
      /2026-04 is final and takes no new entries/,
    );
  });
});

describe("closeDuePeriods", () => {
  it("closes every month whose time has come, oldest first, and makes the latest if it has no row", async () => {
    await db().ledgerPeriod.createMany({ data: [{ period: "2027-03" }] });
    await db().$executeRaw`INSERT INTO "LedgerPeriod" ("period") VALUES ('2027-04')`;
    await db()
      .$executeRaw`UPDATE "LedgerPeriod" SET "state" = 'closed', "closedAt" = now() WHERE "period" = '2027-04'`;
    // 00:00 on 8 June 2027 in Chicago: May may close, and so may anything older that is still open.
    const clock = new TestClock("2027-06-08T05:00:00Z");

    expect(await closeDuePeriods({ db: db(), clock })).toEqual(["2027-03", "2027-05"]);
    expect(await closeDuePeriods({ db: db(), clock })).toEqual([]);
    expect(await monthRow("2027-06")).toBeNull();
    expect((await monthRow("2027-05"))?.state).toBe("closed");
  });

  it("on 8 January closes November and December, in that order, when both are open", async () => {
    await db().ledgerPeriod.createMany({ data: [{ period: "2032-12" }, { period: "2032-11" }] });
    // 00:00 on 8 January 2033 in Chicago.
    const clock = new TestClock("2033-01-08T06:00:00Z");
    expect(await closeDuePeriods({ db: db(), clock })).toEqual(["2032-11", "2032-12"]);
  });

  it("on the 7th, leaves last month open: it closes the next day", async () => {
    // 23:59 on 7 August 2028 in Chicago.
    const clock = new TestClock("2028-08-08T04:59:00Z");
    expect(await closeDuePeriods({ db: db(), clock })).toEqual(["2028-06"]);
    expect(await monthRow("2028-07")).toBeNull();
  });
});
