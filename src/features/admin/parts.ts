import type { AgeRating, ContentMark, GamePart, GamePlaysOn } from "../games/games.ts";

/** What the check page needs of a game: the maker's answers, and the files that wait. */
export interface GameToCheck {
  name: string;
  state: string;
  oneLine: string | null;
  playsOn: GamePlaysOn | null;
  ageRating: AgeRating | null;
  contentMarks: ContentMark[];
  pending: { fileCount: number; totalBytes: number; connectHosts: string[] } | null;
  clipKeys: { upright: string | null; wide: string | null };
}

/** One part of a game as the check page draws it. */
export interface CheckPart {
  part: GamePart;
  title: string;
  value: string | null;
  video: { src: string; shape: "upright" | "wide" } | null;
  canTick: boolean;
  reasons: { code: string; words: string }[];
}

/** Not built yet. */
export function partsToCheck(_game: GameToCheck, _media: (key: string) => string): CheckPart[] {
  throw new Error("not built yet");
}
