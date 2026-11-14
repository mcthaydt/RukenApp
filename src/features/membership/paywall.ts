import type { MembershipView } from "./service.ts";

/**
 * Which card `/join` shows. Not built yet: for now it always shows the price.
 */
export type PaywallCard =
  | { readonly kind: "join" }
  | { readonly kind: "member" }
  | { readonly kind: "paused"; readonly line: string };

export function paywallCard(_view: MembershipView | null): PaywallCard {
  return { kind: "join" };
}
