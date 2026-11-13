// STUB (red push)
import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { RateLimiter, RateLimitRule } from "../../lib/server/rate-limit.ts";
import type { Arrival } from "./arrival.ts";
import type { InvoicePaidOutcome } from "./events.ts";
import type { PremiumPlan } from "./plans.ts";
import type { MembershipState } from "./reducer.ts";
import type { PremiumStripe } from "./stripe-port.ts";
import type { SyncOutcome } from "./sync.ts";

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

export interface MembershipService {
  startCheckout(input: {
    readonly userId: string;
    readonly plan: PremiumPlan;
    readonly returnTo: string;
    readonly arrival: Arrival | null;
  }): Promise<{ url: string }>;
  view(userId: string): Promise<MembershipView>;
  isMember(userId: string): Promise<boolean>;
  checkoutState(input: {
    readonly ref: string;
    readonly userId: string;
  }): Promise<{ state: "open" | "completed" | "expired"; returnTo: string } | null>;
  portalLink(userId: string): Promise<{ url: string }>;
  endNow(userId: string): Promise<"ended" | "none">;
  completeCheckout(input: {
    readonly stripeCheckoutSessionId: string;
    readonly subscriptionId: string;
    readonly atMs: number;
  }): Promise<"recorded" | "duplicate" | "unknown">;
  expireCheckout(stripeCheckoutSessionId: string): Promise<void>;
  syncSubscription(subscriptionId: string, observedAtMs: number): Promise<SyncOutcome>;
  recordInvoicePaid(invoiceId: string): Promise<InvoicePaidOutcome>;
}

export function createMembershipService(deps: MembershipServiceDeps): MembershipService {
  throw new Error(`not built yet ${typeof deps}`);
}
