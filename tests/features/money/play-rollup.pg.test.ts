import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rollUpPlayDays } from "../../../src/features/money/play-rollup.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { addGame, addSession } from "../../support/play.ts";
import { TestClock } from "../../support/test-clock.ts";

// A day's play is added up once the day has ended, into one row for each member and game. A day's play is read from the
// sessions that started up to 24 hours before it began, because a session takes beats for 24 hours and can cross
// midnight. The tests share a database and walk one stretch of December 2026 in order: each rolls up the day before the
// next one's, and each looks only at the people and games it made.

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

/** The rows of a member's play, by day, as the screens and the pool will read them. */
async function playDays(userId: string) {
  const rows = await db().playDay.findMany({ where: { userId }, orderBy: { day: "asc" } });
  return rows.map((row) => ({ day: row.day.toISOString().slice(0, 10), seconds: row.seconds }));
}

async function roll(now: string) {
  return rollUpPlayDays({ db: db(), clock: new TestClock(now) });
}

describe("rollUpPlayDays", () => {
  it("adds up a member's play on a game for a finished day", async () => {
    const user = await createUser(db());
    const game = await addGame(db());
    // 12:00 on 5 December in Chicago, 80 beats 15 seconds apart: 20 minutes.
    await addSession(db(), game, {
      userId: user,
      basis: "member",
      startedAt: "2026-12-05T18:00:00Z",
      beats: 80,
      everySeconds: 15,
    });
    expect(await roll("2026-12-06T12:00:00Z")).toEqual({ days: ["2026-12-05"] });
    expect(await playDays(user)).toEqual([{ day: "2026-12-05", seconds: 1200 }]);
  });

  it("does not touch a day that has not ended", async () => {
    const user = await createUser(db());
    const game = await addGame(db());
    await addSession(db(), game, {
      userId: user,
      basis: "member",
      startedAt: "2026-12-06T18:00:00Z",
      beats: 40,
      everySeconds: 15,
    });
    // 14:00 on the 6th in Chicago: the day is not over.
    expect(await roll("2026-12-06T20:00:00Z")).toEqual({ days: [] });
    expect(await playDays(user)).toEqual([]);
  });

  it("counts only members' play", async () => {
    const free = await createUser(db());
    const staff = await createUser(db());
    const own = await createUser(db());
    const game = await addGame(db());
    const day = { startedAt: "2026-12-06T19:00:00Z", beats: 40, everySeconds: 15 };
    await addSession(db(), game, { ...day, userId: free, basis: "free_game" });
    await addSession(db(), game, { ...day, userId: staff, basis: "staff" });
    await addSession(db(), game, { ...day, userId: own, basis: "own_game" });
    expect(await roll("2026-12-07T12:00:00Z")).toEqual({ days: ["2026-12-06"] });
    for (const user of [free, staff, own]) expect(await playDays(user)).toEqual([]);
  });

  it("counts two tabs once and stops at three hours", async () => {
    // Review Focus 6
    const twoTabs = await createUser(db());
    const long = await createUser(db());
    const game = await addGame(db());
    // Two tabs of one game: 15:00 to 16:00 and 15:30 to 16:30 (Chicago 09:00 to 10:30): 90 minutes, not 120.
    const tab = { userId: twoTabs, basis: "member", beats: 120, everySeconds: 30 } as const;
    await addSession(db(), game, { ...tab, startedAt: "2026-12-07T15:00:00Z" });
    await addSession(db(), game, { ...tab, startedAt: "2026-12-07T15:30:00Z" });
    // Five hours in one session: three hours count.
    await addSession(db(), game, {
      userId: long,
      basis: "member",
      startedAt: "2026-12-07T15:00:00Z",
      beats: 600,
      everySeconds: 30,
    });
    expect(await roll("2026-12-08T12:00:00Z")).toEqual({ days: ["2026-12-07"] });
    expect(await playDays(twoTabs)).toEqual([{ day: "2026-12-07", seconds: 5400 }]);
    expect(await playDays(long)).toEqual([{ day: "2026-12-07", seconds: 10_800 }]);
  });

  it("splits a session that crosses midnight between its two days", async () => {
    const user = await createUser(db());
    const game = await addGame(db());
    // 23:55 on the 8th in Chicago (05:55 UTC on the 9th), beats for ten minutes.
    await addSession(db(), game, {
      userId: user,
      basis: "member",
      startedAt: "2026-12-09T05:55:00Z",
      beats: 40,
      everySeconds: 15,
    });
    expect(await roll("2026-12-10T12:00:00Z")).toEqual({ days: ["2026-12-08", "2026-12-09"] });
    expect(await playDays(user)).toEqual([
      { day: "2026-12-08", seconds: 300 },
      { day: "2026-12-09", seconds: 300 },
    ]);
  });

  it("leaves out the play of anyone who is staff, whatever their role", async () => {
    // Coordinator, 2026-11-14: any staff member's play is staff play, though slice 2 records `staff` only for the game roles.
    const staffer = await createUser(db());
    await db().staffAssignment.create({ data: { userId: staffer, role: "finance" } });
    const game = await addGame(db());
    await addSession(db(), game, {
      userId: staffer,
      basis: "member",
      startedAt: "2026-12-10T18:00:00Z",
      beats: 40,
      everySeconds: 15,
    });
    expect(await roll("2026-12-11T12:00:00Z")).toEqual({ days: ["2026-12-10"] });
    expect(await playDays(staffer)).toEqual([]);
  });

  it("marks a day done even when nobody played, and never adds a day up twice", async () => {
    // Review Focus 9
    expect(await roll("2026-12-12T12:00:00Z")).toEqual({ days: ["2026-12-11"] });
    expect(await db().playDayRun.count({ where: { day: new Date("2026-12-11T00:00:00Z") } })).toBe(1);
    expect(await roll("2026-12-12T13:00:00Z")).toEqual({ days: [] });
    expect(await db().playDayRun.count({ where: { day: new Date("2026-12-11T00:00:00Z") } })).toBe(1);
  });

  it("catches up after missed days, oldest first", async () => {
    const user = await createUser(db());
    const game = await addGame(db());
    await addSession(db(), game, {
      userId: user,
      basis: "member",
      startedAt: "2026-12-12T18:00:00Z",
      beats: 40,
      everySeconds: 15,
    });
    await addSession(db(), game, {
      userId: user,
      basis: "member",
      startedAt: "2026-12-14T18:00:00Z",
      beats: 20,
      everySeconds: 15,
    });
    expect(await roll("2026-12-16T12:00:00Z")).toEqual({
      days: ["2026-12-12", "2026-12-13", "2026-12-14", "2026-12-15"],
    });
    expect(await playDays(user)).toEqual([
      { day: "2026-12-12", seconds: 600 },
      { day: "2026-12-14", seconds: 300 },
    ]);
  });
});

describe("the day the clocks change", () => {
  it("counts a session started in the first hour of a 25-hour day", async () => {
    // Review Focus 6 and 22. 7 November 2027 is 25 hours long in Chicago: 00:30 is 05:30 UTC, and the day began at
    // 05:00 UTC. The day's own first hour is not lost to a window measured back from its end.
    const own = await startTestDatabase();
    try {
      const user = await createUser(own.prisma);
      const game = await addGame(own.prisma);
      await addSession(own.prisma, game, {
        userId: user,
        basis: "member",
        startedAt: "2027-11-07T05:30:00Z",
        beats: 40,
        everySeconds: 15,
      });
      const { days } = await rollUpPlayDays({ db: own.prisma, clock: new TestClock("2027-11-08T12:00:00Z") });
      expect(days).toEqual(["2027-11-07"]);
      const rows = await own.prisma.playDay.findMany({ where: { userId: user } });
      expect(rows.map((row) => row.seconds)).toEqual([600]);
    } finally {
      await own.stop();
    }
  });
});
