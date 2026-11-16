/**
 * What the check page says of the staff member's own play of the files that wait: "You've played it for 2 minutes." It
 * names only the time that counted, not how many times the page was opened, because every open of the check page starts
 * a staff session of its own.
 */
export function playedWords(countedSeconds: number): string {
  if (countedSeconds <= 0) return "You haven't played it yet.";
  if (countedSeconds < 60) return "You've played it for less than a minute.";
  const minutes = Math.floor(countedSeconds / 60);
  return `You've played it for ${String(minutes)} ${minutes === 1 ? "minute" : "minutes"}.`;
}
