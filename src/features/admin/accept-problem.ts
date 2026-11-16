import { STAFF_NO_AGE_WORDS, type GamePart } from "../games/games.ts";

/** The marks the check page offers. Only these count; the service reads the same four and stays the one that decides. */
const MARKS = ["sex_or_nudity", "gore", "drugs", "none"];

/**
 * What is wrong with the choices staff made about who a game is for, read before an Accept goes any further. It is the
 * same two things the service refuses (no age picked, and an 18+ game with no marks or with "None of these" beside
 * another), found early so staff are never asked "Accept it anyway?" about a press that would be refused straight after.
 * `atMarks` says the words belong under the marks' question and not above the ages; the marks' words name the game, so
 * they point at the four boxes that are right there. Null when the choices stand.
 */
export function acceptProblem(
  choice: { ageRating: string; marks: readonly string[] },
  name: string,
): { part: GamePart; atMarks: boolean; words: string } | null {
  if (choice.ageRating === "") return { part: "age_rating", atMarks: false, words: STAFF_NO_AGE_WORDS };
  // Marks belong to an 18+ game only. The page hides them for any other age, and a hidden box that was ticked is still posted.
  if (choice.ageRating !== "age_18") return null;
  const known = choice.marks.filter((mark) => MARKS.includes(mark));
  if (known.length === 0)
    return { part: "age_rating", atMarks: true, words: `Pick what ${name} has, or None of these.` };
  if (known.includes("none") && known.length > 1)
    return {
      part: "age_rating",
      atMarks: true,
      words: "Pick None of these on its own, or pick what's in it.",
    };
  return null;
}
