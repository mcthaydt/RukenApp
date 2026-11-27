import type { RateLimitRule } from "../../lib/server/rate-limit.ts";

// How many games one person may send. The mechanism is public; the deploy's numbers are not (the owner, 2026-11-22:
// exact spam numbers go private, "the mechanism can stay public"). The deploy reads them from the private Worker; the
// stand-ins below are for dev, the journeys and anyone's own copy, and for any moment the private Worker gives none.

export interface SendLimits {
  /** Every rule a send counts against; one refusal refuses the send. Each needs its own name for its counter. */
  rules: readonly { name: string; rule: RateLimitRule }[];
}

const HOUR_MS = 60 * 60_000;

/** Stand-ins, deliberately loose: they only keep a runaway script in check where the real numbers are not bound. */
export const STAND_IN_SEND_LIMITS: SendLimits = {
  rules: [
    { name: "hour", rule: { max: 60, windowMs: HOUR_MS } },
    { name: "day", rule: { max: 300, windowMs: 24 * HOUR_MS } },
  ],
};

/** Whether an answer from the private Worker has the shape of `SendLimits`, so nothing else is ever counted against. */
export function isSendLimits(value: unknown): value is SendLimits {
  if (typeof value !== "object" || value === null) return false;
  const rules = (value as { rules?: unknown }).rules;
  return (
    Array.isArray(rules) &&
    rules.length > 0 &&
    rules.every((one: unknown) => {
      if (typeof one !== "object" || one === null) return false;
      const { name, rule } = one as { name?: unknown; rule?: unknown };
      if (typeof name !== "string" || name === "" || typeof rule !== "object" || rule === null) return false;
      const { max, windowMs } = rule as { max?: unknown; windowMs?: unknown };
      return (
        Number.isInteger(max) && (max as number) > 0 && Number.isInteger(windowMs) && (windowMs as number) > 0
      );
    })
  );
}

/**
 * The limits a send counts against: the private Worker's when it is bound and answers in shape, the stand-ins when it
 * is not bound, throws or answers anything else, as the open order stands in for the feed's private one.
 */
export async function sendLimitsFrom(ask: (() => Promise<unknown>) | null): Promise<SendLimits> {
  if (ask === null) return STAND_IN_SEND_LIMITS;
  try {
    const answer = await ask();
    return isSendLimits(answer) ? answer : STAND_IN_SEND_LIMITS;
  } catch {
    return STAND_IN_SEND_LIMITS;
  }
}
