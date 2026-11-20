import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { GitHub } from "../../../src/features/games/github.ts";
import { newPublicId } from "../../../src/features/games/ids.ts";
import schedule from "../../../src/features/games/library/decision-days.json" with { type: "json" };
import type { DecisionSchedule } from "../../../src/features/games/seats.ts";
import { createGamesService, type GamesService } from "../../../src/features/games/service.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";
import { TestClock } from "../../support/test-clock.ts";

// Decision day: the Owner's decision on a new game is held until Friday noon New York time, then every held decision
// goes out together. Here the ritual is on from Friday 27 November 2026 with 2 seats, so the seat limit is easy to reach.

const noGitHub: GitHub = {
  commitOf: () => Promise.reject(new Error("this test reaches for GitHub")),
  installationOf: () => Promise.resolve(null),
  tarball: () => Promise.reject(new Error("this test reaches for GitHub")),
};
const ON: DecisionSchedule = { ...(schedule as DecisionSchedule), firstDay: "2026-11-27", startSeats: 2 };

let database: TestDatabase | undefined;
let clock: TestClock;
let service: GamesService;

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
beforeEach(async () => {
  // Every test starts with no games, so one test's held yeses never take another's seats. The tables refuse a delete, not a truncate.
  await db().$executeRawUnsafe(
    'TRUNCATE "DecisionOutcome", "DecisionDay", "GameReviewPart", "GameReview", "GamePull", "GameClip", "Game" CASCADE',
  );
  // A Tuesday. The first decision day is Friday 27 November, at 17:00 UTC (noon in New York).
  clock = new TestClock("2026-11-24T15:00:00Z");
  service = createGamesService({
    db: db(),
    clock,
    files: new MemoryFileStore(),
    github: noGitHub,
    schedule: ON,
  });
});

let made = 0;
async function addPull(gameId: string): Promise<string> {
  clock.advance(1_000);
  const pull = await db().gamePull.create({
    data: {
      id: crypto.randomUUID(),
      gameId,
      commitSha: "a".repeat(40),
      fileCount: 3,
      totalBytes: 1000n,
      connectHosts: [],
      pulledAt: new Date(clock.epochMs()),
    },
  });
  return pull.id;
}

/** A game waiting for the Owner's decision, as a maker leaves it after Check and send. */
async function waitingGame(name = "A game") {
  made += 1;
  clock.advance(1_000);
  const game = await db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `held-game-${String(made)}`,
      makerUserId: await createUser(db()),
      name,
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
      ageRating: "age_12",
      state: "waiting",
      pendingSince: new Date(clock.epochMs()),
    },
  });
  const pullId = await addPull(game.id);
  await db().game.update({ where: { id: game.id }, data: { pendingPullId: pullId } });
  return { ...game, pullId };
}

const row = (id: string) => db().game.findUniqueOrThrow({ where: { id } });
const reviews = (gameId: string) => db().gameReview.findMany({ where: { gameId } });
const FRIDAY_NOON = "2026-11-27T17:00:00Z";

