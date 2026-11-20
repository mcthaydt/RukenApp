import type { GameErrorCode } from "./game-error.ts";
import type { DecisionMade, ReviewKind } from "./service.ts";

// What the Owner's review command says, as sentences made in one place so a test can read each one.

/** The line `list` opens with: what waits, and for the coming decision day how many seats are taken. */
export function listSays(
  waiting: number,
  week: { words: string; seats: number; taken: number } | null,
): string {
  const waitingSays =
    waiting === 0
      ? "Nothing is waiting."
      : waiting === 1
        ? "1 game is waiting."
        : `${String(waiting)} games are waiting.`;
  return week === null
    ? waitingSays
    : `${waitingSays} ${String(week.taken)} of ${String(week.seats)} seats are taken for ${week.words}.`;
}

/** What a yes says: held for a day, or live at once. */
export function acceptSays(
  name: string,
  kind: ReviewKind,
  made: DecisionMade,
  dayWords: (day: string) => string,
): string {
  if (made.held)
    return `${name} gets in on ${dayWords(made.day)}. ${String(made.taken)} of ${String(made.seats)} seats are taken.`;
  return kind === "update" ? `${name}'s new version is live.` : `${name} is live.`;
}

/** What a send back says: held for a day, or gone back now. */
export function sendBackSays(name: string, made: DecisionMade, dayWords: (day: string) => string): string {
  return made.held
    ? `${name} goes back to its maker on ${dayWords(made.day)}.`
    : `${name} went back to its maker.`;
}

/** A decision that clashes with another (already held, or no seat left) is a 409; any other refusal is a 400. */
export function failureStatus(code: GameErrorCode): 400 | 409 {
  return code === "CONFLICT" ? 409 : 400;
}
