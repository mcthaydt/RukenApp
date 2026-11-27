import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ListedGame } from "../../../src/features/games/games.ts";
import type { RankedPage, Ranker, RankRequest } from "../../../src/features/feed/ranker.ts";
import {
  createFeedService,
  PRIVATE_WAIT_MS,
  type FeedPage,
  type FeedServiceDeps,
} from "../../../src/features/feed/service.ts";
import { TestClock } from "../../support/test-clock.ts";
import { worlds } from "./worlds.ts";

const START = "2026-11-21T15:00:00Z";
const NOW = Date.parse(START);
const DAY = 86_400_000;

function listed(slug: string, daysAgo: number): ListedGame {
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
  };
}

const GAMES = [listed("a", 20), listed("b", 21), listed("c", 22)];

/** A ranker that answers what it is told to, and remembers every request. */
function stubRanker(answer: (request: RankRequest) => Promise<unknown>) {
  const asked: RankRequest[] = [];
  const ranker = {
    page: (request: RankRequest) => {
      asked.push(request);
      return answer(request);
    },
    notes: () => Promise.resolve({}),
    health: () => Promise.resolve("private"),
  } as unknown as Ranker;
  return { ranker, asked };
}

function serviceWith(extra: Partial<FeedServiceDeps>, games = GAMES) {
  const lines: string[] = [];
  const service = createFeedService({
    clock: new TestClock(START),
    liveGames: () => Promise.resolve(games),
    memberBeatsByGame: () => Promise.resolve(new Map([["id-b", 40]])),
    makersOf: (ids) =>
      Promise.resolve(new Map(ids.map((id) => [id, { handle: `h-${id}`, name: id, photoKey: null }]))),
    media: (key) => `https://media.test/${key}`,
    log: (line) => lines.push(line),
    ...extra,
  });
  return { service, lines };
}

const PRIVATE_PAGE: RankedPage = {
  items: [
    { gameId: "id-c", slot: 0, key: "k1" },
    { gameId: "id-gone", slot: 0, key: "k2" },
    { gameId: "id-a", slot: 0, key: "k3" },
  ],
  next: "private-cursor",
  caughtUpAt: NOW - 1000,
  ask: { index: 1, gameId: "id-a" },
};

describe("the open ranker gives the feed #329 shipped (old against new)", () => {
  const pages = JSON.parse(readFileSync(new URL("./feed-329-pages.json", import.meta.url), "utf8")) as Record<
    string,
    { next: string | null; clips: [string, string, string, string | null][] }[]
  >;

  for (const world of worlds()) {
    it(`world ${world.name}: the same clips, keys and next pages, each next with its o. prefix`, async () => {
      const service = createFeedService(world.deps);
      const expected = pages[world.name] ?? [];
      expect(expected.length).toBeGreaterThan(0);
      let page: FeedPage | null = await service.page(null);
      for (const [index, want] of expected.entries()) {
        if (page === null) throw new Error(`page ${String(index)} is missing`);
        expect(
          page.clips.map((clip) => [clip.key, clip.slug, clip.upright, clip.maker?.handle ?? null]),
        ).toEqual(want.clips);
        expect(page.next).toBe(want.next === null ? null : `o.${want.next}`);
        if (page.next === null) break;
        page = await service.page(page.next);
      }
    });
  }
});

