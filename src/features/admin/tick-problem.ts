import { isReasonFor, SOMETHING_ELSE, type GamePart } from "../games/games.ts";

/** One part staff ticked on the check page, with what they chose and typed for it. Never believed: this only reads them. */
export interface TickedPart {
  part: GamePart;
  reason: string;
  note: string;
}

/** What a press of the one blue button says when nothing is ticked and nothing can be accepted: tick first. */
export const TICK_FIRST_WORDS = "Tick what's wrong first, then press Send back.";

/**
 * The first ticked part that cannot be sent back as it stands, with words that name it by the title it has on the page:
 * "Pick a reason for One line.", or "Say what's wrong with One line, in your own words." for Something else with no line.
 * The page shows the words at that part, so staff do not scroll a long page looking for the one they ticked. The service
 * refuses the same two things and stays the one that decides; this only says which part, which its refusal cannot.
 */
export function tickProblem(
  ticked: readonly TickedPart[],
  titleOf: (part: GamePart) => string,
): { part: GamePart; words: string } | null {
  for (const one of ticked) {
    if (!isReasonFor(one.part, one.reason))
      return { part: one.part, words: `Pick a reason for ${titleOf(one.part)}.` };
    if (one.reason === SOMETHING_ELSE && one.note.trim() === "")
      return { part: one.part, words: `Say what's wrong with ${titleOf(one.part)}, in your own words.` };
  }
  return null;
}
