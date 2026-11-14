import { randomUUID } from "node:crypto";
import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { RateLimiter, RateLimitRule } from "../../lib/server/rate-limit.ts";
import { pastDuePausesAt, premiumAccess } from "./access.ts";
import type { Arrival } from "./arrival.ts";
import { premiumCheckoutExpiry } from "./checkout.ts";
import type { InvoicePaidOutcome } from "./events.ts";
import { paidAfterEnd, recordPayment } from "./payments.ts";
import type { PremiumPlan } from "./plans.ts";
import type { MembershipState } from "./reducer.ts";
import type { PremiumStripe } from "./stripe-port.ts";
import { lockMembership, syncMembership, type SyncOutcome } from "./sync.ts";

/** A person starts a few checkouts at most, even changing their mind. Each one asks Stripe several things. */
export const CHECKOUT_STARTS_PER_USER: RateLimitRule = { max: 10, windowMs: 60_000 };

/** The rate-limit key for one person's checkout starts. Ours start with `api:`. */
export function checkoutStartKey(userId: string): string {
  return `api:checkout-start:${userId}`;
}

/** Why a call was refused. Routes turn the code into a status and the message into words on the screen. */
export type MembershipErrorCode = "INVALID_REQUEST" | "NOT_FOUND" | "ALREADY_MEMBER" | "RATE_LIMITED";

export class MembershipError extends Error {
  override readonly name = "MembershipError";
  readonly code: MembershipErrorCode;
  /** Set on RATE_LIMITED: how long until the person may try again. */
  readonly retryAfterSeconds: number | undefined;

