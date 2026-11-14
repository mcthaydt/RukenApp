// What a game's frame may do. A game is untrusted code from a maker, so it runs in a sandboxed frame on an address of
// its own (the game gate), and gets only the powers below.

/**
 * Scripts, its own storage (the address is its own, so it never reaches Ruken's) and pointer lock. Nothing that could
 * take the page over: no navigating the top page, no pop-ups, no forms, no dialogs, no downloads.
 */
export const GAME_FRAME_SANDBOX = "allow-scripts allow-same-origin allow-pointer-lock";

/** What a game may ask the browser for. The last two are for a game that copies and shares a link. */
export const GAME_FRAME_ALLOW = "gamepad; fullscreen; autoplay; clipboard-write; web-share";
