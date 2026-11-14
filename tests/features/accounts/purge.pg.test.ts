import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  purgeDueAccounts,
  requestDeletion,
  restoreOnSignIn,
} from "../../../src/features/accounts/deletion.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// The daily job that finishes a deletion once its 14 days are over.

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

// The test file shares one database, so a deletion an earlier test left waiting would come due in a later test that
// moves the clock on. Each test starts with none waiting.
beforeEach(async () => {
  await db().deletionRequest.updateMany({
    where: { cancelledAt: null, purgedAt: null },
    data: { cancelledAt: new Date(0) },
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;
const START = "2026-10-14T17:00:00Z";

let made = 0;

/** A person who has everything the purge removes: a password, a session, and a mail link waiting for them. */
async function seedPerson() {
  made += 1;
  const email = `leaving-${String(made)}@example.test`;
  const user = await db().user.create({
    data: {
      name: "Leaving",
      email,
      emailVerified: true,
      image: "https://example.test/me.png",
      adultOn: new Date("2030-01-01"),
    },
  });
  await db().account.create({
    data: { userId: user.id, accountId: user.id, providerId: "credential", password: "hash" },
  });
  await db().session.create({
    data: { userId: user.id, token: `token-${user.id}`, expiresAt: new Date("2026-12-01T00:00:00Z") },
  });
  // The three ways a mail link is stored: by address, by address in the value, and by the person's id.
  const expiresAt = new Date("2026-12-01T00:00:00Z");
  await db().verification.createMany({
    data: [
      { identifier: email, value: "token-a", expiresAt },
      { identifier: "reset-password:abc", value: user.id, expiresAt },
      { identifier: "email-otp", value: email, expiresAt },
    ],
  });
  return { id: user.id, email };
}

/** Asks to be deleted at START, with a clock the test can move on. */
async function askToBeDeleted(userId: string) {
  const clock = new TestClock(START);
  await requestDeletion({ prisma: db(), clock }, userId);
  return clock;
}

describe("purgeDueAccounts", () => {
  it("leaves an account alone until its 14 days are over", async () => {
    const { id } = await seedPerson();
    const clock = await askToBeDeleted(id);

    clock.advance(13 * DAY_MS);

    expect(await purgeDueAccounts({ prisma: db(), clock })).toBe(0);
    const user = await db().user.findUniqueOrThrow({ where: { id } });
    expect(user.status).toBe("pending_deletion");
    expect(user.name).toBe("Leaving");
    expect(await db().account.count({ where: { userId: id } })).toBe(1);
  });

  it("removes the email, the password and the sessions, keeps the row, and marks the request done", async () => {
    const { id, email } = await seedPerson();
    const clock = await askToBeDeleted(id);
    await db().session.create({
      data: { userId: id, token: `late-${id}`, expiresAt: new Date("2026-12-01T00:00:00Z") },
    });

    clock.advance(15 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock })).toBe(1);

    expect(await db().user.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "deleted",
      email: `deleted-${id}@deleted.invalid`,
      name: "Deleted",
      emailVerified: false,
      image: null,
      adultOn: null,
    });
    expect(await db().account.count({ where: { userId: id } })).toBe(0);
    expect(await db().session.count({ where: { userId: id } })).toBe(0);
    expect(
      await db().verification.count({
        where: { OR: [{ identifier: email }, { value: email }, { value: id }] },
      }),
    ).toBe(0);
    expect((await db().deletionRequest.findFirstOrThrow({ where: { userId: id } })).purgedAt).toEqual(
      new Date(clock.epochMs()),
    );
  });

  it("does nothing the second time", async () => {
    const { id } = await seedPerson();
    const clock = await askToBeDeleted(id);
    clock.advance(15 * DAY_MS);
    await purgeDueAccounts({ prisma: db(), clock });

    expect(await purgeDueAccounts({ prisma: db(), clock })).toBe(0);
  });

  it("skips a request that signing in cancelled", async () => {
    const { id } = await seedPerson();
    const clock = await askToBeDeleted(id);
    clock.advance(3 * DAY_MS);
    expect(await restoreOnSignIn(db(), clock, id)).toBe(true);

    clock.advance(12 * DAY_MS);

    expect(await purgeDueAccounts({ prisma: db(), clock })).toBe(0);
    const user = await db().user.findUniqueOrThrow({ where: { id } });
    expect(user.status).toBe("active");
    expect(user.name).toBe("Leaving");
  });

  it("lets the same address sign up again afterwards", async () => {
    const { id, email } = await seedPerson();
    const clock = await askToBeDeleted(id);
    clock.advance(15 * DAY_MS);
    await purgeDueAccounts({ prisma: db(), clock });

    const again = await db().user.create({ data: { name: "Back", email } });

    expect(again.id).not.toBe(id);
  });
});
