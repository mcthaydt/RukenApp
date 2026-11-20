import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { GitHub } from "../../../src/features/games/github.ts";
import { newPublicId } from "../../../src/features/games/ids.ts";
import { createGamesService, type GamesService } from "../../../src/features/games/service.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";
import { TestClock } from "../../support/test-clock.ts";

// How many games were decided, and how many of them got in, measured from staff's decisions: each game counts once, by
// the day of its first decision, over the last 90 days.

let database: TestDatabase | undefined;
let clock: TestClock;
let service: GamesService;
let makerUserId: string;

const github: GitHub = {
  commitOf: () => Promise.reject(new Error("not used")),
  installationOf: () => Promise.resolve(null),
  tarball: () => Promise.reject(new Error("not used")),
};

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

// Decisions are never deleted, so each test stands a year after the last: what an earlier test decided is long out of
// its 90 days.
let year = 2026;

beforeEach(async () => {
  year += 1;
  clock = new TestClock(`${String(year)}-11-17T12:00:00Z`);
  service = createGamesService({ db: db(), clock, files: new MemoryFileStore(), github });
  makerUserId = await createUser(db());
});

let made = 0;

/** A game with one pull, and staff's decisions on it, each on the day given (days before now). */
async function gameDecided(
  decisions: {
    decision: "accepted" | "sent_back";
    daysAgo: number;
    /** A held decision: the day it was to go out (days before now), and what its day did with it. Absent means it took effect at once. */
    held?: { goesOutDaysAgo: number; result?: "applied" | "lapsed" };
  }[],
): Promise<string> {
  made += 1;
  const game = await db().game.create({
    data: { publicId: newPublicId(), slug: `rate-game-${String(made)}`, makerUserId, name: "A game" },
  });
  const pull = await db().gamePull.create({
    data: {
      id: crypto.randomUUID(),
      gameId: game.id,
      commitSha: "a".repeat(40),
      fileCount: 1,
      totalBytes: 10n,
      connectHosts: [],
      pulledAt: new Date(clock.epochMs()),
    },
  });
  for (const one of decisions) {
    const goesOutAt = one.held === undefined ? null : clock.epochMs() - one.held.goesOutDaysAgo * 86_400_000;
    const review = await db().gameReview.create({
      data: {
        gameId: game.id,
        pullId: pull.id,
        staffUserId: makerUserId,
        decision: one.decision,
        decidedAt: new Date(clock.epochMs() - one.daysAgo * 86_400_000),
        goesOutOn: goesOutAt === null ? null : new Date(new Date(goesOutAt).toISOString().slice(0, 10)),
      },
    });
    if (one.held?.result !== undefined && goesOutAt !== null) {
      const day = new Date(new Date(goesOutAt).toISOString().slice(0, 10));
      await db().decisionDay.upsert({
        where: { day },
        update: {},
        create: { day, seats: 10, wentOutAt: new Date(goesOutAt) },
      });
      await db().decisionOutcome.create({ data: { reviewId: review.id, result: one.held.result } });
    }
  }
  return game.id;
}

