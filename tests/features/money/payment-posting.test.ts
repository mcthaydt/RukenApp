import { describe, expect, it } from "vitest";
import {
  feeParts,
  postPaymentFee,
  postPaymentPaid,
  postRelease,
  releaseKey,
  releases,
} from "../../../src/features/money/payment-posting.ts";
import { parsePeriod, type Period } from "../../../src/features/money/period.ts";
import type { PostingLine } from "../../../src/features/money/posting.ts";

const november = parsePeriod("2026-11");

function sum(lines: readonly PostingLine[]): bigint {
  return lines.reduce((total, line) => total + line.amount, 0n);
}

function amountOf(lines: readonly PostingLine[], account: string): bigint {
  return lines.find((line) => line.account === account)?.amount ?? 0n;
}

const paid = {
  plan: "monthly",
  firstPeriod: "2026-11" as Period,
  gross: 1081n,
  tax: 82n,
  fees: 61n,
} as const;

// The yearly payment of the old worked example, with the makers' half rounded down: $85.52 with $6.52 tax and a
// $2.67 fee leaves 7633; half, rounded down, is 3816, which is 318 a month exactly.
const annual = { plan: "annual", firstPeriod: november, gross: 8552n, tax: 652n, fees: 267n } as const;

describe("postPaymentPaid", () => {
  it("posts a payment with what is known at the time", () => {
    expect(postPaymentPaid(paid)).toEqual([
      { account: "platform:stripe_clearing", amount: 1020n },
      { account: "platform:processor_fees", amount: 61n },
      { account: "platform:tax_payable", amount: -82n },
      { account: "pool:premium:2026-11", amount: -469n }, // 938 left; half is 469
      { account: "platform:revenue:premium", amount: -530n }, // 1081 − 82 − 469, as carried
    ]);
  });

  it("posts a yearly payment: the first month to the pool, the rest deferred", () => {
    expect(postPaymentPaid(annual)).toEqual([
      { account: "platform:stripe_clearing", amount: 8285n },
      { account: "platform:processor_fees", amount: 267n },
      { account: "platform:tax_payable", amount: -652n },
      { account: "pool:premium:2026-11", amount: -318n },
      { account: "premium:deferred", amount: -3498n },
      { account: "platform:revenue:premium", amount: -4084n },
    ]);
  });

  it("posts a $7.99 monthly payment with a 53-cent fee: 373 cents into its month, no deferral", () => {
    expect(
      postPaymentPaid({ plan: "monthly", firstPeriod: november, gross: 799n, tax: 0n, fees: 53n }),
    ).toEqual([
      { account: "platform:stripe_clearing", amount: 746n },
      { account: "platform:processor_fees", amount: 53n },
      { account: "pool:premium:2026-11", amount: -373n },
      { account: "platform:revenue:premium", amount: -426n },
    ]);
  });

  it("gives the pool nothing when the fees eat what is left, and Ruken carries the loss", () => {
    // Review Focus 1
    expect(
      postPaymentPaid({ plan: "monthly", firstPeriod: november, gross: 100n, tax: 0n, fees: 150n }),
    ).toEqual([
      { account: "platform:stripe_clearing", amount: -50n },
      { account: "platform:processor_fees", amount: 150n },
      { account: "platform:revenue:premium", amount: -100n },
    ]);
  });

  it("refuses negative amounts and tax above what was paid", () => {
    expect(() => postPaymentPaid({ ...paid, fees: -1n })).toThrow(RangeError);
    expect(() => postPaymentPaid({ ...paid, tax: 1082n })).toThrow(RangeError);
  });

  it("always balances, never posts a zero line, and puts half of what is left, rounded down, into the pool", () => {
    for (const plan of ["monthly", "annual"] as const) {
      for (let base = 0n; base <= 100_000n; base += 3_571n) {
        for (let tax = 0n; tax <= 10_000n; tax += 1_333n) {
          for (let fees = 0n; fees <= 5_000n; fees += 777n) {
            const lines = postPaymentPaid({ plan, firstPeriod: november, gross: base + tax, tax, fees });
            expect(sum(lines)).toBe(0n);
            expect(lines.every((line) => line.amount !== 0n)).toBe(true);
            const toPool = -(amountOf(lines, "pool:premium:2026-11") + amountOf(lines, "premium:deferred"));
            const left = base - fees;
            expect(toPool).toBe(left > 0n ? left / 2n : 0n);
          }
        }
      }
    }
  });
});

