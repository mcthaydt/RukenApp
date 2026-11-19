import type { GamePart } from "../../lib/server/db.ts";
import reasons from "./library/send-back-reasons.json" with { type: "json" };

// Staff send a game back part by part, each with a reason from a short list (spec 11.2). The words staff choose from and
// the words the maker reads are written once, in library/send-back-reasons.json, so the two stay a pair.

/** The code of the one reason every part has: staff write their own line, and the maker reads that line. */
export const SOMETHING_ELSE = "something_else";

export interface SendBackReason {
  part: GamePart;
  code: string;
  /** What staff read and choose. */
  staff: string;
  /** What the maker reads; {name} stands for the game's name. For something_else it is empty: the maker reads staff's line. */
  maker: string;
}

/** The reasons a part can be sent back for, in the order staff see them, always ending with Something else. */
export function reasonsFor(part: GamePart): SendBackReason[] {
  const own = reasons
    .filter((reason) => reason.parts.includes(part))
    .map((reason) => ({ part, code: reason.code, staff: reason.staff, maker: reason.maker }));
  return [...own, { part, code: SOMETHING_ELSE, staff: "Something else", maker: "" }];
}

/** Whether `code` is one of the reasons offered for `part`. */
export function isReasonFor(part: GamePart, code: string): boolean {
  return reasonsFor(part).some((reason) => reason.code === code);
}

/** What the maker reads on the card: the reason's own words with {name} filled in; for Something else, staff's line. */
export function makerWords(part: GamePart, code: string, note: string | null, gameName: string): string {
  if (code === SOMETHING_ELSE) return note ?? "";
  const reason = reasonsFor(part).find((one) => one.code === code);
  return (reason?.maker ?? "").replaceAll("{name}", gameName);
}

/** The heading of a card for a part sent back: "Name: Floor Fifty", "Upright video". */
export function partTitle(part: GamePart, gameName: string): string {
  switch (part) {
    case "name":
      return `Name: ${gameName}`;
    case "one_line":
      return "One line";
    case "files":
      return "Game files";
    case "plays_on":
      return "Where it plays";
    case "upright_video":
      return "Upright video";
    case "wide_video":
      return "Wide video";
    case "age_rating":
      return "Who it's for";
    case "other_websites":
      return "Other websites";
  }
}

/** The part as a thing to fix, for a button: "Fix the upright video". */
export function partNoun(part: GamePart): string {
  switch (part) {
    case "name":
      return "the name";
    case "one_line":
      return "the line";
    case "files":
      return "your game's files";
    case "plays_on":
      return "where it plays";
    case "upright_video":
      return "the upright video";
    case "wide_video":
      return "the wide video";
    case "age_rating":
      return "who it's for";
    case "other_websites":
      return "the websites";
  }
}