describe("holding a new game's decision", () => {
  it("holds a yes for the coming Friday, takes a seat and leaves the game waiting", async () => {
    const game = await waitingGame();
    const staff = await createUser(db());

    const made = await service.accept(game.id, staff);

    expect(made).toEqual({ held: true, day: "2026-11-27", seats: 2, taken: 1 });
    expect(await row(game.id)).toMatchObject({
      state: "waiting",
      pendingPullId: game.pullId,
      livePullId: null,
    });
    const [review] = await reviews(game.id);
    expect(review?.goesOutOn?.toISOString().slice(0, 10)).toBe("2026-11-27");
    expect(await service.thisWeek()).toMatchObject({ words: "Friday 27 November", seats: 2, taken: 1 });
  });

  it("shows the maker nothing: no yes, no address kept, no fix list", async () => {
    const game = await waitingGame("Floor Fifty");
    await service.accept(game.id, await createUser(db()));
    const other = await waitingGame();
    await service.sendBack(other.id, await createUser(db()), [
      { part: "name", reason: "something_else", note: "No." },
    ]);

    expect((await service.gameForMaker(game.slug, game.makerUserId))?.everLive).toBe(false);
    const sent = await service.gameForMaker(other.slug, other.makerUserId);
    expect(sent).toMatchObject({ toFix: [], sentBackLast: false, state: "waiting" });
    // The address still follows the name, since no yes took effect.
    expect(
      await service.saveAnswer(game.id, game.makerUserId, { question: "name", name: "Floor Sixty" }),
    ).toEqual({
      slug: "floor-sixty",
    });
    expect(await service.gamesOf(other.makerUserId)).toMatchObject([{ words: "Waiting for review" }]);
  });

  it("refuses a yes when the week's seats are taken, and writes nothing", async () => {
    for (let i = 0; i < 2; i += 1) await service.accept((await waitingGame()).id, await createUser(db()));
    const third = await waitingGame();

    await expect(service.accept(third.id, await createUser(db()))).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This week's 2 seats are taken. Send it back, or leave it for next week.",
    });
    expect(await reviews(third.id)).toEqual([]);
  });

  it("takes no seat for a send back, even when the seats are gone", async () => {
    for (let i = 0; i < 2; i += 1) await service.accept((await waitingGame()).id, await createUser(db()));
    const third = await waitingGame();

    const made = await service.sendBack(third.id, await createUser(db()), [
      { part: "name", reason: "something_else", note: "No." },
    ]);

    expect(made).toMatchObject({ held: true, day: "2026-11-27", taken: 2 });
  });

  it("holds a decision as final, until the game changes and it lapses", async () => {
    const game = await waitingGame();
    const staff = await createUser(db());
    await service.accept(game.id, staff);

    await expect(service.accept(game.id, staff)).rejects.toMatchObject({
      code: "CONFLICT",
      message: `You already decided on A game. It goes out on Friday 27 November.`,
    });

    clock.advance(60_000);
    await service.saveAnswer(game.id, game.makerUserId, { question: "line", oneLine: "A different line." });
    expect((await service.thisWeek())?.taken).toBe(0);
    expect((await service.waitingGames())[0]).toMatchObject({ decided: null, kind: "game" });
    clock.advance(60_000);
    await expect(service.accept(game.id, staff)).resolves.toMatchObject({ held: true, taken: 1 });
  });

  it.each([
    ["a new video", (id: string, maker: string) => service.saveClip(id, "upright", mp4()).then(() => maker)],
    [
      "a changed rating",
      (id: string, maker: string) => service.saveAnswer(id, maker, { question: "age", ageRating: "age_7" }),
    ],
  ])("lapses a yes when the maker makes %s", async (_what, change) => {
    const game = await waitingGame();
    await service.accept(game.id, await createUser(db()));
    clock.advance(60_000);

    await change(game.id, game.makerUserId);

    expect((await service.thisWeek())?.taken).toBe(0);
  });

  it("lapses a yes when the maker's new files replace the waiting ones", async () => {
    const game = await waitingGame();
    await service.accept(game.id, await createUser(db()));
    clock.advance(60_000);
    const newer = await addPull(game.id);
    await db().game.update({ where: { id: game.id }, data: { pendingPullId: newer } });

    expect((await service.thisWeek())?.taken).toBe(0);
  });

  it("never lets two yeses at the last seat both in", async () => {
    await service.accept((await waitingGame()).id, await createUser(db()));
    const a = await waitingGame();
    const b = await waitingGame();
    const staff = await createUser(db());

    const results = await Promise.allSettled([service.accept(a.id, staff), service.accept(b.id, staff)]);

    expect(results.filter((one) => one.status === "fulfilled")).toHaveLength(1);
    expect((await service.thisWeek())?.taken).toBe(2);
  });

  it("holds a yes made while a day is going out for the next day, never on the day that has gone", async () => {
    const game = await waitingGame();
    const staff = await createUser(db());
    clock.set("2026-11-27T16:59:59Z");
    let letGo: () => void = () => undefined;
    const goes = new Promise<void>((resolve) => (letGo = resolve));
    let locked: () => void = () => undefined;
    const isLocked = new Promise<void>((resolve) => (locked = resolve));
    // A release in the middle of its transaction: it holds the lock and has written the day's row.
    const release = db().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7340113)`;
      await tx.decisionDay.create({
        data: { day: new Date("2026-11-27T00:00:00Z"), seats: 2, wentOutAt: new Date() },
      });
      locked();
      await goes;
    });
    await isLocked;

    const yes = service.accept(game.id, staff);
    await new Promise((resolve) => setTimeout(resolve, 200));
    clock.set("2026-11-27T17:00:01Z");
    letGo();
    await release;

    expect(await yes).toMatchObject({ held: true, day: "2026-12-04" });
  });

  it("holds a decision made after noon on decision day for the next Friday", async () => {
    const game = await waitingGame();
    clock.set(FRIDAY_NOON);

    expect(await service.accept(game.id, await createUser(db()))).toMatchObject({ day: "2026-12-04" });
  });
});

describe("what is decided at once", () => {
  it("puts a live game's update live at once and takes no seat", async () => {
    const game = await waitingGame();
    await db().game.update({
      where: { id: game.id },
      data: { state: "live", livePullId: game.pullId, pendingPullId: null },
    });
    const update = await addPull(game.id);
    await db().game.update({
      where: { id: game.id },
      data: { pendingPullId: update, pendingSince: new Date() },
    });
    await db().gameReview.create({
      data: {
        gameId: game.id,
        pullId: game.pullId,
        staffUserId: await createUser(db()),
        decision: "accepted",
        decidedAt: new Date("2026-11-01T00:00:00Z"),
      },
    });

    expect(await service.accept(game.id, await createUser(db()))).toEqual({ held: false });

    expect(await row(game.id)).toMatchObject({ state: "live", livePullId: update });
    expect((await service.thisWeek())?.taken).toBe(0);
  });

  it("puts a game that was live before back at once, takes no seat and skips the Accepted screen", async () => {
    const game = await waitingGame();
    await db().gameReview.create({
      data: {
        gameId: game.id,
        pullId: game.pullId,
        staffUserId: await createUser(db()),
        decision: "accepted",
        decidedAt: new Date("2026-11-01T00:00:00Z"),
      },
    });
    expect((await service.waitingGames())[0]).toMatchObject({ kind: "back" });

    expect(await service.accept(game.id, await createUser(db()))).toEqual({ held: false });

    const after = await row(game.id);
    expect(after.state).toBe("live");
    expect(after.acceptedSeenAt).not.toBeNull();
    expect((await service.thisWeek())?.taken).toBe(0);
  });

  it("acts at once while the schedule is off", async () => {
    const off = createGamesService({
      db: db(),
      clock,
      files: new MemoryFileStore(),
      github: noGitHub,
      schedule: { ...ON, firstDay: null },
    });
    const game = await waitingGame();

    expect(await off.accept(game.id, await createUser(db()))).toEqual({ held: false });
    expect((await row(game.id)).state).toBe("live");
    expect(await off.thisWeek()).toBeNull();
  });
});

describe("sending a decision day out", () => {
  it("does nothing before the moment, and says so", async () => {
    await service.accept((await waitingGame()).id, await createUser(db()));
    clock.set("2026-11-27T16:59:00Z");

    expect(await service.sendOutDecisionDays()).toEqual([]);
    expect(await db().decisionDay.count()).toBe(0);
  });

  it("makes the yeses live and sends the others back together, records lapsed ones, and runs once", async () => {
    const yes = await waitingGame();
    const no = await waitingGame();
    const lapsedOne = await waitingGame();
    const staff = await createUser(db());
    await service.accept(yes.id, staff);
    await service.sendBack(no.id, staff, [{ part: "name", reason: "something_else", note: "Rename it." }]);
    await service.accept(lapsedOne.id, staff);
    clock.advance(60_000);
    await service.saveAnswer(lapsedOne.id, lapsedOne.makerUserId, { question: "line", oneLine: "Changed." });

    clock.set(FRIDAY_NOON);
    const says = await service.sendOutDecisionDays();

    expect(says).toEqual(["Friday 27 November went out: 1 got in, 1 went back."]);
    expect(await row(yes.id)).toMatchObject({ state: "live", livePullId: yes.pullId, pendingPullId: null });
    expect(await row(no.id)).toMatchObject({ state: "sent_back", toFix: ["name"], pendingPullId: null });
    expect(await row(lapsedOne.id)).toMatchObject({ state: "waiting", pendingPullId: lapsedOne.pullId });
    const outcomes = await db().decisionOutcome.findMany({ orderBy: { createdAt: "asc" } });
    expect(outcomes.map((one) => one.result).sort()).toEqual(["applied", "applied", "lapsed"]);
    expect(await db().decisionDay.findMany()).toMatchObject([{ seats: 2 }]);
    // What took effect is now what makers see.
    expect((await service.gameForMaker(yes.slug, yes.makerUserId))?.everLive).toBe(true);
    expect((await service.gameForMaker(no.slug, no.makerUserId))?.toFix).toHaveLength(1);
    expect((await row(yes.id)).acceptedSeenAt).toBeNull();

    expect(await service.sendOutDecisionDays()).toEqual([]);
    expect(await db().decisionDay.count()).toBe(1);
  });

  it("opens the Accepted screen for a game the release let in, and counts it in the rate", async () => {
    const yes = await waitingGame();
    const no = await waitingGame();
    const staff = await createUser(db());
    await service.accept(yes.id, staff);
    await service.sendBack(no.id, staff, [{ part: "name", reason: "something_else", note: "Rename it." }]);
    // Held: nothing shows until the day has gone out.
    expect(await service.acceptedScreenFor(yes.id)).toBeNull();
    expect(await service.acceptance()).toEqual({ decided: 0, accepted: 0 });

    clock.set(FRIDAY_NOON);
    await service.sendOutDecisionDays();

    expect(await service.acceptedScreenFor(yes.id)).toEqual({ count: 1 });
    expect(await service.acceptedScreenFor(no.id)).toBeNull();
    expect(await service.acceptance()).toEqual({ decided: 2, accepted: 1 });
    await service.markAcceptedSeen(yes.id);
    expect(await service.acceptedScreenFor(yes.id)).toBeNull();
  });

  it("sends missed days out oldest first, and a later day's decisions wait", async () => {
    const first = await waitingGame();
    await service.accept(first.id, await createUser(db()));
    clock.set(FRIDAY_NOON);
    clock.advance(60_000);
    const second = await waitingGame();
    await service.accept(second.id, await createUser(db()));
    const third = await waitingGame();
    clock.set("2026-12-04T17:00:00Z");
    clock.advance(60_000);
    // Both Fridays are due; the third game's decision is made after the second moment, for 11 December.
    await service.accept(third.id, await createUser(db()));

    const says = await service.sendOutDecisionDays();

    expect(says).toEqual([
      "Friday 27 November went out: 1 got in, 0 went back.",
      "Friday 4 December went out: 1 got in, 0 went back.",
    ]);
    expect((await row(third.id)).state).toBe("waiting");
  });

  it("answers 'went out' with the seats the day had", async () => {
    clock.set(FRIDAY_NOON);
    await service.sendOutDecisionDays();
    expect(await db().decisionDay.findMany()).toMatchObject([{ seats: 2 }]);
  });
});

function mp4(): { contentType: string; bytes: Uint8Array } {
  const bytes = new Uint8Array(32);
  bytes.set([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]);
  return { contentType: "video/mp4", bytes };
}
