import { dollars } from "../../features/membership/membership.ts";

/** How much the yearly plan saves on twelve months paid monthly, in words, or null when it saves nothing. */
export function yearlySaving(monthlyCents: bigint, annualCents: bigint): string | null {
  const saved = monthlyCents * 12n - annualCents;
  return saved > 0n ? dollars(saved) : null;
}
