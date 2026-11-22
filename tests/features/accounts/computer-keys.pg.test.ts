import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  answerSignIn,
  cleanCode,
  computersOf,
  finishSignIn,
  lookAtSignIn,
  MAX_COMPUTERS,
  placeWarning,
  placeWords,
  readKey,
  removeAllComputers,
  removeComputer,
  renameComputer,
  sha256,
  startSignIn,
  type ComputerDeps,
} from "../../../src/features/accounts/computer-keys.ts";
import { hashNumber } from "../../../src/features/accounts/phone.ts";
import { requestDeletion } from "../../../src/features/accounts/deletion.ts";
import { createRateLimiter } from "../../../src/lib/server/rate-limit.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// A computer is let in by a code, a Yes on Ruken and a secret only the terminal holds.

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

const LISBON = { city: "Lisbon", country: "Portugal" };
const CHICAGO = { city: "Chicago", country: "United States" };

let addresses = 0;
/** A client address nobody else in the file has, so the per-address limits of one test never reach another. */
function nextAddress(): string {
  addresses += 1;
  return `203.0.113.${String(addresses)}`;
}

function deps(clock: TestClock = new TestClock("2026-11-22T12:00:00Z")): ComputerDeps & { clock: TestClock } {
  return { prisma: db(), clock, limiter: createRateLimiter(db(), clock) };
}

/** A computer let in: the whole way through, as the journey does. */
async function letIn(d: ComputerDeps, userId: string, name = "Dana's MacBook") {
  const started = await startSignIn(d, { name, startedFrom: CHICAGO, clientAddress: nextAddress() });
  if (!started.ok) throw new Error("start refused");
  expect(await answerSignIn(d, { code: started.code, userId, yes: true })).toBe("yes");
  const finished = await finishSignIn(d, { code: started.code, deviceSecret: started.deviceSecret });
  if (finished.status !== "yes") throw new Error(`finish said ${finished.status}`);
  return { key: finished.key, code: started.code, deviceSecret: started.deviceSecret };
}

