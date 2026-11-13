// STUB (red push)
import type { Cookies } from "@sveltejs/kit";
import type { authServices } from "../accounts/accounts.ts";
import type { Arrival } from "./arrival.ts";
import type { StripeEvent } from "./events.ts";
import type { MembershipService } from "./service.ts";

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
  arrival: ArrivalCookie;
  /** Checks a webhook body against its signature; rejects when it is not from Stripe or is too old. */
  verify(payload: string, signature: string): Promise<StripeEvent>;
  /** Stores a verified event and handles it once. Throws when handling fails, so the route answers 500. */
  receive(event: StripeEvent): Promise<void>;
}

export function stripeKeyMode(secretKey: string): "live" | "test" | undefined {
  throw new Error(`not built yet ${typeof secretKey}`);
}

export function stripeModeProblem(secretKey: string, live: boolean): string | undefined {
  throw new Error(`not built yet ${typeof secretKey} ${typeof live}`);
}

export function createMembershipServices(source: Settings, auth: AuthParts): MembershipServices {
  throw new Error(`not built yet ${typeof source} ${typeof auth}`);
}

export function membershipServices(): MembershipServices {
  throw new Error("not built yet");
}
