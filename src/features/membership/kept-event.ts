import type { StripeEvent } from "./events.ts";

/**
 * What of a verified Stripe event Ruken keeps in `WebhookInbox`.
 *
 * Stripe's events carry the person: a checkout's `customer_details` has their email, name and billing address, an
 * invoice has `customer_email`, `customer_name` and `customer_address`, a charge has `billing_details`. Ruken's own
 * database must not hold those after the person's account is deleted, so none of them is ever written: the row keeps
 * only what the handlers and the money work read (Owner, 2026-11-14: "Store only what we use").
 *
 * It is a list of fields to keep, not of fields to drop, so a field Stripe adds later is dropped until someone decides
 * it is needed. A kept field must hold a plain value: where Stripe sends a whole object in place of an id (an expanded
 * customer), the object may hold the person, so the field is dropped.
 */

/** The fields of a Stripe object kept when they hold a plain value: ids, amounts and states. */
const KEPT_OBJECT_FIELDS = [
  "id",
  "object",
  "created",
  "livemode",
  "status",
  "payment_status",
  "reason",
  "currency",
  "amount",
  "amount_due",
  "amount_paid",
  "amount_remaining",
  "amount_refunded",
  "amount_subtotal",
  "amount_total",
  "amount_captured",
  "customer",
  "subscription",
  "invoice",
  "charge",
  "payment_intent",
] as const;

type PlainValue = string | number | boolean | null;

export function keptEvent(event: StripeEvent): StripeEvent {
  return {
    id: event.id,
    type: event.type,
    created: event.created,
    livemode: event.livemode,
    data: { object: keptObject(event.data.object) },
  };
}

function keptObject(object: unknown): Record<string, unknown> {
  if (!isRecord(object)) return {};
  const kept: Record<string, unknown> = {};
  for (const field of KEPT_OBJECT_FIELDS) {
    const value = object[field];
    if (isPlain(value)) kept[field] = value;
  }
  // Ruken's own metadata (`kind`, `plan`, `userId`, `checkoutRef`) is how the handlers recognise a membership checkout.
  const metadata = textEntries(object.metadata);
  if (metadata !== null) kept.metadata = metadata;
  // An invoice's subscription, which `invoice.payment_failed` reads from here; the rest of `parent` is dropped.
  const subscription = subscriptionOf(object.parent);
  if (subscription !== null) kept.parent = { subscription_details: { subscription } };
  return kept;
}

/** The text entries of a metadata object, or null when there is no such object. */
function textEntries(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const text: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") text[key] = item;
  }
  return text;
}

function subscriptionOf(parent: unknown): string | null {
  if (!isRecord(parent) || !isRecord(parent.subscription_details)) return null;
  const subscription = parent.subscription_details.subscription;
  return typeof subscription === "string" ? subscription : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlain(value: unknown): value is PlainValue {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}
