import { createHmac } from "node:crypto";

// A phone number is kept one way, E.164 (`+13125551234`), so one person is one account however they type it.

// Lives with the Texter, which refuses these numbers; `src/lib` may not import a feature.
export { isMadeUpNumber } from "../../lib/server/text.ts";

/**
 * The number as E.164, or null when it cannot be one. Spaces, dashes, dots and brackets are dropped. Typed text that
 * starts `+`, `00` or `011` (how a number is dialled from abroad) is already the whole number. Otherwise the leading
 * zeros go (a country's trunk prefix), under +1 one leading 1 goes too, and the dialing code is put in front.
 */
export function toE164(dialingCode: string, typed: string): string | null {
  const compact = typed.replace(/[\s\-.()]/g, "");
  const international = /^(?:\+|00|011)/.exec(compact);
  const digits = international === null ? compact : compact.slice(international[0].length);
  if (!/^\d+$/.test(digits)) return null;

  let whole: string;
  if (international !== null) {
    whole = digits;
  } else {
    const code = dialingCode.replace(/\D/g, "");
    let national = digits.replace(/^0+/, "");
    if (code === "1" && national.startsWith("1")) national = national.slice(1);
    whole = `${code}${national}`;
  }
  return /^\d{8,15}$/.test(whole) ? `+${whole}` : null;
}

/**
 * A number kept where it may have no account (a limit, a pause, a half-made sign-up, a STOP), as a keyed hash, so a
 * leaked table shows no number. Keyed with BETTER_AUTH_SECRET.
 */
export function hashNumber(number: string, secret: string): string {
  return createHmac("sha256", secret).update(`phone:${number}`).digest("hex");
}
