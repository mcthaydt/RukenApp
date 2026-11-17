// Every text Ruken words itself. Each is a pure function of the site's address, so a test can hold it letter for
// letter. Each starts "Ruken:", is plain GSM-7 (straight apostrophes only) and fits one text. The sign-in code's own
// words are Twilio Verify's, not ours.

export function alreadyText(site: string): string {
  return `Ruken: you already have a Ruken account. Sign in, or reset your password: ${site}/sign-in`;
}

export function passwordChangedText(site: string): string {
  return `Ruken: your password was changed and we signed you out everywhere. Not you? Choose a new one: ${site}/forgot-password`;
}

export function signInPausedText(site: string): string {
  return `Ruken: too many wrong passwords, so sign-in is paused for an hour. Not you? Choose a new password: ${site}/forgot-password`;
}

// GSM-7's basic set takes one place each, and these take two (the escape place and the character).
const GSM_SINGLE = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑܧ¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
const GSM_DOUBLE = new Set("€[]{}|^~\\");

/** How many places a text takes in the GSM-7 encoding, or null when anything in it is outside GSM-7. */
function gsmPlaces(text: string): number | null {
  let places = 0;
  for (const character of text) {
    if (GSM_SINGLE.has(character)) places += 1;
    else if (GSM_DOUBLE.has(character)) places += 2;
    else return null;
  }
  return places;
}

/**
 * One text is 160 GSM-7 places, or 70 characters when anything in it is outside GSM-7, which sends the whole text in
 * a wider encoding. A longer text is sent as two or three paid parts, so this is the limit that matters, not a count
 * of letters.
 */
function fitsOneText(text: string): boolean {
  const places = gsmPlaces(text);
  return places === null ? text.length <= 70 : places <= 160;
}

/**
 * Builds a text that holds a name someone typed (a game, an extra). When the whole does not fit in one text, the name
 * is cut and ends in "..."; `before` and `after` (which holds the link) are never cut.
 */
export function fitText(before: string, name: string, after: string): string {
  const whole = `${before}${name}${after}`;
  if (fitsOneText(whole)) return whole;
  // Cut by whole characters (an emoji is one), one at a time, because cutting can also remove the character that
  // forced the wider encoding, which raises the limit.
  const characters = Array.from(name);
  for (let kept = characters.length - 1; kept >= 0; kept -= 1) {
    const candidate = `${before}${characters.slice(0, kept).join("")}...${after}`;
    if (fitsOneText(candidate)) return candidate;
  }
  return `${before}...${after}`;
}
