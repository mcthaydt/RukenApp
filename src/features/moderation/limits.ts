import type { RateLimitRule } from "../../lib/server/rate-limit.ts";

// How many reports one person may send. The numbers sit here on their own, handed to the service as `limits`, because
// the owner wants spam numbers to move to the private Worker later ("the mechanism can stay public"); that move then
// changes only where these come from.

export interface ReportLimits {
  /** Every rule a send counts against; one refusal refuses the send. Each needs its own name for its counter. */
  rules: readonly { name: string; rule: RateLimitRule }[];
}

const HOUR_MS = 60 * 60_000;

export const REPORT_LIMITS: ReportLimits = {
  rules: [
    { name: "hour", rule: { max: 10, windowMs: HOUR_MS } },
    { name: "day", rule: { max: 30, windowMs: 24 * HOUR_MS } },
  ],
};