describe("the feed through a ranker", () => {
  it("turns the ranker's ids into clips, passes caughtUpAt and ask, and leaves out a game no longer live", async () => {
    const { ranker } = stubRanker(() => Promise.resolve(PRIVATE_PAGE));
    const { service, lines } = serviceWith({ privateRanker: () => ranker });

    const page = await service.page(null);

    expect(page.clips.map((clip) => [clip.key, clip.slug])).toEqual([
      ["k1", "c"],
      ["k3", "a"],
    ]);
    expect(page.clips[0]).toEqual({
      key: "k1",
      slug: "c",
      name: "Game c",
      oneLine: "About c.",
      upright: "https://media.test/clips/c-up.mp4",
      wide: "https://media.test/clips/c-wide.mp4",
      maker: { handle: "h-maker-c", name: "maker-c", photo: null },
      marks: { likes: 0, liked: false, saved: false, reposted: false, own: false },
    });
    expect(page.next).toBe("p.private-cursor");
    expect(page.caughtUpAt).toBe(NOW - 1000);
    expect(page.ask).toEqual({ index: 1, gameId: "id-a" });
    expect(lines).toEqual([]);
  });

  it("hands the ranker plain facts: the live games under 18+, the week's member beats, the time and the crowd", async () => {
    const { ranker, asked } = stubRanker(() => Promise.resolve(PRIVATE_PAGE));
    const adults = { ...listed("adults", 1), ageRating: "age_18" as const };
    const { service } = serviceWith({ privateRanker: () => ranker }, [...GAMES, adults]);

    await service.page(null);

    expect(asked).toHaveLength(1);
    expect(asked[0]).toEqual({
      v: 1,
      viewer: { kind: "crowd", seed: "2026-11-21" },
      after: null,
      asOf: NOW,
      facts: {
        games: GAMES.map((game) => ({
          id: game.id,
          slug: game.slug,
          makerId: game.makerUserId,
          liveSince: game.liveSince.getTime(),
          ageRating: "age_12",
          slots: 1,
        })),
        memberBeats: { "id-b": 40 },
        memberBeatsSince: NOW - 7 * DAY,
      },
    });
  });

  it("gives the private ranker back its own address, without the prefix", async () => {
    const { ranker, asked } = stubRanker(() => Promise.resolve(PRIVATE_PAGE));
    const { service } = serviceWith({ privateRanker: () => ranker });

    await service.page("p.private-cursor");

    expect(asked[0]?.after).toBe("private-cursor");
  });

  it("answers null (the route's 400) when the ranker says the address is not its own", async () => {
    const { ranker } = stubRanker(() => Promise.resolve("bad-cursor"));
    const { service, lines } = serviceWith({ privateRanker: () => ranker });

    expect(await service.page("p.nope")).toBeNull();
    expect(lines).toEqual([]);
  });

  it("answers null for an address with neither prefix, without asking a ranker", async () => {
    const { ranker, asked } = stubRanker(() => Promise.resolve(PRIVATE_PAGE));
    const { service } = serviceWith({ privateRanker: () => ranker });

    for (const bad of ["", "x", "private-cursor", "2026-11-21~1~0~0~a", "q.private-cursor"]) {
      expect(await service.page(bad)).toBeNull();
    }
    expect(asked).toEqual([]);
    expect(await serviceWith({}).service.page("2026-11-21~1~0~0~a")).toBeNull();
  });

  it("answers null for an open address the open ranker did not make", async () => {
    const { service } = serviceWith({});

    for (const bad of ["o.", "o.x", "o.2026-11-21~1", "o.2026-11-21~9999999~0"]) {
      expect(await service.page(bad)).toBeNull();
    }
  });
});

