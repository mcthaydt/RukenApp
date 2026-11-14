import { describe, expect, it } from "vitest";
import { centsRoundedUp, microCentsOf } from "../../../src/features/money/major-units.ts";

describe("microCentsOf (Stripe's decimal dollars as whole millionths of a cent)", () => {
  it.each([
    ["0.06993", 6_993_000n],
    ["2", 200_000_000n],
    ["0.25", 25_000_000n],
    ["10.00", 1_000_000_000n],
    ["0", 0n],
  ])("reads %s as %s millionths of a cent", (text, micro) => {
    expect(microCentsOf(text)).toBe(micro);
  });

  it("reads a returned fee as a negative amount", () => {
    expect(microCentsOf("-0.07")).toBe(-7_000_000n);
  });

  // Review Focus 4
  it.each(["", "--0.07", "0.07-", "0.123456789", "1e-3", "0,07", "abc", "1.2.3", " 0.07", ".5", "1."])(
    "cannot read %j",
    (text) => {
      expect(microCentsOf(text)).toBeNull();
    },
  );
});

describe("centsRoundedUp", () => {
  it("rounds up to the cent, and leaves a whole cent alone", () => {
    expect(centsRoundedUp(11_988_000n)).toBe(12n);
    expect(centsRoundedUp(12_000_000n)).toBe(12n);
    expect(centsRoundedUp(1n)).toBe(1n);
    expect(centsRoundedUp(0n)).toBe(0n);
  });

  it("refuses a negative amount: a returned fee is never rounded into the split", () => {
    expect(() => centsRoundedUp(-1n)).toThrow(RangeError);
  });
});