describe("a code", () => {
  it("is eight letters with no look-alikes, written XXXX-XXXX, and typed any way", async () => {
    const started = await startSignIn(deps(), {
      name: "A",
      startedFrom: LISBON,
      clientAddress: nextAddress(),
    });
    if (!started.ok) throw new Error("refused");
    expect(started.code).toMatch(/^[A-HJ-NP-Z]{4}-[A-HJ-NP-Z]{4}$/);
    expect(cleanCode(started.code.toLowerCase().replace("-", " "))).toBe(started.code);
    expect(cleanCode("ABC")).toBeNull();
    expect(cleanCode("IIII-OOOO")).toBeNull();
  });

  it("is never kept: only the secret's hash is", async () => {
    const started = await startSignIn(deps(), {
      name: "A",
      startedFrom: LISBON,
      clientAddress: nextAddress(),
    });
    if (!started.ok) throw new Error("refused");
    const row = await db().computerSignIn.findUniqueOrThrow({ where: { code: started.code } });
    expect(row.deviceSecretHash).toBe(sha256(started.deviceSecret));
    expect(JSON.stringify(row)).not.toContain(started.deviceSecret);
  });

  it("gives a key to the one who holds the secret after a Yes, once", async () => {
    const userId = await createUser(db());
    const d = deps();
    const { key, code, deviceSecret } = await letIn(d, userId);
    expect(key).toMatch(/^rk_[a-z2-7]{52}$/);
    // Kept as its hash only.
    const row = await db().computerKey.findFirstOrThrow({ where: { userId } });
    expect(row.keyHash).toBe(sha256(key));
    expect(JSON.stringify(row)).not.toContain(key);
    // A second finish finds nothing: the key was taken.
    d.clock.advance({ seconds: 6 });
    expect((await finishSignIn(d, { code, deviceSecret })).status).toBe("gone");
  });

  it("waits until Yes is pressed, and holds no key for No", async () => {
    const userId = await createUser(db());
    const d = deps();
    const started = await startSignIn(d, { name: "A", startedFrom: LISBON, clientAddress: nextAddress() });
    if (!started.ok) throw new Error("refused");
    expect(await finishSignIn(d, { code: started.code, deviceSecret: started.deviceSecret })).toEqual({
      status: "waiting",
    });
    expect(await answerSignIn(d, { code: started.code, userId, yes: false })).toBe("no");
    d.clock.advance({ seconds: 6 });
    const finished = await finishSignIn(d, { code: started.code, deviceSecret: started.deviceSecret });
    expect(finished.status).toBe("no");
    expect(await db().computerKey.count({ where: { userId } })).toBe(0);
  });

  it("is not collected with the right code and the wrong secret", async () => {
    const userId = await createUser(db());
    const d = deps();
    const started = await startSignIn(d, { name: "A", startedFrom: LISBON, clientAddress: nextAddress() });
    if (!started.ok) throw new Error("refused");
    await answerSignIn(d, { code: started.code, userId, yes: true });
    const finished = await finishSignIn(d, { code: started.code, deviceSecret: "not-the-secret" });
    expect(finished.status).toBe("gone");
    expect(await db().computerKey.count({ where: { userId } })).toBe(0);
  });

  it("runs out after ten minutes, for Yes and for finish", async () => {
    const userId = await createUser(db());
    const d = deps();
    const started = await startSignIn(d, { name: "A", startedFrom: LISBON, clientAddress: nextAddress() });
    if (!started.ok) throw new Error("refused");
    d.clock.advance({ minutes: 10, seconds: 1 });
    expect(await answerSignIn(d, { code: started.code, userId, yes: true })).toBe("ran_out");
    expect((await finishSignIn(d, { code: started.code, deviceSecret: started.deviceSecret })).status).toBe(
      "gone",
    );
  });

  it("takes one Yes: a second press changes nothing", async () => {
    const userId = await createUser(db());
    const d = deps();
    const started = await startSignIn(d, { name: "A", startedFrom: LISBON, clientAddress: nextAddress() });
    if (!started.ok) throw new Error("refused");
    expect(await answerSignIn(d, { code: started.code, userId, yes: true })).toBe("yes");
    expect(await answerSignIn(d, { code: started.code, userId, yes: true })).toBe("answered");
    expect(await answerSignIn(d, { code: started.code, userId, yes: false })).toBe("answered");
  });

  it("is looked up with where it was asked from and how long ago", async () => {
    const d = deps();
    const started = await startSignIn(d, {
      name: "Dana's MacBook",
      startedFrom: LISBON,
      clientAddress: nextAddress(),
    });
    if (!started.ok) throw new Error("refused");
    d.clock.advance({ seconds: 40 });
    const looked = await lookAtSignIn(d, started.code, nextAddress());
    expect(looked).toEqual({
      found: true,
      asked: { code: started.code, name: "Dana's MacBook", startedFrom: LISBON, secondsAgo: 40 },
    });
  });
});

