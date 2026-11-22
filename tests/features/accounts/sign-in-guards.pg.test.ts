import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { TestClock } from "../../support/test-clock.ts";
import { hashNumber } from "../../../src/features/accounts/phone.ts";
import {
  SIGN_IN_FAILURE_LIMIT,
  SIGN_IN_PAUSE_MS,
  SIGN_IN_WINDOW_MS,
} from "../../../src/features/accounts/sign-in-guard.ts";
import {
  clearSignInFailures,
  isSignInPausedFor,
  recordWrongPassword,
  releaseSignInAttempt,
  reserveSignInAttempt,
  type SignInGuards,
} from "../../../src/features/accounts/sign-in-guards.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// The SignInGuard table behind the pause: one row per number, never the number itself, and
// at most ten guesses per window however many requests arrive at once.

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

function guardsAt(clock: TestClock): SignInGuards {
  return { db: db(), clock, secret: SECRET };
}

let counter = 0;
function nextNumber(): string {
  counter += 1;
  return `+1312556${String(counter).padStart(4, "0")}`;
}

/** Reserves and then fails `count` guesses one after another, as ten wrong passwords in a row do. */
async function failTimes(
  guards: SignInGuards,
  number: string,
  count: number,
): Promise<{ pauseStarted: boolean }> {
  let last = { pauseStarted: false };
  for (let index = 0; index < count; index += 1) {
    expect(await reserveSignInAttempt(guards, number)).toEqual({ allowed: true });
    last = await recordWrongPassword(guards, number);
  }
  return last;
}

async function rowFor(number: string) {
  return db().signInGuard.findUnique({ where: { numberHash: hashNumber(number, SECRET) } });
}

describe("reserveSignInAttempt and recordWrongPassword", () => {
  it("keeps one row per number, under the keyed hash, and never stores the number", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    const number = nextNumber();

    await failTimes(guards, number, 1);
    await failTimes(guards, number, 1);

    expect((await rowFor(number))?.failures).toBe(2);
    expect(JSON.stringify(await db().signInGuard.findMany())).not.toContain(number);
  });

  it("allows ten guesses, starts the pause on the tenth wrong one, once, and for an hour", async () => {
    const clock = new TestClock("2026-10-23T12:00:00Z");
    const guards = guardsAt(clock);
    const number = nextNumber();

    expect(await failTimes(guards, number, SIGN_IN_FAILURE_LIMIT - 1)).toEqual({ pauseStarted: false });
    expect(await isSignInPausedFor(guards, number)).toBe(false);

    expect(await failTimes(guards, number, 1)).toEqual({ pauseStarted: true });
    expect(await isSignInPausedFor(guards, number)).toBe(true);
    expect((await rowFor(number))?.pausedUntil).toEqual(new Date(clock.epochMs() + SIGN_IN_PAUSE_MS));

    expect(await reserveSignInAttempt(guards, number)).toEqual({ allowed: false });
    expect(await recordWrongPassword(guards, number)).toEqual({ pauseStarted: false });
  });

  it("does not stretch the pause when guesses keep arriving during it", async () => {
    const clock = new TestClock("2026-10-23T12:00:00Z");
    const guards = guardsAt(clock);
    const number = nextNumber();
    await failTimes(guards, number, SIGN_IN_FAILURE_LIMIT);
    const pausedUntil = (await rowFor(number))?.pausedUntil;

    clock.advance(20 * 60 * 1000);
    await reserveSignInAttempt(guards, number);
    await recordWrongPassword(guards, number);

    expect((await rowFor(number))?.pausedUntil).toEqual(pausedUntil);
  });

  it("pauses a number with no account the same way, so a pause says nothing about who has one", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    const stranger = nextNumber();
    expect(await db().user.count({ where: { phoneNumber: stranger } })).toBe(0);

    await failTimes(guards, stranger, SIGN_IN_FAILURE_LIMIT);

    expect(await isSignInPausedFor(guards, stranger)).toBe(true);
  });

  it("lets the pause end with the clock, and counts afresh after it", async () => {
    const clock = new TestClock("2026-10-23T12:00:00Z");
    const guards = guardsAt(clock);
    const number = nextNumber();
    await failTimes(guards, number, SIGN_IN_FAILURE_LIMIT);

    clock.advance(SIGN_IN_PAUSE_MS - 1);
    expect(await reserveSignInAttempt(guards, number)).toEqual({ allowed: false });
    clock.advance(1);
    expect(await isSignInPausedFor(guards, number)).toBe(false);

    expect(await reserveSignInAttempt(guards, number)).toEqual({ allowed: true });
    expect(await rowFor(number)).toMatchObject({ failures: 1, pausedUntil: null });
  });

  it("opens a new window an hour after the first guess, and keeps counting one millisecond before", async () => {
    const clock = new TestClock("2026-10-23T12:00:00Z");
    const guards = guardsAt(clock);
    const early = nextNumber();
    const late = nextNumber();
    await failTimes(guards, early, SIGN_IN_FAILURE_LIMIT - 1);
    await failTimes(guards, late, SIGN_IN_FAILURE_LIMIT - 1);

    clock.advance(SIGN_IN_WINDOW_MS - 1);
    expect(await failTimes(guards, early, 1)).toEqual({ pauseStarted: true });
    clock.advance(1);
    expect(await failTimes(guards, late, 1)).toEqual({ pauseStarted: false });
    expect((await rowFor(late))?.failures).toBe(1);
  });

  it("does not count one address's guesses against another", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    await failTimes(guards, nextNumber(), SIGN_IN_FAILURE_LIMIT);

    expect(await reserveSignInAttempt(guards, nextNumber())).toEqual({ allowed: true });
  });

  it("lets no more than ten guesses through when thirty arrive at once", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    const number = nextNumber();

    const answers = await Promise.all(Array.from({ length: 30 }, () => reserveSignInAttempt(guards, number)));

    expect(answers.filter((answer) => answer.allowed)).toHaveLength(SIGN_IN_FAILURE_LIMIT);
  });
});

describe("releaseSignInAttempt", () => {
  it("gives back a guess that turned out not to be one, and removes a row it leaves empty", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    const number = nextNumber();
    await reserveSignInAttempt(guards, number);
    await reserveSignInAttempt(guards, number);

    await releaseSignInAttempt(guards, number);
    expect((await rowFor(number))?.failures).toBe(1);
    await releaseSignInAttempt(guards, number);
    expect(await rowFor(number)).toBeNull();
    await expect(releaseSignInAttempt(guards, number)).resolves.toBeUndefined();
  });

  it("leaves a pause alone", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    const number = nextNumber();
    await failTimes(guards, number, SIGN_IN_FAILURE_LIMIT);

    await releaseSignInAttempt(guards, number);

    expect(await isSignInPausedFor(guards, number)).toBe(true);
  });
});

describe("clearSignInFailures", () => {
  it("forgets the guesses and lifts a pause, and is quiet when there is nothing to forget", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    const number = nextNumber();
    await failTimes(guards, number, SIGN_IN_FAILURE_LIMIT);

    await clearSignInFailures(guards, number);

    expect(await isSignInPausedFor(guards, number)).toBe(false);
    expect(await rowFor(number)).toBeNull();
    await expect(clearSignInFailures(guards, number)).resolves.toBeUndefined();
  });
});
