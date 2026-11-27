// The one door between the feed and whatever puts its games in order. The app reads the database, decides who is asking,
// hands the ranker plain rows and turns the game ids it answers into clips. The real order runs in a private Worker
// reached by the `PRIVATE` binding; when that is missing, slow or broken the open ranker (public-ranker.ts) answers
// instead. Everything here is plain data, because it crosses a Worker boundary, and it names nothing private: which
// rows a ranker may read is public on purpose, because it is what a person is told is collected.

/** The most clips one page of the feed answers. */
export const FEED_MAX = 50;

/** Who is asking. Decided in public (viewer.ts): `crowd` reads nothing about the person; `full` may. */
export type Viewer = { kind: "crowd"; seed: string } | { kind: "full"; seed: string; id: string };

/** A live game, as a ranker may see it. Times are epoch milliseconds. */
export interface FeedGame {
  id: string;
  slug: string;
  makerId: string;
  liveSince: number;
  ageRating: string;
  /** How many clips the game has to choose from; a page names one by its place, from 0. */
  slots: number;
}

/**
 * Everything a ranker may read. It grows only by adding optional fields; `RankRequest.v` goes up on any other change,
 * so the private Worker can tell an app it does not understand.
 */
export interface FeedFacts {
  /** The games that may be shown, already without the ones this viewer may not see. */
  games: FeedGame[];
  /** Attentive beats from members per game id, since `memberBeatsSince` (epoch ms) up to `asOf`. */
  memberBeats: Record<string, number>;
  memberBeatsSince: number;
  /**
   * Who played what, since `playDaysSince` (epoch ms) up to `asOf`: per signed-in person, game and Chicago day, their
   * attentive beats as a member or free. Never staff's or a maker's own play. Sent only to the private ranker.
   */
  playDays?: FeedPlayDay[];
  playDaysSince?: number;
}

/** One person's play of one game on one Chicago day (`YYYY-MM-DD`). */
export interface FeedPlayDay {
  userId: string;
  gameId: string;
  day: string;
  beats: number;
  basis: "member" | "free_game";
}

export interface RankRequest {
  v: 1;
  viewer: Viewer;
  /** The cursor this ranker made, or null for a first page. Opaque to the app. */
  after: string | null;
  asOf: number;
  facts: FeedFacts;
}

export interface RankedItem {
  gameId: string;
  slot: number;
  /** Its own in the whole feed, because the feed goes round and shows a game again. */
  key: string;
}

export interface RankedPage {
  items: RankedItem[];
  next: string | null;
  caughtUpAt: number | null;
  ask: { index: number; gameId: string } | null;
}

export type FeedNote = "few-plays" | "few-taps" | null;

export interface Ranker {
  page(request: RankRequest): Promise<RankedPage | "bad-cursor">;
  /** Per game, whether its maker is told few people have tapped Play or watched to the end. */
  notes(request: { asOf: number; facts: FeedFacts; gameIds: string[] }): Promise<Record<string, FeedNote>>;
  health(): Promise<"private" | "partial" | "defaults">;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/**
 * Whether an answer from a ranker the app does not run has the contract's shape. A page from the private Worker is
 * checked before anything is built from it; one that is not shaped right is treated as no answer.
 */
export function isRankedPageOrBadCursor(value: unknown): value is RankedPage | "bad-cursor" {
  if (value === "bad-cursor") return true;
  if (!isRecord(value)) return false;
  const { items, next, caughtUpAt, ask } = value;
  if (!Array.isArray(items) || items.length > FEED_MAX) return false;
  const keys = new Set<string>();
  for (const item of items as unknown[]) {
    if (!isRecord(item)) return false;
    if (typeof item.gameId !== "string" || item.gameId === "") return false;
    if (!isCount(item.slot)) return false;
    if (typeof item.key !== "string" || item.key === "" || keys.has(item.key)) return false;
    keys.add(item.key);
  }
  if (next !== null && (typeof next !== "string" || next === "")) return false;
  if (caughtUpAt !== null && !isCount(caughtUpAt)) return false;
  if (ask !== null) {
    if (!isRecord(ask) || !isCount(ask.index) || typeof ask.gameId !== "string") return false;
  }
  return true;
}
