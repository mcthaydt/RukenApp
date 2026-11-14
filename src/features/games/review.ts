import type { GameState } from "../../lib/server/db.ts";

// A game's state in the maker's plain words (design 5.4): short sentences, and when something went wrong, what to fix.
// Every line a maker reads about where a game stands is made here, so the words are tested in one place.

/** What a game's rows say about where it stands. */
interface StateInput {
  state: GameState;
  stateReason: string | null;
  hasPending: boolean;
}

/**
 * A game's state as a headline, with staff's reason apart from it. A live game keeps its old files live while an
 * update waits or is sent back, so its words say so; a new update waiting wins over an older reason. The reason is
 * kept out of the headline so a screen can show it as a plain paragraph and not as a line of large type.
 */
export function stateParts(game: StateInput): { headline: string; reason: string | null } {
  switch (game.state) {
    case "draft":
      return { headline: "Not sent yet", reason: null };
    case "waiting":
      return { headline: "Waiting for review", reason: null };
    case "live":
      if (game.hasPending) return { headline: "Live. Your update is waiting for review", reason: null };
      return game.stateReason === null
        ? { headline: "Live", reason: null }
        : { headline: "Live. Your update was sent back", reason: game.stateReason };
    case "sent_back":
      return { headline: "Sent back", reason: game.stateReason };
    case "taken_off":
      return { headline: "Off Ruken. You took it off.", reason: null };
    case "taken_down":
      return { headline: "Taken down", reason: game.stateReason };
  }
}

/** The state in one line, with the reason after a colon when there is one: "Sent back: Fix the sound." */
export function stateWords(game: StateInput): string {
  const { headline, reason } = stateParts(game);
  return reason === null ? headline : `${headline}: ${reason}`;
}

/**
 * The line under a game's name in the maker's list: where it stands and what to do next. Staff's whole reason is
 * not repeated here; the game's own page has it.
 */
export function listWords(game: StateInput & { filesProblem: boolean; bothVideos: boolean }): string {
  const { headline, reason } = stateParts(game);
  switch (game.state) {
    case "draft":
      if (game.filesProblem) return `${headline}. Fix your game's files.`;
      return game.bothVideos ? `${headline}. Send it for review.` : `${headline}. Add your videos.`;
    case "sent_back":
      return `${headline}. See what to fix.`;
    case "live":
      return reason === null ? headline : `${headline}. See what to fix.`;
    case "taken_down":
      return `${headline}. See why.`;
    case "waiting":
    case "taken_off":
      return headline;
  }
}

/**
 * The one next step, in a line under a game's state on its own page. Null when there is nothing to do (a game that
 * is off Ruken). What is wrong with the files comes first, since nothing else works until they are fixed.
 */
export function nextStepWords(
  game: StateInput & { filesProblem: boolean; upright: boolean; wide: boolean },
): string | null {
  const canSend = game.state === "draft" || game.state === "sent_back";
  if (canSend && game.filesProblem) return "Fix your game's files on GitHub, then copy it again.";
  switch (game.state) {
    case "draft":
      if (game.upright && game.wide) return "Everything's here. Send it for review.";
      if (game.upright) return "Add your wide video, then send it for review.";
      if (game.wide) return "Add your upright video, then send it for review.";
      return "Add your two videos, then send it for review.";
    case "sent_back":
      return "Fix it, then send it again.";
    case "waiting":
      // No mail is sent yet, so the line must not promise one.
      return "We're looking at it. Come back here to see when it's live.";
    case "live":
      return !game.hasPending && game.stateReason !== null
        ? "Fix it, then send your newest version for review."
        : "Players can find it on Ruken.";
    case "taken_off":
    case "taken_down":
      return null;
  }
}

/** What is still missing before a game can be sent. */
export interface MissingBeforeSend {
  files: boolean;
  upright: boolean;
  wide: boolean;
  agreement: boolean;
}

/**
 * One sentence naming everything still missing, in the order a maker works down the page, or null when nothing is.
 * Listing them all means a maker fixes everything in one go and is not refused three times for three things.
 */
export function beforeSendWords(missing: MissingBeforeSend): string | null {
  const parts = [
    missing.files ? "copy your game from GitHub" : null,
    missing.upright ? "add the upright video" : null,
    missing.wide ? "add the wide video" : null,
    missing.agreement ? "tick the box" : null,
  ].filter((part) => part !== null);
  const last = parts.pop();
  if (last === undefined) return null;
  if (parts.length === 0) return `Before you send it: ${last}.`;
  if (parts.length === 1) return `Before you send it: ${parts.join("")} and ${last}.`;
  return `Before you send it: ${parts.join(", ")}, and ${last}.`;
}
