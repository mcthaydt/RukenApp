import { describe, expect, it } from "vitest";
import { PREMIUM_PRICES_CENTS, PREMIUM_TRIAL_DAYS } from "../../../src/features/membership/plans.ts";

// What a person is promised on the paywall (design 6): one membership, two prices, nothing else.
describe("the membership plans", () => {
  it("cost $9.99 a month or $99 a year, before any sales tax", () => {
    expect(PREMIUM_PRICES_CENTS).toEqual({ monthly: 999n, annual: 9900n });
  });

  it("have no trial", () => {
    expect(PREMIUM_TRIAL_DAYS).toBe(0);
  });
});
