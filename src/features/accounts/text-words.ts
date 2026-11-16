// The words of every text this branch sends. Each text starts "Ruken:", fits in one text, holds one link at most and is
// written for a tired person at a glance. `site` is BETTER_AUTH_URL.

export const codeText = (code: string): string =>
  `Ruken: your code is ${code}. It works for 10 minutes. Don't share it with anyone.`;

export const alreadyText = (site: string): string =>
  `Ruken: you already have a Ruken account. Sign in, or reset your password: ${site}/sign-in`;

export const resetCodeText = (code: string): string =>
  `Ruken: your code to choose a new password is ${code}. It works for 10 minutes. Didn't ask? Ignore this text.`;

export const passwordChangedText = (site: string): string =>
  `Ruken: your password was changed and we signed you out everywhere. Not you? Choose a new one: ${site}/forgot-password`;

export const signInPausedText = (site: string): string =>
  `Ruken: too many wrong passwords, so sign-in is paused for an hour. Not you? Choose a new password: ${site}/forgot-password`;

// GSM 03.38, the alphabet a one-part text can be written in. The second group is spelled with two places each.
const GSM7_ONE_PLACE = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ),
);
const GSM7_TWO_PLACES = new Set(Array.from("\f^{}\\[~]|€"));

const isGsm7 = (text: string): boolean =>
  Array.from(text).every((letter) => GSM7_ONE_PLACE.has(letter) || GSM7_TWO_PLACES.has(letter));

/** How many places the text takes in the alphabet it is sent in: GSM-7 places, or 16-bit units outside GSM-7. */
export function placesIn(text: string): number {
  if (!isGsm7(text)) return text.length;
  return Array.from(text).reduce((places, letter) => places + (GSM7_TWO_PLACES.has(letter) ? 2 : 1), 0);
}

/**
 * How many places one text holds: 160, or 70 when anything in it is outside GSM-7, which sends the whole text in a
 * wider alphabet. A longer text is sent as two or three paid parts.
 */
export function textLimitOf(text: string): 160 | 70 {
  return isGsm7(text) ? 160 : 70;
}

/**
 * `before + name + after` in one text. When the whole is too long the name is cut and ends in "...", the longest cut
 * that fits; `before` and `after` (which holds the link) are never cut. A name with an emoji moves the whole text to the
 * 70-place limit, so the cut is judged on the whole.
 */
export function fitText(before: string, name: string, after: string): string {
  const letters = Array.from(name);
  for (let kept = letters.length; kept >= 0; kept--) {
    const shown = kept === letters.length ? name : `${letters.slice(0, kept).join("").trimEnd()}...`;
    const whole = `${before}${shown}${after}`;
    if (placesIn(whole) <= textLimitOf(whole)) return whole;
  }
  // Even with no name it is too long: send what there is rather than nothing.
  return `${before}...${after}`;
}
