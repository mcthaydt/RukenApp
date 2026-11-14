import type { MembershipView } from "./service.ts";

/** Cents as dollars in words people say: `999n` is "$9.99", `9900n` is "$99", `123456n` is "$1,234.56". */
export function dollars(cents: bigint): string {
  if (cents < 0n) throw new RangeError("dollars() writes an amount of money, which is never below zero");
  const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const rest = cents % 100n;
  return rest === 0n ? `$${whole}` : `$${whole}.${rest.toString().padStart(2, "0")}`;
}

/** A Chicago day in words ("Friday, November 27"); the one formatter lives in `src/lib/long-date.ts`, and `/me` reads it from here. */
export { longDate } from "../../lib/long-date.ts";

/** Which button goes under the membership line on `/me`. */
export type MembershipButton = "join" | "manageOrCancel" | "manage" | "updateCard";

export function membershipLine(view: MembershipView): { line: string; button: MembershipButton } {
  throw new Error(`not built yet: ${view.state}`);
}
