import { describe, expect, it } from "vitest";
import { canonicalJson } from "../../../src/features/money/canonical-json.ts";

describe("canonicalJson", () => {
  it("sorts keys at every depth, drops undefined members and leaves no whitespace", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: null, y: "x" }], c: undefined } })).toBe(
      '{"a":{"d":[3,{"y":"x","z":null}]},"b":1}',
    );
  });

  it("writes bigints as decimal strings, so cents never pass through a float", () => {
    expect(canonicalJson({ amount: -12_345_678_901_234_567n, zero: 0n })).toBe(
      '{"amount":"-12345678901234567","zero":"0"}',
    );
  });

  it("refuses values JSON cannot carry exactly", () => {
    expect(() => canonicalJson({ amount: Number.NaN })).toThrow(RangeError);
    expect(() => canonicalJson({ amount: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });
});
