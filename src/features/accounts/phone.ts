import { createHmac } from "node:crypto";

// A phone number, written one way. People type theirs many ways, and one number must be one account, so
// everything that stores or looks up a number first writes it as E.164 (a "+", then 8 to 15 digits).

// `src/lib/` imports no feature, so the made-up-number rule lives with the Texter and is re-exported here for the
// accounts feature's own code and tests.
export { isMadeUpNumber } from "../../lib/server/text.ts";

/**
 * Writes a typed number as E.164, or null when it cannot be one. `dialingCode` is the country the person picked
 * ("+1"). Spaces, dashes, dots and brackets are dropped. Typed text starting "+", "00" or "011" already names its
 * country, so what follows is the whole number, whatever country was picked. Otherwise leading zeros are dropped
 * (several countries write one), under "+1" one leading "1" is dropped, and the dialing code goes in front.
 */
export function toE164(dialingCode: string, typed: string): string | null {
  const cleaned = typed.replace(/[\s\-.()]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) return null;

  let digits: string;
  if (cleaned.startsWith("+")) digits = cleaned.slice(1);
  else if (cleaned.startsWith("011")) digits = cleaned.slice(3);
  else if (cleaned.startsWith("00")) digits = cleaned.slice(2);
  else {
    const local = cleaned.replace(/^0+/, "");
    const withoutTrunkOne = dialingCode === "+1" && local.startsWith("1") ? local.slice(1) : local;
    digits = dialingCode.replace(/\D/g, "") + withoutTrunkOne;
  }

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
