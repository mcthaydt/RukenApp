// What a screen may import from the feed feature. Browser-safe: no server code is reachable from here (the layer test
// checks), so none of it can end up in a visitor's download. The screens it names are the only way another folder
// reaches a `.svelte` file of this feature.
export { default as Feed } from "./Feed.svelte";
export { default as Bar } from "./Bar.svelte";
export { default as Followed } from "./Followed.svelte";
export { default as Search } from "./Search.svelte";
export { default as ShareSheet } from "./ShareSheet.svelte";
export { default as MarkedGames } from "./MarkedGames.svelte";

export type { ShareSheetControl } from "./share.ts";
export { default as YourFeed } from "./YourFeed.svelte";
export { default as FeedTop } from "./FeedTop.svelte";
export { kept, sawYourTurn } from "./kept.svelte.ts";