describe("limits", () => {
  it("refuses the 11th start in an hour from one address", async () => {
    const d = deps();
    const address = nextAddress();
    for (let n = 0; n < 10; n += 1) {
      expect((await startSignIn(d, { name: "A", startedFrom: LISBON, clientAddress: address })).ok).toBe(
        true,
      );
    }
    const eleventh = await startSignIn(d, { name: "A", startedFrom: LISBON, clientAddress: address });
    expect(eleventh.ok).toBe(false);
  });

  it("slows finish to once every 5 seconds per code", async () => {
    const d = deps();
    const started = await startSignIn(d, { name: "A", startedFrom: LISBON, clientAddress: nextAddress() });
    if (!started.ok) throw new Error("refused");
    const input = { code: started.code, deviceSecret: started.deviceSecret };
    expect((await finishSignIn(d, input)).status).toBe("waiting");
    expect((await finishSignIn(d, input)).status).toBe("slow");
    d.clock.advance({ seconds: 6 });
    expect((await finishSignIn(d, input)).status).toBe("waiting");
  });

  it("refuses a typed code for 10 minutes after 5 wrong ones from one address", async () => {
    const d = deps();
    const started = await startSignIn(d, { name: "A", startedFrom: LISBON, clientAddress: nextAddress() });
    if (!started.ok) throw new Error("refused");
    const address = nextAddress();
    for (let n = 0; n < 5; n += 1) {
      expect(await lookAtSignIn(d, "AAAA-BBBB", address)).toEqual({ found: false, reason: "wrong" });
    }
    // Even the right code is refused now.
    expect(await lookAtSignIn(d, started.code, address)).toEqual({ found: false, reason: "too_many_wrong" });
    // 10 minutes on, the block is over (the code itself has run out by then, which is its own answer).
    d.clock.advance({ minutes: 10, seconds: 1 });
    expect(await lookAtSignIn(d, started.code, address)).toEqual({ found: false, reason: "ran_out" });
  });

  it("refuses the 21st computer, and the 21st Yes in an hour", async () => {
    const d = deps();
    const userId = await createUser(db());
    for (let n = 0; n < MAX_COMPUTERS; n += 1) await letIn(d, userId, `Computer ${String(n)}`);
    // 20 Yes were pressed above: the 21st press in the hour is turned away before anything else.
    const limited = await startSignIn(d, {
      name: "Too soon",
      startedFrom: LISBON,
      clientAddress: nextAddress(),
    });
    if (!limited.ok) throw new Error("refused");
    expect(await answerSignIn(d, { code: limited.code, userId, yes: true })).toBe("limited");
    // An hour on, the 21st computer is the one that is refused.
    d.clock.advance({ minutes: 61 });
    const started = await startSignIn(d, {
      name: "One more",
      startedFrom: LISBON,
      clientAddress: nextAddress(),
    });
    if (!started.ok) throw new Error("refused");
    expect(await answerSignIn(d, { code: started.code, userId, yes: true })).toBe("too_many_computers");
    const another = await startSignIn(d, {
      name: "Again",
      startedFrom: LISBON,
      clientAddress: nextAddress(),
    });
    if (!another.ok) throw new Error("refused");
    expect(await answerSignIn(d, { code: another.code, userId, yes: true })).toBe("too_many_computers");
  });

  it("never lets a maker hold more than 20 keys, however many Yes were pressed before any finished", async () => {
    const d = deps();
    const userId = await createUser(db());
    for (let n = 0; n < MAX_COMPUTERS - 1; n += 1) await letIn(d, userId, `Computer ${String(n)}`);
    d.clock.advance({ minutes: 61 });
    const waiting = [];
    for (let n = 0; n < 5; n += 1) {
      const started = await startSignIn(d, {
        name: `Late ${String(n)}`,
        startedFrom: LISBON,
        clientAddress: nextAddress(),
      });
      if (!started.ok) throw new Error("refused");
      waiting.push(started);
    }
    // Only one more fits: the Yes answers that come while a computer is on its way count as computers.
    const answers = [];
    for (const one of waiting) answers.push(await answerSignIn(d, { code: one.code, userId, yes: true }));
    expect(answers).toEqual([
      "yes",
      "too_many_computers",
      "too_many_computers",
      "too_many_computers",
      "too_many_computers",
    ]);
    for (const one of waiting) await finishSignIn(d, { code: one.code, deviceSecret: one.deviceSecret });
    expect(await db().computerKey.count({ where: { userId } })).toBe(MAX_COMPUTERS);
  });

  it("refuses at finish when the maker is already at 20, and says so", async () => {
    const d = deps();
    const userId = await createUser(db());
    const started = await startSignIn(d, {
      name: "Early",
      startedFrom: LISBON,
      clientAddress: nextAddress(),
    });
    if (!started.ok) throw new Error("refused");
    expect(await answerSignIn(d, { code: started.code, userId, yes: true })).toBe("yes");
    // The 20 keys arrive some other way (twenty computers let in after this Yes).
    for (let n = 0; n < MAX_COMPUTERS; n += 1) {
      await db().computerKey.create({
        data: { userId, name: `K${String(n)}`, keyHash: sha256(`k-${userId}-${String(n)}`) },
      });
    }
    const finished = await finishSignIn(d, { code: started.code, deviceSecret: started.deviceSecret });
    expect(finished.status).toBe("no");
    expect(await db().computerKey.count({ where: { userId } })).toBe(MAX_COMPUTERS);
  });

  it("deletes the ten oldest expired codes when a start runs", async () => {
    const d = deps();
    for (let n = 0; n < 12; n += 1)
      await startSignIn(d, { name: "Old", startedFrom: LISBON, clientAddress: nextAddress() });
    const before = await db().computerSignIn.count({
      where: { expiresAt: { lte: new Date(d.clock.epochMs() + 11 * 60_000) } },
    });
    d.clock.advance({ minutes: 11 });
    await startSignIn(d, { name: "New", startedFrom: LISBON, clientAddress: nextAddress() });
    const left = await db().computerSignIn.count({
      where: { expiresAt: { lte: new Date(d.clock.epochMs()) } },
    });
    expect(before - left).toBeGreaterThanOrEqual(10);
  });
});

