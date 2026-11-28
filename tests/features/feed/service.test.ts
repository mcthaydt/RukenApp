import { describe, expect, it } from "vitest";
import type { ListedGame } from "../../../src/features/games/games.ts";
import {
  createFeedService,
  FEED_MAX,
  MORE_AT_LEAST,
  type FeedServiceDeps,
} from "../../../src/features/feed/service.ts";
import { TestClock } from "../../support/test-clock.ts";

const DAY = 86_400_000;
const START = "2026-11-21T15:00:00Z";
const NOW = Date.parse(START);

/** A live game that went live `daysAgo` days before the test's clock. */
function listed(slug: string, daysAgo: number, extra: Partial<ListedGame> = {}): ListedGame {
  return {
    id: `id-${slug}`,
    publicId: `pub-${slug}`,
    slug,
    name: `Game ${slug}`,
    oneLine: `About ${slug}.`,
    freeToPlay: false,
    showsPlayerCount: false,
    makerUserId: `maker-${slug}`,
    livePullId: "pull",
    connectHosts: [],
    ageRating: "age_12",
    contentMarks: [],
    clips: { upright: `clips/${slug}-up.mp4`, wide: `clips/${slug}-wide.mp4` },
    liveSince: new Date(NOW - daysAgo * DAY),
    ...extra,
  };
}

/** The feed's neighbours as plain functions, and what each was asked. */
function depsFor(
  games: ListedGame[],
  options: {
    beats?: Record<string, number>;
    makers?: Record<string, { handle: string; name: string; photoKey: string | null; listed: boolean }>;
    /** Each person's followed makers' accounts. */
    follows?: Record<string, string[]>;
  } = {},
  clock = new TestClock(START),
) {
  const asked = { since: [] as Date[], now: [] as Date[], makerIds: [] as string[][] };
  const deps: FeedServiceDeps = {
    clock,
    liveGames: () => Promise.resolve(games),
    memberBeatsByGame: (since, now) => {
      asked.since.push(since);
      asked.now.push(now);
      return Promise.resolve(new Map(Object.entries(options.beats ?? {})));
    },
    makersOf: (ids) => {
      asked.makerIds.push([...ids]);
      return Promise.resolve(
        new Map(Object.entries(options.makers ?? {}).filter(([id]) => ids.includes(id))),
      );
    },
    followedAmong: (followerId, makerIds) =>
      Promise.resolve(new Set((options.follows?.[followerId] ?? []).filter((id) => makerIds.includes(id)))),
    followedMakerIds: (followerId) => Promise.resolve(options.follows?.[followerId] ?? []),
    media: (key) => `https://media.test/${key}`,
  };
  return { service: createFeedService(deps), asked, deps };
}

/** The first page's clips. */
async function firstPage(service: ReturnType<typeof depsFor>["service"]) {
  return (await service.page(null)).clips;
}

