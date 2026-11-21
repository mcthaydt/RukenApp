import type { AgeRating, ContentMark } from "../../lib/server/db.ts";
import type { GameErrorCode } from "./game-error.ts";
import { ratingWords } from "./laid-out.ts";
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

/** What a live game holds for review: the videos that wait (by shape, as keys) and the rating that waits. */
interface HeldFacts {
  held: { ageRating: AgeRating; contentMarks: ContentMark[] } | null;
  heldClips: { upright: { key: string } | null; wide: { key: string } | null };
  clips: { upright: { key: string } | null; wide: { key: string } | null };
  ageRating: AgeRating | null;
  contentMarks: ContentMark[];
}

/** One part that changed: what players see now and what waits, each as the words or the address staff open. */
export interface HeldChange {
  part: "upright_video" | "wide_video" | "age_rating";
  now: string | null;
  waiting: string;
}

/**
 * What staff's look shows of a live game's update that holds a video or the rating: for each held part, the value
 * players see now and the value waiting. Empty when nothing is held, and then the look answers as it always did.
 * `media` makes a video's address from its key.
 */
export function heldChanges(game: HeldFacts, media: (key: string) => string): HeldChange[] {
  const changes: HeldChange[] = [];
  for (const [shape, part] of [
    ["upright", "upright_video"],
    ["wide", "wide_video"],
  ] as const) {
    const waiting = game.heldClips[shape];
    if (waiting === null) continue;
    const live = game.clips[shape];
    changes.push({ part, now: live === null ? null : media(live.key), waiting: media(waiting.key) });
  }
  if (game.held !== null) {
    changes.push({
      part: "age_rating",
      now: ratingWords(game.ageRating, game.contentMarks),
      // `ratingWords` is null only for no rating, and a held rating is always one.
      waiting: ratingWords(game.held.ageRating, game.held.contentMarks) ?? "",
    });
  }
  return changes;
}

/** What `look` tells staff to do when an update holds a video or the rating. */
export const LOOK_SAYS_SEEN =
  'This update changes a video or the rating. To say yes, send back the "seen" time below: {"do":"accept","game":…,"seen":…}. If the maker changes it again, look again.';
