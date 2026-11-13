import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { StripeEvent } from "./events.ts";

/**
 * The Stripe webhook inbox. Every verified delivery is written to `WebhookInbox` before anything acts
 * on it, once per Stripe event id, so:
 *
 * - a delivery Stripe repeats is one row, not two;
 * - a delivery whose handling fails is kept, with the error, and Stripe sends it again;
 * - every event Ruken acted on, and when, can be looked up later, and slice 5 can read the kept
 *   events (disputes and refunds are stored and not acted on yet).
 *
 * Out of order delivery is safe because the handlers read Stripe's current state rather than the
 * event.
 */

/** The longest error message kept on a row. */
const ERROR_TEXT_MAX = 1000;

/**
 * Stores a verified delivery and returns its inbox id. A repeat of an event already stored adds
 * nothing and answers the same id. Only verified deliveries come here: a bad signature is answered
 * 400 and stored nowhere, so nobody can fill the table, or take a real event's id, by posting junk.
 */
export async function storeStripeDelivery(
  db: Pick<PrismaClient, "webhookInbox">,
  event: StripeEvent,
  receivedAtMs: number,
): Promise<string> {
  await db.webhookInbox.createMany({
    data: [
      {
        deliveryId: event.id,
        // The event as plain JSON, the way Postgres keeps it.
        payload: JSON.parse(JSON.stringify(event)) as object,
        receivedAt: new Date(receivedAtMs),
      },
    ],
    skipDuplicates: true,
  });
  const row = await db.webhookInbox.findUniqueOrThrow({
    where: { deliveryId: event.id },
    select: { id: true },
  });
  return row.id;
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

/**
 * Handles one stored delivery. A row already processed is skipped. An event from the other Stripe
 * mode (a test event reaching a live site, or the reverse) is marked `livemode_mismatch` and never
 * handled. A failure is written on the row and thrown again, so the route answers 500 and Stripe
 * sends the event again.
 */
export async function processStripeDelivery(
  deps: ProcessDeliveryDeps,
  inboxId: string,
): Promise<DeliveryOutcome> {
  const row = await deps.db.webhookInbox.findUniqueOrThrow({ where: { id: inboxId } });
  if (row.processedAt !== null) return "already_processed";
  const event = row.payload as unknown as StripeEvent;

  if (event.livemode !== deps.live) {
    await deps.db.webhookInbox.update({ where: { id: inboxId }, data: { error: "livemode_mismatch" } });
    return "livemode_mismatch";
  }

  try {
    await deps.handle(event);
  } catch (error) {
    await deps.db.webhookInbox.update({ where: { id: inboxId }, data: { error: errorText(error) } });
    throw error;
  }
  await deps.db.webhookInbox.update({
    where: { id: inboxId },
    data: { processedAt: new Date(deps.clock.epochMs()), error: null },
  });
  return "processed";
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, ERROR_TEXT_MAX);
}
