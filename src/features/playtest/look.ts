// What a person sees of a game's playtest, from their row alone. One pure rule, read by the game's page and by the
// feed's list, so the two can never differ (playtesting spec, the state table).

/** The part of a person's row the look depends on; null for someone with no row. */
export interface LookRow {
  state: "asked" | "in" | "declined" | "removed";
  takenBackAt: Date | null;
}

/**
 * `badge`: the Playtest badge shows. `action`: what goes under or in place of Wishlist: "ask" (Ask to playtest),
 * "asked" (You asked…, Take back), "play" (Play with the tag), or "none" (the page as it is without playtesting).
 */
export interface PlaytestLook {
  badge: boolean;
  action: "ask" | "asked" | "play" | "none";
}

/** Nothing playtest: after launch, on a game that is not live, or for its maker. */
export const NO_LOOK: PlaytestLook = { badge: false, action: "none" };

/**
 * A person the maker said no to still sees their ask (they are never told), so declined reads as asked until they take
 * it back. Someone taken off sees nothing playtest at all, so they read as the game with playtesting turned off.
 */
export function lookOf(row: LookRow | null, game: { asking: boolean; isMaker: boolean }): PlaytestLook {
  if (game.isMaker) return NO_LOOK;
  if (row?.state === "in") return { badge: false, action: "play" };
  if (row?.state === "removed") return NO_LOOK;
  const asked = row !== null && (row.state === "asked" || row.takenBackAt === null);
  if (asked) return { badge: game.asking, action: "asked" };
  return game.asking ? { badge: true, action: "ask" } : NO_LOOK;
}
