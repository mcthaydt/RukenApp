// What a page's own script may import from the play feature. Browser-safe: no server code is reachable from here (the
// layer test checks), so none of it can end up in a visitor's download.
export { createAttention, type Attention, type Look } from "./attention.ts";
export { startBeats } from "./beats.ts";
export { BEAT_EVERY_MS } from "./time.ts";
