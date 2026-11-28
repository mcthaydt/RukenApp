// The feed's entry: what routes and other features may import. Anything not exported here is internal.
export { feedServices, setPrivateRanker, type MarkedGame } from "./services.ts";
export { isMarkKind, MARK_KINDS, type MarkKind } from "./marks.ts";
export { pressOfPath, pressPath, rememberPress, takePress, type WaitingPress } from "./pressed.ts";
export { FEED_MAX, type FeedClip, type FeedPage } from "./service.ts";
export { TAB_DATA } from "./tab-data.ts";
export type { Ranker } from "./ranker.ts";
export type { Chip, Choice, Learning, YourFeed } from "./taste.ts";
export { SEARCH_LONGEST, type Found, type FoundGame, type FoundMaker } from "./search.ts";
