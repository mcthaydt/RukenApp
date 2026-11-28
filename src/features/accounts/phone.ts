import { createHmac } from "node:crypto";

// A phone number, written one way. People type theirs many ways, and one number must be one account, so
// everything that stores or looks up a number first writes it as E.164 (a "+", then 8 to 15 digits).

// `src/lib/` imports no feature, so the made-up-number rule lives with the Texter and is re-exported here for the
// accounts feature's own code and tests.
export { isMadeUpNumber } from "../../lib/server/text.ts";

/**
 * Writes a typed number as E.164, or null when it cannot be one. `dialingCode` is the country the person picked
 * ("+1"). Spaces, dashes, dots and brackets are dropped. Typed text starting "+" or "00" already names its country,
 * and so does "011" under "+1" (the North American prefix; elsewhere it is a national number, as in Leeds's 0113),
 * so what follows is the whole number, whatever country was picked. Otherwise leading zeros are dropped
 * (several countries write one), under "+1" one leading "1" is dropped, and the dialing code goes in front. A North
 * American number (country code 1) must be ten digits after it.
 */
export function toE164(dialingCode: string, typed: string): string | null {
  const cleaned = typed.replace(/[\s\-.()]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) return null;

  let digits: string;
  if (cleaned.startsWith("+")) digits = cleaned.slice(1);
  else if (dialingCode === "+1" && cleaned.startsWith("011")) digits = cleaned.slice(3);
  else if (cleaned.startsWith("00")) digits = cleaned.slice(2);
  else {
    const local = cleaned.replace(/^0+/, "");
    const withoutTrunkOne = dialingCode === "+1" && local.startsWith("1") ? local.slice(1) : local;
    digits = dialingCode.replace(/\D/g, "") + withoutTrunkOne;
  }

  // Country code 1 is North America's: a number there is ten digits after it, so a short one (a number typed without
  // its area code) is refused here and never reaches a text.
  if (digits.startsWith("1") && digits.length !== 11) return null;
  return /^\d{8,15}$/.test(digits) ? `+${digits}` : null;
}

/**
 * The key for a number that may have no account (limits, the pause, a pending sign-up, STOP): HMAC-SHA-256 of
 * "phone:<E.164>" under the server's secret (BETTER_AUTH_SECRET), in lower-case hex.
 *
 * Keyed and not a plain hash because phone numbers are easy to guess: anyone holding a copy of the table could
 * hash every number and see which were typed. The "phone:" prefix keeps these values apart from the other keys
 * made from the same secret.
 */
export function hashNumber(number: string, secret: string): string {
  return createHmac("sha256", secret).update(`phone:${number}`).digest("hex");
}

export interface OpenCountry {
  /** ISO 3166-1 alpha-2, what the form posts. */
  code: string;
  name: string;
  /** What `toE164` puts in front of a number typed without one. */
  dialing: string;
}

/**
 * The countries the sign-in screens offer. Ruken opens only where a person can text Ruken back (STOP, START, HELP), which
 * today is the United States and Canada; each one that follows is added here, with its numbers, when it opens.
 */
export const OPEN_COUNTRIES: readonly OpenCountry[] = [
  { code: "US", name: "United States", dialing: "+1" },
  { code: "CA", name: "Canada", dialing: "+1" },
];

/** The open country with these two capital letters, or null for anything else (a closed country, or text a form made up). */
export function countryOf(code: string): OpenCountry | null {
  return OPEN_COUNTRIES.find((country) => country.code === code) ?? null;
}

/**
 * The number a form's country and phone fields name, as E.164, or null for a closed country or a number that cannot be
 * one. A number typed with its own "+" (or "00") names its own country, so it must still start with the dialing code of
 * the open country that was picked: "+44 ..." under United States is a closed country's number, and is refused here
 * before anything is kept or texted.
 */
export function typedNumber(countryCode: string, phone: string): string | null {
  const country = countryOf(countryCode);
  if (country === null) return null;
  const number = toE164(country.dialing, phone);
  return number !== null && number.startsWith(country.dialing) ? number : null;
}

/** A number as /me shows it to its owner: "+1 312 555 0142" for a North American one, the digits as they are otherwise. */
export function shownAs(number: string): string {
  const north = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(number);
  return north === null ? number : `+1 ${north[1] ?? ""} ${north[2] ?? ""} ${north[3] ?? ""}`;
}
