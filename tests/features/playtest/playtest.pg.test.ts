import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPublicId } from "../../../src/features/games/ids.ts";
import type { ListedGame } from "../../../src/features/games/games.ts";
import { LAUNCH_MS } from "../../../src/features/launch/launch.ts";
import { NO_LOOK, type PlaytestLook } from "../../../src/features/playtest/look.ts";
import { createPlaytest, type Playtest } from "../../../src/features/playtest/service.ts";
import { canSend, friendPagesOf } from "../../../src/features/sends/who.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// Playtesting (playtesting spec): the state table. Every state a person and a game can be in is seeded, every action is
// run on it, with the switch on and with it off, and each cell's result is checked: the row's fields afterwards, and
// what the person then sees on the game's page and in the feed.

let database: TestDatabase | undefined;
const clock = new TestClock("2026-11-28T12:00:00Z");
const BEFORE = LAUNCH_MS - 86_400_000;
const AFTER = LAUNCH_MS + 86_400_000;
let playtest: Playtest;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  playtest = createPlaytest({
    db: db(),
    clock,
    liveGames: async () =>
      (
        await db().game.findMany({
          where: { state: "live", livePullId: { not: null } },
          select: { id: true, slug: true, name: true, ageRating: true, publicId: true, makerUserId: true },
        })
      ).map(
        (game) =>
          ({
            ...game,
            clips: {
              upright: `https://media.test/clips/${game.publicId}/upright-0000000000000000.mp4`,
              wide: "",
            },
          }) as unknown as ListedGame,
      ),
    makersOf: async (userIds) =>
      new Map(
        (
          await db().makerPage.findMany({
            where: { userId: { in: [...userIds] } },
            select: { userId: true, handle: true, name: true, photoKey: true },
          })
        ).map(({ userId, ...page }) => [userId, page] as const),
      ),
    media: (key) => `https://media.test/${key}`,
    canSend: (fromId, toId) => canSend(db(), fromId, toId),
    friendsOf: async (userId) =>
      (await friendPagesOf(db(), userId, 8)).map((page) => ({
        handle: page.handle,
        name: page.name,
        photo: null,
      })),
  });
});

afterAll(async () => {
  await database?.stop();
});

let made = 0;

async function person(): Promise<{ id: string; handle: string }> {
  made += 1;
  const id = await createUser(db());
  const handle = `tester-${String(made)}`;
  await db().makerPage.create({ data: { userId: id, handle, name: `Tester ${String(made)}` } });
  return { id, handle };
}

async function befriend(a: string, b: string): Promise<void> {
  const at = new Date(clock.epochMs());
  await db().makerFollow.createMany({
    data: [
      { followerId: a, makerId: b, followedAt: at },
      { followerId: b, makerId: a, followedAt: at },
    ],
  });
}

async function setLive(gameId: string, live: boolean): Promise<void> {
  if (live) {
    const pull = await db().gamePull.create({
      data: {
        id: crypto.randomUUID(),
        gameId,
        commitSha: "a".repeat(40),
        fileCount: 1,
        totalBytes: 10n,
        connectHosts: [],
        pulledAt: new Date(clock.epochMs()),
      },
    });
    await db().game.update({ where: { id: gameId }, data: { state: "live", livePullId: pull.id } });
  } else {
    await db().game.update({ where: { id: gameId }, data: { state: "taken_off", livePullId: null } });
  }
}

/** A live game by a new maker, with asking on or off. */
async function game(
  asking: boolean,
  ageRating: "age_12" | "age_18" = "age_12",
): Promise<{ id: string; slug: string; maker: { id: string; handle: string } }> {
  made += 1;
  const maker = await person();
  const row = await db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `playtest-${String(made)}`,
      makerUserId: maker.id,
      name: `Game ${String(made)}`,
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
      ageRating,
      contentMarks: ageRating === "age_18" ? ["gore"] : [],
      playtestAsking: asking,
    },
  });
  await setLive(row.id, true);
  return { id: row.id, slug: row.slug, maker };
}

const STATES = ["none", "asked", "declined", "takenBack", "in", "removed", "maker"] as const;
type State = (typeof STATES)[number];

