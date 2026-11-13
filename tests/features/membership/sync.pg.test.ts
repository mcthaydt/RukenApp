import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PremiumSubscription } from "../../../src/features/membership/subscription.ts";
import { syncMembership } from "../../../src/features/membership/sync.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { createUser } from "../../support/create-user.ts";

// Direct tests for syncMembership. It reads the subscription from Stripe and stores the result in
// the member's row. A subscription that ended
// marks the member ended (lapsed); one that is active keeps them active; and the odd cases (not
// Premium, another stack's member, a stale or second subscription) change nothing.

let database: TestDatabase | undefined;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.stop();
});

const DAY = 86_400_000;
const OBSERVED_AT = Date.parse("2026-11-10T12:00:00Z");
const PERIOD_END = OBSERVED_AT + 20 * DAY;

// Stripe ids are unique in the database, so tests number theirs across the whole file.
let subscriptionCount = 0;
function nextSubscriptionId(): string {
  subscriptionCount += 1;
  return `sub_sync_${String(subscriptionCount)}`;
}

/** A membership subscription as Stripe reports it; `changes` overrides the parts a test cares about. */
function subscription(
  userId: string | null,
  changes: Partial<PremiumSubscription> = {},
): PremiumSubscription {
  return {
    id: nextSubscriptionId(),
    status: "active",
    plan: "monthly",
    cancelAtPeriodEnd: false,
    cancelAtMs: null,
    currentPeriodEndMs: PERIOD_END,
    customerId: "cus_sync",
    userId,
    premium: true,
    endedAtMs: null,
    ...changes,
  };
}

/** Syncs the subscription with a Stripe that answers with exactly that snapshot. */
function sync(snapshot: PremiumSubscription, observedAtMs = OBSERVED_AT) {
  const stripe = { subscription: () => Promise.resolve(snapshot) };
  return syncMembership({ db: db(), stripe }, snapshot.id, observedAtMs);
}

function membershipOf(userId: string) {
  return db().premiumMembership.findUnique({ where: { userId } });
}

