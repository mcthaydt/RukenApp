import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createMembershipService,
  MembershipError,
  type MembershipService,
} from "../../../src/features/membership/service.ts";
import type { Arrival } from "../../../src/features/membership/arrival.ts";
import type {
  PaidPremiumInvoice,
  PremiumSubscription,
} from "../../../src/features/membership/subscription.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createRateLimiter } from "../../../src/lib/server/rate-limit.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { FakePremiumStripe } from "../../support/fake-premium-stripe.ts";
import { TestClock } from "../../support/test-clock.ts";

// The membership service on Postgres: joining, the membership mirror, the webhook handlers and who
// brought a member. Stripe is a fake that remembers state; the real calls are tested in
// checkout.test.ts and subscription.test.ts.

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
const NOW = "2026-11-02T12:00:00Z";
const NOW_MS = Date.parse(NOW);
const PERIOD_END = NOW_MS + 30 * DAY;
/** When the maker's link was last landed on, in the tests that carry an arrival. */
const ARRIVED_AT_MS = NOW_MS - DAY;

// Stripe ids are unique in the database, so ids are numbered across the whole file.
let stripeIds = 0;
function nextId(prefix: string): string {
  stripeIds += 1;
  return `${prefix}_${String(stripeIds)}`;
}

function setup() {
  const clock = new TestClock(NOW);
  const stripe = new FakePremiumStripe(() => clock.epochMs());
  const service = createMembershipService({
    db: db(),
    clock,
    siteOrigin: "https://ruken.test",
    stripe,
    rateLimiter: createRateLimiter(db(), clock),
  });
  return { clock, stripe, service };
}

/** A membership subscription for `userId`, as Stripe holds it after the checkout. */
function stripeSubscription(
  stripe: FakePremiumStripe,
  userId: string,
  changes: Partial<PremiumSubscription> = {},
): PremiumSubscription {
  const subscription: PremiumSubscription = {
    id: nextId("sub"),
    status: "active",
    plan: "monthly",
    cancelAtPeriodEnd: false,
    cancelAtMs: null,
    currentPeriodEndMs: PERIOD_END,
    customerId: nextId("cus"),
    userId,
    premium: true,
    endedAtMs: null,
    ...changes,
  };
  stripe.subscriptions.set(subscription.id, subscription);
  return subscription;
}

/** A paid monthly invoice of `subscriptionId`, as Stripe reports it. */
function paidInvoice(input: {
  subscriptionId: string;
  userId: string;
  paidAtMs?: number;
}): PaidPremiumInvoice {
  return {
    stripeInvoiceId: nextId("in"),
    subscriptionId: input.subscriptionId,
    userId: input.userId,
    plan: "monthly",
    periodStartMs: NOW_MS,
    paidAtMs: input.paidAtMs ?? NOW_MS,
    gross: 1081n,
    tax: 82n,
    fee: 61n,
  };
}

/** A person with a membership mirrored from Stripe. */
async function member(
  service: MembershipService,
  stripe: FakePremiumStripe,
  changes: Partial<PremiumSubscription> = {},
) {
  const userId = await createUser(db());
  const subscription = stripeSubscription(stripe, userId, changes);
  await db().billingCustomer.create({ data: { userId, stripeCustomerId: subscription.customerId } });
  await service.syncSubscription(subscription.id, NOW_MS);
  return { userId, subscriptionId: subscription.id, customerId: subscription.customerId };
}

/** Starts a monthly checkout for `userId`; `arrival` is the maker's link they last landed on, if any. */
function start(service: MembershipService, userId: string, arrival: Arrival | null = null) {
  return service.startCheckout({ userId, plan: "monthly", returnTo: "/", arrival });
}

/**
 * Pays the person's latest checkout in the fake Stripe and tells the service, as the webhook would.
 * Calling it again for the same person repeats the same webhook.
 */
