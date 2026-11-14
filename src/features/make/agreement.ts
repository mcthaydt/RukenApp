import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";

// What a maker has agreed to (stub: the code comes after its tests have been seen failing).

export const MAKER_AGREEMENT_VERSION = "";
export const MAKER_AGREEMENT_TEXT = "";

export function hasAgreed(_db: PrismaClient, userId: string): Promise<boolean> {
  return Promise.reject(new Error(`not built yet: hasAgreed ${userId}`));
}

export function agree(_db: PrismaClient, clock: Clock, userId: string): Promise<void> {
  return Promise.reject(new Error(`not built yet: agree ${userId} ${String(clock.epochMs())}`));
}
