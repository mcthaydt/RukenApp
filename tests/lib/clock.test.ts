import { describe, expect, it } from "vitest";
import { chicagoDayOf, systemClock } from "../../src/lib/clock.ts";

describe("systemClock", () => {
  it("epochMs agrees with now within a few milliseconds", () => {
    const fromInstant = systemClock.now().epochMilliseconds;
    const fromEpoch = systemClock.epochMs();
    expect(Math.abs(fromEpoch - fromInstant)).toBeLessThan(50);
  });
});

// The calendar is America/Chicago. chicagoDayOf is the one place its day boundaries are worked out,
// so the tests sit on the awkward days: daylight time starting and ending, and the minute either
// side of midnight.
describe("chicagoDayOf", () => {
  it("reads the Chicago date of an instant, not the UTC one", () => {
    // 03:30 UTC on 24 October is still the evening of the 23rd in Chicago (UTC-5).
    expect(chicagoDayOf(Date.parse("2026-10-24T03:30:00Z"))).toBe("2026-10-23");
    expect(chicagoDayOf(Date.parse("2026-10-24T05:00:00Z"))).toBe("2026-10-24");
  });

  it("turns over at Chicago midnight in winter (UTC-6) too", () => {
    expect(chicagoDayOf(Date.parse("2027-01-15T05:59:59.999Z"))).toBe("2027-01-14");
    expect(chicagoDayOf(Date.parse("2027-01-15T06:00:00Z"))).toBe("2027-01-15");
  });

  it("follows the clocks going back on 1 November 2026, a 25-hour day", () => {
    expect(chicagoDayOf(Date.parse("2026-11-01T04:59:59.999Z"))).toBe("2026-10-31");
    expect(chicagoDayOf(Date.parse("2026-11-01T05:00:00Z"))).toBe("2026-11-01");
    expect(chicagoDayOf(Date.parse("2026-11-02T05:59:59.999Z"))).toBe("2026-11-01");
    expect(chicagoDayOf(Date.parse("2026-11-02T06:00:00Z"))).toBe("2026-11-02");
  });
});
