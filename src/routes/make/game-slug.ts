// A game's address as it appears after `/make/`: lower-case words joined by single hyphens. A connection to GitHub
// carries one through GitHub and back, and the maker is sent to `/make/<address>/files`, so only the shape of an
// address is ever put in a redirect. Whether the game is hers is the question's own 404.
const GAME_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `value` when it is the shape of a game's address, otherwise null. */
export function gameSlugOf(value: string | null): string | null {
  return value !== null && value.length <= 40 && GAME_SLUG.test(value) ? value : null;
}
