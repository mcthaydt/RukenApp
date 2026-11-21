/**
 * The words a game's address may not be: each is a folder of `/make/` that has a screen of its own, which a router
 * tries before a game's address. A test reads the folders and fails until a new one is listed here.
 */
export const RESERVED_GAME_SLUGS: ReadonlySet<string> = new Set(["new", "github", "page"]);