async function completeTheOpenCheckout(
  service: MembershipService,
  stripe: FakePremiumStripe,
  userId: string,
) {
  const intent = await db().checkoutIntent.findFirstOrThrow({
    where: { userId, state: { in: ["open", "completed"] } },
    orderBy: { createdAt: "desc" },
  });
  stripe.sessions.set(intent.stripeCheckoutSessionId, "complete");
  const subscription =
    [...stripe.subscriptions.values()].find((candidate) => candidate.userId === userId) ??
    stripeSubscription(stripe, userId, { plan: intent.plan });
  await service.completeCheckout({
    stripeCheckoutSessionId: intent.stripeCheckoutSessionId,
    subscriptionId: subscription.id,
    atMs: NOW_MS,
  });
  return subscription;
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(MembershipError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe("startCheckout", { timeout: 30_000 }, () => {
  it("starts a subscription checkout at the plan's price, makes the customer, then records the intent", async () => {
    const { stripe, service } = setup();
    const userId = await createUser(db());

    const started = await service.startCheckout({
      userId,
      plan: "annual",
      returnTo: "/games/floorfifty",
      arrival: null,
    });

    const intent = await db().checkoutIntent.findFirstOrThrow({ where: { userId } });
    const user = await db().user.findUniqueOrThrow({ where: { id: userId } });
    const customer = await db().billingCustomer.findUniqueOrThrow({ where: { userId } });
    expect(stripe.customersMade).toEqual([{ userId, email: user.email }]);
    expect(stripe.checkouts).toEqual([
      {
        priceId: "price_annual",
        customerId: customer.stripeCustomerId,
        userId,
        successUrl: `https://ruken.test/join/done?checkout=${intent.id}`,
        cancelUrl: "https://ruken.test/join?plan=annual&next=%2Fgames%2Ffloorfifty",
        expiresAtSec: NOW_MS / 1000 + 31 * 60,
        metadata: { checkoutRef: intent.id, kind: "premium", plan: "annual" },
      },
    ]);
    expect(started.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(intent).toMatchObject({ plan: "annual", state: "open", returnTo: "/games/floorfifty" });
  });

  it("refuses a return address that is not a path on Ruken, and starts nothing", async () => {
    const { stripe, service } = setup();
    const userId = await createUser(db());
    for (const returnTo of ["https://evil.example", "//evil.example", "evil"]) {
      await expectCode(
        service.startCheckout({ userId, plan: "monthly", returnTo, arrival: null }),
        "INVALID_REQUEST",
      );
    }
    expect(stripe.checkouts).toEqual([]);
    expect(await db().checkoutIntent.count({ where: { userId } })).toBe(0);
  });

  it("makes the Stripe customer once, and closes the person's older open checkout", async () => {
    const { stripe, service } = setup();
    const userId = await createUser(db());
    await start(service, userId);
    await service.startCheckout({ userId, plan: "annual", returnTo: "/", arrival: null });

    expect(stripe.customersMade).toHaveLength(1);
    expect(stripe.checkouts[1]?.customerId).toBe(stripe.checkouts[0]?.customerId);
    const intents = await db().checkoutIntent.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    expect(intents.map((intent) => intent.state)).toEqual(["expired", "open"]);
    expect(stripe.sessions.get(intents[0]?.stripeCheckoutSessionId ?? "")).toBe("expired");
  });

  it("two starts at the same moment leave one open checkout", async () => {
    // Review Focus 2: a double click, or two tabs, must not leave two checkouts that could both be paid.
    const { stripe, service } = setup();
    const userId = await createUser(db());
    stripe.checkoutDelayMs = 300;
    // Both starts begin a transaction at once, and Prisma waits only two seconds for each to begin.
    // Open both connections first, so this tests the lock and not how fast a runner connects.
    await Promise.all([
      db().$queryRaw`SELECT 1 FROM pg_sleep(0.2)`,
      db().$queryRaw`SELECT 1 FROM pg_sleep(0.2)`,
    ]);

    await Promise.all([start(service, userId), start(service, userId)]);

    expect(await db().checkoutIntent.count({ where: { userId, state: "open" } })).toBe(1);
    expect([...stripe.sessions].filter(([, state]) => state === "open")).toHaveLength(1);
    expect(stripe.customersMade).toHaveLength(1);
  });

  it("refuses with ALREADY_MEMBER when the older checkout was paid, and starts nothing", async () => {
    const { stripe, service } = setup();
    const userId = await createUser(db());
    await start(service, userId);
    const intent = await db().checkoutIntent.findFirstOrThrow({ where: { userId } });
    stripe.sessions.set(intent.stripeCheckoutSessionId, "complete");

    await expectCode(start(service, userId), "ALREADY_MEMBER");
    expect(stripe.checkouts).toHaveLength(1);
  });

  it.each([
    ["active", {}],
    ["past_due", { status: "past_due" as const }],
    ["canceling", { cancelAtPeriodEnd: true }],
  ])("refuses with ALREADY_MEMBER while the membership is %s", async (_state, changes) => {
    const { stripe, service } = setup();
    const { userId } = await member(service, stripe, changes);
    await expectCode(start(service, userId), "ALREADY_MEMBER");
  });

  it("lets a person whose membership ended join again", async () => {
    const { stripe, service } = setup();
    const { userId } = await member(service, stripe, { status: "canceled" });
    await expect(start(service, userId)).resolves.toHaveProperty("url");
  });

  it("is RATE_LIMITED, with when to try again, once a person starts too many checkouts", async () => {
    const { stripe, service } = setup();
    const userId = await createUser(db());
    for (let i = 0; i < 10; i += 1) await start(service, userId);

    const refused = start(service, userId);
    await expectCode(refused, "RATE_LIMITED");
    await expect(refused).rejects.toMatchObject({ retryAfterSeconds: 60 });
    expect(stripe.checkouts).toHaveLength(10);
  });
});

describe("view and isMember", { timeout: 30_000 }, () => {
  it("answers none, and not a member, for a person who never joined", async () => {
    const { service } = setup();
    const userId = await createUser(db());
    expect(await service.view(userId)).toEqual({
      state: "none",
      member: false,
      plan: null,
      renewsAt: null,
      endsAt: null,
      pausesAt: null,
    });
    expect(await service.isMember(userId)).toBe(false);
  });

  it("shows an active member's plan and renewal", async () => {
    const { stripe, service } = setup();
    const { userId } = await member(service, stripe);
    expect(await service.view(userId)).toEqual({
      state: "active",
      member: true,
      plan: "monthly",
      renewsAt: new Date(PERIOD_END),
      endsAt: null,
      pausesAt: null,
    });
    expect(await service.isMember(userId)).toBe(true);
  });

  it("shows when a cancelling membership ends, and no renewal; still a member until then", async () => {
    const { stripe, service } = setup();
    const { userId } = await member(service, stripe, { cancelAtPeriodEnd: true });
    expect(await service.view(userId)).toMatchObject({
      state: "canceling",
      member: true,
      renewsAt: null,
      endsAt: new Date(PERIOD_END),
    });
  });

  it("shows when a failing payment pauses the membership: seven days from the first failure", async () => {
    const { stripe, service } = setup();
    const { userId } = await member(service, stripe, { status: "past_due" });
    expect(await service.view(userId)).toMatchObject({
      state: "past_due",
      member: true,
      renewsAt: null,
      pausesAt: new Date(NOW_MS + 7 * DAY),
    });
  });

  it("shows an ended membership with no dates, and not a member", async () => {
    const { stripe, service } = setup();
    const { userId } = await member(service, stripe, { status: "canceled" });
    expect(await service.view(userId)).toMatchObject({
      state: "ended",
      member: false,
      renewsAt: null,
      endsAt: null,
      pausesAt: null,
    });
  });
});

describe("checkoutState", { timeout: 30_000 }, () => {
  it("a checkout ref belongs to the person who started it", async () => {
    const { service } = setup();
    const userId = await createUser(db());
    const someoneElse = await createUser(db());
    await start(service, userId);
    const intent = await db().checkoutIntent.findFirstOrThrow({ where: { userId } });

    expect(await service.checkoutState({ ref: intent.id, userId })).toEqual({ state: "open", returnTo: "/" });
    expect(await service.checkoutState({ ref: intent.id, userId: someoneElse })).toBeNull();
    expect(await service.checkoutState({ ref: "no-such-ref", userId })).toBeNull();
  });

  it("says completed once the checkout is paid, and expired once Stripe closes it", async () => {
    const { stripe, service } = setup();
    const paid = await createUser(db());
    await start(service, paid);
    const paidIntent = await db().checkoutIntent.findFirstOrThrow({ where: { userId: paid } });
    await completeTheOpenCheckout(service, stripe, paid);
    expect((await service.checkoutState({ ref: paidIntent.id, userId: paid }))?.state).toBe("completed");

    const left = await createUser(db());
    await start(service, left);
    const leftIntent = await db().checkoutIntent.findFirstOrThrow({ where: { userId: left } });
    await service.expireCheckout(leftIntent.stripeCheckoutSessionId);
    expect((await service.checkoutState({ ref: leftIntent.id, userId: left }))?.state).toBe("expired");
  });
});

describe("portalLink", { timeout: 30_000 }, () => {
  it("opens Stripe's portal for the person's customer, coming back to /me", async () => {
    const { stripe, service } = setup();
    const { userId, customerId } = await member(service, stripe);
    await expect(service.portalLink(userId)).resolves.toEqual({
      url: "https://billing.stripe.com/p/session/test_1",
    });
    expect(stripe.portalLinks).toEqual([{ customerId, returnUrl: "https://ruken.test/me" }]);
  });

  it("answers NOT_FOUND for a person with no customer", async () => {
    const { service } = setup();
    await expectCode(service.portalLink(await createUser(db())), "NOT_FOUND");
  });
});

describe("completeCheckout and expireCheckout", { timeout: 30_000 }, () => {
  it("mirrors the subscription, then marks the checkout completed", async () => {
    const { stripe, service } = setup();
    const userId = await createUser(db());
    await start(service, userId);
    const subscription = await completeTheOpenCheckout(service, stripe, userId);

    expect(await db().premiumMembership.findUniqueOrThrow({ where: { userId } })).toMatchObject({
      stripeSubscriptionId: subscription.id,
      state: "active",
    });
    expect(await db().checkoutIntent.findFirstOrThrow({ where: { userId } })).toMatchObject({
      state: "completed",
      completedAt: new Date(NOW_MS),
    });
  });

  it("answers duplicate for a repeat, and unknown for a session Ruken did not start", async () => {
    const { stripe, service } = setup();
    const userId = await createUser(db());
    await start(service, userId);
    const intent = await db().checkoutIntent.findFirstOrThrow({ where: { userId } });
    const subscription = await completeTheOpenCheckout(service, stripe, userId);
    const again = {
      stripeCheckoutSessionId: intent.stripeCheckoutSessionId,
      subscriptionId: subscription.id,
      atMs: NOW_MS,
    };

    expect(await service.completeCheckout(again)).toBe("duplicate");
    expect(await service.completeCheckout({ ...again, stripeCheckoutSessionId: "cs_nobody" })).toBe(
      "unknown",
    );
  });

  it("expires an open checkout, once, and leaves a completed one alone", async () => {
    const { stripe, service } = setup();
    const left = await createUser(db());
    await start(service, left);
    const leftIntent = await db().checkoutIntent.findFirstOrThrow({ where: { userId: left } });
    await service.expireCheckout(leftIntent.stripeCheckoutSessionId);
    await service.expireCheckout(leftIntent.stripeCheckoutSessionId);
    expect((await db().checkoutIntent.findUniqueOrThrow({ where: { id: leftIntent.id } })).state).toBe(
      "expired",
    );

    const paid = await createUser(db());
    await start(service, paid);
    const paidIntent = await db().checkoutIntent.findFirstOrThrow({ where: { userId: paid } });
    await completeTheOpenCheckout(service, stripe, paid);
    await service.expireCheckout(paidIntent.stripeCheckoutSessionId);
    expect((await db().checkoutIntent.findUniqueOrThrow({ where: { id: paidIntent.id } })).state).toBe(
      "completed",
    );
  });
});

describe("recordInvoicePaid", { timeout: 30_000 }, () => {
  it("stores what Stripe said was paid, in cents", async () => {
    const { stripe, service } = setup();
    const { userId, subscriptionId } = await member(service, stripe);
    const invoice = paidInvoice({ subscriptionId, userId });
    stripe.invoices.set(invoice.stripeInvoiceId, invoice);

    expect(await service.recordInvoicePaid(invoice.stripeInvoiceId)).toEqual({ outcome: "recorded" });
    expect(
      await db().membershipPayment.findUniqueOrThrow({ where: { stripeInvoiceId: invoice.stripeInvoiceId } }),
    ).toMatchObject({ grossCents: 1081n, taxCents: 82n, cardFeeCents: 61n, plan: "monthly", userId });
  });

  it("answers duplicate for a repeat, and keeps one row", async () => {
    const { stripe, service } = setup();
    const { userId, subscriptionId } = await member(service, stripe);
    const invoice = paidInvoice({ subscriptionId, userId });
    stripe.invoices.set(invoice.stripeInvoiceId, invoice);

    await service.recordInvoicePaid(invoice.stripeInvoiceId);
    expect(await service.recordInvoicePaid(invoice.stripeInvoiceId)).toEqual({ outcome: "duplicate" });
    expect(await db().membershipPayment.count({ where: { userId } })).toBe(1);
  });

  it("answers a repeat as a duplicate even after the subscription has ended", async () => {
    const { stripe, service } = setup();
    const { userId, subscriptionId } = await member(service, stripe);
    const invoice = paidInvoice({ subscriptionId, userId });
    stripe.invoices.set(invoice.stripeInvoiceId, invoice);

    await service.recordInvoicePaid(invoice.stripeInvoiceId);
    await service.endNow(userId);
    expect(await service.recordInvoicePaid(invoice.stripeInvoiceId)).toEqual({ outcome: "duplicate" });
  });

  it("keeps nothing, and says paid_after_end, for an invoice paid after the subscription ended", async () => {
    const { stripe, service } = setup();
    const { userId, subscriptionId } = await member(service, stripe, {
      status: "canceled",
      endedAtMs: NOW_MS,
    });
    const invoice = paidInvoice({ subscriptionId, userId, paidAtMs: NOW_MS + DAY });
    stripe.invoices.set(invoice.stripeInvoiceId, invoice);

    expect(await service.recordInvoicePaid(invoice.stripeInvoiceId)).toEqual({ outcome: "paid_after_end" });
    expect(await db().membershipPayment.count({ where: { userId } })).toBe(0);
  });

  it("answers not_premium for an invoice that is not a membership's", async () => {
    const { service } = setup();
    expect(await service.recordInvoicePaid("in_unknown")).toEqual({ outcome: "not_premium" });
  });

  it("answers not_this_stack, and writes nothing, for a person this database does not have", async () => {
    const { stripe, service } = setup();
    const invoice = paidInvoice({ subscriptionId: "sub_elsewhere", userId: "user_from_another_site" });
    stripe.invoices.set(invoice.stripeInvoiceId, invoice);

    expect(await service.recordInvoicePaid(invoice.stripeInvoiceId)).toEqual({ outcome: "not_this_stack" });
    expect(await db().membershipPayment.count({ where: { stripeInvoiceId: invoice.stripeInvoiceId } })).toBe(
      0,
    );
  });

  it("invoice.paid arriving before the checkout completes still makes one membership and one payment", async () => {
    // Review Focus 1: Stripe sends events in any order, and more than once.
    const { stripe, service } = setup();
    const userId = await createUser(db());
    await start(service, userId);
    const intent = await db().checkoutIntent.findFirstOrThrow({ where: { userId } });
    const subscription = stripeSubscription(stripe, userId);
    const invoice = paidInvoice({ subscriptionId: subscription.id, userId });
    stripe.invoices.set(invoice.stripeInvoiceId, invoice);

    await service.recordInvoicePaid(invoice.stripeInvoiceId);
    await service.completeCheckout({
      stripeCheckoutSessionId: intent.stripeCheckoutSessionId,
      subscriptionId: subscription.id,
      atMs: NOW_MS,
    });
    await service.recordInvoicePaid(invoice.stripeInvoiceId);

    expect(await db().premiumMembership.count({ where: { userId } })).toBe(1);
    expect(await db().membershipPayment.count({ where: { stripeInvoiceId: invoice.stripeInvoiceId } })).toBe(
      1,
    );
  });
});

describe("endNow", { timeout: 30_000 }, () => {
  it("stops the subscription in Stripe and ends the membership, keeping the payments", async () => {
    // Review Focus 6: a person who deletes their account is never charged while it waits.
    const { stripe, service } = setup();
    const { userId, subscriptionId } = await member(service, stripe);
    const invoice = paidInvoice({ subscriptionId, userId });
    stripe.invoices.set(invoice.stripeInvoiceId, invoice);
    await service.recordInvoicePaid(invoice.stripeInvoiceId);

    expect(await service.endNow(userId)).toBe("ended");

    expect(stripe.subscriptions.get(subscriptionId)?.status).toBe("canceled");
    expect(stripe.writes).toEqual(["cancelNow", "voidPayableInvoices"]);
    expect((await service.view(userId)).member).toBe(false);
    expect(await db().membershipPayment.count({ where: { userId } })).toBe(1);
  });

  it("answers none for a person with no membership, or one that has ended", async () => {
    const { stripe, service } = setup();
    expect(await service.endNow(await createUser(db()))).toBe("none");
    const { userId } = await member(service, stripe, { status: "canceled" });
    expect(await service.endNow(userId)).toBe("none");
    expect(stripe.writes).toEqual([]);
  });
});

describe("who brought a member", { timeout: 30_000 }, () => {
  // The cookie and the link say which maker. The service only records it, as it happened.
  it("records the maker whose link the member last arrived through", async () => {
    const { stripe, service } = setup();
    const userId = await createUser(db());
    const maker = await createUser(db());
    await start(service, userId, { makerUserId: maker, path: "/g/a-game", atMs: ARRIVED_AT_MS });
    const subscription = await completeTheOpenCheckout(service, stripe, userId);

    expect(await db().membershipStart.findMany({ where: { userId } })).toMatchObject([
      {
        broughtByUserId: maker,
        arrivalPath: "/g/a-game",
        arrivedAt: new Date(ARRIVED_AT_MS),
        plan: "monthly",
        stripeSubscriptionId: subscription.id,
        startedAt: new Date(NOW_MS),
      },
    ]);
  });

  it("sends nothing about the arrival to Stripe", async () => {
    const { stripe, service } = setup();
    const userId = await createUser(db());
    const maker = await createUser(db());
    await start(service, userId, { makerUserId: maker, path: "/g/a-game", atMs: ARRIVED_AT_MS });
    const sent = JSON.stringify(stripe.checkouts);
    expect(sent).not.toContain(maker);
    expect(sent).not.toContain("/g/a-game");
  });

  it("records a member nobody brought, with no maker", async () => {
    const { stripe, service } = setup();
    const userId = await createUser(db());
    await service.startCheckout({ userId, plan: "annual", returnTo: "/", arrival: null });
    await completeTheOpenCheckout(service, stripe, userId);

    expect(await db().membershipStart.findMany({ where: { userId } })).toMatchObject([
      { broughtByUserId: null, arrivalPath: null, arrivedAt: null, plan: "annual" },
    ]);
  });

  it("records no maker when the arrival names an account that does not exist", async () => {
    // Review Focus 9: the person still pays and becomes a member.
    const { stripe, service } = setup();
    const userId = await createUser(db());
    await start(service, userId, { makerUserId: "nobody", path: "/g/a-game", atMs: ARRIVED_AT_MS });
    await completeTheOpenCheckout(service, stripe, userId);

    const row = await db().membershipStart.findFirstOrThrow({ where: { userId } });
    expect(row).toMatchObject({ broughtByUserId: null, arrivalPath: null, arrivedAt: null });
    expect((await service.view(userId)).member).toBe(true);
  });

  it("records the last arrival when a person starts paying twice", async () => {
    // Review Focus 10: arrive through one maker, start paying, come back, arrive through another, pay.
    const { stripe, service } = setup();
    const userId = await createUser(db());
    const maker = await createUser(db());
    const otherMaker = await createUser(db());
    await start(service, userId, { makerUserId: maker, path: "/g/a-game", atMs: ARRIVED_AT_MS });
    await start(service, userId, { makerUserId: otherMaker, path: "/other", atMs: ARRIVED_AT_MS + 1 });
    await completeTheOpenCheckout(service, stripe, userId);

    expect(await db().membershipStart.findMany({ where: { userId } })).toMatchObject([
      { broughtByUserId: otherMaker, arrivalPath: "/other" },
    ]);
  });

  it("records a maker's own membership as it happened, for later rules to judge", async () => {
    const { stripe, service } = setup();
    const userId = await createUser(db());
    await start(service, userId, { makerUserId: userId, path: "/me-as-maker", atMs: ARRIVED_AT_MS });
    await completeTheOpenCheckout(service, stripe, userId);
    expect(await db().membershipStart.findFirstOrThrow({ where: { userId } })).toMatchObject({
      broughtByUserId: userId,
    });
  });

  it("a checkout completed twice leaves one membership start", async () => {
    const { stripe, service } = setup();
    const userId = await createUser(db());
    await start(service, userId);
    await completeTheOpenCheckout(service, stripe, userId);
    await completeTheOpenCheckout(service, stripe, userId);
    expect(await db().membershipStart.count({ where: { userId } })).toBe(1);
  });
});