describe("feed", () => {
  it("answers no clips when no game is live", async () => {
    expect(await depsFor([]).service.page(null)).toEqual({ clips: [], next: null });
  });

  it("answers the clips in the feed's order: new games newest first, then the most played", async () => {
    const { service } = depsFor(
      [listed("old-quiet", 30), listed("new-old", 5), listed("old-busy", 20), listed("new-new", 1)],
      { beats: { "id-old-busy": 50, "id-old-quiet": 2 } },
    );

    expect((await firstPage(service)).map((clip) => clip.slug)).toEqual([
      "new-new",
      "new-old",
      "old-busy",
      "old-quiet",
    ]);
  });

  it("gives whole addresses for both clips and the maker's photo, and the maker or null", async () => {
    const { service } = depsFor([listed("with", 1), listed("without", 2)], {
      makers: {
        "maker-with": { handle: "night-owl", name: "Night Owl", photoKey: "photos/owl.png", listed: true },
      },
    });

    const clips = await firstPage(service);

    expect(clips[0]).toEqual({
      key: "0~with",
      slug: "with",
      name: "Game with",
      oneLine: "About with.",
      upright: "https://media.test/clips/with-up.mp4",
      wide: "https://media.test/clips/with-wide.mp4",
      maker: {
        handle: "night-owl",
        name: "Night Owl",
        photo: "https://media.test/photos/owl.png",
        listed: true,
        following: false,
        mine: false,
      },
      // No marks were read (the stand-in has none), so the clip shows none.
      marks: { likes: 0, liked: false, saved: false, reposted: false },
      // Nobody is signed in, so no friend liked it.
      friends: { faces: [], more: 0 },
    });
    expect(clips[1]?.maker).toBeNull();
  });

  it("asks for each shown game's marks once, for the viewer, and puts them on its clip", async () => {
    const { deps } = depsFor([listed("one", 1), listed("two", 2)]);
    const asked: { viewerId: string | null; ids: string[] }[] = [];
    const withMarks = createFeedService({
      ...deps,
      marksOf: (viewerId, games) => {
        asked.push({ viewerId, ids: games.map((game) => game.id) });
        return Promise.resolve(
          new Map([["id-two", { likes: 3, liked: true, saved: false, reposted: true }]]),
        );
      },
    });

    const clips = (await withMarks.page(null, undefined, "viewer-1")).clips;

    expect(asked).toHaveLength(1);
    expect(asked[0]?.viewerId).toBe("viewer-1");
    expect(new Set(asked[0]?.ids)).toEqual(new Set(["id-one", "id-two"]));
    expect(clips.find((clip) => clip.slug === "two")?.marks).toEqual({
      likes: 3,
      liked: true,
      saved: false,
      reposted: true,
    });
    expect(clips.find((clip) => clip.slug === "one")?.marks.likes).toBe(0);
  });

  it("asks once for the viewer's friends who liked the shown games, and puts their faces on each clip", async () => {
    const { deps } = depsFor([listed("one", 1), listed("two", 2)]);
    const asked: { viewerId: string | null; ids: string[] }[] = [];
    const withFriends = createFeedService({
      ...deps,
      friendLikesOf: (viewerId, gameIds) => {
        asked.push({ viewerId, ids: [...gameIds] });
        return Promise.resolve(
          new Map([
            [
              "id-two",
              {
                faces: [
                  { name: "Ana", photoKey: "photos/ana.webp" },
                  { name: "Ben", photoKey: null },
                ],
                more: 4,
              },
            ],
          ]),
        );
      },
    });

    const clips = (await withFriends.page(null, undefined, "viewer-1")).clips;

    expect(asked).toHaveLength(1);
    expect(asked[0]?.viewerId).toBe("viewer-1");
    expect(new Set(asked[0]?.ids)).toEqual(new Set(["id-one", "id-two"]));
    expect(clips.find((clip) => clip.slug === "two")?.friends).toEqual({
      faces: [
        { name: "Ana", photo: "https://media.test/photos/ana.webp" },
        { name: "Ben", photo: null },
      ],
      more: 4,
    });
    expect(clips.find((clip) => clip.slug === "one")?.friends).toEqual({ faces: [], more: 0 });

    // Signed out, nobody is asked about.
    await withFriends.page(null);
    expect(asked).toHaveLength(1);
  });

  it("gives a maker with no photo a null photo, and says an unlisted maker is unlisted", async () => {
    const { service } = depsFor([listed("one", 1)], {
      makers: { "maker-one": { handle: "h", name: "N", photoKey: null, listed: false } },
    });

    expect((await firstPage(service))[0]?.maker).toEqual({
      handle: "h",
      name: "N",
      photo: null,
      listed: false,
      following: false,
      mine: false,
    });
  });

  it("marks the makers the person asking follows, and their own games, and nobody else's", async () => {
    const makers = {
      "maker-a": { handle: "a", name: "A", photoKey: null, listed: true },
      "maker-b": { handle: "b", name: "B", photoKey: null, listed: true },
      "maker-c": { handle: "c", name: "C", photoKey: null, listed: true },
    };
    const { service } = depsFor([listed("a", 1), listed("b", 2), listed("c", 3)], {
      makers,
      follows: { one: ["maker-a"], two: ["maker-b"] },
    });
    const marks = async (viewer: string | null) =>
      Object.fromEntries(
        (await service.page(null, undefined, viewer)).clips.map((clip) => [
          clip.slug,
          [clip.maker?.following, clip.maker?.mine],
        ]),
      );

    expect(await marks("one")).toEqual({ a: [true, false], b: [false, false], c: [false, false] });
    expect(await marks("two")).toEqual({ a: [false, false], b: [true, false], c: [false, false] });
    expect(await marks("maker-c")).toEqual({ a: [false, false], b: [false, false], c: [false, true] });
    expect(await marks(null)).toEqual({ a: [false, false], b: [false, false], c: [false, false] });
  });

  it("leaves out games rated 18+", async () => {
    const { service } = depsFor([listed("kids", 1), listed("adults", 1, { ageRating: "age_18" })]);

    expect((await firstPage(service)).map((clip) => clip.slug)).toEqual(["kids"]);
  });

  it("asks for the week's beats up to now", async () => {
    const { service, asked } = depsFor([listed("one", 1)]);

    await firstPage(service);

    expect(asked.since).toEqual([new Date(NOW - 7 * DAY)]);
    expect(asked.now).toEqual([new Date(NOW)]);
  });

  it("keeps one order across two moments on one Chicago day", async () => {
    // Ten games tied on age and plays: only the day's seed orders them.
    const games = Array.from({ length: 10 }, (_, index) => listed(`tie-${String(index)}`, 20));
    const morning = depsFor(games, {}, new TestClock("2026-11-21T14:00:00Z"));
    const evening = depsFor(games, {}, new TestClock("2026-11-22T03:00:00Z"));

    const slugs = async (service: typeof morning.service) =>
      (await firstPage(service)).map((clip) => clip.slug);

    expect(await slugs(evening.service)).toEqual(await slugs(morning.service));
  });

  it("gives at most 50 clips on the first page, and asks for the makers of those only", async () => {
    const games = Array.from({ length: 60 }, (_, index) => listed(`g${String(index)}`, 20 + index));
    const { service, asked } = depsFor(games);

    const clips = await firstPage(service);

    expect(clips).toHaveLength(FEED_MAX);
    expect(FEED_MAX).toBe(50);
    expect(asked.makerIds[0]).toHaveLength(50);
  });

  it("answers no next page when no game is live", async () => {
    expect((await depsFor([]).service.page(null)).next).toBeNull();
  });
});