interface Cell {
  /** The person's row afterwards; "gone" is no row. Omitted: unchanged. */
  state?: "asked" | "in" | "declined" | "removed" | "gone";
  via?: "ask" | "invite" | "link";
  takenBack?: boolean;
  notice?: boolean;
  noticeGone?: boolean;
  seen?: boolean;
}

const T0 = new Date("2026-11-27T09:00:00Z");

/** Seeds P's row for a state; for "maker", P is the game's maker. */
async function seed(state: State, asking: boolean, ageRating: "age_12" | "age_18" = "age_12") {
  const g = await game(asking, ageRating);
  const p = state === "maker" ? g.maker : await person();
  if (state !== "maker") await befriend(g.maker.id, p.id);
  const base = { gameId: g.id, userId: p.id, via: "ask" as const, askedAt: T0 };
  if (state === "asked") await db().playtester.create({ data: { ...base, state: "asked" } });
  if (state === "declined")
    await db().playtester.create({ data: { ...base, state: "declined", decidedAt: T0 } });
  if (state === "takenBack")
    await db().playtester.create({ data: { ...base, state: "declined", decidedAt: T0, takenBackAt: T0 } });
  if (state === "in")
    await db().playtester.create({ data: { ...base, state: "in", decidedAt: T0, noticeAt: T0 } });
  if (state === "removed")
    await db().playtester.create({
      data: { ...base, state: "removed", decidedAt: T0, noticeAt: T0, noticeGoneAt: T0 },
    });
  return { g, p };
}

function rowOf(gameId: string, userId: string) {
  return db().playtester.findUnique({ where: { gameId_userId: { gameId, userId } } });
}

async function rowId(gameId: string, userId: string): Promise<string> {
  return (await rowOf(gameId, userId))?.id ?? "no-such-row";
}

type Action = (
  g: Awaited<ReturnType<typeof seed>>["g"],
  p: { id: string; handle: string },
) => Promise<unknown>;

const yes = () => Promise.resolve(true);

const ACTIONS: Record<string, Action> = {
  ask: (g, p) => playtest.ask(p.id, g.slug, BEFORE, yes),
  takeBack: (g, p) => playtest.takeBack(p.id, g.slug, BEFORE),
  yes: async (g, p) => playtest.answer(g.maker.id, g.slug, await rowId(g.id, p.id), true, BEFORE),
  no: async (g, p) => playtest.answer(g.maker.id, g.slug, await rowId(g.id, p.id), false, BEFORE),
  invite: (g, p) => playtest.invite(g.maker.id, g.slug, p.handle, BEFORE),
  link: async (g, p) => {
    const token = await playtest.linkFor(g.maker.id, g.slug, BEFORE);
    return playtest.openLink(p.id, token ?? "", BEFORE, yes);
  },
  remove: async (g, p) => playtest.remove(g.maker.id, g.slug, await rowId(g.id, p.id), BEFORE),
  hide: async (g, p) => playtest.hide(p.id, await rowId(g.id, p.id)),
  seen: (_g, p) => playtest.markSeen(p.id, yes, BEFORE),
};

/** Each action's cell in each state, with the switch on; `off` overrides a cell with the switch off. */
const TABLE: Record<string, { on: Partial<Record<State, Cell>>; off?: Partial<Record<State, Cell>> }> = {
  ask: {
    on: { none: { state: "asked", via: "ask" }, takenBack: { state: "declined", takenBack: false } },
    off: {},
  },
  takeBack: { on: { asked: { state: "gone" }, declined: { state: "declined", takenBack: true } } },
  yes: { on: { asked: { state: "in", via: "ask", notice: true } } },
  no: { on: { asked: { state: "declined" } } },
  invite: {
    on: {
      none: { state: "in", via: "invite", notice: true },
      asked: { state: "in", via: "invite", notice: true },
      declined: { state: "in", via: "invite", notice: true },
      takenBack: { state: "in", via: "invite", takenBack: false, notice: true },
      removed: { state: "in", via: "invite", noticeGone: false, notice: true },
    },
  },
  link: {
    on: {
      none: { state: "in", via: "link", notice: false },
      asked: { state: "in", via: "link", notice: false },
    },
  },
  remove: { on: { in: { state: "removed", noticeGone: true } } },
  hide: { on: { in: { state: "in", noticeGone: true } } },
  seen: { on: { in: { seen: true } } },
};

