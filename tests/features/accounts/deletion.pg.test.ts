import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requestDeletion, restoreOnSignIn } from "../../../src/features/accounts/deletion.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// "Delete my account": 14 days to change one's mind, then the daily job (purge.pg.test.ts) finishes it.

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

const NOW = "2026-10-14T17:00:00Z";
const IN_14_DAYS = new Date("2026-10-28T17:00:00Z");

function depsAt(at: string) {
  return { prisma: db(), clock: new TestClock(at) };
}

/** Gives a person a signed-in session, as the people who ask to be deleted have. */
async function signIn(userId: string, token: string): Promise<void> {
  await db().session.create({
    data: { token, userId, expiresAt: new Date("2026-12-01T00:00:00Z") },
  });
}

describe("requestDeletion", () => {
  it("starts the 14 days, marks the account and signs out every session", async () => {
    const userId = await createUser(db());
    await signIn(userId, `first-${userId}`);
    await signIn(userId, `second-${userId}`);

    expect(await requestDeletion(depsAt(NOW), userId)).toEqual({ purgeAfter: IN_14_DAYS });

    const user = await db().user.findUniqueOrThrow({
      where: { id: userId },
      include: { deletionRequests: true },
    });
    expect(user.status).toBe("pending_deletion");
    expect(user.deletionRequests).toMatchObject([
      { requestedAt: new Date(NOW), purgeAfter: IN_14_DAYS, cancelledAt: null, purgedAt: null },
    ]);
    expect(await db().session.count({ where: { userId } })).toBe(0);
  });

  it("answers the first date again instead of starting a second request", async () => {
    const userId = await createUser(db());
    await requestDeletion(depsAt(NOW), userId);

    expect(await requestDeletion(depsAt("2026-10-15T09:00:00Z"), userId)).toEqual({
      purgeAfter: IN_14_DAYS,
    });
    expect(await db().deletionRequest.count({ where: { userId } })).toBe(1);
  });

  it("leaves one open request when two arrive at the same moment, and answers both the same date", async () => {
    const userId = await createUser(db());

    const answers = await Promise.all([
      requestDeletion(depsAt(NOW), userId),
      requestDeletion(depsAt(NOW), userId),
    ]);

    expect(answers).toEqual([{ purgeAfter: IN_14_DAYS }, { purgeAfter: IN_14_DAYS }]);
    expect(await db().deletionRequest.count({ where: { userId } })).toBe(1);
  });

  it("refuses a person with staff access, and changes nothing", async () => {
    const userId = await createUser(db());
    await signIn(userId, `staff-${userId}`);
    await db().staffAssignment.create({ data: { userId, role: "curator" } });

    expect(await requestDeletion(depsAt(NOW), userId)).toBe("staff");

    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).status).toBe("active");
    expect(await db().deletionRequest.count({ where: { userId } })).toBe(0);
    expect(await db().session.count({ where: { userId } })).toBe(1);
  });
});

describe("restoreOnSignIn", () => {
  it("cancels a waiting deletion when the person signs in within the 14 days", async () => {
    const userId = await createUser(db());
    await requestDeletion(depsAt(NOW), userId);

    const day13 = new TestClock("2026-10-27T17:00:00Z");
    expect(await restoreOnSignIn(db(), day13, userId)).toBe(true);

    const user = await db().user.findUniqueOrThrow({
      where: { id: userId },
      include: { deletionRequests: true },
    });
    expect(user.status).toBe("active");
    expect(user.deletionRequests[0]?.cancelledAt).toEqual(new Date("2026-10-27T17:00:00Z"));
  });

  it("changes nothing once the 14 days are over", async () => {
    const userId = await createUser(db());
    await requestDeletion(depsAt(NOW), userId);

    expect(await restoreOnSignIn(db(), new TestClock("2026-10-28T17:00:00Z"), userId)).toBe(false);

    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).status).toBe("pending_deletion");
    expect((await db().deletionRequest.findFirstOrThrow({ where: { userId } })).cancelledAt).toBeNull();
  });

  it("answers false when nothing is waiting", async () => {
    const userId = await createUser(db());
    expect(await restoreOnSignIn(db(), new TestClock(NOW), userId)).toBe(false);
  });
});
