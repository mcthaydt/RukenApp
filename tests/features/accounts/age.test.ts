import { describe, expect, it } from "vitest";
import { ageCheck } from "../../../src/features/accounts/age.ts";
import { TestClock } from "../../support/test-clock.ts";

// Ages are worked out once, at sign-up, in America/Chicago, from the injected Clock.
// October 2026 is daylight time there (UTC-5), so local midnight on Oct 14 is 05:00Z.
const justBeforeMidnight = new TestClock("2026-10-14T04:59:59Z"); // Oct 13, 23:59:59 in Chicago
const atMidnight = new TestClock("2026-10-14T05:00:00Z"); // Oct 14, 00:00:00 in Chicago

describe("ageCheck", () => {
  it("turns 18 at Chicago midnight on the birthday, not at UTC midnight", () => {
    const born = { year: 2008, month: 10, day: 14 };
    expect(ageCheck(born, justBeforeMidnight)).toEqual({ kind: "minor", adultOn: "2026-10-14" });
    expect(ageCheck(born, atMidnight)).toEqual({ kind: "adult", adultOn: "2026-10-14" });
  });

  it("refuses under 13 until Chicago midnight on the 13th birthday, and returns no date to store", () => {
    const born = { year: 2013, month: 10, day: 14 };
    expect(ageCheck(born, justBeforeMidnight)).toEqual({ kind: "under13" });
    expect(ageCheck(born, atMidnight)).toEqual({ kind: "minor", adultOn: "2031-10-14" });
  });

  it("puts a 29 February birthday on 1 March in a year without one", () => {
    const born = { year: 2008, month: 2, day: 29 };
    expect(ageCheck(born, new TestClock("2026-02-28T18:00:00Z"))).toEqual({
      kind: "minor",
      adultOn: "2026-03-01",
    });
    expect(ageCheck(born, new TestClock("2026-03-01T18:00:00Z"))).toEqual({
      kind: "adult",
      adultOn: "2026-03-01",
    });
    // Born 29 Feb 2012: the 13th birthday in 2025 is 1 March too.
    expect(ageCheck({ year: 2012, month: 2, day: 29 }, new TestClock("2025-02-28T18:00:00Z"))).toEqual({
      kind: "under13",
    });
  });

  it("always puts a 29 February 18th birthday on 1 March, since birth year + 18 is never a leap year", () => {
    expect(ageCheck({ year: 2000, month: 2, day: 29 }, atMidnight)).toEqual({
      kind: "adult",
      adultOn: "2018-03-01",
    });
    expect(ageCheck({ year: 2004, month: 2, day: 29 }, new TestClock("2021-06-01T12:00:00Z"))).toEqual({
      kind: "minor",
      adultOn: "2022-03-01",
    });
  });

  it("leaves other birthdays alone", () => {
    expect(ageCheck({ year: 2010, month: 2, day: 28 }, atMidnight)).toEqual({
      kind: "minor",
      adultOn: "2028-02-28",
    });
    expect(ageCheck({ year: 2010, month: 3, day: 1 }, atMidnight)).toEqual({
      kind: "minor",
      adultOn: "2028-03-01",
    });
  });

  it("calls an impossible date invalid", () => {
    expect(ageCheck({ year: 2010, month: 2, day: 30 }, atMidnight)).toEqual({ kind: "invalid" });
    expect(ageCheck({ year: 2010, month: 4, day: 31 }, atMidnight)).toEqual({ kind: "invalid" });
    expect(ageCheck({ year: 2010, month: 13, day: 1 }, atMidnight)).toEqual({ kind: "invalid" });
    expect(ageCheck({ year: 2010, month: 0, day: 1 }, atMidnight)).toEqual({ kind: "invalid" });
    // 2010 had no 29 February.
    expect(ageCheck({ year: 2010, month: 2, day: 29 }, atMidnight)).toEqual({ kind: "invalid" });
  });

  it("calls a date after today invalid, and today itself under 13", () => {
    expect(ageCheck({ year: 2026, month: 10, day: 15 }, atMidnight)).toEqual({ kind: "invalid" });
    expect(ageCheck({ year: 2026, month: 10, day: 14 }, atMidnight)).toEqual({ kind: "under13" });
  });
});
