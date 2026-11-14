import type { GameState } from "../../lib/server/db.ts";

// A game's state in the maker's plain words (stub: the words come after their tests have been seen failing).

export function stateWords(game: {
  state: GameState;
  stateReason: string | null;
  hasPending: boolean;
}): string {
  throw new Error(`not built yet: stateWords ${game.state}`);
}
