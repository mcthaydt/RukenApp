import { longDate } from "../../lib/long-date.ts";
import { PREMIUM_PRICES_CENTS, type PremiumPlan } from "./plans.ts";
import type { MembershipView } from "./service.ts";

// A Chicago day in words ("Friday, November 27"): the one formatter lives in `src/lib/long-date.ts`, and `/me` reads
// it from here.
export { longDate };

/** Cents as dollars in words people say: `999n` is "$9.99", `9900n` is "$99", `123456n` is "$1,234.56". */
export function dollars(cents: bigint): string {
  if (cents < 0n) throw new RangeError("dollars() writes an amount of money, which is never below zero");
  const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const rest = cents % 100n;
  return rest === 0n ? `$${whole}` : `$${whole}.${rest.toString().padStart(2, "0")}`;
}

/** Which button goes under the membership line on `/me`. */
export type MembershipButton = "join" | "manageOrCancel" | "manage" | "updateCard";

export function membershipLine(view: MembershipView): { line: string; button: MembershipButton } {
  switch (view.state) {
    case "none":
    case "ended":
      return { line: "You're not a member.", button: "join" };
    case "active": {
      const price = view.plan === null ? "" : ` ${planPrice(view.plan)}.`;
      const renews = view.renewsAt === null ? "" : ` Renews on ${longDate(view.renewsAt)}.`;
      return { line: `You're a member.${price}${renews}`, button: "manageOrCancel" };
    }
    case "canceling":
      return {
        line:
          view.endsAt === null
            ? "Your membership is ending. You can play until then."
            : `Your membership ends on ${longDate(view.endsAt)}. You can play until then.`,
        button: "manage",
      };
    case "past_due":
      // Still a member for seven days after the first failure; after that the membership is paused until the card works.
      return {
        line:
          view.member && view.pausesAt !== null
            ? `We couldn't charge your card. Update it by ${longDate(view.pausesAt)} to keep playing.`
            : "We couldn't charge your card, so your membership is paused. Update your card to play again.",
        button: "updateCard",
      };
  }
}

/** "$9.99 a month" or "$99 a year": the price comes from the rules (plans.ts), never from a string typed here. */
function planPrice(plan: PremiumPlan): string {
  return `${dollars(PREMIUM_PRICES_CENTS[plan])} a ${plan === "annual" ? "year" : "month"}`;
}
