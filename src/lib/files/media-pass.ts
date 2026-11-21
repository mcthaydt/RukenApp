import { createHmac, timingSafeEqual } from "node:crypto";

// The media pass: what lets a browser load one video from the game gate. Ruken's site signs it when it builds a
// video's address, and only for someone it already decided may have that address; the gate (a separate Worker with no
// database) checks it on every video request. It names one video and a time, never a person or a rating.
//
// It imports only `node:crypto`, so the gate can bundle it and the games feature can use it.

/** Time is cut into windows this long (UTC), so everyone handed one video in one window gets the same address. */
export const MEDIA_PASS_WINDOW_MS = 12 * 60 * 60 * 1000;

const VERSION = "v1";
/** Mixed into every mac, so a play pass's mac (its own prefix) is never taken for a media pass's, and back. */
const MAC_PREFIX = "ruken-media-pass-v1:";
const SHAPE = /^v1\.(\d{1,15})\.([A-Za-z0-9_-]{43})$/;

/** The end of the next window: a pass signed now lasts at least one window and at most two (12 to 24 hours). */
export function mediaPassExpiry(nowMs: number): number {
  return (Math.floor(nowMs / MEDIA_PASS_WINDOW_MS) + 2) * MEDIA_PASS_WINDOW_MS;
}

function macOf(key: string, expirySeconds: number, secret: string): Buffer {
  return createHmac("sha256", secret)
    .update(`${MAC_PREFIX}${key}\n${String(expirySeconds)}`)
    .digest();
}

/** `v1.<expiry in whole seconds>.<mac>`. The same video, time and secret always make the same pass. */
export function makeMediaPass(key: string, expiresAtMs: number, secret: string): string {
  if (secret === "") throw new Error("The play pass secret is not set.");
  const seconds = Math.floor(expiresAtMs / 1000);
  return `${VERSION}.${String(seconds)}.${macOf(key, seconds, secret).toString("base64url")}`;
}

/** The pass's expiry in milliseconds when it is good for this video right now, otherwise null. Never throws. */
export function checkMediaPass(
  value: string | null,
  key: string,
  secret: string,
  nowMs: number,
): number | null {
  if (value === null || secret === "") return null;
  const match = SHAPE.exec(value);
  if (match === null) return null;
  const seconds = Number(match[1]);
  // Compared as written, not as decoded: the last character of a base64url mac carries bits that decoding drops, so
  // two different strings can decode to the same bytes, and only one of them is the pass the site signed.
  const given = Buffer.from(match[2] ?? "");
  const expected = Buffer.from(macOf(key, seconds, secret).toString("base64url"));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const expiresAtMs = seconds * 1000;
  return expiresAtMs > nowMs ? expiresAtMs : null;
}
