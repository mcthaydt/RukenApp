import { describe, expect, it } from "vitest";
import { membershipLine } from "../../../src/features/membership/format.ts";
import { paywallCard } from "../../../src/features/membership/paywall.ts";
import type { MembershipView } from "../../../src/features/membership/service.ts";

// Which card /join shows. The paused case is here because no journey can reach it: the stand-in Stripe has no failing
// card. A member whose card failed more than seven days ago is not a member, but pressing "Continue to payment" would
// only be bounced (they still have a membership), so they are told and sent to Stripe's page to fix the card.

const NONE: MembershipView = {
  state: "none",
  member: false,
  plan: null,
  renewsAt: null,
  endsAt: null,
  pausesAt: null,
};
const PAUSED: MembershipView = { ...NONE, state: "past_due", plan: "monthly" };

describe("paywallCard", () => {
  it("shows the price to someone signed out, and to someone who never joined", () => {
    expect(paywallCard(null)).toEqual({ kind: "join" });
    expect(paywallCard(NONE)).toEqual({ kind: "join" });
  });

  it("shows the price again to someone whose membership ended", () => {
    expect(paywallCard({ ...NONE, state: "ended", plan: "annual" })).toEqual({ kind: "join" });
  });

  it("tells a member so, whatever state their membership is in", () => {
    expect(paywallCard({ ...NONE, state: "active", member: true, plan: "monthly" })).toEqual({
      kind: "member",
    });
    expect(paywallCard({ ...PAUSED, member: true, pausesAt: new Date("2026-12-14T18:00:00Z") })).toEqual({
      kind: "member",
    });
  });

  it("says the membership is paused, in /me's words, once the seven days are up", () => {
    expect(paywallCard(PAUSED)).toEqual({
      kind: "paused",
      line: "We couldn't charge your card, so your membership is paused. Update your card to play again.",
    });
    // The same words /me shows, so the two screens never disagree.
    expect(paywallCard(PAUSED)).toMatchObject({ line: membershipLine(PAUSED).line });
  });
});
