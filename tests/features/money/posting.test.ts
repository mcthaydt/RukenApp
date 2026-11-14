import { describe, expect, it } from "vitest";
import { requireNonNegative, withoutZeroLines } from "../../../src/features/money/posting.ts";

describe("withoutZeroLines", () => {
  it("leaves out the lines that say nothing and keeps the others in order", () => {
    expect(
      withoutZeroLines([
        { account: "a", amount: 5n },
        { account: "b", amount: 0n },
        { account: "c", amount: -5n, makerUserId: "maker" },
      ]),
    ).toEqual([
      { account: "a", amount: 5n },
      { account: "c", amount: -5n, makerUserId: "maker" },
    ]);
  });
});

describe("requireNonNegative", () => {
  it("accepts zero and more, and refuses anything below zero", () => {
    expect(() => {
      requireNonNegative(0n, 1n, 500n);
    }).not.toThrow();
    expect(() => {
      requireNonNegative(1n, -1n);
    }).toThrow(RangeError);
  });
});