/** What P sees, by state, with the switch on and off. */
const LOOKS: Record<"on" | "off", Record<State, PlaytestLook>> = {
  on: {
    none: { badge: true, action: "ask" },
    asked: { badge: true, action: "asked" },
    declined: { badge: true, action: "asked" },
    takenBack: { badge: true, action: "ask" },
    in: { badge: false, action: "play" },
    removed: NO_LOOK,
    maker: NO_LOOK,
  },
  off: {
    none: NO_LOOK,
    asked: { badge: false, action: "asked" },
    declined: { badge: false, action: "asked" },
    takenBack: NO_LOOK,
    in: { badge: false, action: "play" },
    removed: NO_LOOK,
    maker: NO_LOOK,
  },
};

function check(
  before: Awaited<ReturnType<typeof rowOf>>,
  after: Awaited<ReturnType<typeof rowOf>>,
  cell: Cell,
) {
  if (cell.state === "gone") {
    expect(after).toBeNull();
    return;
  }
  if (before === null && cell.state === undefined) {
    expect(after).toBeNull();
    return;
  }
  expect(after).not.toBeNull();
  if (after === null) return;
  expect(after.state).toBe(cell.state ?? before?.state);
  expect(after.via).toBe(cell.via ?? before?.via);
  expect(after.takenBackAt !== null).toBe(cell.takenBack ?? before?.takenBackAt != null);
  expect(after.noticeAt !== null).toBe(cell.notice ?? before?.noticeAt != null);
  expect(after.noticeGoneAt !== null).toBe(cell.noticeGone ?? before?.noticeGoneAt != null);
  expect(after.noticeSeenAt !== null).toBe(cell.seen ?? before?.noticeSeenAt != null);
}

describe("the state table", () => {
  for (const asking of [true, false]) {
    const way = asking ? "on" : "off";
    for (const [name, action] of Object.entries(ACTIONS)) {
      for (const state of STATES) {
        it(`${name} on ${state}, switch ${way}`, async () => {
          const { g, p } = await seed(state, asking);
          const before = await rowOf(g.id, p.id);
          await action(g, p);
          const after = await rowOf(g.id, p.id);
          const cells = TABLE[name] ?? { on: {} };
          const cell = (asking ? cells.on[state] : (cells.off ?? cells.on)[state]) ?? {};
          check(before, after, cell);
        });
      }
    }

    for (const state of STATES) {
      it(`what P sees on ${state}, switch ${way}, on the game's page and in the feed`, async () => {
        const { g, p } = await seed(state, asking);
        const look = LOOKS[way][state];
        expect(await playtest.viewOf(g.slug, p.id, BEFORE)).toEqual(look);
        const feed = await playtest.feedStateFor(p.id, BEFORE);
        expect(feed.badge.includes(g.slug)).toBe(look.badge);
        expect(feed.play.includes(g.slug)).toBe(look.action === "play");
      });
    }
  }

  it("someone signed out sees the badge and Ask only with the switch on", async () => {
    const on = await game(true);
    const off = await game(false);
    expect(await playtest.viewOf(on.slug, null, BEFORE)).toEqual({ badge: true, action: "ask" });
    expect(await playtest.viewOf(off.slug, null, BEFORE)).toEqual(NO_LOOK);
    const feed = await playtest.feedStateFor(null, BEFORE);
    expect(feed.badge).toContain(on.slug);
    expect(feed.badge).not.toContain(off.slug);
  });
});

