// The moods and genres a person can ask the feed for more or less of, in the Owner's words (learned feed spec 6.3).
// Keys are what a FeedTaste row keeps; the words are what a chip says. Browser-safe: Your feed's screen reads them.

export const MOODS = {
  bold: "Bold",
  cosy: "Cosy",
  clever: "Clever",
  heartfelt: "Heartfelt",
  showy: "Showy",
  tidy: "Tidy",
  friendly: "Friendly",
  spooky: "Spooky",
  adventurous: "Adventurous",
  tough: "Tough",
  weird: "Weird",
  dreamy: "Dreamy",
} as const;

export const GENRES = {
  action: "Action",
  adventure: "Adventure",
  puzzle: "Puzzle",
  story: "Story",
  strategy: "Strategy",
  role_playing: "Role-playing",
  platformer: "Platformer",
  racing_sports: "Racing and sports",
  building_life: "Building and life",
  party_board: "Party and board",
  other: "Other",
} as const;

export type Mood = keyof typeof MOODS;
export type Genre = keyof typeof GENRES;

export const isMood = (value: string): value is Mood => Object.hasOwn(MOODS, value);
export const isGenre = (value: string): value is Genre => Object.hasOwn(GENRES, value);

/**
 * The line at the top of Your feed, from the person's top "more" moods and genres by a fixed template, never by an AI.
 * With none yet it says the feed is still learning. "Other" says nothing about a taste, so it is left out.
 */
export function tasteSentence(more: readonly string[]): string {
  const words = more
    .filter((key) => key !== "other")
    .flatMap((key): string[] => (isMood(key) ? [MOODS[key]] : isGenre(key) ? [GENRES[key]] : []))
    .slice(0, 3)
    .map((word) => word.toLowerCase());
  if (words.length === 0) return "Play a few games and we'll learn what you like.";
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} and ${words.at(-1) ?? ""}`;
  return `Lately you've been into ${list ?? ""} games.`;
}
