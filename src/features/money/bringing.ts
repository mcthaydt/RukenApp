import { addMonths, periodOf, type Period } from "./period.ts";
import { BRINGING_MONTHS } from "./rules.ts";

/** One `MembershipStart` row: a member completing a checkout, and the maker whose link they came through, if any. */
export interface Join {
  readonly userId: string;
  readonly startedAtMs: number;
  readonly broughtByUserId: string | null;
}

/**
 * The maker who gets the bringing bonus for a member in `period`, or null. `joins` are one member's joins, in any
 * order.
 *
 * Only the member's first join counts (the least `startedAtMs`; a tie goes to the one given first), however later
 * joins arrived. The bonus covers the Chicago month of that join and the eleven after it. There is none when the first
 * join had no maker, or when the maker is the member themselves.
 */
export function bringerOf(joins: readonly Join[], period: Period): string | null {
  const [head, ...rest] = joins;
  if (head === undefined) return null;
  const first = rest.reduce(
    (earliest, join) => (join.startedAtMs < earliest.startedAtMs ? join : earliest),
    head,
  );
  if (first.broughtByUserId === null || first.broughtByUserId === first.userId) return null;

  // Periods are `YYYY-MM`, which sort in time order as plain strings.
  const firstMonth = periodOf(first.startedAtMs);
  if (period < firstMonth || period >= addMonths(firstMonth, BRINGING_MONTHS)) return null;
  return first.broughtByUserId;
}
