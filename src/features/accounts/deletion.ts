import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";

/** How long a person has to change their mind. */
export const DELETION_WAIT_DAYS = 14;

/** What deletion needs: a database and the time. */
export interface DeletionDeps {
  readonly prisma: PrismaClient;
  readonly clock: Clock;
}

export function requestDeletion(deps: DeletionDeps, userId: string): Promise<{ purgeAfter: Date } | "staff"> {
  throw new Error(`not built yet: ${typeof deps} ${typeof userId}`);
}

export function restoreOnSignIn(prisma: PrismaClient, clock: Clock, userId: string): Promise<boolean> {
  throw new Error(`not built yet: ${typeof prisma} ${typeof clock} ${typeof userId}`);
}
