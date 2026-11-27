import { stillOfClip } from "../../lib/stills.ts";
import type { ListedGame } from "../games/games.ts";

// Search, from the feed's top bar: the games on the feed and the makers who made them, found by what a person types.
// It looks only at what the feed may show (live games, none rated 18+), so a game the feed leaves out cannot be found
// here either. There are few enough live games to read them all and match here, which keeps it to one plain rule.

/** The most of each kind one search shows. */
export const SEARCH_MAX = 20;
/** The longest search that is read; anything past it is left off. */
export const SEARCH_LONGEST = 80;

export interface SearchDeps {
  liveGames(): Promise<ListedGame[]>;
  makersOf(
    userIds: readonly string[],
  ): Promise<Map<string, { handle: string; name: string; photoKey: string | null }>>;
  /** The whole address of a file in the bucket, from its key. */
  media(key: string): string;
}

export interface FoundGame {
  slug: string;
  name: string;
  oneLine: string;
  /** Who made it, when they have a page. */
  maker: string | null;
  /** The opening frame of its upright clip, as a small picture beside its name; null when the clip is not a stored one. */
  still: string | null;
}

export interface FoundMaker {
  handle: string;
  name: string;
  photo: string | null;
}

/** How wide a result's still is fetched: the smallest still made, about twice the 64px it is shown at. */
const THUMBNAIL_WIDTH = 240;

/** A clip's opening frame (the second the feed starts it on), from the clip's whole address. */
function thumbnailOf(clip: string): string | null {
  const still = stillOfClip(clip);
  return still === null ? null : `${still.address}?at=0&width=${String(THUMBNAIL_WIDTH)}`;
}

export interface Found {
  games: FoundGame[];
  makers: FoundMaker[];
}

/**
 * Words as a search compares them: small letters, accents off (so "pokemon" finds "Pokémon"), and every run of spaces
 * one space.
 */
export function plainWords(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * How well `text` matches `wanted` (both plain words): 0 when it starts with it, 1 when a word in it does, 2 when it is
 * anywhere in it, and null when it is not there at all.
 */
export function matchRank(text: string, wanted: string): number | null {
  if (wanted === "") return null;
  if (text.startsWith(wanted)) return 0;
  if (text.includes(` ${wanted}`)) return 1;
  if (text.includes(wanted)) return 2;
  return null;
}

/** The best of several ranks, or null when none matched. */
function best(ranks: (number | null)[]): number | null {
  const found = ranks.filter((rank) => rank !== null);
  return found.length === 0 ? null : Math.min(...found);
}

/** Matches first by how well, then by name, so the same search always gives the same order. */
function inOrder<T extends { name: string }>(matches: { rank: number; item: T }[]): T[] {
  return matches
    .sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name, "en"))
    .slice(0, SEARCH_MAX)
    .map(({ item }) => item);
}

export function createSearch(deps: SearchDeps) {
  /** The games and makers that match `query`. An empty search finds nothing. */
  async function find(query: string): Promise<Found> {
    const wanted = plainWords(query.slice(0, SEARCH_LONGEST));
    if (wanted === "") return { games: [], makers: [] };

    const games = (await deps.liveGames()).filter((game) => game.ageRating !== "age_18");
    const makers =
      games.length === 0
        ? new Map<string, { handle: string; name: string; photoKey: string | null }>()
        : await deps.makersOf([...new Set(games.map((game) => game.makerUserId))]);

    const foundGames = games.flatMap((game) => {
      const maker = makers.get(game.makerUserId);
      // A game's name counts first; its line and its maker's name find it too, after the games whose name matched.
      const byName = matchRank(plainWords(game.name), wanted);
      const byRest = best([
        matchRank(plainWords(game.oneLine), wanted),
        maker === undefined ? null : matchRank(plainWords(maker.name), wanted),
      ]);
      const rank = byName ?? (byRest === null ? null : byRest + 3);
      if (rank === null) return [];
      return [
        {
          rank,
          item: {
            slug: game.slug,
            name: game.name,
            oneLine: game.oneLine,
            maker: maker?.name ?? null,
            still: thumbnailOf(deps.media(game.clips.upright)),
          },
        },
      ];
    });

    const foundMakers = [...makers.values()].flatMap((maker) => {
      const rank = best([
        matchRank(plainWords(maker.name), wanted),
        matchRank(maker.handle, wanted.replace(/^@/, "")),
      ]);
      if (rank === null) return [];
      return [
        {
          rank,
          item: {
            handle: maker.handle,
            name: maker.name,
            photo: maker.photoKey === null ? null : deps.media(maker.photoKey),
          },
        },
      ];
    });

    return { games: inOrder(foundGames), makers: inOrder(foundMakers) };
  }

  return { find };
}

export type Search = ReturnType<typeof createSearch>;