describe("releases", () => {
  it("is empty for a monthly payment, which has nothing deferred", () => {
    expect(releases(paid)).toEqual([]);
  });

  it("is the eleven months after the first for a yearly payment", () => {
    const parts = releases(annual);
    expect(parts).toHaveLength(11);
    expect(parts[0]).toEqual({ period: "2026-12", amount: 318n });
    expect(parts[10]).toEqual({ period: "2027-10", amount: 318n });
  });

  it("adds up to exactly what postPaymentPaid deferred", () => {
    for (let base = 0n; base <= 100_000n; base += 3_571n) {
      for (let fees = 0n; fees <= 5_000n; fees += 777n) {
        const payment = {
          plan: "annual",
          firstPeriod: november,
          gross: base + 700n,
          tax: 700n,
          fees,
        } as const;
        const deferred = -amountOf(postPaymentPaid(payment), "premium:deferred");
        expect(releases(payment).reduce((total, part) => total + part.amount, 0n)).toBe(deferred);
      }
    }
  });
});

describe("postRelease", () => {
  it("moves one month's part from the deferred balance to that month's pool", () => {
    expect(postRelease({ period: parsePeriod("2026-12"), amount: 318n })).toEqual([
      { account: "premium:deferred", amount: 318n },
      { account: "pool:premium:2026-12", amount: -318n },
    ]);
  });

  it("refuses a negative or zero amount", () => {
    expect(() => postRelease({ period: november, amount: -1n })).toThrow(RangeError);
    expect(() => postRelease({ period: november, amount: 0n })).toThrow(RangeError);
  });
});

describe("releaseKey", () => {
  it("is release:<invoice>:<month>, so a repeat for the same invoice and month is ignored", () => {
    expect(releaseKey("in_123", parsePeriod("2026-12"))).toBe("release:in_123:2026-12");
  });
});

describe("a fee that arrives after the payment", () => {
  it("splits a later fee as if it had been known", () => {
    expect(feeParts(paid, 12n)).toEqual({ months: [{ period: "2026-11", amount: 6n }], ruken: 6n }); // 469 → 463
    expect(feeParts(paid, 1n)).toEqual({ months: [{ period: "2026-11", amount: 1n }], ruken: 0n }); // 938 → 937: half, rounded down, goes 469 → 468
  });

  it("posts a later fee out of Stripe, the month's pool and Ruken's half, adding up to zero", () => {
    expect(postPaymentFee(feeParts(paid, 12n), (period) => `pool:premium:${period}`)).toEqual([
      { account: "platform:stripe_clearing", amount: -12n },
      { account: "pool:premium:2026-11", amount: 6n },
      { account: "platform:revenue:premium", amount: 6n },
    ]);
  });

  it("takes a yearly payment's later fee from the months it belongs to", () => {
    // $107.17 with $8.17 tax and a $3.87 fee: 9513 left, 4756 to makers (397 four times, 396 eight times). A further
    // 24 cents leaves 9489 and 4744 (396 four times, 395 eight times): one cent less in each of the twelve months.
    const yearly = { plan: "annual", firstPeriod: november, gross: 10717n, tax: 817n, fees: 387n } as const;
    const parts = feeParts(yearly, 24n);
    expect(parts.months).toHaveLength(12);
    expect(parts.months.every((month) => month.amount === 1n)).toBe(true);
    expect(parts.ruken).toBe(12n);
    const lines = postPaymentFee(parts, (period) =>
      period === "2026-11" ? "pool:premium:2026-11" : "premium:deferred",
    );
    expect(lines).toEqual([
      { account: "platform:stripe_clearing", amount: -24n },
      { account: "pool:premium:2026-11", amount: 1n },
      { account: "premium:deferred", amount: 11n },
      { account: "platform:revenue:premium", amount: 12n },
    ]);
  });

  it("takes nothing more from makers once their half is nothing", () => {
    // Review Focus 1
    expect(feeParts({ ...paid, fees: 2000n }, 5n)).toEqual({ months: [], ruken: 5n });
  });

  it("posts a fee that touches no maker as Stripe and Ruken only", () => {
    expect(postPaymentFee({ months: [], ruken: 5n }, (period) => `pool:premium:${period}`)).toEqual([
      { account: "platform:stripe_clearing", amount: -5n },
      { account: "platform:revenue:premium", amount: 5n },
    ]);
  });

  it("always takes exactly the fee, split between makers and Ruken, however late it comes", () => {
    for (const fee of [1n, 2n, 7n, 12n, 61n, 500n, 2000n]) {
      const parts = feeParts(paid, fee);
      expect(parts.months.reduce((total, month) => total + month.amount, 0n) + parts.ruken).toBe(fee);
      expect(sum(postPaymentFee(parts, (period) => `pool:premium:${period}`))).toBe(0n);
    }
  });
});
