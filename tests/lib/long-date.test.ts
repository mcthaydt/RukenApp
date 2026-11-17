import { describe, expect, it } from "vitest";
import { longDate, longDay } from "../../src/lib/long-date.ts";

describe("longDay", () => {
  it("writes a calendar day in words, the day it names whatever zone the server is in", () => {
    expect(longDay("2026-11-27")).toBe("Friday, November 27");
    expect(longDay("2026-01-01")).toBe("Thursday, January 1");
  });

  it("answers null for text that is not a real day", () => {
    expect(longDay("2026-02-30")).toBeNull();
    expect(longDay("soon")).toBeNull();
    expect(longDay("2026-11-27T10:00:00Z")).toBeNull();
    expect(longDay("")).toBeNull();
  });
});

describe("longDate", () => {
  it("writes the Chicago day an instant falls on, so 3 a.m. UTC is still the day before", () => {
    expect(longDate(new Date("2026-12-15T03:00:00Z"))).toBe("Monday, December 14");
  });

  it("moves to the next day once Chicago has", () => {
    expect(longDate(new Date("2026-12-15T07:00:00Z"))).toBe("Tuesday, December 15");
  });
});
