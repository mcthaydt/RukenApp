import { describe, expect, it } from "vitest";
import { PREMIUM_PRICES_CENTS } from "../../../src/features/membership/membership.ts";
import { yearlySaving } from "../../../src/routes/join/saving.ts";

describe("what the yearly plan saves", () => {
  it("is twelve months paid monthly, less the yearly price", () => {
    expect(yearlySaving(999n, 9900n)).toBe("$20.88");
  });

  it("is worked out from today's prices, never typed", () => {
    const { monthly, annual } = PREMIUM_PRICES_CENTS;
    expect(yearlySaving(monthly, annual)).toBe(`$${(Number(monthly * 12n - annual) / 100).toFixed(2)}`);
  });

  it("is left out when the yearly plan saves nothing", () => {
    expect(yearlySaving(1000n, 12000n)).toBeNull();
    expect(yearlySaving(1000n, 13000n)).toBeNull();
  });
});
