import { describe, expect, it } from "vitest";
import { parsePeriod, type Period } from "../../../src/features/money/period.ts";
import { poolContributions } from "../../../src/features/money/pool-share.ts";

const november = parsePeriod("2026-11");

describe("poolContributions (how a payment feeds the makers' pool)", () => {
  // The stand-in Stripe's numbers: $9.99, 82 cents of tax, a 61-cent card fee, and 12 cents of other fees.
  const monthly = {
    plan: "monthly",
    firstPeriod: "2026-11" as Period,
    gross: 1081n,
    tax: 82n,
    fees: 73n,
  } as const;

  it("takes tax and every fee off the top, then gives makers half", () => {
    expect(poolContributions(monthly)).toEqual([{ period: "2026-11", amount: 463n }]); // 1081 − 82 − 73 = 926; half is 463
  });

  it("gives Ruken the odd cent", () => {
    expect(poolContributions({ ...monthly, fees: 72n })[0]?.amount).toBe(463n); // 927 left; half, rounded down
  });

  it("puts half of a monthly payment's net into the month it pays for", () => {
    // $7.99 with no tax and a 53-cent fee: 746 left, half is 373.
    expect(
      poolContributions({ plan: "monthly", firstPeriod: november, gross: 799n, tax: 0n, fees: 53n }),
    ).toEqual([{ period: "2026-11", amount: 373n }]);
  });

  it("spreads a yearly fee over twelve months, the odd cents first", () => {
    const parts = poolContributions({
      plan: "annual",
      firstPeriod: "2026-11" as Period,
      gross: 10717n,
      tax: 817n,
      fees: 387n,
    });
    expect(parts.map((part) => part.period)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
      "2027-07",
      "2027-08",
      "2027-09",
      "2027-10",
    ]);
    expect(parts.map((part) => part.amount)).toEqual([
      397n,
      397n,
      397n,
      397n,
      396n,
      396n,
      396n,
      396n,
      396n,
      396n,
      396n,
      396n,
    ]); // 9513 left; half, rounded down, is 4756
  });

  it("gives the leftover cents of the even split to the earliest months", () => {
    // 1211 left → 605 to makers → 50 each, 5 cents over.
    const parts = poolContributions({
      plan: "annual",
      firstPeriod: november,
      gross: 1211n,
      tax: 0n,
      fees: 0n,
    });
    expect(parts.map((part) => part.amount)).toEqual([
      51n,
      51n,
      51n,
      51n,
      51n,
      50n,
      50n,
      50n,
      50n,
      50n,
      50n,
      50n,
    ]);
  });

  it("gives nothing, never less, when the fees are more than what is left", () => {
    // Review Focus 1
    expect(poolContributions({ ...monthly, fees: 2000n })).toEqual([{ period: "2026-11", amount: 0n }]);
  });

  it("refuses a negative amount", () => {
    expect(() => poolContributions({ ...monthly, gross: -1n })).toThrow(RangeError);
    expect(() => poolContributions({ ...monthly, tax: -1n })).toThrow(RangeError);
    expect(() => poolContributions({ ...monthly, fees: -1n })).toThrow(RangeError);
  });

  it("always adds up to half of what is left, rounded down, with at most one cent between months", () => {
    // A fixed sweep of prices, taxes and fees, in place of random cases, so a failure replays exactly.
    for (const plan of ["monthly", "annual"] as const) {
      for (let price = 0n; price <= 100_000n; price += 4_321n) {
        for (let tax = 0n; tax <= 10_000n; tax += 1_333n) {
          for (let fees = 0n; fees <= 5_000n; fees += 777n) {
            const gross = price + tax;
            const parts = poolContributions({ plan, firstPeriod: november, gross, tax, fees });
            const left = gross - tax - fees;
            const amounts = parts.map((part) => part.amount);
            expect(amounts.reduce((sum, amount) => sum + amount, 0n)).toBe(left > 0n ? left / 2n : 0n);
            expect(Math.max(...amounts.map(Number)) - Math.min(...amounts.map(Number))).toBeLessThanOrEqual(
              1,
            );
          }
        }
      }
    }
  });
});
