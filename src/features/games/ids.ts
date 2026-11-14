// A game has two names. Its public id is made once and never changes: it names the game's own address on the
// games' domain and its folder in the bucket, so a renamed game keeps its saves. Its slug is the address of its
// page on Ruken (`/g/<slug>`) and is made from its name.

/** A game's public id: ten characters of a-z and 2-7. */
export const PUBLIC_ID = /^[a-z2-7]{10}$/;

/** 32 characters, so one random byte picks one with no leftover (256 is a multiple of 32): every id is equally likely. */
const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const ID_LENGTH = 10;

/** A slug is 3 to 40 characters; the database refuses anything else (`Game_slug_check`). */
const SLUG_MIN = 3;
const SLUG_MAX = 40;

function randomBytesFromTheRuntime(count: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(count));
}

/** A new public id. A test hands in its own bytes to get a known id. */
export function newPublicId(randomBytes: (count: number) => Uint8Array = randomBytesFromTheRuntime): string {
  let id = "";
  for (const byte of randomBytes(ID_LENGTH)) {
    id += ID_ALPHABET.charAt(byte % ID_ALPHABET.length);
  }
  return id;
}

/**
 * The address a game's name makes: lower case, letters and digits, every other run of characters one hyphen, 3 to 40
 * characters. Accents are taken off the letters first (`Büro` is `buro`). Answers null when the name leaves fewer than
 * three characters, because such an address would be useless.
 */
export function slugOf(name: string): string | null {
  const slug = name
    .normalize("NFKD")
    // The accent marks that NFKD split off the letters.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX)
    // The cut may have left a hyphen at the end.
    .replace(/-+$/, "");
  return slug.length >= SLUG_MIN ? slug : null;
}
