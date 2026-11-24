import { systemClock } from "../../lib/clock.ts";
import { prisma } from "../../lib/server/db.ts";
import { createRateLimiter } from "../../lib/server/rate-limit.ts";
import { REPORT_LIMITS } from "./limits.ts";
import { createReports, type Reports } from "./reports.ts";

// Everything the moderation feature needs, built once per server process.

export interface ModerationServices {
  reports: Reports;
}

let shared: ModerationServices | undefined;

export function moderationServices(): ModerationServices {
  shared ??= {
    reports: createReports({
      db: prisma(),
      clock: systemClock,
      limiter: createRateLimiter(prisma(), systemClock),
      limits: REPORT_LIMITS,
    }),
  };
  return shared;
}