  constructor(code: MembershipErrorCode, message: string, options: { retryAfterSeconds?: number } = {}) {
    super(message);
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export interface MembershipServiceDeps {
  readonly db: PrismaClient;
  readonly clock: Clock;
  /** Where Stripe sends the person back, for example https://ruken.example. */
  readonly siteOrigin: string;
  readonly stripe: PremiumStripe;
  readonly rateLimiter: RateLimiter;
}

/** What the screens show about a person's membership. */
export interface MembershipView {
  readonly state: "none" | MembershipState;
  /** Whether the person is a member right now: the one rule `premiumAccess`, read at this moment. */
  readonly member: boolean;
  readonly plan: PremiumPlan | null;
  /** The next charge: only while active. */
  readonly renewsAt: Date | null;
  /** When a cancelling membership stops. */
  readonly endsAt: Date | null;
  /** When a failing payment's grace runs out, while it is failing. */
  readonly pausesAt: Date | null;
}

/** The tables the service reads and writes. A transaction's client has the same ones. */
type Tables = Pick<
  PrismaClient,
  | "user"
  | "billingCustomer"
  | "checkoutIntent"
  | "premiumMembership"
  | "membershipStart"
  | "membershipPayment"
>;

/** Holding the person's lock spans a few Stripe calls (closing, making a customer, a checkout). */
const MEMBER_LOCK_TIMEOUT_MS = 30_000;

export function createMembershipService(deps: MembershipServiceDeps) {
  const { db, clock, stripe } = deps;
  const sync = (subscriptionId: string, observedAtMs: number) =>
    syncMembership(deps, subscriptionId, observedAtMs);

  /**
   * The person's Stripe customer, made the first time they check out. Stripe is called before the
   * row is written; if two requests race, both make a customer, one row wins and the other customer
   * is simply never used.
   */
  async function customerFor(tables: Tables, userId: string): Promise<string> {
    const existing = await tables.billingCustomer.findUnique({ where: { userId } });
    if (existing !== null) return existing.stripeCustomerId;
    const user = await tables.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    const customerId = await stripe.createCustomer({ userId, email: user.email });
    await tables.billingCustomer.createMany({
      data: [{ userId, stripeCustomerId: customerId }],
      skipDuplicates: true,
    });
    return (await tables.billingCustomer.findUniqueOrThrow({ where: { userId } })).stripeCustomerId;
  }

  /**
   * Runs `work` holding the person's lock (sync.ts), and does all its database work in the same
   * transaction, so the lock is released only after every write is committed. The next holder then
   * reads everything this one wrote. It allows for the Stripe calls made inside.
   */
  function withMemberLock<T>(userId: string, work: (tables: Tables) => Promise<T>): Promise<T> {
    return db.$transaction(
      async (tx) => {
        await lockMembership(tx, userId);
        return work(tx);
      },
      { timeout: MEMBER_LOCK_TIMEOUT_MS },
    );
  }

  /** The arrival, if it names an account that exists: otherwise nobody brought this person. */
  async function knownArrival(tables: Tables, arrival: Arrival | null) {
    if (arrival === null) return { broughtByUserId: null, arrivalPath: null, arrivedAt: null };
    const maker = await tables.user.findUnique({ where: { id: arrival.makerUserId }, select: { id: true } });
    if (maker === null) return { broughtByUserId: null, arrivalPath: null, arrivedAt: null };
    return {
      broughtByUserId: maker.id,
      arrivalPath: arrival.path,
      arrivedAt: new Date(arrival.atMs),
    };
  }

  /** The person's membership as the screens show it. */
  async function view(userId: string): Promise<MembershipView> {
    const row = await db.premiumMembership.findUnique({ where: { userId } });
    if (row === null) {
      return { state: "none", member: false, plan: null, renewsAt: null, endsAt: null, pausesAt: null };
    }
    return {
      state: row.state,
      member: premiumAccess(row, clock.epochMs()),
      plan: row.plan,
      renewsAt: row.state === "active" ? row.currentPeriodEnd : null,
      endsAt: row.state === "ended" ? null : row.cancelAt,
      pausesAt: row.state === "past_due" ? pastDuePausesAt(row) : null,
    };
  }

  return {
    /**
     * Starts joining. A person whose membership has not ended is already a member. Any checkout they
     * left open is closed first, so they cannot pay twice; if that earlier one turns out to have been
     * paid, this one is refused too. Stripe is called before the CheckoutIntent is written: if the
     * write fails, the unused Checkout expires on its own.
     *
     * `arrival` is the maker's link the person last landed on, read by the route from the cookie
     * only the server writes. It is copied onto this checkout's row and nothing about it goes to
     * Stripe, so paying never depends on the cookie still being there. Two starts: the last one wins.
     */
    async startCheckout(input: {
      readonly userId: string;
      readonly plan: PremiumPlan;
      /** A path on Ruken, where to go after paying. */
      readonly returnTo: string;
      readonly arrival: Arrival | null;
    }): Promise<{ url: string }> {
      if (!input.returnTo.startsWith("/") || input.returnTo.startsWith("//")) {
        throw new MembershipError("INVALID_REQUEST", "That link does not belong to Ruken.");
      }
      const limit = await deps.rateLimiter.hit(checkoutStartKey(input.userId), CHECKOUT_STARTS_PER_USER);
      if (!limit.allowed) {
        throw new MembershipError(
          "RATE_LIMITED",
          "You tried to pay a lot of times just now. Wait a minute.",
          {
            retryAfterSeconds: limit.retryAfterSeconds,
          },
        );
      }
      // Two starts at the same moment (a double click, two tabs) would each find no open checkout and
      // each make one, and both could be paid. Under the person's lock they take turns, so the second
      // finds the first's checkout and closes it.
      return withMemberLock(input.userId, async (tables) => {
        const current = await tables.premiumMembership.findUnique({ where: { userId: input.userId } });
        if (current !== null && current.state !== "ended") {
          throw new MembershipError("ALREADY_MEMBER", "You are already a member.");
        }

        const older = await tables.checkoutIntent.findMany({
          where: { userId: input.userId, state: "open" },
        });
        for (const intent of older) {
          if ((await stripe.closeCheckout(intent.stripeCheckoutSessionId)) === "complete") {
            // Paid, and its webhook has not arrived yet: the membership is on its way.
            throw new MembershipError(
              "ALREADY_MEMBER",
              "Your payment went through. Your membership is coming.",
            );
          }
          await tables.checkoutIntent.update({ where: { id: intent.id }, data: { state: "expired" } });
        }

        const customerId = await customerFor(tables, input.userId);
        const prices = await stripe.prices();
        const arrival = await knownArrival(tables, input.arrival);
        // The ref is made here so it can go into Stripe's return address; the return page finds the
        // checkout again with it.
        const ref = randomUUID();
        const started = await stripe.startCheckout({
          priceId: prices[input.plan],
          customerId,
          userId: input.userId,
          successUrl: `${deps.siteOrigin}/join/done?checkout=${ref}`,
          cancelUrl: `${deps.siteOrigin}/join?plan=${input.plan}&next=${encodeURIComponent(input.returnTo)}`,
          expiresAtSec: premiumCheckoutExpiry(clock.epochMs()),
          metadata: { checkoutRef: ref, kind: "premium", plan: input.plan },
        });
        await tables.checkoutIntent.create({
          data: {
            id: ref,
            userId: input.userId,
            plan: input.plan,
            stripeCheckoutSessionId: started.id,
            returnTo: input.returnTo,
            ...arrival,
          },
        });
        return { url: started.url };
      });
    },

    view,

    /**
     * Where a checkout stands, for the page the person lands on after paying. Null for a ref that is
     * not this person's, so one person cannot look at another's.
     */
    async checkoutState(input: {
      readonly ref: string;
      readonly userId: string;
    }): Promise<{ state: "open" | "completed" | "expired"; returnTo: string } | null> {
      const intent = await db.checkoutIntent.findFirst({ where: { id: input.ref, userId: input.userId } });
      if (intent === null) return null;
      return { state: intent.state === "cancelled" ? "expired" : intent.state, returnTo: intent.returnTo };
    },

    /** Stripe's billing portal, where the member changes their card or cancels, coming back to /me. */
    async portalLink(userId: string): Promise<{ url: string }> {
      const customer = await db.billingCustomer.findUnique({ where: { userId } });
      if (customer === null) throw new MembershipError("NOT_FOUND", "There is no membership to look after.");
      return { url: await stripe.portalLink(customer.stripeCustomerId, `${deps.siteOrigin}/me`) };
    },

    /**
     * Ends a running membership now, with no refund, so the person is never charged while their
     * account waits to be deleted. The payment rows stay. "none" when there is nothing to end.
     */
    async endNow(userId: string): Promise<"ended" | "none"> {
      const row = await db.premiumMembership.findUnique({ where: { userId } });
      if (row === null || row.state === "ended") return "none";
      await stripe.cancelNow(row.stripeSubscriptionId);
      await stripe.voidPayableInvoices(row.stripeSubscriptionId);
      await sync(row.stripeSubscriptionId, clock.epochMs());
      return "ended";
    },

    // ---- The webhook handlers. Each reads Stripe again; the event is only a signal. ----

    /**
     * `checkout.session.completed`: mirror the new subscription, then mark the checkout completed
     * and add its `MembershipStart` row, in that order, so the return page never says "done" before
     * the membership exists. The mark and the row are one transaction and happen only when the
     * checkout was not completed before, so a repeat adds nothing. "unknown" for a session Ruken did
     * not start.
     */
    async completeCheckout(input: {
      readonly stripeCheckoutSessionId: string;
      readonly subscriptionId: string;
      /** The event's time, in milliseconds. */
      readonly atMs: number;
    }): Promise<"recorded" | "duplicate" | "unknown"> {
      const intent = await db.checkoutIntent.findUnique({
        where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
      });
      if (intent === null) return "unknown";
      await sync(input.subscriptionId, input.atMs);
      return db.$transaction(async (tx) => {
        const completed = await tx.checkoutIntent.updateMany({
          where: { id: intent.id, state: { not: "completed" } },
          data: { state: "completed", completedAt: new Date(input.atMs) },
        });
        if (completed.count === 0) return "duplicate";
        await tx.membershipStart.create({
          data: {
            checkoutIntentId: intent.id,
            userId: intent.userId,
            stripeSubscriptionId: input.subscriptionId,
            plan: intent.plan,
            startedAt: new Date(input.atMs),
            broughtByUserId: intent.broughtByUserId,
            arrivalPath: intent.arrivalPath,
            arrivedAt: intent.arrivedAt,
          },
        });
        return "recorded";
      });
    },

    /** `checkout.session.expired`: an open checkout moves to expired. A repeat, or a session Ruken did not start, changes nothing. */
    async expireCheckout(stripeCheckoutSessionId: string): Promise<void> {
      await db.checkoutIntent.updateMany({
        where: { stripeCheckoutSessionId, state: "open" },
        data: { state: "expired" },
      });
    },

    /** `customer.subscription.*` and `invoice.payment_failed`: mirror the subscription (sync.ts). */
    syncSubscription(subscriptionId: string, observedAtMs: number): Promise<SyncOutcome> {
      return sync(subscriptionId, observedAtMs);
    },

    /**
     * `invoice.paid`: keep the payment, once, and mirror the subscription, since a paid retry ends a
     * run of failures. The order matters, and is the carried one:
     * 1. read the invoice from Stripe; not a membership invoice: `not_premium`;
     * 2. a person this database does not have: `not_this_stack` (a shared Stripe test mode);
     * 3. sync the subscription;
     * 4. a payment row for this invoice already exists: `duplicate`. Checked before the next step, so
     *    a repeat is never reported as paid after the end, which would send a person to refund it;
     * 5. paid after the subscription ended: `paid_after_end`, and nothing is kept;
     * 6. keep the row.
     * Everything that can fail runs before the row is written, so a payment row always has its sync
     * behind it, and one that fails part way leaves nothing and is tried again whole.
     */
    async recordInvoicePaid(invoiceId: string): Promise<InvoicePaidOutcome> {
      const paid = await stripe.paidInvoice(invoiceId);
      if (paid === null) return { outcome: "not_premium" };
      const user = await db.user.findUnique({ where: { id: paid.userId }, select: { id: true } });
      if (user === null) return { outcome: "not_this_stack" };
      await sync(paid.subscriptionId, paid.paidAtMs);
      if ((await db.membershipPayment.count({ where: { stripeInvoiceId: invoiceId } })) > 0) {
        return { outcome: "duplicate" };
      }
      if (paidAfterEnd(await stripe.subscription(paid.subscriptionId), paid.paidAtMs)) {
        return { outcome: "paid_after_end" };
      }
      return { outcome: (await recordPayment(db, paid)) === "recorded" ? "recorded" : "duplicate" };
    },
  };
}

export type MembershipService = ReturnType<typeof createMembershipService>;
