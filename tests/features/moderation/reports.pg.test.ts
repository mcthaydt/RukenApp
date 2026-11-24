import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPublicId } from "../../../src/features/games/ids.ts";
import { REPORT_LIMITS } from "../../../src/features/moderation/limits.ts";
import { createReports, type Reports } from "../../../src/features/moderation/reports.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createRateLimiter } from "../../../src/lib/server/rate-limit.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// Players' reports on games (report-a-game spec): one per person and game, read back, changed, taken back, limited.

let database: TestDatabase | undefined;
const clock = new TestClock("2026-11-24T12:00:00Z");
let reports: Reports;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

/** Small limits, so a test reaches them in a few sends. */
const LIMITS = { rules: [{ name: "hour", rule: { max: 3, windowMs: 60 * 60_000 } }] };

beforeAll(async () => {
  database = await startTestDatabase();
  reports = createReports({ db: db(), clock, limiter: createRateLimiter(db(), clock), limits: LIMITS });
});

afterAll(async () => {
  await database?.stop();
});

let made = 0;

async function newGame() {
  made += 1;
  const makerUserId = await createUser(db());
  return db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `reported-${String(made)}`,
      makerUserId,
      name: `Game ${String(made)}`,
    },
  });
}

describe("reports", () => {
  it("makes, reads back, changes and takes back one report", async () => {
    const player = await createUser(db());
    const game = await newGame();
    expect(await reports.mine(player, game.id)).toBeNull();

    expect(await reports.save(player, game, { reason: "gambling", note: "Slots in it." })).toBe("made");
    expect(await reports.mine(player, game.id)).toEqual({ reason: "gambling", note: "Slots in it." });

    clock.advance(60_000);
    expect(await reports.save(player, game, { reason: "ads", note: null })).toBe("changed");
    const rows = await db().gameReport.findMany({ where: { userId: player } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reason: "ads", note: null });
    expect(rows[0]?.changedAt.getTime()).toBeGreaterThan(rows[0]?.madeAt.getTime() ?? Infinity);

    await reports.withdraw(player, game.id);
    expect(await reports.mine(player, game.id)).toBeNull();
    await reports.withdraw(player, game.id);
  });

  it("makes one row from two sends at the same moment", async () => {
    const player = await createUser(db());
    const game = await newGame();
    const both = await Promise.all([
      reports.save(player, game, { reason: "sexual", note: null }),
      reports.save(player, game, { reason: "hateful", note: null }),
    ]);
    expect([...both].sort()).toEqual(["changed", "made"]);
    expect(await db().gameReport.count({ where: { userId: player, gameId: game.id } })).toBe(1);
  });

  it("refuses the maker's own game and counts nothing for it", async () => {
    const game = await newGame();
    expect(await reports.save(game.makerUserId, game, { reason: "broken", note: null })).toBe("own");
    expect(await db().gameReport.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("refuses a send past the limit and saves nothing; taking back is not counted", async () => {
    const player = await createUser(db());
    const games = [await newGame(), await newGame(), await newGame(), await newGame()];
    for (const game of games.slice(0, 3)) {
      expect(await reports.save(player, game, { reason: "other", note: null })).toBe("made");
      await reports.withdraw(player, game.id);
      await reports.withdraw(player, game.id);
    }
    const fourth = games[3];
    if (fourth === undefined) throw new Error("no fourth game");
    const refused = await reports.save(player, fourth, { reason: "other", note: null });
    expect(refused).toEqual({ limited: expect.any(Number) as number });
    expect(await db().gameReport.count({ where: { userId: player } })).toBe(0);

    clock.advance(60 * 60_000);
    expect(await reports.save(player, fourth, { reason: "other", note: null })).toBe("made");
  });

  it("lists reported games for review, most reported first, naming no reporter", async () => {
    await db().gameReport.deleteMany({});
    const once = await newGame();
    const twice = await newGame();
    const [a, b, c] = await Promise.all([createUser(db()), createUser(db()), createUser(db())]);
    await reports.save(a, once, { reason: "copied", note: "It's my game." });
    await reports.save(b, twice, { reason: "gambling", note: null });
    await reports.save(c, twice, { reason: "ads", note: "Ads every level." });
    const listed = await reports.forReview();
    expect(listed.map((one) => [one.game, one.count])).toEqual([
      [twice.slug, 2],
      [once.slug, 1],
    ]);
    expect(listed[1]).toMatchObject({
      name: once.name,
      reports: [{ reason: "Copied from someone else", note: "It's my game." }],
    });
    // Read as one piece of text, so a field added later cannot slip a reporter past this.
    const text = JSON.stringify(listed);
    for (const userId of [a, b, c]) {
      const person = await db().user.findUniqueOrThrow({ where: { id: userId } });
      for (const named of [person.id, person.phoneNumber, person.name, person.email])
        if (named !== null && named !== "") expect(text).not.toContain(named);
    }
  });

  it("answers each person only their own report", async () => {
    const [first, second] = [await createUser(db()), await createUser(db())];
    const game = await newGame();
    await reports.save(first, game, { reason: "ads", note: "Mine." });
    expect(await reports.mine(second, game.id)).toBeNull();
  });

  it("keeps the two later reasons, Graphic violence and A scam, and reads them back in words", async () => {
    await db().gameReport.deleteMany({});
    const player = await createUser(db());
    const game = await newGame();
    expect(await reports.save(player, game, { reason: "violence", note: null })).toBe("made");
    expect(await reports.mine(player, game.id)).toEqual({ reason: "violence", note: null });
    expect((await reports.forReview())[0]?.reports).toMatchObject([{ reason: "Graphic violence" }]);
    expect(await reports.save(player, game, { reason: "scam", note: "Asks for a card number." })).toBe(
      "changed",
    );
    expect(await reports.mine(player, game.id)).toEqual({ reason: "scam", note: "Asks for a card number." });
    expect((await reports.forReview())[0]?.reports).toMatchObject([
      { reason: "A scam or steals your info", note: "Asks for a card number." },
    ]);
  });

  it("refuses an unknown reason in the table too", async () => {
    const player = await createUser(db());
    const game = await newGame();
    await expect(
      db().$executeRaw`INSERT INTO "GameReport" (id, "userId", "gameId", reason, "madeAt", "changedAt")
        VALUES ('x-reason', ${player}, ${game.id}, 'boring', now(), now())`,
    ).rejects.toThrow();
  });

  it("keeps a note to 500 characters in the table too", async () => {
    const player = await createUser(db());
    const game = await newGame();
    await expect(
      db().gameReport.create({
        data: {
          userId: player,
          gameId: game.id,
          reason: "other",
          note: "x".repeat(501),
          madeAt: new Date(),
          changedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it("uses limits of an hour and a day, each within the time counters are kept", () => {
    expect(REPORT_LIMITS.rules.map((one) => one.name)).toEqual(["hour", "day"]);
  });
});
