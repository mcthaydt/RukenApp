import { describe, expect, it } from "vitest";
import {
  isSignInPaused,
  SIGN_IN_FAILURE_LIMIT,
  SIGN_IN_PAUSE_MS,
  SIGN_IN_WINDOW_MS,
} from "../../../src/features/accounts/sign-in-guard.ts";

// The account-level pause after too many wrong passwords. The counting itself is one SQL statement
// per step (sign-in-guards.ts, tested against Postgres in sign-in-guards.pg.test.ts); what is pure is here.

const START = new Date("2026-10-23T12:00:00Z");
const MINUTE = 60 * 1000;

describe("the limits", () => {
  it("are ten guesses inside an hour, and a pause of an hour", () => {
    expect(SIGN_IN_FAILURE_LIMIT).toBe(10);
    expect(SIGN_IN_WINDOW_MS).toBe(60 * MINUTE);
    expect(SIGN_IN_PAUSE_MS).toBe(60 * MINUTE);
  });
});

describe("isSignInPaused", () => {
  const state = (pausedUntil: Date | null) => ({ failures: 10, windowStartedAt: START, pausedUntil });

  it("is false for a number with no record, and for one with no pause", () => {
    expect(isSignInPaused(null, START)).toBe(false);
    expect(isSignInPaused(state(null), START)).toBe(false);
  });

  it("is true until the pause ends, and false from that moment", () => {
    const until = new Date(START.getTime() + SIGN_IN_PAUSE_MS);
    expect(isSignInPaused(state(until), new Date(until.getTime() - 1))).toBe(true);
    expect(isSignInPaused(state(until), until)).toBe(false);
  });
});
