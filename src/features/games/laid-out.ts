import type { AgeRating, ContentMark, GamePlaysOn } from "../../lib/server/db.ts";

// The small facts a game is laid out with where a maker checks it (spec 5b): where it plays, who it is for, and which
// other websites it uses, each as the words a maker reads. Pure, so the words are tested in one place.

/** Where a game plays, or null while the maker has not said. */
export function playsOnWords(playsOn: GamePlaysOn | null): string | null {
  if (playsOn === null) return null;
  return playsOn === "phone_and_computer" ? "Plays on phones and computers" : "Plays on computers only";
}

const RATING_WORDS: Record<AgeRating, string> = {
  age_3: "3+",
  age_7: "7+",
  age_12: "12+",
  age_16: "16+",
  age_18: "18+",
};

/** What an 18+ game says it has, in the one order the screens always list them. "None of these" is not a mark. */
const MARK_WORDS: [Exclude<ContentMark, "none">, string][] = [
  ["sex_or_nudity", "Sex or nudity"],
  ["gore", "Gore"],
  ["drugs", "Drugs"],
];

/**
 * Who a game is for ("12+"), with the marks of an 18+ game after a dot ("18+ · Gore"). Only an 18+ game has marks, and
 * an 18+ game with none (or "None of these") is "18+" alone. Null while the maker has not said.
 */
export function ratingWords(ageRating: AgeRating | null, marks: readonly ContentMark[]): string | null {
  if (ageRating === null) return null;
  if (ageRating !== "age_18") return RATING_WORDS[ageRating];
  const named = MARK_WORDS.filter(([mark]) => marks.includes(mark)).map(([, words]) => words);
  return named.length === 0 ? RATING_WORDS.age_18 : `${RATING_WORDS.age_18} · ${named.join(", ")}`;
}

/** The websites a game talks to: "Uses no other websites", or "Uses" and every one of them. */
export function websitesWords(hosts: readonly string[]): string {
  return hosts.length === 0 ? "Uses no other websites" : `Uses ${hosts.join(", ")}`;
}
