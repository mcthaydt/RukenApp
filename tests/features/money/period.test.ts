import { describe, expect, it } from "vitest";
import { addMonths, isPeriod, parsePeriod, periodOf } from "../../../src/features/money/period.ts";

describe("periods (a calendar month in America/Chicago, written YYYY-MM)", () => {
  it.each(["2026-11", "2027-01", "2099-12"])("accepts %s", (text) => {
    expect(isPeriod(text)).toBe(true);
    expect(parsePeriod(text)).toBe(text);
  });

  it.each(["2026-13", "2026-00", "2026-1", "26-11", "2026-11-01", ""])("rejects %s", (text) => {
    expect(isPeriod(text)).toBe(false);
    expect(() => parsePeriod(text)).toThrow(RangeError);
  });

  it("adds months across a year end", () => {
    expect(addMonths(parsePeriod("2026-11"), 0)).toBe("2026-11");
    expect(addMonths(parsePeriod("2026-11"), 2)).toBe("2027-01");
    expect(addMonths(parsePeriod("2026-11"), 11)).toBe("2027-10");
    expect(addMonths(parsePeriod("2027-01"), -1)).toBe("2026-12");
  });

  it("sorts in time order as plain strings", () => {
    const periods = ["2027-01", "2026-12", "2026-11"].map(parsePeriod);
    expect([...periods].sort()).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("knows the Chicago month of an instant, on both sides of midnight", () => {
    expect(periodOf(Date.parse("2026-12-01T05:59:59Z"))).toBe("2026-11"); // 23:59:59 on 30 November in Chicago
    expect(periodOf(Date.parse("2026-12-01T06:00:00Z"))).toBe("2026-12");
  });
});
