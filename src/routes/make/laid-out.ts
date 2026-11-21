// What a game laid out for its maker is made of. Types only, so a screen in the browser can name them without loading
// the server code that fills them in (laid-out.server.ts).
import type { GamePart } from "../../features/games/games.ts";

/** A part of a game that has something to say about it on the laid-out game: the three facts shown as chips. */
export type ChipPart = "files" | "age_rating" | "other_websites";

/** Every part a Change link can lead to. */
export type ChangePart = "name" | "one_line" | "upright_video" | "wide_video" | ChipPart;

/** A game as its maker sees it before sending: its videos' addresses, its words, the facts, and where each is changed. */
export interface LaidOutGame {
  name: string;
  line: string;
  /** The address of each video, or null while there is none. */
  upright: string | null;
  wide: string | null;
  chips: { part: ChipPart; words: string }[];
  /**
   * The parts whose value shown here is a change with staff, waiting for their yes (a live game's new video or rating):
   * players still see the old one, and the screen says this one is "Waiting for review".
   */
  waiting: ChangePart[];
  /** The parts that hold a change nobody is reviewing yet (something is still to fix, or the copy was refused). */
  notSent: ChangePart[];
  /** The address of the question that changes each part named here; a part not named has no Change. */
  changes: Partial<Record<ChangePart, string>>;
}

/** One thing staff sent back, as a card shows it: what is wrong, where it is fixed and, for a video, the video itself. */
export interface FixCardData {
  part: GamePart;
  title: string;
  words: string;
  /** Staff's own line beside a reason from the list, or null. */
  note: string | null;
  /** The question that fixes it, or null when it is fixed somewhere else (a live game's files, mended on GitHub). */
  href: string | null;
  video: { src: string; shape: "upright" | "wide" } | null;
  /** What the blue button says when this is the first thing to fix: "Fix the upright video". */
  fixWords: string;
}