describe("reading a key", () => {
  it("answers the maker for a key, and nobody for anything else", async () => {
    const d = deps();
    const userId = await createUser(db());
    const { key } = await letIn(d, userId);
    expect(await readKey(d, `Bearer ${key}`)).toMatchObject({ userId });
    expect(await readKey(d, null)).toBeNull();
    expect(await readKey(d, key)).toBeNull();
    expect(await readKey(d, `Bearer ${key}x`)).toBeNull();
    expect(await readKey(d, "Bearer rk_" + "a".repeat(52))).toBeNull();
  });

  it("stops working when the maker removes the computer", async () => {
    const d = deps();
    const userId = await createUser(db());
    const { key } = await letIn(d, userId);
    const [computer] = await computersOf(d, userId);
    expect(await removeComputer(d, userId, computer?.id ?? "")).toBe(true);
    expect(await readKey(d, `Bearer ${key}`)).toBeNull();
  });

  it("is not removable by another maker, and not renamable by one", async () => {
    const d = deps();
    const owner = await createUser(db());
    const other = await createUser(db());
    const { key } = await letIn(d, owner);
    const [computer] = await computersOf(d, owner);
    expect(await removeComputer(d, other, computer?.id ?? "")).toBe(false);
    expect(await renameComputer(d, other, computer?.id ?? "", "Mine now")).toBe(false);
    expect(await readKey(d, `Bearer ${key}`)).not.toBeNull();
  });

  it("is renamed, up to 60 characters, never to nothing", async () => {
    const d = deps();
    const userId = await createUser(db());
    await letIn(d, userId);
    const [computer] = await computersOf(d, userId);
    expect(await renameComputer(d, userId, computer?.id ?? "", "x".repeat(80))).toBe(true);
    expect((await computersOf(d, userId))[0]?.name).toHaveLength(60);
    expect(await renameComputer(d, userId, computer?.id ?? "", "   ")).toBe(false);
  });

  it("stops working after 90 days unused", async () => {
    const d = deps();
    const userId = await createUser(db());
    const { key } = await letIn(d, userId);
    d.clock.advance({ hours: 24 * 89 });
    expect(await readKey(d, `Bearer ${key}`)).not.toBeNull();
    // Using it moved the clock on its use: another 89 days is still fine, and 91 days of silence is not.
    d.clock.advance({ hours: 24 * 91 });
    expect(await readKey(d, `Bearer ${key}`)).toBeNull();
  });

  it("writes when it was last used at most once an hour", async () => {
    const d = deps();
    const userId = await createUser(db());
    const { key } = await letIn(d, userId);
    const first = (await db().computerKey.findFirstOrThrow({ where: { userId } })).lastUsedAt;
    d.clock.advance({ minutes: 30 });
    await readKey(d, `Bearer ${key}`);
    expect((await db().computerKey.findFirstOrThrow({ where: { userId } })).lastUsedAt).toEqual(first);
    d.clock.advance({ minutes: 31 });
    await readKey(d, `Bearer ${key}`);
    expect(
      (await db().computerKey.findFirstOrThrow({ where: { userId } })).lastUsedAt.getTime(),
    ).toBeGreaterThan(first.getTime());
  });

  it("is refused for an account waiting to be deleted, and deleting removes the keys at once", async () => {
    const d = deps();
    const userId = await createUser(db());
    const { key } = await letIn(d, userId);
    await requestDeletion({ prisma: db(), clock: d.clock }, userId);
    expect(await db().computerKey.count({ where: { userId } })).toBe(0);
    expect(await readKey(d, `Bearer ${key}`)).toBeNull();
  });

  it("is refused for an account that is not active even if a key row is left", async () => {
    const d = deps();
    const userId = await createUser(db());
    const { key } = await letIn(d, userId);
    await db().user.update({ where: { id: userId }, data: { status: "pending_deletion" } });
    expect(await readKey(d, `Bearer ${key}`)).toBeNull();
  });

  it("is not collected after removeAllComputers, even from a Yes pressed before it", async () => {
    const d = deps();
    const userId = await createUser(db());
    const started = await startSignIn(d, {
      name: "Mistake",
      startedFrom: LISBON,
      clientAddress: nextAddress(),
    });
    if (!started.ok) throw new Error("refused");
    expect(await answerSignIn(d, { code: started.code, userId, yes: true })).toBe("yes");
    await removeAllComputers(db(), userId);
    const finished = await finishSignIn(d, { code: started.code, deviceSecret: started.deviceSecret });
    expect(finished.status).not.toBe("yes");
    expect(await db().computerKey.count({ where: { userId } })).toBe(0);
  });

  it("is not collected after Delete my account, even from a Yes pressed before it", async () => {
    const d = deps();
    const userId = await createUser(db());
    const started = await startSignIn(d, {
      name: "Mistake",
      startedFrom: LISBON,
      clientAddress: nextAddress(),
    });
    if (!started.ok) throw new Error("refused");
    expect(await answerSignIn(d, { code: started.code, userId, yes: true })).toBe("yes");
    await requestDeletion({ prisma: db(), clock: d.clock }, userId);
    expect(await db().computerSignIn.count({ where: { userId } })).toBe(0);
    const finished = await finishSignIn(d, { code: started.code, deviceSecret: started.deviceSecret });
    expect(finished.status).not.toBe("yes");
    expect(await db().computerKey.count({ where: { userId } })).toBe(0);
  });

  it("keeps working while a sign-in pause is on the maker's number: the pause is for password guesses only", async () => {
    const d = deps();
    const userId = await createUser(db());
    const { key } = await letIn(d, userId);
    await db().signInGuard.create({
      data: {
        numberHash: hashNumber("+12025550123", "a-secret"),
        failures: 10,
        windowStartedAt: new Date(d.clock.epochMs()),
        pausedUntil: new Date(d.clock.epochMs() + 60 * 60_000),
      },
    });
    expect(await readKey(d, `Bearer ${key}`)).toMatchObject({ userId });
  });

  it("is removed with every other key of the maker by removeAllComputers, and only theirs", async () => {
    const d = deps();
    const userId = await createUser(db());
    const other = await createUser(db());
    const mine = await letIn(d, userId);
    const theirs = await letIn(d, other);
    await removeAllComputers(db(), userId);
    expect(await readKey(d, `Bearer ${mine.key}`)).toBeNull();
    expect(await readKey(d, `Bearer ${theirs.key}`)).not.toBeNull();
  });
});

