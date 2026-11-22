import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keepPending, takePending } from "../../../src/features/accounts/pending-sign-up.ts";
import { makeAccount, removeHalfMadeAccount } from "../../../src/features/accounts/sign-up-account.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// The last step of sign-up: what better-auth leaves (a user with a number and a session) becomes an account that can
// sign in, in one transaction, or is taken back whole.

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

const SECRET = "test_secret_that_is_at_least_32_chars";
const clock = new TestClock("2026-11-17T12:00:00Z");
const ADULT_ON = new Date("2044-05-06T00:00:00Z");

let made = 0;

/** What better-auth's `verify` leaves: a user with a number, confirmed, and a session. No password, no age. */
async function bareUser(): Promise<{ userId: string; number: string }> {
  made += 1;
  const number = `+1312558${String(made).padStart(4, "0")}`;
  const user = await db().user.create({
    data: {
      name: "Player",
      email: `${String(made)}@phone.ruken.invalid`,
      phoneNumber: number,
      phoneNumberVerified: true,
    },
  });
  await db().session.create({
    data: { token: `token-${String(made)}`, userId: user.id, expiresAt: new Date("2030-01-01T00:00:00Z") },
  });
  return { userId: user.id, number };
}

const deps = () => ({ db: db(), clock, secret: SECRET });

describe("makeAccount", () => {
  it("gives the user the kept password and age and the time the code proved the number, and forgets what was kept", async () => {
    const { userId, number } = await bareUser();
    await keepPending(deps(), { number, browser: "a", passwordHash: "scrypt-hash", adultOn: ADULT_ON });
    await keepPending(deps(), { number, browser: "b", passwordHash: "other-hash", adultOn: ADULT_ON });

    await makeAccount(deps(), { userId, number, passwordHash: "scrypt-hash", adultOn: ADULT_ON });

    const account = await db().account.findFirstOrThrow({ where: { userId } });
    expect(account).toMatchObject({ providerId: "credential", accountId: userId, password: "scrypt-hash" });
    const user = await db().user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.adultOn).toEqual(ADULT_ON);
    expect(user.phoneConfirmedAt).toEqual(new Date(clock.epochMs()));
    expect(await takePending(deps(), { number, browser: "a" })).toBeNull();
    expect(await takePending(deps(), { number, browser: "b" })).toBeNull();
  });

  it("leaves an age that is already set as it is", async () => {
    const { userId, number } = await bareUser();
    await db().user.update({ where: { id: userId }, data: { adultOn: new Date("2030-01-01T00:00:00Z") } });
    await makeAccount(deps(), { userId, number, passwordHash: "hash", adultOn: ADULT_ON });
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).adultOn).toEqual(
      new Date("2030-01-01T00:00:00Z"),
    );
  });

  it("changes nothing at all when one write fails", async () => {
    const { userId, number } = await bareUser();
    await keepPending(deps(), { number, browser: "a", passwordHash: "hash", adultOn: ADULT_ON });
    // A second credential for the same person is refused by nothing in the schema, so make the transaction fail on a
    // user that does not exist instead.
    await expect(
      makeAccount(deps(), { userId: "no-such-user", number, passwordHash: "hash", adultOn: ADULT_ON }),
    ).rejects.toThrow();
    expect(await db().account.count({ where: { userId } })).toBe(0);
    expect(await takePending(deps(), { number, browser: "a" })).not.toBeNull();
  });
});

describe("removeHalfMadeAccount", () => {
  it("removes the user and its session, and nothing of anyone else", async () => {
    const half = await bareUser();
    const other = await bareUser();

    await removeHalfMadeAccount(db(), half.userId);

    expect(await db().user.count({ where: { id: half.userId } })).toBe(0);
    expect(await db().session.count({ where: { userId: half.userId } })).toBe(0);
    expect(await db().user.count({ where: { id: other.userId } })).toBe(1);
    expect(await db().session.count({ where: { userId: other.userId } })).toBe(1);
  });

  it("frees the number, so the next try is not told an account has it", async () => {
    const { userId, number } = await bareUser();
    await removeHalfMadeAccount(db(), userId);
    expect(await db().user.count({ where: { phoneNumber: number } })).toBe(0);
  });
});
