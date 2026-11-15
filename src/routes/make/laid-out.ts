// What a game laid out for its maker is made of. Types only, so a screen in the browser can name them without loading
// the server code that fills them in (laid-out.server.ts).

/** A part of a game that has something to say about it on the laid-out game: the four facts shown as chips. */
export type ChipPart = "files" | "plays_on" | "age_rating" | "other_websites";

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
  /** The address of the question that changes each part named here; a part not named has no Change. */
  changes: Partial<Record<ChangePart, string>>;
}
