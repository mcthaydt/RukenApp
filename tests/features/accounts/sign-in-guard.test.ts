import { describe, expect, it } from "vitest";
import {
  hashSignInEmail,
  isSignInPaused,
  SIGN_IN_FAILURE_LIMIT,
  SIGN_IN_PAUSE_MS,
  SIGN_IN_WINDOW_MS,
} from "../../../src/features/accounts/sign-in-guard.ts";

// The account-level pause after too many wrong passwords. The counting itself is one SQL statement
// per step (sign-in-guards.ts, tested against Postgres in sign-in-guards.pg.test.ts); what is pure is here.

const START = new Date("2026-10-23T12:00:00Z");
const MINUTE = 60 * 1000;
const SECRET = ["test", "secret", "that", "is", "long", "enough"].join("-");

describe("the limits", () => {
  it("are ten guesses inside an hour, and a pause of an hour", () => {
    expect(SIGN_IN_FAILURE_LIMIT).toBe(10);
    expect(SIGN_IN_WINDOW_MS).toBe(60 * MINUTE);
    expect(SIGN_IN_PAUSE_MS).toBe(60 * MINUTE);
  });
});

describe("isSignInPaused", () => {
  const state = (pausedUntil: Date | null) => ({ failures: 10, windowStartedAt: START, pausedUntil });

  it("is false for an address with no record, and for one with no pause", () => {
    expect(isSignInPaused(null, START)).toBe(false);
    expect(isSignInPaused(state(null), START)).toBe(false);
  });

  it("is true until the pause ends, and false from that moment", () => {
    const until = new Date(START.getTime() + SIGN_IN_PAUSE_MS);
    expect(isSignInPaused(state(until), new Date(until.getTime() - 1))).toBe(true);
    expect(isSignInPaused(state(until), until)).toBe(false);
  });
});

describe("hashSignInEmail", () => {
  it("is 64 lower-case hex characters, which the table's check requires", () => {
    expect(hashSignInEmail("pat@example.test", SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is the same for any letter case and stray spaces, and different for another address", () => {
    expect(hashSignInEmail("  Pat@Example.TEST ", SECRET)).toBe(hashSignInEmail("pat@example.test", SECRET));
    expect(hashSignInEmail("sam@example.test", SECRET)).not.toBe(hashSignInEmail("pat@example.test", SECRET));
  });

  it("depends on the server secret, so a copy of the table cannot be checked against a list of addresses", () => {
    expect(hashSignInEmail("pat@example.test", `${SECRET}-other`)).not.toBe(
      hashSignInEmail("pat@example.test", SECRET),
    );
  });

  it("is not the plain SHA-256 of the address", async () => {
    const { createHash } = await import("node:crypto");
    expect(hashSignInEmail("pat@example.test", SECRET)).not.toBe(
      createHash("sha256").update("pat@example.test").digest("hex"),
    );
  });
});
