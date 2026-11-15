/**
 * What a game's play time says on the check page, in words: "Played so far: 2 minutes counted." It names only the time that
 * counted, not how many times it was opened, because every open of the check page starts a staff session of its own.
 */
export function playedWords(countedSeconds: number): string {
  if (countedSeconds <= 0) return "Played so far: nothing counted yet.";
  if (countedSeconds < 60) return "Played so far: less than a minute counted.";
  const minutes = Math.floor(countedSeconds / 60);
  return `Played so far: ${String(minutes)} ${minutes === 1 ? "minute" : "minutes"} counted.`;
}
