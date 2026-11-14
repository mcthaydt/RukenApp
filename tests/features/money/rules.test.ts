import { describe, expect, it } from "vitest";
import {
  ANSWER_BUSINESS_DAYS,
  BRINGING_MONTHS,
  CHARGEBACK_COST_MAKERS_SHARE_BPS,
  CLOSE_DAY_OF_MONTH,
  DAILY_PLAY_CAP_SECONDS,
  FINAL_DAY_OF_MONTH,
  PAYOUT_DAY_OF_MONTH,
  PAYOUT_MINIMUM_CENTS,
  POOL_WEIGHT_SCALE,
  QUESTION_WINDOW_DAYS,
} from "../../../src/features/money/rules.ts";

// These are promises to makers (design 6). A change here is an Owner decision, applied from the next month and
// never retroactively. This test makes such a change loud.
describe("money rules", () => {
  it("keeps every rule's number", () => {
    expect(BRINGING_MONTHS).toBe(12); // "for a member's first 12 months"
    expect(DAILY_PLAY_CAP_SECONDS).toBe(10_800); // "at most 180 minutes per member, per game, per day"
    expect(PAYOUT_MINIMUM_CENTS).toBe(2500n); // "The minimum is $25"
    expect(CLOSE_DAY_OF_MONTH).toBe(8);
    expect(FINAL_DAY_OF_MONTH).toBe(10); // "final on the 10th"
    expect(PAYOUT_DAY_OF_MONTH).toBe(15); // "paid on the 15th"
    expect(CHARGEBACK_COST_MAKERS_SHARE_BPS).toBe(5000);
    expect(POOL_WEIGHT_SCALE).toBe(1_000_000_000n);
    expect(QUESTION_WINDOW_DAYS).toBe(90);
    expect(ANSWER_BUSINESS_DAYS).toBe(10);
  });
});
