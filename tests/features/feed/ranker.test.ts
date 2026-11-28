import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ListedGame } from "../../../src/features/games/games.ts";
import type { RankedPage, Ranker, RankRequest } from "../../../src/features/feed/ranker.ts";
import {
  createFeedService,
  packPlays,
  PLAYS_KEPT_MS,
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
  caughtUpAt: 1,
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

describe("Good pick?", () => {
  const FULL = { kind: "full", id: "viewer-1" } as const;
  const ASKS = { ...PRIVATE_PAGE, ask: { index: 0, gameId: "id-a" } };

  function asking(before: string[] = []) {
    const notes: string[] = [];
    const asked = new Set(before);
    return {
      notes,
      asking: (userId: string, gameId: string) => {
        notes.push(`${userId}:${gameId}`);
        const fresh = !asked.has(gameId);
        asked.add(gameId);
        return Promise.resolve(fresh);
      },
    };
  }

  it("shows a full viewer the card on the clip the ranker names, about the game it names, and notes it once", async () => {
    const { ranker } = stubRanker(() => Promise.resolve(ASKS));
    const kept = asking();
    const { service } = serviceWith({ privateRanker: () => ranker, asking: kept.asking });

    expect((await service.page(null, FULL)).ask).toEqual({ key: "k1", slug: "a", name: "Game a" });
    expect(kept.notes).toEqual(["viewer-1:id-a"]);
    // Asked before: the card is left out.
    expect((await service.page(null, FULL)).ask).toBeUndefined();
  });

  it("asks nobody in the crowd, and notes nothing", async () => {
    const { ranker } = stubRanker(() => Promise.resolve(ASKS));
    const kept = asking();
    const { service } = serviceWith({ privateRanker: () => ranker, asking: kept.asking });

    expect((await service.page(null)).ask).toBeUndefined();
    expect(kept.notes).toEqual([]);
  });

  it("leaves the card out when its clip or its game is not shown", async () => {
    const kept = asking();
    for (const ask of [
      { index: 1, gameId: "id-a" },
      { index: 0, gameId: "id-gone" },
      { index: 9, gameId: "id-a" },
    ]) {
      const { ranker } = stubRanker(() => Promise.resolve({ ...PRIVATE_PAGE, ask }));
      const { service } = serviceWith({ privateRanker: () => ranker, asking: kept.asking });
      expect((await service.page(null, FULL)).ask).toBeUndefined();
    }
    expect(kept.notes).toEqual([]);
  });
});

describe("the feed through a ranker", () => {
  it("turns the ranker's ids into clips, marks where the person is caught up, and leaves out a game no longer live", async () => {
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
      maker: { handle: "h-maker-c", name: "maker-c", photo: null, following: false, mine: false },
      marks: { likes: 0, liked: false, saved: false, reposted: false },
    });
    expect(page.next).toBe("p.private-cursor");
    // Caught up at the second item, which is no longer live: the line goes on the next clip shown.
    expect(page.caughtUp).toBe("k3");
    // The crowd is never asked Good pick: nothing about them is kept (learned feed spec D4).
    expect(page.ask).toBeUndefined();
    expect(lines).toEqual([]);
  });

  it("says nothing of being caught up when the ranker does not, or when nothing shown is left after that point", async () => {
    for (const caughtUpAt of [null, 3]) {
      const { ranker } = stubRanker(() => Promise.resolve({ ...PRIVATE_PAGE, caughtUpAt }));
      const { service } = serviceWith({ privateRanker: () => ranker });
      expect((await service.page(null)).caughtUp).toBeUndefined();
    }
    // Caught up at the very first item: the line is on the first clip.
    const { ranker } = stubRanker(() => Promise.resolve({ ...PRIVATE_PAGE, caughtUpAt: 0 }));
    const { service } = serviceWith({ privateRanker: () => ranker });
    expect((await service.page(null)).caughtUp).toBe("k1");
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

  it("hands the private ranker who played what over FEED_PUBLIC's window, for the live games it may show", async () => {
    const { ranker, asked } = stubRanker(() => Promise.resolve(PRIVATE_PAGE));
    const adults = { ...listed("adults", 1), ageRating: "age_18" as const };
    const read: { since: Date; now: Date; gameIds: readonly string[] }[] = [];
    const day = { userId: "u1", gameId: "id-a", day: "2026-11-20", beats: 12, basis: "member" as const };
    const { service } = serviceWith(
      {
        privateRanker: () => ranker,
        windowDays: () => 30,
        playDays: (since, now, gameIds) => {
          read.push({ since, now, gameIds });
          return Promise.resolve([day]);
        },
      },
      [...GAMES, adults],
    );

    await service.page(null);

    expect(read).toEqual([
      { since: new Date(NOW - 30 * DAY), now: new Date(NOW), gameIds: GAMES.map((game) => game.id) },
    ]);
    // id-a is the first game; the person is 1, since the crowd viewer is nobody; 2026-11-20 is a day before today.
    expect(asked[0]?.facts.plays).toEqual({ since: NOW - 30 * DAY, rows: [0, 1, 1, 12, 1] });
  });

  it("sends play as numbers only, the viewer 0 and everyone else by a number that names nobody", () => {
    const rows = [
      { userId: "zed", gameId: "id-b", day: "2026-11-21", beats: 3, basis: "free_game" as const },
      { userId: "viewer-1", gameId: "id-a", day: "2026-11-19", beats: 7, basis: "member" as const },
      { userId: "amy", gameId: "id-c", day: "2026-11-21", beats: 1, basis: "member" as const },
      { userId: "amy", gameId: "id-gone", day: "2026-11-21", beats: 1, basis: "member" as const },
    ];
    const packed = packPlays(rows, ["id-a", "id-b", "id-c"], "viewer-1", NOW - 30 * DAY, NOW);
    expect(packed).toEqual({ since: NOW - 30 * DAY, rows: [1, 2, 0, 3, 0, 0, 0, 2, 7, 1, 2, 1, 0, 1, 1] });
    expect(JSON.stringify(packed)).not.toMatch(/zed|amy|viewer-1/);
  });

  it("reads who played what once in five minutes, and again after a read that failed", async () => {
    const { ranker } = stubRanker(() => Promise.resolve(PRIVATE_PAGE));
    const clock = new TestClock(START);
    let reads = 0;
    let fail = false;
    const { service } = serviceWith({
      clock,
      privateRanker: () => ranker,
      playDays: () => {
        reads += 1;
        return fail ? Promise.reject(new Error("database gone")) : Promise.resolve([]);
      },
    });

    await service.page(null);
    clock.advance(PLAYS_KEPT_MS / 2);
    await service.page(null);
    expect(reads).toBe(1);
    clock.advance(PLAYS_KEPT_MS);
    fail = true;
    await service.page(null);
    fail = false;
    await service.page(null);
    expect(reads).toBe(3);
  });

  it("gives the page the open order, with nothing of who played what, when the play read fails", async () => {
    const { ranker, asked } = stubRanker(() => Promise.resolve(PRIVATE_PAGE));
    const opened: RankRequest[] = [];
    const { service, lines } = serviceWith({
      privateRanker: () => ranker,
      playDays: () => Promise.reject(new Error("database gone")),
      openRanker: {
        page: (request) => {
          opened.push(request);
          return Promise.resolve({ items: [], next: "x", caughtUpAt: null, ask: null });
        },
        notes: () => Promise.resolve({}),
        health: () => Promise.resolve("defaults"),
      },
    });

    const page = await service.page(null);

    expect(asked).toHaveLength(0);
    expect(opened[0]?.facts.plays).toBeUndefined();
    expect(page.next).toBe("o.x");
    expect(lines).toEqual(["feed: the play read failed; the open order was used."]);
  });

  it("never hands who played what to the open order when the private ranker does not answer", async () => {
    const { ranker } = stubRanker(() => Promise.reject(new Error("down")));
    const opened: RankRequest[] = [];
    const { service } = serviceWith({
      privateRanker: () => ranker,
      playDays: () =>
        Promise.resolve([
          { userId: "u1", gameId: "id-a", day: "2026-11-20", beats: 1, basis: "member" as const },
        ]),
      openRanker: {
        page: (request) => {
          opened.push(request);
          return Promise.resolve({ items: [], next: "x", caughtUpAt: null, ask: null });
        },
        notes: () => Promise.resolve({}),
        health: () => Promise.resolve("defaults"),
      },
    });

    await service.page(null);

    expect(opened).toHaveLength(1);
    expect(opened[0]?.facts.plays).toBeUndefined();
  });

  it("does not read who played what when only the open ranker answers, which never uses it", async () => {
    let reads = 0;
    const { service } = serviceWith({
      playDays: () => {
        reads += 1;
        return Promise.resolve([]);
      },
    });

    await service.page(null);

    expect(reads).toBe(0);
  });

  // Who the page is for (to mark the makers they follow) is not who the ranker is told: without the cookie yes the
  // ranker only ever sees the crowd (maker-credit-and-follow spec).
  it("marks a signed-in person's follows and own games while the ranker is still told the crowd", async () => {
    const { ranker, asked } = stubRanker(() => Promise.resolve(PRIVATE_PAGE));
    const { service } = serviceWith({
      privateRanker: () => ranker,
      followedAmong: (_followerId, makerIds) =>
        Promise.resolve(new Set(makerIds.filter((id) => id === "maker-c"))),
    });

    const page = await service.page(null, undefined, "maker-a");

    expect(asked.map((request) => request.viewer)).toEqual([{ kind: "crowd", seed: "2026-11-21" }]);
    expect(page.clips.map((clip) => [clip.slug, clip.maker?.following, clip.maker?.mine])).toEqual([
      ["c", true, false],
      ["a", false, true],
    ]);
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

describe("the feed's health, for /healthz/feed", () => {
  const healthOf = (answer: () => Promise<unknown>) =>
    ({
      page: () => Promise.resolve(PRIVATE_PAGE),
      notes: () => Promise.resolve({}),
      health: answer,
    }) as unknown as Ranker;

  it("with no private ranker bound, is the open order on its defaults, with no line", async () => {
    const { service, lines } = serviceWith({ privateRanker: () => null });
    expect(await service.health()).toEqual({ ranker: "open", health: "defaults" });
    expect(lines).toEqual([]);
  });

  it("is what the private ranker says of itself, when it answers", async () => {
    for (const health of ["private", "partial", "defaults"] as const) {
      const { service, lines } = serviceWith({
        privateRanker: () => healthOf(() => Promise.resolve(health)),
      });
      expect(await service.health()).toEqual({ ranker: "private", health });
      expect(lines).toEqual([]);
    }
  });

  it("is the open order, with one line saying why, when the private ranker throws or answers nonsense", async () => {
    for (const [answer, why] of [
      [() => Promise.reject(new Error("user-1 broke")), "threw"],
      [() => Promise.resolve("fine"), "bad answer"],
    ] as const) {
      const { service, lines } = serviceWith({ privateRanker: () => healthOf(answer) });
      expect(await service.health()).toEqual({ ranker: "open", health: "defaults" });
      expect(lines).toEqual([`feed: the private ranker did not answer its health (${why}).`]);
    }
  });

  it(`is the open order when the private ranker takes longer than ${String(PRIVATE_WAIT_MS)} ms`, async () => {
    vi.useFakeTimers();
    const late = () =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve("private");
        }, PRIVATE_WAIT_MS + 1);
      });
    const { service, lines } = serviceWith({ privateRanker: () => healthOf(late) });

    const pending = service.health();
    await vi.advanceTimersByTimeAsync(PRIVATE_WAIT_MS + 1);
    const health = await pending;

    vi.useRealTimers();
    expect(health).toEqual({ ranker: "open", health: "defaults" });
    expect(lines).toEqual(["feed: the private ranker did not answer its health (slow)."]);
  });
});