/** Walks the feed from the first page for `count` clips, the way the screen does: each page's `next` asks for the one after. */
async function walk(service: ReturnType<typeof depsFor>["service"], count: number): Promise<string[]> {
  const slugs: string[] = [];
  const keys = new Set<string>();
  let page = await service.page(null);
  for (let pages = 0; slugs.length < count; pages += 1) {
    for (const clip of page.clips) {
      // Every clip in one feed has its own key, so the screen can tell two showings of one game apart.
      expect(keys.has(clip.key)).toBe(false);
      keys.add(clip.key);
      slugs.push(clip.slug);
    }
    if (page.next === null) break;
    expect(pages).toBeLessThan(10_000);
    const next = await service.page(page.next);
    if (next === null) throw new Error("a next page from the service is always one it reads");
    page = next;
  }
  return slugs;
}

describe("the feed never ends", () => {
  it("shows every game once, then goes round again, for as long as a person scrolls", async () => {
    const games = Array.from({ length: 7 }, (_, index) => listed(`g${String(index)}`, 20 + index));
    const { service } = depsFor(games);

    const slugs = await walk(service, 7 * 6);

    expect(slugs.length).toBeGreaterThanOrEqual(7 * 6);
    for (let round = 0; round < 6; round += 1) {
      expect(new Set(slugs.slice(round * 7, round * 7 + 7)).size).toBe(7);
    }
  });

  it("the first page is the feed's order, with no game twice", async () => {
    const games = Array.from({ length: 4 }, (_, index) => listed(`g${String(index)}`, 20 + index));
    const { service } = depsFor(games, { beats: { "id-g2": 9, "id-g0": 5 } });

    const first = await service.page(null);

    expect(first.clips.map((clip) => clip.slug)).toEqual(["g2", "g0", "g1", "g3"]);
    expect(first.next).not.toBeNull();
  });

  it("goes round in a new order, and never shows one game twice in a row", async () => {
    const games = Array.from({ length: 5 }, (_, index) => listed(`g${String(index)}`, 20 + index));
    const { service } = depsFor(games);

    const slugs = await walk(service, 5 * 40);
    const rounds = Array.from({ length: 40 }, (_, round) => slugs.slice(round * 5, round * 5 + 5).join(","));

    expect(new Set(rounds).size).toBeGreaterThan(1);
    for (let index = 1; index < slugs.length; index += 1) expect(slugs[index]).not.toBe(slugs[index - 1]);
  });

  it("with two games, takes turns", async () => {
    const { service } = depsFor([listed("a", 20), listed("b", 21)]);

    const slugs = await walk(service, 20);

    for (let index = 1; index < slugs.length; index += 1) expect(slugs[index]).not.toBe(slugs[index - 1]);
  });

  it("with one game, shows it again and again", async () => {
    const { service } = depsFor([listed("only", 20)]);

    const slugs = await walk(service, 25);

    expect(slugs.length).toBeGreaterThanOrEqual(25);
    expect(new Set(slugs)).toEqual(new Set(["only"]));
  });

  it("a later page holds enough clips that the screen asks rarely", async () => {
    const { service } = depsFor([listed("a", 20), listed("b", 21), listed("c", 22)]);

    const first = await service.page(null);
    const second = await service.page(first.next ?? "");

    expect(second?.clips.length).toBeGreaterThanOrEqual(MORE_AT_LEAST);
    expect(second?.clips.length).toBeLessThanOrEqual(FEED_MAX);
  });

  it("goes past 50 games: the rest of the first round comes next, then the round again", async () => {
    const games = Array.from({ length: 60 }, (_, index) => listed(`g${String(index)}`, 20 + index));
    const { service } = depsFor(games);

    const slugs = await walk(service, 120);

    expect(new Set(slugs.slice(0, 60)).size).toBe(60);
    expect(new Set(slugs.slice(60, 120)).size).toBe(60);
  });

  it("keeps 18+ games out of every page", async () => {
    const { service } = depsFor([listed("kids", 20), listed("adults", 20, { ageRating: "age_18" })]);

    expect(new Set(await walk(service, 30))).toEqual(new Set(["kids"]));
  });

  it("never shows one game twice in a row where a page ends, even when plays change the order in between", async () => {
    for (let count = 2; count <= 8; count += 1) {
      const games = Array.from({ length: count }, (_, index) => listed(`g${String(index)}`, 20));
      const beats: Record<string, number> = {};
      const { service } = depsFor(games, { beats });

      const first = await service.page(null);
      const shown = first.clips.map((clip) => clip.slug);
      // Members play the game that ended the first page, so on the next request it is first in the order, not last.
      beats[`id-${shown.at(-1) ?? ""}`] = 1_000;
      let next = first.next ?? "";
      for (let pages = 0; pages < 6; pages += 1) {
        const page = await service.page(next);
        if (page === null) throw new Error("a next page from the service is always one it reads");
        shown.push(...page.clips.map((clip) => clip.slug));
        next = page.next ?? "";
        // And again: the game that ended this page becomes the most played.
        beats[`id-${shown.at(-1) ?? ""}`] = 2_000 + pages;
      }

      for (let index = 1; index < shown.length; index += 1) {
        expect(shown[index], `${String(count)} games: ${shown.join(" ")}`).not.toBe(shown[index - 1]);
      }
    }
  });

  it("answers null for an address it did not make", async () => {
    const { service } = depsFor([listed("a", 20)]);

    for (const bad of [
      "",
      "x",
      "2026-11-21~1",
      "2026-11-21~-1~0",
      "2026-11-21~1~0~9",
      "nope~1~0",
      "2026-11-21~9999999~0",
    ]) {
      expect(await service.page(bad)).toBeNull();
    }
  });

  it("goes on in one order across midnight, from the day the feed was opened", async () => {
    const games = Array.from({ length: 6 }, (_, index) => listed(`t${String(index)}`, 20));
    const before = depsFor(games, {}, new TestClock("2026-11-22T05:00:00Z"));
    const after = depsFor(games, {}, new TestClock("2026-11-22T07:00:00Z"));

    const first = await before.service.page(null);
    const fromBefore = await before.service.page(first.next ?? "");
    const fromAfter = await after.service.page(first.next ?? "");

    expect(fromAfter?.clips.map((clip) => clip.key)).toEqual(fromBefore?.clips.map((clip) => clip.key));
  });
});

