// STUB (red push)
import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { StripeEvent } from "./events.ts";

export function storeStripeDelivery(
  db: Pick<PrismaClient, "webhookInbox">,
  event: StripeEvent,
  receivedAtMs: number,
): Promise<string> {
  throw new Error(`not built yet ${typeof db} ${typeof event} ${typeof receivedAtMs}`);
}

export interface ProcessDeliveryDeps {
  readonly db: Pick<PrismaClient, "webhookInbox">;
  readonly clock: Clock;
  /** STRIPE_LIVE: whether this site takes live payments. Events from the other mode are refused. */
  readonly live: boolean;
  /** `handleStripeEvent` with this site's services (events.ts). */
  handle(event: StripeEvent): Promise<void>;
}

export type DeliveryOutcome = "processed" | "already_processed" | "livemode_mismatch";

export function processStripeDelivery(deps: ProcessDeliveryDeps, inboxId: string): Promise<DeliveryOutcome> {
  throw new Error(`not built yet ${typeof deps} ${typeof inboxId}`);
}
