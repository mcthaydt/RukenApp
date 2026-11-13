import { describe, expect, it } from "vitest";
import { pastDuePausesAt, premiumAccess } from "../../../src/features/membership/access.ts";

// Who counts as a member right now. One helper for every reader, so they never disagree.

const DAY = 86_400_000;
const PERIOD_END = new Date(Date.UTC(2026, 11, 2, 15, 0, 0));
const FAILED = new Date(Date.UTC(2026, 10, 2, 15, 0, 0));
const PAUSE = FAILED.getTime() + 7 * DAY;

function membership(state: "active" | "canceling" | "past_due" | "ended", pastDueSince: Date | null = null) {
  return { state, currentPeriodEnd: PERIOD_END, pastDueSince };
}

describe("premiumAccess", () => {
  it("is false without a membership", () => {
    expect(premiumAccess(null, PERIOD_END.getTime() - DAY)).toBe(false);
  });

  it.each(["active", "canceling"] as const)(
    "runs %s to the end of the paid period, and not a moment past it",
    (state) => {
      expect(premiumAccess(membership(state), PERIOD_END.getTime() - 1)).toBe(true);
      expect(premiumAccess(membership(state), PERIOD_END.getTime())).toBe(false);
      expect(premiumAccess(membership(state), PERIOD_END.getTime() + 1000)).toBe(false);
    },
  );

  it("runs past_due for seven days from the first failure", () => {
    expect(premiumAccess(membership("past_due", FAILED), FAILED.getTime())).toBe(true);
    expect(premiumAccess(membership("past_due", FAILED), PAUSE - 1000)).toBe(true);
    expect(premiumAccess(membership("past_due", FAILED), PAUSE)).toBe(false);
  });

  it("is still a member six days after the first failure, and not at seven", () => {
    expect(premiumAccess(membership("past_due", FAILED), FAILED.getTime() + 6 * DAY)).toBe(true);
    expect(premiumAccess(membership("past_due", FAILED), FAILED.getTime() + 7 * DAY)).toBe(false);
  });

  it("never runs past_due beyond the paid period's end", () => {
    const lateFailure = new Date(PERIOD_END.getTime() - 2 * DAY);
    expect(premiumAccess(membership("past_due", lateFailure), PERIOD_END.getTime() - 1)).toBe(true);
    expect(premiumAccess(membership("past_due", lateFailure), PERIOD_END.getTime())).toBe(false);
  });

  it("gives an ended membership nothing, even inside its old period", () => {
    expect(premiumAccess(membership("ended"), PERIOD_END.getTime() - DAY)).toBe(false);
    expect(premiumAccess(membership("ended", FAILED), FAILED.getTime())).toBe(false);
  });
});

describe("pastDuePausesAt", () => {
  it("is seven days after the first failure", () => {
    expect(pastDuePausesAt(membership("past_due", FAILED))).toEqual(new Date(PAUSE));
  });

  it("is the period end when that comes first", () => {
    const lateFailure = new Date(PERIOD_END.getTime() - 2 * DAY);
    expect(pastDuePausesAt(membership("past_due", lateFailure))).toEqual(PERIOD_END);
  });

  it("is the period end for a past_due row that has no first failure recorded", () => {
    expect(pastDuePausesAt(membership("past_due", null))).toEqual(PERIOD_END);
  });
});
