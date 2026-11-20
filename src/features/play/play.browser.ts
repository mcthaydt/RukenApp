// What the play screen's own script may import from the play feature. Browser-safe: no server code is reachable from
// here (the layer test checks), so none of it can end up in a visitor's download.
export {
  FIRST_PLACE,
  heightRange,
  isDrag,
  readPlace,
  tabByKey,
  tabRest,
  TAB_HEIGHT,
  TAB_WIDTH,
  type TabPlace,
} from "./menu-tab.ts";
export { createAttention, type Look } from "./attention.ts";
export { BEAT_EVERY_MS } from "./time.ts";
