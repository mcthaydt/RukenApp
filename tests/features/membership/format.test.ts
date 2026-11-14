import { describe, expect, it } from "vitest";
import { dollars, longDate } from "../../../src/features/membership/format.ts";

describe("dollars", () => {
  it("writes the two prices the way a person says them", () => {
    expect(dollars(999n)).toBe("$9.99");
    expect(dollars(9900n)).toBe("$99");
  });

  it("puts commas in the thousands and keeps both digits of the cents", () => {
    expect(dollars(123456n)).toBe("$1,234.56");
    expect(dollars(5n)).toBe("$0.05");
    expect(dollars(0n)).toBe("$0");
  });

  it("refuses an amount below zero", () => {
    expect(() => dollars(-1n)).toThrow(RangeError);
  });
});

describe("longDate", () => {
  it("is the shared Chicago-day formatter, so /me and /goodbye write a date the same way", () => {
    expect(longDate(new Date("2026-12-15T03:00:00Z"))).toBe("Monday, December 14");
  });
});