describe("where a request came from", () => {
  it("says no warning for the same place, and none when either place is unknown", () => {
    expect(placeWarning(CHICAGO, CHICAGO)).toBeNull();
    expect(placeWarning({ city: null, country: null }, CHICAGO)).toBeNull();
    expect(placeWarning(CHICAGO, { city: null, country: null })).toBeNull();
  });

  it("warns, in plain words, for a different city or a different country", () => {
    expect(placeWarning(LISBON, CHICAGO)).toBe(
      "This was asked from Lisbon, Portugal. You're in Chicago, United States. If you didn't just type `npx ruken sign-in`, press No.",
    );
    expect(placeWarning({ city: "Austin", country: "United States" }, CHICAGO)).toContain("Austin");
  });

  it("compares countries alone when a side has no city", () => {
    expect(placeWarning({ city: null, country: "United States" }, CHICAGO)).toBeNull();
    expect(placeWarning({ city: null, country: "Portugal" }, CHICAGO)).toContain("Portugal. You're in");
  });

  it("writes a place as words", () => {
    expect(placeWords(LISBON)).toBe("Lisbon, Portugal");
    expect(placeWords({ city: null, country: "Portugal" })).toBe("Portugal");
    expect(placeWords({ city: null, country: null })).toBe("somewhere we can't tell");
  });
});
