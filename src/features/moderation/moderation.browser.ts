// What a screen may import from the moderation feature. Browser-safe: no server code is reachable from here (the layer
// test checks), so none of it can end up in a visitor's download.
export { default as ReportSheet } from "./ReportSheet.svelte";

/** What a screen holds of its Report sheet (`bind:this`): the one way to open it. */
export interface ReportSheetControl {
  open(game: { slug: string; name: string }, from: HTMLElement | null): void;
}
