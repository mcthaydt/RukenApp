import { HANDLE_MAX, HANDLE_MIN, RESERVED_HANDLES } from "./handle.ts";

// The address a page gets from the name a person gives at sign-up. Nobody types it: it is made here, and always keeps
// the address rules in handle.ts (and the database's own check), whatever the name is.

/** Zero-width spaces, joiners and the byte-order mark: they show nothing, so a name of only these is no name. */
const INVISIBLE = /[​-‍⁠﻿]/g;

/** Room left for a hyphen and up to 6 digits when the first try is taken. */
const WITH_DIGITS_MAX = HANDLE_MAX - 7;

/** What every name too short or with no Latin letters starts from. */
const FALLBACK_BASE = "friend";

/** The name as it is kept: trimmed, with the invisible characters taken out. */
export function cleanName(raw: string): string {
  return raw.replace(INVISIBLE, "").trim();
}

/** The name in address letters: lower-case, accents dropped, every other run of characters one hyphen. */
export function addressBase(name: string): string {
  return cleanName(name)
    .normalize("NFKD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The base cut to `max` characters, with a hyphen the cut left at the end dropped. */
function cut(base: string, max: number): string {
  return base.slice(0, max).replace(/-+$/, "");
}

function usable(address: string): boolean {
  return address.length >= HANDLE_MIN && !RESERVED_HANDLES.has(address);
}

/**
 * The addresses to try, in order: the name itself, then five with 4 random digits and five with 6. `digits(n)` gives
 * n random digits; a test hands it fixed ones.
 */
export function addressesFor(name: string, digits: (count: number) => string): string[] {
  const base = addressBase(name);
  const first = cut(base, HANDLE_MAX);
  const tries: string[] = usable(first) ? [first] : [];
  const short = cut(base, WITH_DIGITS_MAX);
  const stem = short.length >= HANDLE_MIN ? short : FALLBACK_BASE;
  for (const count of [4, 4, 4, 4, 4, 6, 6, 6, 6, 6]) tries.push(`${stem}-${digits(count)}`);
  return tries;
}

/** `count` random digits, from the platform's random source. */
export function randomDigits(count: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(count)), (byte) => String(byte % 10)).join("");
}