describe("launch", () => {
  it("ends playtesting: nothing shows, nothing plays as a playtester, and no action changes a field", async () => {
    const { g, p } = await seed("in", true);
    const other = await person();
    await befriend(g.maker.id, other.id);
    expect(await playtest.viewOf(g.slug, p.id, AFTER)).toEqual(NO_LOOK);
    expect(await playtest.feedStateFor(p.id, AFTER)).toEqual({ badge: [], play: [] });
    expect(await playtest.isPlaytester(g.id, p.id, AFTER)).toBe(false);
    expect(await playtest.isPlaytester(g.id, p.id, BEFORE)).toBe(true);
    expect(await playtest.noticesOf(p.id, yes, AFTER)).toEqual([]);
    expect(await playtest.hasNew(p.id, yes, AFTER)).toBe(false);
    expect(await playtest.pageFor(g.maker.id, g.slug, AFTER)).toBeNull();
    const id = await rowId(g.id, p.id);
    expect(await playtest.ask(other.id, g.slug, AFTER, yes)).toBe("refused");
    expect(await playtest.invite(g.maker.id, g.slug, other.handle, AFTER)).toBe("refused");
    expect(await playtest.remove(g.maker.id, g.slug, id, AFTER)).toBe(false);
    expect(await playtest.setAsking(g.maker.id, g.slug, false, AFTER)).toBe(false);
    expect(await playtest.linkFor(g.maker.id, g.slug, AFTER)).toBeNull();
    expect(await db().playtester.count({ where: { gameId: g.id } })).toBe(1);
    expect((await rowOf(g.id, p.id))?.state).toBe("in");
  });
});

describe("a game that is not live", () => {
  it("changes nothing for any action, and its rows show and work again once it is live", async () => {
    const { g, p } = await seed("in", true);
    const asker = await person();
    await befriend(g.maker.id, asker.id);
    const token = await playtest.linkFor(g.maker.id, g.slug, BEFORE);
    await setLive(g.id, false);

    expect(await playtest.ask(asker.id, g.slug, BEFORE, yes)).toBe("refused");
    expect(await playtest.invite(g.maker.id, g.slug, asker.handle, BEFORE)).toBe("refused");
    expect(await playtest.remove(g.maker.id, g.slug, await rowId(g.id, p.id), BEFORE)).toBe(false);
    expect(await playtest.pageFor(g.maker.id, g.slug, BEFORE)).toBeNull();
    await playtest.openLink(asker.id, token ?? "", BEFORE, yes);
    expect(await db().playtester.count({ where: { gameId: g.id } })).toBe(1);
    expect(await playtest.isPlaytester(g.id, p.id, BEFORE)).toBe(false);
    expect(await playtest.noticesOf(p.id, yes, BEFORE)).toEqual([]);

    await setLive(g.id, true);
    expect(await playtest.isPlaytester(g.id, p.id, BEFORE)).toBe(true);
    expect((await playtest.noticesOf(p.id, yes, BEFORE)).map((row) => row.slug)).toEqual([g.slug]);
    expect(await playtest.ask(asker.id, g.slug, BEFORE, yes)).toBe("asked");
  });
});