describe("syncMembership", { timeout: 30_000 }, () => {
  it("makes a row for a member who has none, active until the period ends", async () => {
    const userId = await createUser(db());
    const snapshot = subscription(userId);

    expect(await sync(snapshot)).toBe("updated");

    expect(await membershipOf(userId)).toMatchObject({
      stripeSubscriptionId: snapshot.id,
      plan: "monthly",
      state: "active",
      currentPeriodEnd: new Date(PERIOD_END),
      cancelAt: null,
      pastDueSince: null,
    });
  });

  it("keeps an active member active when the same subscription is synced again", async () => {
    const userId = await createUser(db());
    const snapshot = subscription(userId);
    await sync(snapshot);

    const renewed = { ...snapshot, currentPeriodEndMs: PERIOD_END + 30 * DAY };
    expect(await sync(renewed)).toBe("updated");

    expect(await membershipOf(userId)).toMatchObject({
      state: "active",
      currentPeriodEnd: new Date(PERIOD_END + 30 * DAY),
    });
    expect(await db().premiumMembership.count({ where: { userId } })).toBe(1);
  });

  it("marks a member ended when their subscription has ended", async () => {
    const userId = await createUser(db());
    const snapshot = subscription(userId);
    await sync(snapshot);

    const lapsed = { ...snapshot, status: "canceled" as const, endedAtMs: OBSERVED_AT };
    expect(await sync(lapsed)).toBe("updated");

    expect((await membershipOf(userId))?.state).toBe("ended");
  });

  it("stores what Stripe says inside the lock, not the first read made before it", async () => {
    const userId = await createUser(db());
    const snapshot = subscription(userId);
    await sync(snapshot);

    // Another delivery changes the subscription between the first read and the one inside the lock.
    // Stripe answers "active" to the first call and "canceled" to the second.
    const canceled = { ...snapshot, status: "canceled" as const, endedAtMs: OBSERVED_AT };
    let reads = 0;
    const stripe = {
      subscription: () => {
        reads += 1;
        return Promise.resolve(reads === 1 ? snapshot : canceled);
      },
    };
    expect(await syncMembership({ db: db(), stripe }, snapshot.id, OBSERVED_AT)).toBe("updated");

    expect((await membershipOf(userId))?.state).toBe("ended");
  });

  it("marks a member ended when payments ran out (unpaid), keeping the failure stamp", async () => {
    const userId = await createUser(db());
    const snapshot = subscription(userId);
    await sync({ ...snapshot, status: "past_due" }, OBSERVED_AT);

    expect(await sync({ ...snapshot, status: "unpaid" }, OBSERVED_AT + 7 * DAY)).toBe("updated");

    expect(await membershipOf(userId)).toMatchObject({
      state: "ended",
      // The failure stamp stays when a failing membership ends.
      pastDueSince: new Date(OBSERVED_AT),
    });
  });

  it("stamps the first failed payment, and does not restart the clock on a later failure", async () => {
    const userId = await createUser(db());
    const snapshot = { ...subscription(userId), status: "past_due" as const };

    await sync(snapshot, OBSERVED_AT);
    await sync(snapshot, OBSERVED_AT + 3 * DAY);

    expect(await membershipOf(userId)).toMatchObject({
      state: "past_due",
      pastDueSince: new Date(OBSERVED_AT),
    });
  });

  it("returns a past-due member to active, and clears the failures, when a retry is paid", async () => {
    const userId = await createUser(db());
    const snapshot = subscription(userId);
    await sync({ ...snapshot, status: "past_due" });

    await sync(snapshot);

    expect(await membershipOf(userId)).toMatchObject({ state: "active", pastDueSince: null });
  });

  it("shows a member who cancelled as canceling, with the date it ends", async () => {
    const userId = await createUser(db());
    await sync({ ...subscription(userId), cancelAtPeriodEnd: true });
    const row = await membershipOf(userId);
    expect(row?.state).toBe("canceling");
    expect(row?.cancelAt).toEqual(new Date(PERIOD_END));
  });

  it("keeps the first join date when a lapsed member joins again on a new subscription", async () => {
    const userId = await createUser(db());
    const first = subscription(userId);
    await sync(first);
    await sync({ ...first, status: "canceled" });
    const before = await membershipOf(userId);

    const second = subscription(userId, { plan: "annual" });
    expect(await sync(second)).toBe("updated");

    const after = await membershipOf(userId);
    expect(after).toMatchObject({ stripeSubscriptionId: second.id, plan: "annual", state: "active" });
    expect(after?.createdAt).toEqual(before?.createdAt);
  });

  it("ignores a subscription whose first payment hasn't gone through", async () => {
    const userId = await createUser(db());
    expect(await sync(subscription(userId, { status: "incomplete" }))).toBe("ignored");
    expect(await membershipOf(userId)).toBeNull();
  });

  it("ignores an old subscription's late event after the member has rejoined", async () => {
    const userId = await createUser(db());
    const old = subscription(userId);
    await sync(old);
    await sync({ ...old, status: "canceled" });
    const current = subscription(userId);
    await sync(current);

    expect(await sync({ ...old, status: "canceled" })).toBe("ignored");

    expect(await membershipOf(userId)).toMatchObject({ stripeSubscriptionId: current.id, state: "active" });
  });

  it("reports a second running subscription and changes nothing", async () => {
    const userId = await createUser(db());
    const current = subscription(userId);
    await sync(current);

    const second = subscription(userId);
    expect(await sync(second)).toBe("second_subscription");

    expect(await membershipOf(userId)).toMatchObject({ stripeSubscriptionId: current.id, state: "active" });
  });

  it("answers not_premium, and writes nothing, for a subscription Ruken didn't start for the membership", async () => {
    const userId = await createUser(db());
    expect(await sync(subscription(userId, { premium: false }))).toBe("not_premium");
    expect(await membershipOf(userId)).toBeNull();
  });

  it("answers not_premium for a subscription with no member on it", async () => {
    expect(await sync(subscription(null))).toBe("not_premium");
  });

  it("answers not_this_stack, and writes nothing, for a person this database doesn't have", async () => {
    const snapshot = subscription("user_from_another_site");
    expect(await sync(snapshot)).toBe("not_this_stack");
    expect(await db().premiumMembership.count({ where: { stripeSubscriptionId: snapshot.id } })).toBe(0);
  });
});