describe("when the private ranker does not answer, the open one does", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** The open ranker's first page, for the same world. */
  async function openFirst() {
    return serviceWith({}).service.page(null);
  }

  /** One line, which says why and names no viewer and no value. */
  function expectOneLine(lines: string[], why: string) {
    expect(lines).toEqual([`feed: the private ranker did not answer (${why}); the open order was used.`]);
  }

  it("when it throws", async () => {
    const { ranker } = stubRanker(() => Promise.reject(new Error("user-1 broke 42")));
    const { service, lines } = serviceWith({ privateRanker: () => ranker });

    expect(await service.page(null, { kind: "full", id: "user-1" })).toEqual(await openFirst());
    expectOneLine(lines, "threw");
  });

  it(`when it takes longer than ${String(PRIVATE_WAIT_MS)} ms`, async () => {
    vi.useFakeTimers();
    const { ranker } = stubRanker(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(PRIVATE_PAGE);
          }, PRIVATE_WAIT_MS + 1);
        }),
    );
    const { service, lines } = serviceWith({ privateRanker: () => ranker });

    const pending = service.page(null);
    await vi.advanceTimersByTimeAsync(PRIVATE_WAIT_MS + 1);
    const page = await pending;

    vi.useRealTimers();
    expect(page).toEqual(await openFirst());
    expectOneLine(lines, "slow");
  });

  it("but not when it answers just in time", async () => {
    vi.useFakeTimers();
    const { ranker } = stubRanker(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(PRIVATE_PAGE);
          }, PRIVATE_WAIT_MS - 1);
        }),
    );
    const { service, lines } = serviceWith({ privateRanker: () => ranker });

    const pending = service.page(null);
    await vi.advanceTimersByTimeAsync(PRIVATE_WAIT_MS - 1);

    expect((await pending).next).toBe("p.private-cursor");
    expect(lines).toEqual([]);
  });

  it("when its answer is not shaped right", async () => {
    const badAnswers: unknown[] = [
      null,
      "nope",
      {},
      { ...PRIVATE_PAGE, items: "x" },
      { ...PRIVATE_PAGE, items: [{ gameId: "id-a", slot: -1, key: "k" }] },
      { ...PRIVATE_PAGE, items: [{ gameId: "id-a", slot: 0, key: "" }] },
      { ...PRIVATE_PAGE, items: [{ gameId: 3, slot: 0, key: "k" }] },
      {
        ...PRIVATE_PAGE,
        items: [
          { gameId: "id-a", slot: 0, key: "k" },
          { gameId: "id-b", slot: 0, key: "k" },
        ],
      },
      {
        ...PRIVATE_PAGE,
        items: Array.from({ length: 51 }, (_, index) => ({
          gameId: "id-a",
          slot: 0,
          key: `k${String(index)}`,
        })),
      },
      { ...PRIVATE_PAGE, next: 3 },
      { ...PRIVATE_PAGE, next: "" },
      { ...PRIVATE_PAGE, caughtUpAt: "soon" },
      { ...PRIVATE_PAGE, ask: { index: "1", gameId: "id-a" } },
    ];
    for (const bad of badAnswers) {
      const { ranker } = stubRanker(() => Promise.resolve(bad));
      const { service, lines } = serviceWith({ privateRanker: () => ranker });

      expect(await service.page(null), JSON.stringify(bad)).toEqual(await openFirst());
      expectOneLine(lines, "bad answer");
    }
  });

  it("a private address while the private ranker is gone gives a fresh first page", async () => {
    const { service, lines } = serviceWith({ privateRanker: () => null });

    expect(await service.page("p.private-cursor")).toEqual(await openFirst());
    expect(lines).toEqual([]);
  });

  it("a private address while the private ranker is failing gives a fresh first page", async () => {
    const { ranker } = stubRanker(() => Promise.reject(new Error("down")));
    const { service } = serviceWith({ privateRanker: () => ranker });

    expect(await service.page("p.private-cursor")).toEqual(await openFirst());
  });

  it("while the private ranker stays down, an open address goes on in the open order: the feed still scrolls", async () => {
    const { ranker } = stubRanker(() => Promise.reject(new Error("down")));
    const { service, lines } = serviceWith({ privateRanker: () => ranker });

    const first = await service.page(null);
    const second = await service.page(first.next ?? "");
    const third = await service.page(second?.next ?? "");

    const open = serviceWith({});
    const openFirst = await open.service.page(null);
    const openSecond = await open.service.page(openFirst.next ?? "");
    expect(second).toEqual(openSecond);
    const seen = new Set(first.clips.map((clip) => clip.key));
    expect(second?.clips.length).toBeGreaterThan(0);
    for (const clip of second?.clips ?? []) expect(seen.has(clip.key)).toBe(false);
    for (const clip of second?.clips ?? []) seen.add(clip.key);
    for (const clip of third?.clips ?? []) expect(seen.has(clip.key)).toBe(false);
    expect(second?.next?.startsWith("o.")).toBe(true);
    expect(third?.next?.startsWith("o.")).toBe(true);
    expect(lines).toHaveLength(3);
  });

  it("while the private ranker is down, an open address the open ranker did not make is still a 400", async () => {
    const { ranker } = stubRanker(() => Promise.reject(new Error("down")));
    const { service } = serviceWith({ privateRanker: () => ranker });

    expect(await service.page("o.garbage")).toBeNull();
  });

  it("an open address once the private ranker is back gives the private ranker's fresh first page", async () => {
    const open = await openFirst();
    const { ranker, asked } = stubRanker(() => Promise.resolve(PRIVATE_PAGE));
    const { service } = serviceWith({ privateRanker: () => ranker });

    const page = await service.page(open.next ?? "");

    expect(asked[0]?.after).toBeNull();
    expect(page?.next).toBe("p.private-cursor");
  });

  it("an open page's own address goes on in the open order while there is no private ranker", async () => {
    const { service } = serviceWith({});

    const first = await service.page(null);
    const second = await service.page(first.next ?? "");

    expect(first.next?.startsWith("o.")).toBe(true);
    expect(second?.clips.length).toBeGreaterThan(0);
    expect(second?.next?.startsWith("o.")).toBe(true);
  });
});
