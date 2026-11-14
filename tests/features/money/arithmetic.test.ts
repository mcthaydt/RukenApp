import { describe, expect, it } from "vitest";
import { lrr, pct } from "../../../src/features/money/arithmetic.ts";

describe("pct (share of a non-negative amount in basis points, round half up)", () => {
  it.each([
    [1000n, 5000, 500n],
    [799n, 5000, 400n], // 399.5 rounds up
    [7900n, 9000, 7110n],
    [1n, 5000, 1n], // 0.5 rounds up
    [1n, 4999, 0n],
    [0n, 9500, 0n],
    [500n, 9500, 475n],
  ])("pct(%s, %s) = %s", (amount, bps, expected) => {
    expect(pct(amount, bps)).toBe(expected);
  });

  it("refuses a negative amount (reversals negate lines, they never recompute)", () => {
    expect(() => pct(-1n, 5000)).toThrow(RangeError);
  });

  it("refuses basis points outside 0..10000 or not whole", () => {
    expect(() => pct(100n, 10001)).toThrow(RangeError);
    expect(() => pct(100n, -1)).toThrow(RangeError);
    expect(() => pct(100n, 12.5)).toThrow(RangeError);
  });
});

describe("lrr (largest-remainder rounding)", () => {
  it("splits a total by weight, leftover cents to the largest remainders", () => {
    expect(
      lrr(1000n, [
        { key: "a", weight: 1n },
        { key: "b", weight: 1n },
        { key: "c", weight: 1n },
      ]),
    ).toEqual(
      new Map([
        ["a", 334n],
        ["b", 333n],
        ["c", 333n],
      ]),
    );
  });

  it("breaks remainder ties by key in ascending code-unit order", () => {
    const shares = lrr(2n, [
      { key: "m03", weight: 1n },
      { key: "m01", weight: 1n },
      { key: "m02", weight: 1n },
    ]);
    expect(shares.get("m01")).toBe(1n);
    expect(shares.get("m02")).toBe(1n);
    expect(shares.get("m03")).toBe(0n);
  });

  it("gives every item zero when the total is zero", () => {
    expect(lrr(0n, [{ key: "a", weight: 3n }])).toEqual(new Map([["a", 0n]]));
  });

  it("refuses an empty list, a zero total weight, negative weights, duplicate keys or a negative total", () => {
    expect(() => lrr(10n, [])).toThrow(RangeError);
    expect(() => lrr(10n, [{ key: "a", weight: 0n }])).toThrow(RangeError);
    expect(() =>
      lrr(10n, [
        { key: "a", weight: -1n },
        { key: "b", weight: 2n },
      ]),
    ).toThrow(RangeError);
    expect(() =>
      lrr(10n, [
        { key: "a", weight: 1n },
        { key: "a", weight: 1n },
      ]),
    ).toThrow(RangeError);
    expect(() => lrr(-10n, [{ key: "a", weight: 1n }])).toThrow(RangeError);
  });

  // A fixed-seed generator stands in for a property-test library, so a failure replays exactly.
  function seeded(seed: number): () => number {
    let state = seed;
    return () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state;
    };
  }

  it("always sums to the total, each share is the floor or ceiling of its exact share, and order does not matter", () => {
    const next = seeded(20_261_114);
    for (let round = 0; round < 300; round += 1) {
      const count = 1 + (next() % 20);
      const list = Array.from({ length: count }, (_, i) => ({
        key: `k${String(i)}`,
        // The first item always has some weight, so the total weight is never zero.
        weight: BigInt(next() % 1_000_001) + (i === 0 ? 1n : 0n),
      }));
      const total = BigInt(next()) * BigInt(next() % 3);
      const shares = lrr(total, list);
      const weightSum = list.reduce((sum, item) => sum + item.weight, 0n);
      let sum = 0n;
      for (const item of list) {
        const share = shares.get(item.key) ?? -1n;
        const floor = (total * item.weight) / weightSum;
        expect(share === floor || share === floor + 1n).toBe(true);
        sum += share;
      }
      expect(sum).toBe(total);
      expect(lrr(total, [...list].reverse())).toEqual(shares);
    }
  });
});