describe("in order", () => {
  it("a no sticks: declined, take back, ask leaves one declined row and nothing in Asking", async () => {
    const { g, p } = await seed("declined", true);
    await playtest.takeBack(p.id, g.slug, BEFORE);
    expect(await playtest.viewOf(g.slug, p.id, BEFORE)).toEqual({ badge: true, action: "ask" });
    await playtest.ask(p.id, g.slug, BEFORE, yes);
    expect(await playtest.viewOf(g.slug, p.id, BEFORE)).toEqual({ badge: true, action: "asked" });
    expect(await db().playtester.findMany({ where: { gameId: g.id }, select: { state: true } })).toEqual([
      { state: "declined" },
    ]);
    expect((await playtest.pageFor(g.maker.id, g.slug, BEFORE))?.waiting).toEqual([]);
  });

  it("yes, seen, remove, then invite brings the row back at its old time with the dot off", async () => {
    const { g, p } = await seed("asked", true);
    await playtest.answer(g.maker.id, g.slug, await rowId(g.id, p.id), true, BEFORE);
    const first = (await playtest.noticesOf(p.id, yes, BEFORE))[0];
    expect(first?.kind).toBe("let");
    expect(await playtest.hasNew(p.id, yes, BEFORE)).toBe(true);
    await playtest.markSeen(p.id, yes, BEFORE);
    expect(await playtest.hasNew(p.id, yes, BEFORE)).toBe(false);
    await playtest.remove(g.maker.id, g.slug, await rowId(g.id, p.id), BEFORE);
    expect(await playtest.noticesOf(p.id, yes, BEFORE)).toEqual([]);
    clock.advance(60_000);
    await playtest.invite(g.maker.id, g.slug, p.handle, BEFORE);
    const back = await playtest.noticesOf(p.id, yes, BEFORE);
    expect(back.map((row) => [row.slug, row.at.getTime(), row.kind])).toEqual([
      [g.slug, first?.at.getTime(), "invited"],
    ]);
    expect(await playtest.hasNew(p.id, yes, BEFORE)).toBe(false);
  });

  it("link open, remove, then invite shows the row with the dot on", async () => {
    const { g, p } = await seed("none", true);
    const token = await playtest.linkFor(g.maker.id, g.slug, BEFORE);
    expect(await playtest.openLink(p.id, token ?? "", BEFORE, yes)).toBe(g.slug);
    expect(await playtest.noticesOf(p.id, yes, BEFORE)).toEqual([]);
    await playtest.remove(g.maker.id, g.slug, await rowId(g.id, p.id), BEFORE);
    await playtest.invite(g.maker.id, g.slug, p.handle, BEFORE);
    expect((await playtest.noticesOf(p.id, yes, BEFORE)).map((row) => row.slug)).toEqual([g.slug]);
    expect(await playtest.hasNew(p.id, yes, BEFORE)).toBe(true);
  });

  it("the link stays the same until a new one is made, after which the old one does nothing", async () => {
    const { g, p } = await seed("none", true);
    const first = await playtest.linkFor(g.maker.id, g.slug, BEFORE);
    expect(await playtest.linkFor(g.maker.id, g.slug, BEFORE)).toBe(first);
    const second = await playtest.newLink(g.maker.id, g.slug, BEFORE);
    expect(second).not.toBe(first);
    expect(await playtest.openLink(p.id, first ?? "", BEFORE, yes)).toBeNull();
    expect(await rowOf(g.id, p.id)).toBeNull();
    expect(await playtest.openLink(p.id, second ?? "", BEFORE, yes)).toBe(g.slug);
    expect((await rowOf(g.id, p.id))?.state).toBe("in");
  });

  it("the Playtesters page lists asks and players, with Since or Invited, and ticks friends already playing", async () => {
    const { g, p } = await seed("asked", true);
    const friend = await person();
    await befriend(g.maker.id, friend.id);
    await playtest.invite(g.maker.id, g.slug, friend.handle, BEFORE);
    const page = await playtest.pageFor(g.maker.id, g.slug, BEFORE);
    expect(page?.waiting.map((one) => one.id)).toEqual([await rowId(g.id, p.id)]);
    expect(page?.playing.map((one) => [one.id, one.invited])).toEqual([[await rowId(g.id, friend.id), true]]);
    const faces = await playtest.inviteFaces(g.maker.id, g.slug);
    expect(faces.find((face) => face.handle === friend.handle)?.invited).toBe(true);
    expect(faces.find((face) => face.handle === p.handle)?.invited).toBe(false);
  });
});

describe("who may change what", () => {
  it("only the maker manages, nobody asks for their own game, and an invite to a non-friend is refused", async () => {
    const { g, p } = await seed("asked", true);
    const stranger = await person();
    const id = await rowId(g.id, p.id);
    expect(await playtest.pageFor(stranger.id, g.slug, BEFORE)).toBeNull();
    expect(await playtest.answer(stranger.id, g.slug, id, true, BEFORE)).toBe(false);
    expect(await playtest.remove(stranger.id, g.slug, id, BEFORE)).toBe(false);
    expect(await playtest.setAsking(stranger.id, g.slug, false, BEFORE)).toBe(false);
    expect(await playtest.linkFor(stranger.id, g.slug, BEFORE)).toBeNull();
    expect(await playtest.invite(stranger.id, g.slug, p.handle, BEFORE)).toBe("refused");
    expect(await playtest.ask(g.maker.id, g.slug, BEFORE, yes)).toBe("refused");
    expect(await playtest.invite(g.maker.id, g.slug, stranger.handle, BEFORE)).toBe("refused");
    await playtest.takeBack(stranger.id, g.slug, BEFORE);
    expect(await playtest.hide(stranger.id, id)).toBe("not found");
    expect((await rowOf(g.id, p.id))?.state).toBe("asked");
    expect(await db().playtester.count({ where: { gameId: g.id } })).toBe(1);
    expect((await db().game.findUniqueOrThrow({ where: { id: g.id } })).playtestAsking).toBe(true);
  });

  it("an answer for one game's row given through another game changes nothing", async () => {
    const { g, p } = await seed("asked", true);
    const mine = await game(true);
    expect(await playtest.answer(mine.maker.id, mine.slug, await rowId(g.id, p.id), true, BEFORE)).toBe(true);
    expect((await rowOf(g.id, p.id))?.state).toBe("asked");
  });
});

