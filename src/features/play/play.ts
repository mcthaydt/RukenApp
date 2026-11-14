// The play feature's entry: what routes and other features may import. Anything not exported here is internal.
export { GAME_FRAME_ALLOW, GAME_FRAME_SANDBOX } from "./frame.ts";
export { backFromPaywall, isPhone, type PlayBasis } from "./may-play.ts";
export { playServices } from "./services.ts";
export { countedMs, LONGEST_COUNTED_GAP_MS, PLAY_SESSION_LIFE_MS } from "./time.ts";
