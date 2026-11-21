import { describe, expect, it } from "vitest";
import type { ListedGame } from "../../../src/features/games/games.ts";
import { createFeedService, FEED_MAX, type FeedServiceDeps } from "../../../src/features/feed/service.ts";
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
    makers?: Record<string, { handle: string; name: string; photoKey: string | null }>;
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
    media: (key) => `https://media.test/${key}`,
  };
  return { service: createFeedService(deps), asked };
}

describe("feed", () => {
  it("answers no clips when no game is live", async () => {
    expect(await depsFor([]).service.feed()).toEqual([]);
  });

  it("answers the clips in the feed's order: new games newest first, then the most played", async () => {
    const { service } = depsFor(
      [listed("old-quiet", 30), listed("new-old", 5), listed("old-busy", 20), listed("new-new", 1)],
      { beats: { "id-old-busy": 50, "id-old-quiet": 2 } },
    );

    expect((await service.feed()).map((clip) => clip.slug)).toEqual([
      "new-new",
      "new-old",
      "old-busy",
      "old-quiet",
    ]);
  });

  it("gives whole addresses for both clips and the maker's photo, and the maker or null", async () => {
    const { service } = depsFor([listed("with", 1), listed("without", 2)], {
      makers: { "maker-with": { handle: "night-owl", name: "Night Owl", photoKey: "photos/owl.png" } },
    });

    const clips = await service.feed();

    expect(clips[0]).toEqual({
      slug: "with",
      name: "Game with",
      oneLine: "About with.",
      upright: "https://media.test/clips/with-up.mp4",
      wide: "https://media.test/clips/with-wide.mp4",
      maker: { handle: "night-owl", name: "Night Owl", photo: "https://media.test/photos/owl.png" },
    });
    expect(clips[1]?.maker).toBeNull();
  });

  it("gives a maker with no photo a null photo", async () => {
    const { service } = depsFor([listed("one", 1)], {
      makers: { "maker-one": { handle: "h", name: "N", photoKey: null } },
    });

    expect((await service.feed())[0]?.maker).toEqual({ handle: "h", name: "N", photo: null });
  });

  it("leaves out games rated 18+", async () => {
    const { service } = depsFor([listed("kids", 1), listed("adults", 1, { ageRating: "age_18" })]);

    expect((await service.feed()).map((clip) => clip.slug)).toEqual(["kids"]);
  });

  it("asks for the week's beats up to now", async () => {
    const { service, asked } = depsFor([listed("one", 1)]);

    await service.feed();

    expect(asked.since).toEqual([new Date(NOW - 7 * DAY)]);
    expect(asked.now).toEqual([new Date(NOW)]);
  });

  it("keeps one order across two moments on one Chicago day", async () => {
    // Ten games tied on age and plays: only the day's seed orders them.
    const games = Array.from({ length: 10 }, (_, index) => listed(`tie-${String(index)}`, 20));
    const morning = depsFor(games, {}, new TestClock("2026-11-21T14:00:00Z"));
    const evening = depsFor(games, {}, new TestClock("2026-11-22T03:00:00Z"));

    const slugs = async (service: typeof morning.service) => (await service.feed()).map((clip) => clip.slug);

    expect(await slugs(evening.service)).toEqual(await slugs(morning.service));
  });

  it("gives at most 50 clips, and asks for the makers of those only", async () => {
    const games = Array.from({ length: 60 }, (_, index) => listed(`g${String(index)}`, 20 + index));
    const { service, asked } = depsFor(games);

    const clips = await service.feed();

    expect(clips).toHaveLength(FEED_MAX);
    expect(FEED_MAX).toBe(50);
    expect(asked.makerIds[0]).toHaveLength(50);
  });
});
