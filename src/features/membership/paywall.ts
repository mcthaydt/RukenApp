import type { MembershipView } from "./service.ts";

/**
 * Which card `/join` shows.
 *
 * Not built yet: for now a member is told so and everyone else is shown the price.
 */
export type PaywallCard =
  | { readonly kind: "join" }
  | { readonly kind: "member" }
  | { readonly kind: "paused"; readonly line: string };

export function paywallCard(view: MembershipView | null): PaywallCard {
  return view?.member === true ? { kind: "member" } : { kind: "join" };
}
