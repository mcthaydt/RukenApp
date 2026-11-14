import { describe, expect, it } from "vitest";
import { parsePeriod } from "../../../src/features/money/period.ts";
import { closeAt, finalAt, latestPeriodDue } from "../../../src/features/money/periods.ts";

// A month's two moments are midnight in Chicago, whatever the offset from UTC is that day. The daily job runs once, in
// the small hours (09:17 UTC), so a month is closed and made final by the first run on or after its day.

const iso = (ms: number) => new Date(ms).toISOString();

describe("when a month closes and is made final", () => {
  it("closes at midnight starting the 8th, and is final at midnight starting the 10th", () => {
    const november = parsePeriod("2026-11");
    expect(iso(closeAt(november))).toBe("2026-12-08T06:00:00.000Z");
    expect(iso(finalAt(november))).toBe("2026-12-10T06:00:00.000Z");
  });

  it("keeps midnight in Chicago while the clocks are on summer time", () => {
    // Summer time runs 14 March to 7 November 2027, so midnight is 05:00 UTC.
    expect(iso(closeAt(parsePeriod("2027-03")))).toBe("2027-04-08T05:00:00.000Z");
    expect(iso(finalAt(parsePeriod("2027-07")))).toBe("2027-08-10T05:00:00.000Z");
  });

  it("is right on both sides of a clock change", () => {
    // 2027-02's 8th is before the clocks go forward on 14 March, so midnight is still 06:00 UTC.
    expect(iso(closeAt(parsePeriod("2027-02")))).toBe("2027-03-08T06:00:00.000Z");
    // 2026-10's 8th is after the clocks went back on 1 November.
    expect(iso(closeAt(parsePeriod("2026-10")))).toBe("2026-11-08T06:00:00.000Z");
  });

  it("rolls December into January of the next year", () => {
    expect(iso(closeAt(parsePeriod("2026-12")))).toBe("2027-01-08T06:00:00.000Z");
  });
});

describe("latestPeriodDue", () => {
  it("on the 8th, answers last month", () => {
    // 00:00 on 8 December 2026 in Chicago.
    expect(latestPeriodDue(Date.parse("2026-12-08T06:00:00Z"), closeAt)).toBe("2026-11");
  });

  it("on the 7th, answers the month before last", () => {
    // 23:59 on 7 December 2026 in Chicago.
    expect(latestPeriodDue(Date.parse("2026-12-08T05:59:59Z"), closeAt)).toBe("2026-10");
  });

  it("goes by the moment it is given: the 10th is when a month is final", () => {
    expect(latestPeriodDue(Date.parse("2026-12-09T12:00:00Z"), finalAt)).toBe("2026-10");
    expect(latestPeriodDue(Date.parse("2026-12-10T06:00:00Z"), finalAt)).toBe("2026-11");
  });
});
