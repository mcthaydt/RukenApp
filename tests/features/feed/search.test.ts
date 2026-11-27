import { describe, expect, it } from "vitest";
import type { ListedGame } from "../../../src/features/games/games.ts";
import {
  createSearch,
  matchRank,
  plainWords,
  SEARCH_LONGEST,
  SEARCH_MAX,
} from "../../../src/features/feed/search.ts";

// Search from the feed's top bar finds live games and their makers by what a person types, and nothing the feed leaves out.

function game(slug: string, name: string, more: Partial<ListedGame> = {}): ListedGame {
  return {
    id: `id-${slug}`,
    publicId: `pub-${slug}`,
    slug,
    name,
    oneLine: `A line about ${slug}.`,
    freeToPlay: false,
    showsPlayerCount: false,
    makerUserId: "maker-a",
    livePullId: "pull",
    connectHosts: [],
    ageRating: "age_12",
    contentMarks: [],
    clips: { upright: `clips/${slug}-up.mp4`, wide: `clips/${slug}-wide.mp4` },
    liveSince: new Date("2026-11-20T00:00:00Z"),
    ...more,
  };
}

const MAKERS = new Map([
  ["maker-a", { handle: "night-owl", name: "Night Owl", photoKey: "photos/owl.png" }],
  ["maker-b", { handle: "sunny", name: "Sunny Days", photoKey: null }],
]);

function searchOver(games: ListedGame[]) {
  const asked: string[][] = [];
  const search = createSearch({
    liveGames: () => Promise.resolve(games),
    makersOf: (ids) => {
      asked.push([...ids]);
      return Promise.resolve(new Map([...MAKERS].filter(([id]) => ids.includes(id))));
    },
    media: (key) => `https://media.test/${key}`,
  });
  return { search, asked };
}

describe("plain words", () => {
  it("drops case, accents and extra spaces", () => {
    expect(plainWords("  Pokémon   CAFÉ ")).toBe("pokemon cafe");
  });
});

describe("how well words match", () => {
  it("ranks a start first, then a word's start, then anywhere, and nothing as null", () => {
    expect(matchRank("floor fifty", "floor")).toBe(0);
    expect(matchRank("floor fifty", "fif")).toBe(1);
    expect(matchRank("floor fifty", "oor")).toBe(2);
    expect(matchRank("floor fifty", "zebra")).toBeNull();
    expect(matchRank("floor fifty", "")).toBeNull();
  });
});

describe("search", () => {
  it("finds a game by its name, whatever the case or accents", async () => {
    const { search } = searchOver([game("cafe", "Café Rush"), game("other", "Other")]);
    const found = await search.find("cafe");
    expect(found.games.map((item) => item.slug)).toEqual(["cafe"]);
    expect(found.games[0]).toEqual({
      slug: "cafe",
      name: "Café Rush",
      oneLine: "A line about cafe.",
      maker: "Night Owl",
    });
  });

  it("puts games whose name matches before games found by their line or maker", async () => {
    const { search } = searchOver([
      game("by-line", "Zed", { oneLine: "A rocket ride." }),
      game("by-name", "Rocket League Lite"),
      game("mid-name", "Big Rocket"),
    ]);
    const found = await search.find("rocket");
    expect(found.games.map((item) => item.slug)).toEqual(["by-name", "mid-name", "by-line"]);
  });

  it("finds a maker by name or address, with or without the @, with their photo's whole address", async () => {
    const { search } = searchOver([game("a", "A"), game("b", "B", { makerUserId: "maker-b" })]);
    expect((await search.find("night")).makers).toEqual([
      { handle: "night-owl", name: "Night Owl", photo: "https://media.test/photos/owl.png" },
    ]);
    expect((await search.find("@sun")).makers).toEqual([
      { handle: "sunny", name: "Sunny Days", photo: null },
    ]);
  });

  it("finds a maker's games by the maker's name", async () => {
    const { search } = searchOver([game("a", "Alpha"), game("b", "Beta", { makerUserId: "maker-b" })]);
    expect((await search.find("sunny")).games.map((item) => item.slug)).toEqual(["b"]);
  });

  it("never finds a game rated 18+, or a maker whose only game is", async () => {
    const { search } = searchOver([
      game("adults", "Night Club", { ageRating: "age_18" }),
      game("sun", "Sun", { makerUserId: "maker-b" }),
    ]);
    const found = await search.find("night");
    expect(found.games).toEqual([]);
    expect(found.makers).toEqual([]);
  });

  it("finds nothing for an empty search, and asks the database nothing", async () => {
    const { search, asked } = searchOver([game("a", "A")]);
    expect(await search.find("   ")).toEqual({ games: [], makers: [] });
    expect(asked).toEqual([]);
  });

  it(`shows at most ${String(SEARCH_MAX)} of each, the same order every time`, async () => {
    const many = Array.from({ length: SEARCH_MAX + 5 }, (_, index) =>
      game(`g${String(index)}`, `Game ${String(index)}`),
    );
    const { search } = searchOver(many);
    const first = await search.find("game");
    expect(first.games).toHaveLength(SEARCH_MAX);
    expect(await search.find("game")).toEqual(first);
  });

  it(`reads only the first ${String(SEARCH_LONGEST)} letters of a search`, async () => {
    const long = "a".repeat(SEARCH_LONGEST);
    const { search } = searchOver([game("long", long)]);
    expect((await search.find(`${long}zzz`)).games.map((item) => item.slug)).toEqual(["long"]);
  });
});