describe("the Followed tab", () => {
  const makers = {
    "maker-a": { handle: "ada", name: "Ada", photoKey: null, listed: true },
    "maker-b": { handle: "bo", name: "Bo", photoKey: "photos/bo.png", listed: true },
  };

  it("says how many makers the person follows, and shows nothing when it is none", async () => {
    const { service } = depsFor([listed("a", 1, { makerUserId: "maker-a" })], { makers });
    expect(await service.followedPage("me")).toEqual({ following: 0, page: { clips: [], next: null } });
  });

  it("holds only the followed makers' live games, the last maker followed first, each maker's newest first, and ends", async () => {
    const { service } = depsFor(
      [
        listed("a-old", 9, { makerUserId: "maker-a" }),
        listed("a-new", 1, { makerUserId: "maker-a" }),
        listed("b", 5, { makerUserId: "maker-b" }),
        listed("other", 0),
      ],
      { makers, follows: { me: ["maker-b", "maker-a"] } },
    );
    const { following, page } = await service.followedPage("me");
    expect(following).toBe(2);
    expect(page.next).toBeNull();
    expect(page.clips.map((clip) => clip.slug)).toEqual(["b", "a-new", "a-old"]);
    expect(page.clips[0]?.maker).toEqual({
      handle: "bo",
      name: "Bo",
      photo: "https://media.test/photos/bo.png",
      listed: true,
      following: true,
      mine: false,
    });
    expect(new Set(page.clips.map((clip) => clip.key)).size).toBe(3);
  });

  it("puts the faces of friends who liked a game on its clip there too", async () => {
    const { deps } = depsFor([listed("b", 5, { makerUserId: "maker-b" })], {
      makers,
      follows: { me: ["maker-b"] },
    });
    const withFriends = createFeedService({
      ...deps,
      friendLikesOf: (viewerId) =>
        Promise.resolve(
          viewerId === "me"
            ? new Map([["id-b", { faces: [{ name: "Cy", photoKey: null }], more: 0 }]])
            : new Map(),
        ),
    });
    const { page } = await withFriends.followedPage("me");
    expect(page.clips[0]?.friends).toEqual({ faces: [{ name: "Cy", photo: null }], more: 0 });
  });

  it("never holds a game rated 18+, so a maker whose only game is one leaves the tab empty", async () => {
    const { service } = depsFor([listed("adults", 1, { makerUserId: "maker-a", ageRating: "age_18" })], {
      makers,
      follows: { me: ["maker-a"] },
    });
    expect(await service.followedPage("me")).toEqual({ following: 1, page: { clips: [], next: null } });
  });
});
