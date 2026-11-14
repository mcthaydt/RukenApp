// What a screen's components and src/params/ may import from the pages feature. Browser-safe: no server code
// is reachable from here (the layer test checks), so none of it can end up in a visitor's download.
export { DEFAULT_THEME, THEMES, type Theme } from "./themes.ts";
