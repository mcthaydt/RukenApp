import { describe, expect, it } from "vitest";
import { paidAfterEnd } from "../../../src/features/membership/payments.ts";

// A payment made after its subscription ended bought no membership, so a person refunds it. A payment
// made while the subscription still ran is a normal one, even when it is recorded late.

const ENDED_AT = Date.UTC(2026, 10, 10, 12, 0, 0);

describe("paidAfterEnd", () => {
  it("is false while the subscription runs", () => {
    expect(paidAfterEnd({ status: "active", endedAtMs: null }, ENDED_AT)).toBe(false);
    expect(paidAfterEnd({ status: "past_due", endedAtMs: null }, ENDED_AT)).toBe(false);
  });

  it.each(["canceled", "incomplete_expired"])(
    "is true for a payment at or after the end of a %s one",
    (status) => {
      expect(paidAfterEnd({ status, endedAtMs: ENDED_AT }, ENDED_AT)).toBe(true);
      expect(paidAfterEnd({ status, endedAtMs: ENDED_AT }, ENDED_AT + 1)).toBe(true);
    },
  );

  it("is false for a payment made before the end, even when it is recorded after", () => {
    expect(paidAfterEnd({ status: "canceled", endedAtMs: ENDED_AT }, ENDED_AT - 1)).toBe(false);
  });

  it("counts an ended subscription with no end time as ended before any payment", () => {
    expect(paidAfterEnd({ status: "canceled", endedAtMs: null }, ENDED_AT)).toBe(true);
  });
});
