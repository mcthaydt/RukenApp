import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { TestClock } from "../../support/test-clock.ts";
import {
  hashSignInEmail,
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

// The SignInGuard table behind the pause: one row per address, never the address itself, and
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
function nextEmail(): string {
  counter += 1;
  return `guard${String(counter)}@example.test`;
}

/** Reserves and then fails `count` guesses one after another, as ten wrong passwords in a row do. */
async function failTimes(
  guards: SignInGuards,
  email: string,
  count: number,
): Promise<{ pauseStarted: boolean }> {
  let last = { pauseStarted: false };
  for (let index = 0; index < count; index += 1) {
    expect(await reserveSignInAttempt(guards, email)).toEqual({ allowed: true });
    last = await recordWrongPassword(guards, email);
  }
  return last;
}

async function rowFor(email: string) {
  return db().signInGuard.findUnique({ where: { emailHash: hashSignInEmail(email, SECRET) } });
}

describe("reserveSignInAttempt and recordWrongPassword", () => {
  it("keeps one row per address, under the keyed hash, and never stores the address", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    const email = nextEmail();

    await failTimes(guards, email, 1);
    await failTimes(guards, email.toUpperCase(), 1);

    expect((await rowFor(email))?.failures).toBe(2);
    expect(JSON.stringify(await db().signInGuard.findMany())).not.toContain("@");
  });

  it("allows ten guesses, starts the pause on the tenth wrong one, once, and for an hour", async () => {
    const clock = new TestClock("2026-10-23T12:00:00Z");
    const guards = guardsAt(clock);
    const email = nextEmail();

    expect(await failTimes(guards, email, SIGN_IN_FAILURE_LIMIT - 1)).toEqual({ pauseStarted: false });
    expect(await isSignInPausedFor(guards, email)).toBe(false);

    expect(await failTimes(guards, email, 1)).toEqual({ pauseStarted: true });
    expect(await isSignInPausedFor(guards, email)).toBe(true);
    expect((await rowFor(email))?.pausedUntil).toEqual(new Date(clock.epochMs() + SIGN_IN_PAUSE_MS));

    expect(await reserveSignInAttempt(guards, email)).toEqual({ allowed: false });
    expect(await recordWrongPassword(guards, email)).toEqual({ pauseStarted: false });
  });

  it("does not stretch the pause when guesses keep arriving during it", async () => {
    const clock = new TestClock("2026-10-23T12:00:00Z");
    const guards = guardsAt(clock);
    const email = nextEmail();
    await failTimes(guards, email, SIGN_IN_FAILURE_LIMIT);
    const pausedUntil = (await rowFor(email))?.pausedUntil;

    clock.advance(20 * 60 * 1000);
    await reserveSignInAttempt(guards, email);
    await recordWrongPassword(guards, email);

    expect((await rowFor(email))?.pausedUntil).toEqual(pausedUntil);
  });

  it("pauses an address with no account the same way, so a pause says nothing about who has one", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    const stranger = nextEmail();
    expect(await db().user.count({ where: { email: stranger } })).toBe(0);

    await failTimes(guards, stranger, SIGN_IN_FAILURE_LIMIT);

    expect(await isSignInPausedFor(guards, stranger)).toBe(true);
  });

  it("lets the pause end with the clock, and counts afresh after it", async () => {
    const clock = new TestClock("2026-10-23T12:00:00Z");
    const guards = guardsAt(clock);
    const email = nextEmail();
    await failTimes(guards, email, SIGN_IN_FAILURE_LIMIT);

    clock.advance(SIGN_IN_PAUSE_MS - 1);
    expect(await reserveSignInAttempt(guards, email)).toEqual({ allowed: false });
    clock.advance(1);
    expect(await isSignInPausedFor(guards, email)).toBe(false);

    expect(await reserveSignInAttempt(guards, email)).toEqual({ allowed: true });
    expect(await rowFor(email)).toMatchObject({ failures: 1, pausedUntil: null });
  });

  it("opens a new window an hour after the first guess, and keeps counting one millisecond before", async () => {
    const clock = new TestClock("2026-10-23T12:00:00Z");
    const guards = guardsAt(clock);
    const early = nextEmail();
    const late = nextEmail();
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
    await failTimes(guards, nextEmail(), SIGN_IN_FAILURE_LIMIT);

    expect(await reserveSignInAttempt(guards, nextEmail())).toEqual({ allowed: true });
  });

  it("lets no more than ten guesses through when thirty arrive at once", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    const email = nextEmail();

    const answers = await Promise.all(Array.from({ length: 30 }, () => reserveSignInAttempt(guards, email)));

    expect(answers.filter((answer) => answer.allowed)).toHaveLength(SIGN_IN_FAILURE_LIMIT);
  });
});

describe("releaseSignInAttempt", () => {
  it("gives back a guess that turned out not to be one, and removes a row it leaves empty", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    const email = nextEmail();
    await reserveSignInAttempt(guards, email);
    await reserveSignInAttempt(guards, email);

    await releaseSignInAttempt(guards, email);
    expect((await rowFor(email))?.failures).toBe(1);
    await releaseSignInAttempt(guards, email);
    expect(await rowFor(email)).toBeNull();
    await expect(releaseSignInAttempt(guards, email)).resolves.toBeUndefined();
  });

  it("leaves a pause alone", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    const email = nextEmail();
    await failTimes(guards, email, SIGN_IN_FAILURE_LIMIT);

    await releaseSignInAttempt(guards, email);

    expect(await isSignInPausedFor(guards, email)).toBe(true);
  });
});

describe("clearSignInFailures", () => {
  it("forgets the guesses and lifts a pause, for any letter case, and is quiet when there is nothing to forget", async () => {
    const guards = guardsAt(new TestClock("2026-10-23T12:00:00Z"));
    const email = nextEmail();
    await failTimes(guards, email, SIGN_IN_FAILURE_LIMIT);

    await clearSignInFailures(guards, email.toUpperCase());

    expect(await isSignInPausedFor(guards, email)).toBe(false);
    expect(await rowFor(email)).toBeNull();
    await expect(clearSignInFailures(guards, email)).resolves.toBeUndefined();
  });
});
