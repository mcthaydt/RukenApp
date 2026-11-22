// The words in the browser tab (the owner, 2026-11-22: "use Ruken - The Everyday Console for base title and
// Ruken - [Game Name] for when play a game"). Every screen shows the base title from the layout; a game's own
// page and its play screen show the game's name instead.
export const BASE_TITLE = "Ruken - The Everyday Console";

export function gameTitle(name: string): string {
  return `Ruken - ${name}`;
}
