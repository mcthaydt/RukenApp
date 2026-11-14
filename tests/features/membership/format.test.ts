import { describe, expect, it } from "vitest";
import { dollars, longDate, membershipLine } from "../../../src/features/membership/format.ts";
import type { MembershipView } from "../../../src/features/membership/service.ts";

describe("dollars", () => {
  it("writes the two prices the way a person says them", () => {
    expect(dollars(999n)).toBe("$9.99");
    expect(dollars(9900n)).toBe("$99");
  });

  it("puts commas in the thousands and keeps both digits of the cents", () => {
    expect(dollars(123456n)).toBe("$1,234.56");
    expect(dollars(5n)).toBe("$0.05");
    expect(dollars(0n)).toBe("$0");
  });

  it("refuses an amount below zero", () => {
    expect(() => dollars(-1n)).toThrow(RangeError);
  });
});

describe("longDate", () => {
  it("is the shared Chicago-day formatter, so /me and /goodbye write a date the same way", () => {
    expect(longDate(new Date("2026-12-15T03:00:00Z"))).toBe("Monday, December 14");
  });
});

// What /me says under the email, one case for each row of the table in the plan (Task 30). The two past_due rows are
// here because no journey can reach them: the stand-in Stripe has no failing card.
describe("membershipLine", () => {
  const NONE: MembershipView = {
    state: "none",
    member: false,
    plan: null,
    renewsAt: null,
    endsAt: null,
    pausesAt: null,
  };
  // Noon UTC is the same calendar day in Chicago.
  const DEC_14 = new Date("2026-12-14T18:00:00Z");

  it("tells someone who never joined, and someone whose membership ended, to join", () => {
    expect(membershipLine(NONE)).toEqual({ line: "You're not a member.", button: "join" });
    expect(membershipLine({ ...NONE, state: "ended", plan: "monthly" })).toEqual({
      line: "You're not a member.",
      button: "join",
    });
  });

  it("tells an active monthly member what they pay and when it renews", () => {
    expect(
      membershipLine({ ...NONE, state: "active", member: true, plan: "monthly", renewsAt: DEC_14 }),
    ).toEqual({
      line: "You're a member. $9.99 a month. Renews on Monday, December 14.",
      button: "manageOrCancel",
    });
  });

  it("tells an active yearly member what they pay and when it renews", () => {
    expect(
      membershipLine({ ...NONE, state: "active", member: true, plan: "annual", renewsAt: DEC_14 }),
    ).toEqual({
      line: "You're a member. $99 a year. Renews on Monday, December 14.",
      button: "manageOrCancel",
    });
  });

  it("tells a member who cancelled when it ends, and that they can play until then", () => {
    expect(
      membershipLine({ ...NONE, state: "canceling", member: true, plan: "monthly", endsAt: DEC_14 }),
    ).toEqual({
      line: "Your membership ends on Monday, December 14. You can play until then.",
      button: "manage",
    });
  });

  it("tells a member whose card failed, and who is still one, by when to update it", () => {
    expect(
      membershipLine({ ...NONE, state: "past_due", member: true, plan: "monthly", pausesAt: DEC_14 }),
    ).toEqual({
      line: "We couldn't charge your card. Update it by Monday, December 14 to keep playing.",
      button: "updateCard",
    });
  });

  it("tells a member whose card failed and whose seven days are over that the membership is paused", () => {
    expect(
      membershipLine({ ...NONE, state: "past_due", member: false, plan: "monthly", pausesAt: DEC_14 }),
    ).toEqual({
      line: "We couldn't charge your card, so your membership is paused. Update your card to play again.",
      button: "updateCard",
    });
  });
});
