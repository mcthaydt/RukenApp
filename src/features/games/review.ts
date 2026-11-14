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
