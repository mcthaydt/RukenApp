import { describe, expect, it } from "vitest";
import {
  reduceMembership,
  type MembershipRow,
  type SubscriptionSnapshot,
} from "../../../src/features/membership/reducer.ts";

// The membership row mirrors the Stripe subscription. Every webhook re-fetches the
// subscription and reduces (previous row, snapshot, when it was seen) to the next row, so a late or
// repeated event converges on Stripe's newest state.

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 2, 15, 0, 0); // 2026-11-02
const PERIOD_END = Date.UTC(2026, 11, 2, 15, 0, 0);

function snapshot(overrides: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot {
  return {
    id: "sub_1",
    status: "active",
    plan: "monthly",
    cancelAtPeriodEnd: false,
    cancelAtMs: null,
    currentPeriodEndMs: PERIOD_END,
    ...overrides,
  };
}

function row(overrides: Partial<MembershipRow> = {}): MembershipRow {
  return {
    stripeSubscriptionId: "sub_1",
    plan: "monthly",
    state: "active",
    currentPeriodEndMs: PERIOD_END,
    cancelAtMs: null,
    pastDueSince: null,
    ...overrides,
  };
}

describe("reduceMembership: Stripe status to Ruken state", () => {
  it("makes a new active row from an active subscription", () => {
    expect(reduceMembership(null, snapshot(), NOW)).toEqual(row());
  });

  it("reads trialing like active (no trials are offered)", () => {
    expect(reduceMembership(null, snapshot({ status: "trialing" }), NOW)).toEqual(row());
  });

  it("is canceling when cancel_at_period_end is set, ending at the period end", () => {
    expect(reduceMembership(row(), snapshot({ cancelAtPeriodEnd: true }), NOW)).toEqual(
      row({ state: "canceling", cancelAtMs: PERIOD_END }),
    );
  });

  // Stripe can record "cancel at the end of the period" as a set `cancel_at` time with cancel_at_period_end false.
  // The member has still cancelled, so /me must say when it ends, never "Renews on".
  it("is canceling when Stripe sets cancel_at alone, ending at that time", () => {
    expect(reduceMembership(row(), snapshot({ cancelAtMs: PERIOD_END }), NOW)).toEqual(
      row({ state: "canceling", cancelAtMs: PERIOD_END }),
    );
  });

  it("is past_due on past_due", () => {
    expect(reduceMembership(row(), snapshot({ status: "past_due" }), NOW)).toEqual(
      row({ state: "past_due", pastDueSince: NOW }),
    );
  });

  it.each(["unpaid", "canceled", "incomplete_expired", "paused"] as const)("is ended on %s", (status) => {
    expect(reduceMembership(row(), snapshot({ status }), NOW)?.state).toBe("ended");
  });

  it("changes nothing on incomplete, before the first payment", () => {
    expect(reduceMembership(null, snapshot({ status: "incomplete" }), NOW)).toBeNull();
    expect(reduceMembership(row(), snapshot({ status: "incomplete" }), NOW)).toBeNull();
  });

  it("takes the plan and the period end from the subscription", () => {
    const next = reduceMembership(
      row(),
      snapshot({ plan: "annual", currentPeriodEndMs: PERIOD_END + 365 * DAY }),
      NOW,
    );
    expect(next).toMatchObject({ plan: "annual", currentPeriodEndMs: PERIOD_END + 365 * DAY });
  });

  it("keeps a cancel time Stripe set without cancel_at_period_end", () => {
    expect(reduceMembership(row(), snapshot({ cancelAtMs: PERIOD_END - DAY }), NOW)?.cancelAtMs).toBe(
      PERIOD_END - DAY,
    );
  });
});

describe("reduceMembership: failed payments", () => {
  it("stamps pastDueSince at the first failure and keeps it on the next ones", () => {
    const first = reduceMembership(row(), snapshot({ status: "past_due" }), NOW);
    const second = reduceMembership({ ...row(), ...first }, snapshot({ status: "past_due" }), NOW + 3 * DAY);
    expect(second).toMatchObject({ state: "past_due", pastDueSince: NOW });
  });

  it("clears pastDueSince when a payment goes through", () => {
    const pastDue = row({ state: "past_due", pastDueSince: NOW });
    expect(reduceMembership(pastDue, snapshot(), NOW + DAY)).toEqual(row());
  });

  it("stays past_due while a failing member also asked to cancel", () => {
    const pastDue = row({ state: "past_due", pastDueSince: NOW });
    expect(
      reduceMembership(pastDue, snapshot({ status: "past_due", cancelAtPeriodEnd: true }), NOW),
    ).toMatchObject({
      state: "past_due",
      cancelAtMs: PERIOD_END,
    });
  });

  it("keeps pastDueSince when Stripe ends a failing membership, so the row still says when the failures began", () => {
    const pastDue = row({ state: "past_due", pastDueSince: NOW });
    expect(reduceMembership(pastDue, snapshot({ status: "canceled" }), NOW + 7 * DAY)).toMatchObject({
      state: "ended",
      pastDueSince: NOW,
    });
  });

  it("does not bring back a pastDueSince that was cleared", () => {
    const ended = row({ state: "ended", pastDueSince: null });
    expect(reduceMembership(ended, snapshot({ status: "canceled" }), NOW)).toMatchObject({
      state: "ended",
      pastDueSince: null,
    });
  });
});

describe("reduceMembership: more than one subscription", () => {
  it("ignores an event for another subscription while the row's own has not ended", () => {
    expect(reduceMembership(row(), snapshot({ id: "sub_old", status: "canceled" }), NOW)).toBeNull();
    expect(reduceMembership(row({ state: "canceling" }), snapshot({ id: "sub_2" }), NOW)).toBeNull();
  });

  it("replaces an ended row with the new subscription when the member joins again", () => {
    const ended = row({ state: "ended", plan: "annual", pastDueSince: NOW - 30 * DAY });
    expect(reduceMembership(ended, snapshot({ id: "sub_2" }), NOW)).toEqual(
      row({ stripeSubscriptionId: "sub_2" }),
    );
  });

  it("ignores a late event that ends some older subscription after the row has ended", () => {
    const ended = row({ state: "ended", stripeSubscriptionId: "sub_2" });
    expect(reduceMembership(ended, snapshot({ id: "sub_1", status: "canceled" }), NOW)).toBeNull();
  });
});

describe("reduceMembership: repeats", () => {
  it("gives the same row for the same snapshot twice", () => {
    const once = reduceMembership(row(), snapshot({ status: "past_due" }), NOW);
    if (once === null) throw new Error("expected a row");
    expect(reduceMembership(once, snapshot({ status: "past_due" }), NOW + DAY)).toEqual(once);
  });
});
