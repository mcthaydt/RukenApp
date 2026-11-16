/**
 * What the check page says of the staff member's own play of the files that wait: "You've played it for 2 minutes." It
 * names only the time that counted, not how many times the page was opened, because every open of the check page starts
 * a staff session of its own.
 */
export function playedWords(countedSeconds: number): string {
  if (countedSeconds <= 0) return "You haven't played it yet. Press inside the game to start.";
  if (countedSeconds < 60) return "You've played it for less than a minute.";
  const minutes = Math.floor(countedSeconds / 60);
  return `You've played it for ${String(minutes)} ${minutes === 1 ? "minute" : "minutes"}.`;
}

/**
 * What an update's check page says of members' play of the game that is live: "Players have played it for 2 minutes."
 * It is how a person sees on the test site that play time is counted, until slice 5 gives play time a home.
 */
export function playersPlayedWords(countedSeconds: number): string {
  if (countedSeconds <= 0) return "Players haven't played it yet.";
  if (countedSeconds < 60) return "Players have played it for less than a minute.";
  const minutes = Math.floor(countedSeconds / 60);
  return `Players have played it for ${String(minutes)} ${minutes === 1 ? "minute" : "minutes"}.`;
}

/**
 * Whether Accept must first ask. Staff are meant to play a game before they say yes (spec 11.1), but not made to: an
 * Accept with no play counted asks "Accept it anyway?" once, and the same press with `confirmed` goes through. It reads the
 * play counted when the button is pressed, never the line the page was drawn with, so a game played since is not asked about.
 */
export function mustAskBeforeAccepting(countedSeconds: number, confirmed: boolean): boolean {
  return countedSeconds <= 0 && !confirmed;
}

/** The question staff are asked when they accept a game they have not played. */
export function acceptAnywayWords(name: string): string {
  return `You haven't played ${name} yet. Press Back to play it, or press Accept it anyway.`;
}