describe("acceptance", () => {
  it("is nothing decided when no game has a decision", async () => {
    expect(await service.acceptance()).toEqual({ decided: 0, accepted: 0 });
  });

  it("counts each game once, as got in when any decision on it was a yes", async () => {
    await gameDecided([{ decision: "accepted", daysAgo: 3 }]);
    // Sent back twice, then let in: one game, and it got in.
    await gameDecided([
      { decision: "sent_back", daysAgo: 10 },
      { decision: "sent_back", daysAgo: 8 },
      { decision: "accepted", daysAgo: 5 },
    ]);
    // Sent back and never sent again: one game that did not get in.
    await gameDecided([{ decision: "sent_back", daysAgo: 4 }]);

    expect(await service.acceptance()).toEqual({ decided: 3, accepted: 2 });
  });

  it("leaves out a game whose first decision is older than 90 days, even with a newer one", async () => {
    // Let in long ago, and an update of it accepted this week: it is not a new game this season.
    await gameDecided([
      { decision: "accepted", daysAgo: 120 },
      { decision: "accepted", daysAgo: 2 },
    ]);
    await gameDecided([{ decision: "sent_back", daysAgo: 89 }]);

    expect(await service.acceptance()).toEqual({ decided: 1, accepted: 0 });
  });

  it("leaves out a held decision until its day has gone out, and a lapsed one always", async () => {
    // Held for a day that has not gone out yet: no outcome, so nothing took effect.
    await gameDecided([{ decision: "accepted", daysAgo: 1, held: { goesOutDaysAgo: -3 } }]);
    await gameDecided([{ decision: "accepted", daysAgo: 6, held: { goesOutDaysAgo: 1, result: "lapsed" } }]);
    expect(await service.acceptance()).toEqual({ decided: 0, accepted: 0 });
  });

  it("counts a held decision that went out as applied, dated by the day it went out", async () => {
    // Decided 100 days ago but it went out 5 days ago: inside the window. One decided 10 days ago that went out 95 days
    // ago is not possible, so the other side of the window is a send back that went out 91 days ago.
    await gameDecided([
      { decision: "accepted", daysAgo: 100, held: { goesOutDaysAgo: 5, result: "applied" } },
    ]);
    await gameDecided([
      { decision: "sent_back", daysAgo: 92, held: { goesOutDaysAgo: 91, result: "applied" } },
    ]);
    expect(await service.acceptance()).toEqual({ decided: 1, accepted: 1 });
  });

  it("counts a game sent back on decision day and let in later as one game that got in", async () => {
    await gameDecided([
      { decision: "sent_back", daysAgo: 20, held: { goesOutDaysAgo: 14, result: "applied" } },
      { decision: "accepted", daysAgo: 8, held: { goesOutDaysAgo: 7, result: "applied" } },
    ]);
    expect(await service.acceptance()).toEqual({ decided: 1, accepted: 1 });
  });
});

describe("the Accepted screen", () => {
  const letIn = {
    decision: "accepted" as const,
    daysAgo: 1,
    held: { goesOutDaysAgo: 0, result: "applied" as const },
  };

  async function live(id: string): Promise<void> {
    const pull = await db().gamePull.findFirstOrThrow({ where: { gameId: id } });
    await db().game.update({
      where: { id },
      data: {
        state: "live",
        livePullId: pull.id,
        oneLine: "A line.",
        playsOn: "phone_and_computer",
        repoFullName: "maker/game",
        ageRating: "age_12",
      },
    });
  }

  it("shows for a live game a decision day let in, with that day's count, until it is seen", async () => {
    const first = await gameDecided([letIn]);
    const second = await gameDecided([letIn]);
    await live(first);
    await live(second);

    expect(await service.acceptedScreenFor(first)).toEqual({ count: 2 });
    await service.markAcceptedSeen(first);
    expect(await service.acceptedScreenFor(first)).toBeNull();
    expect(await service.acceptedScreenFor(second)).toEqual({ count: 2 });
  });

  it("does not count a yes that lapsed, nor show for a held yes that has not gone out", async () => {
    const letInGame = await gameDecided([letIn]);
    await gameDecided([{ ...letIn, held: { goesOutDaysAgo: 0, result: "lapsed" } }]);
    const held = await gameDecided([{ decision: "accepted", daysAgo: 1, held: { goesOutDaysAgo: -3 } }]);
    await live(letInGame);
    await live(held);

    expect(await service.acceptedScreenFor(letInGame)).toEqual({ count: 1 });
    expect(await service.acceptedScreenFor(held)).toBeNull();
  });

  it("does not show for a yes made at once, a game that is not live, or a game sent back on its day", async () => {
    const atOnce = await gameDecided([{ decision: "accepted", daysAgo: 1 }]);
    const waiting = await gameDecided([letIn]);
    const sentBack = await gameDecided([{ ...letIn, decision: "sent_back" }]);
    await live(atOnce);
    await live(sentBack);

    expect(await service.acceptedScreenFor(atOnce)).toBeNull();
    expect(await service.acceptedScreenFor(waiting)).toBeNull();
    expect(await service.acceptedScreenFor(sentBack)).toBeNull();
  });
});
