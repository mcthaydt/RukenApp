import { createHmac, timingSafeEqual } from "node:crypto";

// The play pass: what lets a browser load a game's files. Ruken's app signs it when someone presses Play; the game
// gate (a separate Worker) checks it on every request. The pass names a game, one pull of it, the servers the game may
// talk to and a time, and a random id of its own. It never names a person: only Ruken's database ties the id to an
// account, so a game that reads its own address learns nothing about who is playing.
//
// It imports nothing from the app, so the gate can bundle it.

/**
 * A pass lasts a day. A member keeps one pass per game for that day, so the game's addresses stay the same and the
 * browser keeps the files it already downloaded (a game can be 90 MB).
 */
export const PASS_LIFE_MS = 24 * 60 * 60 * 1000;

/**
 * A pass is handed out again only while at least this much is left, so no Play starts on a pass about to run out with
 * a level or a sound still to load.
 */
export const PASS_MIN_LEFT_MS = 4 * 60 * 60 * 1000;

/** Everything a pass says. */
export interface PassClaims {
  /** The pass's own random id: 22 characters of base64url. It is how a leaked address is traced to one person. */
  id: string;
  /** The game's public id. */
  game: string;
  /** The pull whose files the pass opens. */
  pull: string;
  /** The servers the game may talk to, as the maker listed them. */
  connect: string[];
  expiresAtMs: number;
}

const VERSION = "v1";
/** Mixed into every mac, so a mac made for something else with the same secret is never taken for a pass's. */
const MAC_PREFIX = "ruken-play-pass-v1:";

const ID = /^[A-Za-z0-9_-]{22}$/;
// Written out here, not imported: this file imports no feature. They are the shapes the games feature allows.
const GAME = /^[a-z2-7]{10}$/;
const PULL = /^[A-Za-z0-9-]{1,64}$/;
const HOST_NAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{1,5})?$/;
const MAX_HOSTS = 5;

function requireSecret(secret: string): void {
  if (secret === "") throw new Error("The play pass secret is not set.");
}

function macOf(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${MAC_PREFIX}${payload}`).digest();
}

/** A new pass id: 16 random bytes. A test hands in its own bytes to get a known id. */
export function newPassId(
  randomBytes: (count: number) => Uint8Array = (count) => crypto.getRandomValues(new Uint8Array(count)),
): string {
  return Buffer.from(randomBytes(16)).toString("base64url");
}

/**
 * `v1.<payload>.<mac>`: the payload is the claims as JSON, the mac is HMAC-SHA256 over it, both in base64url, so the
 * whole pass is one path segment. The same claims and secret always make the same pass, so a pass rebuilt from its
 * row is the address the browser already has.
 */
export function makePass(claims: PassClaims, secret: string): string {
  requireSecret(secret);
  const payload = Buffer.from(
    JSON.stringify({
      i: claims.id,
      g: claims.game,
      p: claims.pull,
      c: claims.connect,
      exp: Math.floor(claims.expiresAtMs / 1000),
    }),
  ).toString("base64url");
  return `${VERSION}.${payload}.${macOf(payload, secret).toString("base64url")}`;
}

/** The claims in a pass's payload, or null when the payload is not exactly the shape `makePass` writes. */
function claimsFrom(payload: string): PassClaims | null {
  let body: unknown;
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { i, g, p, c, exp } = body as Record<string, unknown>;

  if (typeof i !== "string" || !ID.test(i)) return null;
  if (typeof g !== "string" || !GAME.test(g)) return null;
  if (typeof p !== "string" || !PULL.test(p)) return null;
  if (!Array.isArray(c) || c.length > MAX_HOSTS) return null;
  const hosts: unknown[] = c;
  const connect = hosts.filter((host): host is string => typeof host === "string" && HOST_NAME.test(host));
  if (connect.length !== hosts.length) return null;
  if (typeof exp !== "number" || !Number.isInteger(exp)) return null;

  return { id: i, game: g, pull: p, connect, expiresAtMs: exp * 1000 };
}

/**
 * The claims in a pass, or null for anything that is not a good pass that has not run out. It never throws, whatever
 * it is handed: it is run on every file request, on what anyone may type into an address.
 */
export function checkPass(value: string, secret: string, nowMs: number): PassClaims | null {
  requireSecret(secret);
  const parts = value.split(".");
  const [version, payload, given] = parts;
  if (parts.length !== 3 || version !== VERSION || payload === undefined || given === undefined) return null;

  // Compared in constant time, so how long a wrong mac takes does not say how much of it was right.
  const expected = macOf(payload, secret);
  const actual = Buffer.from(given, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  const claims = claimsFrom(payload);
  if (claims === null || nowMs >= claims.expiresAtMs) return null;
  return claims;
}
