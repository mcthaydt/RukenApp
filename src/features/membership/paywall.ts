import { membershipLine } from "./format.ts";
import type { MembershipView } from "./service.ts";

/**
 * Which card `/join` shows.
 *
 * - `member`: the person is a member right now; they are told so and sent on.
 * - `paused`: they have a membership whose card failed more than seven days ago. It is not running, but it has not
 *   ended either, so Stripe would refuse a second subscription. The price would only bounce them, so the card says
 *   what happened, in `/me`'s own words, and sends them to Stripe's page to fix the card.
 * - `join`: everyone else, signed out (`null`) or never a member, or whose membership ended: the price and the button.
 */
export type PaywallCard =
  | { readonly kind: "join" }
  | { readonly kind: "member" }
  | { readonly kind: "paused"; readonly line: string };

export function paywallCard(view: MembershipView | null): PaywallCard {
  if (view === null) return { kind: "join" };
  if (view.member) return { kind: "member" };
  if (view.state === "past_due") return { kind: "paused", line: membershipLine(view).line };
  return { kind: "join" };
}
