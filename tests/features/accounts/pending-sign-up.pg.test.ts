import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  forgetPending,
  keepPending,
  newBrowserValue,
  PENDING_MS,
  takePending,
  type PendingDeps,
} from "../../../src/features/accounts/pending-sign-up.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// A sign-up is bound to the browser that started it, so a code typed in one browser finishes only that browser's
// sign-up, and a stranger who starts one for someone's number cannot change the password the real person's code sets.

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

const SECRET = ["test", "secret", "that", "is", "long", "enough"].join("-");
const NUMBER = "+13125551234";
const ADULT_ON = new Date("2044-05-06T00:00:00Z");

function depsAt(clock: TestClock): PendingDeps {
  return { db: db(), clock, secret: SECRET };
}

describe("a pending sign-up", () => {
  it("is kept for the browser that started it, and given back to it", async () => {
    const deps = depsAt(new TestClock("2026-11-17T12:00:00Z"));
    await keepPending(deps, { number: NUMBER, browser: "browser-a", passwordHash: "hash-a", adultOn: ADULT_ON });

    expect(await takePending(deps, { number: NUMBER, browser: "browser-a" })).toEqual({
      passwordHash: "hash-a",
      adultOn: ADULT_ON,
    });
  });

  it("is not given to another browser, or for another number", async () => {
    const deps = depsAt(new TestClock("2026-11-17T12:00:00Z"));
    await keepPending(deps, { number: "+13125551001", browser: "browser-a", passwordHash: "hash-a", adultOn: ADULT_ON });

    expect(await takePending(deps, { number: "+13125551001", browser: "browser-b" })).toBeNull();
    expect(await takePending(deps, { number: "+13125551002", browser: "browser-a" })).toBeNull();
    expect(await takePending(deps, { number: "+13125551001", browser: "" })).toBeNull();
  });

  it("keeps one row for each browser, so a stranger's try replaces nothing of the person's", async () => {
    const deps = depsAt(new TestClock("2026-11-17T12:00:00Z"));
    const number = "+13125551003";
    await keepPending(deps, { number, browser: "person", passwordHash: "the-person's", adultOn: ADULT_ON });
    await keepPending(deps, { number, browser: "stranger", passwordHash: "the-stranger's", adultOn: ADULT_ON });

    expect((await takePending(deps, { number, browser: "person" }))?.passwordHash).toBe("the-person's");
    expect((await takePending(deps, { number, browser: "stranger" }))?.passwordHash).toBe("the-stranger's");
  });

  it("is replaced by a newer try from the same browser", async () => {
    const deps = depsAt(new TestClock("2026-11-17T12:00:00Z"));
    const number = "+13125551004";
    await keepPending(deps, { number, browser: "person", passwordHash: "first", adultOn: ADULT_ON });
    await keepPending(deps, { number, browser: "person", passwordHash: "second", adultOn: ADULT_ON });

    expect((await takePending(deps, { number, browser: "person" }))?.passwordHash).toBe("second");
    expect(await db().pendingSignUp.count({ where: { numberHash: { not: "" } } })).toBeGreaterThan(0);
  });

  it("lasts ten minutes, and an expired one is deleted when it is asked for", async () => {
    const clock = new TestClock("2026-11-17T12:00:00Z");
    const deps = depsAt(clock);
    const number = "+13125551005";
    await keepPending(deps, { number, browser: "person", passwordHash: "hash", adultOn: ADULT_ON });
    const before = await db().pendingSignUp.count();

    clock.advance(PENDING_MS - 1);
    expect(await takePending(deps, { number, browser: "person" })).not.toBeNull();
    clock.advance(1);
    expect(await takePending(deps, { number, browser: "person" })).toBeNull();
    expect(await db().pendingSignUp.count()).toBe(before - 1);
    expect(PENDING_MS).toBe(10 * 60 * 1000);
  });

  it("is kept under keyed hashes: no number, browser value or password in the table", async () => {
    const deps = depsAt(new TestClock("2026-11-17T12:00:00Z"));
    await keepPending(deps, { number: "+13125551006", browser: "a-browser-value", passwordHash: "hash", adultOn: ADULT_ON });
    const rows = JSON.stringify(await db().pendingSignUp.findMany());
    expect(rows).not.toContain("3125551006");
    expect(rows).not.toContain("a-browser-value");
    const row = await db().pendingSignUp.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    expect(row.numberHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.browserHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is forgotten for every browser at once when the number's sign-up finishes", async () => {
    const deps = depsAt(new TestClock("2026-11-17T12:00:00Z"));
    const number = "+13125551007";
    await keepPending(deps, { number, browser: "a", passwordHash: "hash", adultOn: ADULT_ON });
    await keepPending(deps, { number, browser: "b", passwordHash: "hash", adultOn: ADULT_ON });
    await forgetPending(deps, number);
    expect(await takePending(deps, { number, browser: "a" })).toBeNull();
    expect(await takePending(deps, { number, browser: "b" })).toBeNull();
  });
});

describe("newBrowserValue", () => {
  it("is 32 random bytes in base64url, and different each time", () => {
    const value = newBrowserValue();
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newBrowserValue()).not.toBe(value);
  });
});
