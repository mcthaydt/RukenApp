import {
  LIVE_MAY_BE_SENT_BACK,
  megabytes,
  partTitle,
  playsOnWords,
  ratingWords,
  reasonsFor,
  websitesWords,
  type AgeRating,
  type ContentMark,
  type GamePart,
  type GamePlaysOn,
} from "../games/games.ts";

// The eight parts staff tick on the check page, made once here so the page only draws them: each part's title, its value
// in the maker's own words, its video when it is one, whether it has a box, and the reasons a ticked part can be sent
// back for. A live game's update has a box only on what its maker can still fix.

/** What the check page needs of a game: the maker's answers, and the files that wait. */
export interface GameToCheck {
  name: string;
  state: string;
  oneLine: string | null;
  playsOn: GamePlaysOn | null;
  ageRating: AgeRating | null;
  contentMarks: readonly ContentMark[];
  pending: { fileCount: number; totalBytes: number; connectHosts: readonly string[] } | null;
  clipKeys: { upright: string | null; wide: string | null };
}

/** One part of a game as the check page draws it. */
export interface CheckPart {
  part: GamePart;
  title: string;
  /** The part's value in words; null for a video, which shows itself. */
  value: string | null;
  video: { src: string; shape: "upright" | "wide" } | null;
  /** False for a part an update cannot be sent back for: it is shown with no box. */
  canTick: boolean;
  /** The reasons staff choose from, ending with "Something else"; none when there is no box. */
  reasons: { code: string; words: string }[];
}

/** The parts in a game's own order (the order the database lists them in, and the maker's questions are asked in). */
const PARTS: readonly GamePart[] = [
  "name",
  "one_line",
  "files",
  "plays_on",
  "upright_video",
  "wide_video",
  "age_rating",
  "other_websites",
];

/** "3 files, 1 MB" for the files that wait. */
function filesWords(pending: GameToCheck["pending"]): string | null {
  if (pending === null) return null;
  const noun = pending.fileCount === 1 ? "file" : "files";
  return `${String(pending.fileCount)} ${noun}, ${megabytes(pending.totalBytes)}`;
}

/** What each part says, as words. A video says nothing: it is drawn. */
function valueOf(game: GameToCheck, part: GamePart): string | null {
  switch (part) {
    case "name":
      return game.name;
    case "one_line":
      return game.oneLine;
    case "files":
      return filesWords(game.pending);
    case "plays_on":
      return playsOnWords(game.playsOn);
    case "age_rating":
      return ratingWords(game.ageRating, game.contentMarks);
    case "other_websites":
      return game.pending === null ? null : websitesWords(game.pending.connectHosts);
    case "upright_video":
    case "wide_video":
      return null;
  }
}

/** The video a part shows, with its address from `media`, or null for a part that is not a video or has none. */
function videoOf(
  game: GameToCheck,
  part: GamePart,
  media: (key: string) => string,
): CheckPart["video"] {
  if (part === "upright_video" && game.clipKeys.upright !== null)
    return { src: media(game.clipKeys.upright), shape: "upright" };
  if (part === "wide_video" && game.clipKeys.wide !== null)
    return { src: media(game.clipKeys.wide), shape: "wide" };
  return null;
}

/** The parts of a game staff check, in order, each with what the page draws for it. */
export function partsToCheck(game: GameToCheck, media: (key: string) => string): CheckPart[] {
  return PARTS.map((part) => {
    const canTick = game.state !== "live" || LIVE_MAY_BE_SENT_BACK.includes(part);
    return {
      part,
      // The name's own title is "Name": the game's name is the value beside it.
      title: part === "name" ? "Name" : partTitle(part, game.name),
      value: valueOf(game, part),
      video: videoOf(game, part, media),
      canTick,
      reasons: canTick ? reasonsFor(part).map((reason) => ({ code: reason.code, words: reason.staff })) : [],
    };
  });
}
