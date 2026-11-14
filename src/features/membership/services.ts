import type { Cookies } from "@sveltejs/kit";
import type Stripe from "stripe";
import type { Clock } from "../../lib/clock.ts";
import { optionalEnv, requireEnv } from "../../lib/server/env.ts";
import { createRateLimiter } from "../../lib/server/rate-limit.ts";
import { authServices } from "../accounts/accounts.ts";
import {
  ARRIVAL_COOKIE,
  ARRIVAL_MAX_AGE_SECONDS,
  openArrival,
  sealArrival,
  type Arrival,
} from "./arrival.ts";
import { handleStripeEvent, type MembershipEventHandlers, type StripeEvent } from "./events.ts";
import { processStripeDelivery, storeStripeDelivery } from "./inbox.ts";
import { createMembershipService, type MembershipService } from "./service.ts";
import { createStripe } from "./stripe-client.ts";
import { bindPremiumStripe } from "./stripe-port.ts";
import { verifyStripeWebhook } from "./webhook.ts";

// Everything the membership needs, built once per server process from the settings. Routes call
// membershipServices(); tests build their own with createMembershipServices.

type Settings = Readonly<Record<string, string | undefined>>;

/** What the membership borrows from sign-in: the database, the clock and the cookie rules. */
type AuthParts = Pick<ReturnType<typeof authServices>, "prisma" | "clock" | "cookies">;

/** The one cookie the membership writes, and who may write it. */
export interface ArrivalCookie {
  /**
   * Remembers that a visitor just landed on this maker's link. Each new arrival replaces the last,
   * so the cookie always holds the last one. Slice 2's `/g/<game>` and slice 3's `/<handle>` call
   * this; nothing in slice 1 does.
   */
  remember(cookies: Pick<Cookies, "set">, link: { makerUserId: string; path: string }): void;
  /** The last arrival, or null when there is none or the cookie was not written by the server. */
  read(cookies: Pick<Cookies, "get">): Arrival | null;
}

export interface MembershipServices {
  service: MembershipService;
  /** The one Stripe client, for the features above the membership (the money feature reads payments through it). */
  stripe: Stripe;
  arrival: ArrivalCookie;
  /** Checks a webhook body against its signature; rejects when it is not from Stripe or is too old. */
  verify(payload: string, signature: string): Promise<StripeEvent>;
  /** Stores a verified event and handles it once. Throws when handling fails, so the route answers 500. */
  receive(event: StripeEvent): Promise<void>;
}

/** The Stripe mode a key belongs to, from its prefix, or undefined for anything else. */
export function stripeKeyMode(secretKey: string): "live" | "test" | undefined {
  if (/^[sr]k_live_/.test(secretKey)) return "live";
  if (/^[sr]k_test_/.test(secretKey)) return "test";
  return undefined;
}

/**
 * Why the Stripe key and STRIPE_LIVE cannot be used together, or undefined when they can. Without
 * this check, a live key left with STRIPE_LIVE=false would mark every real payment's events
 * "livemode_mismatch" and drop them, while Stripe was told they were delivered.
 */
export function stripeModeProblem(secretKey: string, live: boolean): string | undefined {
  const mode = stripeKeyMode(secretKey);
  if (mode === undefined) {
    return "STRIPE_SECRET_KEY is not a Stripe secret or restricted key (sk_live_, rk_live_, sk_test_, rk_test_)";
  }
  if ((mode === "live") === live) return undefined;
  return live
    ? "STRIPE_LIVE is true but STRIPE_SECRET_KEY is a test key"
    : "STRIPE_SECRET_KEY is a live key but STRIPE_LIVE is not true, so every real payment would be dropped";
}

function readLiveSetting(source: Settings): boolean {
  const raw = requireEnv("STRIPE_LIVE", source);
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`STRIPE_LIVE must be "true" or "false", not "${raw}".`);
}

/**
 * Reads the settings first, so a missing or wrong one stops the start with its name before
 * anything is called. `auth` is what sign-in already built: the database client, the clock and the
 * cookie rules.
 */
export function createMembershipServices(source: Settings, auth: AuthParts): MembershipServices {
  const secretKey = requireEnv("STRIPE_SECRET_KEY", source);
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET", source);
  const live = readLiveSetting(source);
  const apiBase = optionalEnv("STRIPE_API_BASE", source);
  const siteOrigin = requireEnv("BETTER_AUTH_URL", source);
  const arrivalSecret = requireEnv("BETTER_AUTH_SECRET", source);

  // A live site can never be pointed at a stand-in Stripe.
  if (apiBase !== undefined && live) {
    throw new Error("STRIPE_API_BASE is for tests only and cannot be used with STRIPE_LIVE=true.");
  }
  const problem = stripeModeProblem(secretKey, live);
  if (problem !== undefined) throw new Error(problem);

  const { prisma, clock, cookies } = auth;
  const stripe = createStripe(apiBase === undefined ? { secretKey } : { secretKey, apiBase });
  const service = createMembershipService({
    db: prisma,
    clock,
    siteOrigin,
    stripe: bindPremiumStripe(stripe),
    rateLimiter: createRateLimiter(prisma, clock),
  });

  const handlers: MembershipEventHandlers = {
    completeCheckout: (input) => service.completeCheckout(input),
    expireCheckout: (stripeCheckoutSessionId) => service.expireCheckout(stripeCheckoutSessionId),
    syncSubscription: (subscriptionId, observedAtMs) =>
      service.syncSubscription(subscriptionId, observedAtMs),
    recordInvoicePaid: (invoiceId) => service.recordInvoicePaid(invoiceId),
    // One line, with no personal detail, for a person to find in the site's logs.
    report: (problem) => {
      console.error(`membership: ${problem.message}`);
    },
  };

  return {
    service,
    stripe,
    arrival: arrivalCookie(arrivalSecret, clock, cookies.secure),
    verify: (payload, signature) =>
      verifyStripeWebhook({ payload, signature, secret: webhookSecret, nowMs: clock.epochMs() }),
    async receive(event) {
      const inboxId = await storeStripeDelivery(prisma, event, clock.epochMs());
      await processStripeDelivery(
        { db: prisma, clock, live, handle: (stored) => handleStripeEvent(handlers, stored) },
        inboxId,
      );
    },
  };
}

function arrivalCookie(secret: string, clock: Clock, secure: boolean): ArrivalCookie {
  return {
    remember(cookies, link) {
      const value = sealArrival({ ...link, atMs: clock.epochMs() }, secret);
      // httpOnly: page scripts cannot read or write it, only the server. SameSite=Lax: it is sent
      // when someone follows a link to Ruken, which is the whole point.
      cookies.set(ARRIVAL_COOKIE, value, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure,
        maxAge: ARRIVAL_MAX_AGE_SECONDS,
      });
    },
    read: (cookies) => openArrival(cookies.get(ARRIVAL_COOKIE), secret),
  };
}

let shared: MembershipServices | undefined;

/** The process-wide membership services, created on first use. */
export function membershipServices(): MembershipServices {
  shared ??= createMembershipServices(process.env, authServices());
  return shared;
}
