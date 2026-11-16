import { createHash } from "node:crypto";
import type { AgeRating, ClipShape, ContentMark, GamePlaysOn } from "../../lib/server/db.ts";

// What staff looked at (audit S-1). A game waiting for review can still be changed by its maker, and a change is saved at
// once. The check page carries a sign of what it showed, and a decision made on a page whose sign no longer matches the
// game is refused, so a game is never accepted, or sent back, as something staff did not see.

/** The parts of a waiting game that a person judges: the maker's answers, the files that wait, and the two videos. */
export interface Judged {
  name: string;
  oneLine: string | null;
  playsOn: GamePlaysOn | null;
  ageRating: AgeRating | null;
  contentMarks: readonly ContentMark[];
  connectHosts: readonly string[];
  pendingPullId: string | null;
  clips: readonly { shape: ClipShape; key: string }[];
}

/**
 * A SHA-256 of everything a person judges, in a fixed order. Lists are sorted first, so the order a database happens to
 * give them in never moves the sign; the whole is written as JSON, so "ab" and "c" are never confused with "a" and "bc".
 * The rating staff choose at Accept is theirs, not the maker's, so it is not part of what they saw changing.
 */
export function seenOf(game: Judged): string {
  const judged = [
    game.name,
    game.oneLine,
    game.playsOn,
    game.ageRating,
    [...game.contentMarks].sort(),
    [...game.connectHosts].sort(),
    game.pendingPullId,
    [...game.clips].map((clip) => [clip.shape, clip.key]).sort(),
  ];
  return createHash("sha256").update(JSON.stringify(judged)).digest("hex");
}
