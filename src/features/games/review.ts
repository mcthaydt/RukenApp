import type { GameState } from "../../lib/server/db.ts";

// A game's state in the maker's plain words (design 5.4): short sentences, and when something went wrong, what to fix.

/**
 * What the maker reads under a game's name. A live game keeps its old files live while an update waits or is sent back,
 * so its words say so; a new update waiting wins over an older reason.
 */
export function stateWords(game: {
  state: GameState;
  stateReason: string | null;
  hasPending: boolean;
}): string {
  /** A line that ends with its reason when there is one: "Sent back: Fix the sound." */
  const because = (lead: string): string =>
    game.stateReason === null ? lead : `${lead}: ${game.stateReason}`;
  switch (game.state) {
    case "draft":
      return "Not sent yet";
    case "waiting":
      return "Waiting for review";
    case "live":
      if (game.hasPending) return "Live. Your update is waiting for review";
      return game.stateReason === null ? "Live" : because("Live. Your update was sent back");
    case "sent_back":
      return because("Sent back");
    case "taken_off":
      return "Off Ruken. You took it off.";
    case "taken_down":
      return because("Taken down");
  }
}

/** A game's state as a headline, and the reason apart when there is one. Not built yet. */
export function stateParts(game: { state: GameState; stateReason: string | null; hasPending: boolean }): {
  headline: string;
  reason: string | null;
} {
  throw new Error(`stateParts is not built yet (${game.state})`);
}

/** The two lines a game has in the maker's list: where it stands and what to do. Not built yet. */
export function listWords(game: {
  state: GameState;
  stateReason: string | null;
  hasPending: boolean;
  filesProblem: boolean;
  bothVideos: boolean;
}): string {
  throw new Error(`listWords is not built yet (${game.state})`);
}

/** The one next step, under a game's state on its own page. Not built yet. */
export function nextStepWords(game: {
  state: GameState;
  stateReason: string | null;
  hasPending: boolean;
  filesProblem: boolean;
  upright: boolean;
  wide: boolean;
}): string | null {
  throw new Error(`nextStepWords is not built yet (${game.state})`);
}

/** What is still missing before a game can be sent. */
export interface MissingBeforeSend {
  files: boolean;
  upright: boolean;
  wide: boolean;
  agreement: boolean;
}

/** One sentence naming everything still missing, or null when nothing is. Not built yet. */
export function beforeSendWords(missing: MissingBeforeSend): string | null {
  throw new Error(`beforeSendWords is not built yet (${String(missing.files)})`);
}