describe("an 18+ game", () => {
  const no = () => Promise.resolve(false);

  it("an ask or a link from someone not known to be 18 changes nothing", async () => {
    const { g, p } = await seed("none", true, "age_18");
    expect(await playtest.ask(p.id, g.slug, BEFORE, no)).toBe("refused");
    const token = await playtest.linkFor(g.maker.id, g.slug, BEFORE);
    await playtest.openLink(p.id, token ?? "", BEFORE, no);
    expect(await rowOf(g.id, p.id)).toBeNull();
  });

  it("an invite is made as for anyone, and hidden on the friend's side", async () => {
    const { g, p } = await seed("none", true, "age_18");
    expect(await playtest.invite(g.maker.id, g.slug, p.handle, BEFORE)).toBe("invited");
    expect((await playtest.pageFor(g.maker.id, g.slug, BEFORE))?.playing.length).toBe(1);
    expect(await playtest.noticesOf(p.id, no, BEFORE)).toEqual([]);
    expect(await playtest.hasNew(p.id, no, BEFORE)).toBe(false);
    expect((await playtest.noticesOf(p.id, yes, BEFORE)).length).toBe(1);
  });
});

describe("two presses at once", () => {
  it("leave one row in the right state", async () => {
    const asked = await seed("asked", true);
    const id = await rowId(asked.g.id, asked.p.id);
    await Promise.all([
      playtest.answer(asked.g.maker.id, asked.g.slug, id, true, BEFORE),
      playtest.answer(asked.g.maker.id, asked.g.slug, id, false, BEFORE),
    ]);
    expect(["in", "declined"]).toContain((await rowOf(asked.g.id, asked.p.id))?.state);

    const none = await seed("none", true);
    await Promise.all([
      playtest.invite(none.g.maker.id, none.g.slug, none.p.handle, BEFORE),
      playtest.invite(none.g.maker.id, none.g.slug, none.p.handle, BEFORE),
      playtest.ask(none.p.id, none.g.slug, BEFORE, yes),
    ]);
    expect(await db().playtester.count({ where: { gameId: none.g.id } })).toBe(1);

    const playing = await seed("in", true);
    const playingId = await rowId(playing.g.id, playing.p.id);
    await Promise.all([
      playtest.remove(playing.g.maker.id, playing.g.slug, playingId, BEFORE),
      playtest.remove(playing.g.maker.id, playing.g.slug, playingId, BEFORE),
    ]);
    expect((await rowOf(playing.g.id, playing.p.id))?.state).toBe("removed");
  });
});

describe("the tables", () => {
  it("refuse an ask with no time, and a link token that is not 22 characters of base64url", async () => {
    const { g, p } = await seed("none", true);
    await expect(
      db()
        .$executeRaw`INSERT INTO "Playtester" ("id","gameId","userId","state","via") VALUES ('x1', ${g.id}, ${p.id}, 'asked', 'ask')`,
    ).rejects.toThrow(/Playtester_asked_check/);
    await expect(
      db()
        .$executeRaw`INSERT INTO "PlaytestLink" ("gameId","token","madeAt") VALUES (${g.id}, 'short', now())`,
    ).rejects.toThrow(/PlaytestLink_token_check/);
  });
});
