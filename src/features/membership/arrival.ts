import { createHmac, timingSafeEqual } from "node:crypto";

// The last arrival through a maker's page or game link, remembered in one cookie only the server can
// write (design 6, "Bringing a member"). It is a fact from the link, never typed: the value is sealed
// with a keyed hash, so a value changed by hand is ignored instead of believed.

/** Which maker's link a visitor last landed on, which link, and when (the server's time). */
export interface Arrival {
  /** The maker's account id. */
  readonly makerUserId: string;
  /** The link's path on Ruken: `/g/<game>` or `/<handle>`. */
  readonly path: string;
  readonly atMs: number;
}

export const ARRIVAL_COOKIE = "rk_arrival";

/** 400 days, the longest a browser keeps a cookie. An arrival has no time limit of its own. */
export const ARRIVAL_MAX_AGE_SECONDS = 34_560_000;

/** Keeps this use of the secret apart from every other use of it. */
const MAC_PREFIX = "ruken-arrival-v1:";

const MAKER_ID_MAX = 64;
const PATH_MAX = 200;

function macOf(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(MAC_PREFIX + payload)
    .digest("base64url");
}

/** `<payload>.<mac>`: the arrival as JSON in base64url, then its keyed hash. */
export function sealArrival(arrival: Arrival, secret: string): string {
  const payload = Buffer.from(JSON.stringify(arrival)).toString("base64url");
  return `${payload}.${macOf(payload, secret)}`;
}

/** The arrival in a sealed value, or null for anything that is not exactly what `sealArrival` made. It never throws. */
export function openArrival(value: string | undefined, secret: string): Arrival | null {
  if (value === undefined) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payload = "", mac = ""] = parts;

  const expected = Buffer.from(macOf(payload, secret));
  const given = Buffer.from(mac);
  // timingSafeEqual refuses buffers of different lengths, so a wrong length is a plain "no".
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  return arrivalFrom(parsed);
}

/** The arrival in parsed JSON, or null when any field is not what a real link would give. */
function arrivalFrom(json: unknown): Arrival | null {
  if (typeof json !== "object" || json === null) return null;
  const { makerUserId, path, atMs } = json as Record<string, unknown>;
  if (typeof makerUserId !== "string" || makerUserId.length < 1 || makerUserId.length > MAKER_ID_MAX) {
    return null;
  }
  if (typeof path !== "string" || !path.startsWith("/") || path.length > PATH_MAX) return null;
  if (typeof atMs !== "number" || !Number.isSafeInteger(atMs) || atMs <= 0) return null;
  return { makerUserId, path, atMs };
}
