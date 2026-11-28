import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPublicId } from "../../../src/features/games/ids.ts";
import type { ListedGame } from "../../../src/features/games/games.ts";
import { STAND_IN_SEND_LIMITS, type SendLimits } from "../../../src/features/sends/limits.ts";
import { createSends, type Sends } from "../../../src/features/sends/service.ts";
import { canSend } from "../../../src/features/sends/who.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createRateLimiter } from "../../../src/lib/server/rate-limit.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// Your turn (games-sent-to-you brief): friends, people who follow each other, send each other games; each person reads,
// marks seen and removes only their own list, and may stop a sender without the sender ever knowing.

let database: TestDatabase | undefined;
const clock = new TestClock("2026-11-27T12:00:00Z");
let limits: SendLimits = STAND_IN_SEND_LIMITS;
let sends: Sends;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  sends = createSends({
    db: db(),
    clock,
    limiter: createRateLimiter(db(), clock),
    limits: () => Promise.resolve(limits),
    // The live games, as the games feature lists them, with only what Your turn reads.
    liveGames: async () =>
      (
        await db().game.findMany({
          where: { state: "live", livePullId: { not: null } },
          select: { id: true, slug: true, name: true, ageRating: true, publicId: true },
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
  });
});

afterAll(async () => {
  await database?.stop();
});

let made = 0;

/** A person with a page at an address nobody else in this file has. */
async function person(photoKey: string | null = null): Promise<{ id: string; handle: string; name: string }> {
  made += 1;
  const id = await createUser(db());
  const handle = `person-${String(made)}`;
  const name = `Person ${String(made)}`;
  await db().makerPage.create({ data: { userId: id, handle, name, photoKey } });
  return { id, handle, name };
}

async function follow(followerId: string, makerId: string): Promise<void> {
  await db().makerFollow.create({ data: { followerId, makerId, followedAt: new Date(clock.epochMs()) } });
}

async function friends(a: string, b: string): Promise<void> {
  await follow(a, b);
  await follow(b, a);
}

async function adult(id: string): Promise<void> {
  await db().user.update({ where: { id }, data: { adultOn: new Date("2014-01-01T00:00:00Z") } });
}

/** A live game by its own maker; `state` other than live makes one that is not. */
async function game(
  ageRating: "age_12" | "age_18" = "age_12",
  live = true,
): Promise<{ id: string; slug: string }> {
  made += 1;
  const makerId = await createUser(db());
  const row = await db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `sent-${String(made)}`,
      makerUserId: makerId,
      name: `Game ${String(made)}`,
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
      ageRating,
      contentMarks: ageRating === "age_18" ? ["gore"] : [],
    },
  });
  if (live) {
    const pull = await db().gamePull.create({
      data: {
        id: crypto.randomUUID(),
        gameId: row.id,
        commitSha: "a".repeat(40),
        fileCount: 1,
        totalBytes: 10n,
        connectHosts: [],
        pulledAt: new Date(clock.epochMs()),
      },
    });
    await db().game.update({ where: { id: row.id }, data: { state: "live", livePullId: pull.id } });
  }
  return { id: row.id, slug: row.slug };
}

const never = () => Promise.resolve(false);
const always = () => Promise.resolve(true);

describe("who may send to whom", () => {
  it("is only friends: each follows the other", async () => {
    const ana = await person();
    const ben = await person();
    expect(await canSend(db(), ana.id, ben.id)).toBe(false);
    await follow(ana.id, ben.id);
    expect(await canSend(db(), ana.id, ben.id)).toBe(false);
    expect(await canSend(db(), ben.id, ana.id)).toBe(false);
    await follow(ben.id, ana.id);
    expect(await canSend(db(), ana.id, ben.id)).toBe(true);
    expect(await canSend(db(), ben.id, ana.id)).toBe(true);
    expect(await canSend(db(), ana.id, ana.id)).toBe(false);
  });

  it("shows exactly the friends as faces, newest friendship first, at most 8", async () => {
    const me = await person();
    const onlyIFollow = await person();
    await follow(me.id, onlyIFollow.id);
    const onlyFollowsMe = await person();
    await follow(onlyFollowsMe.id, me.id);
    const pals: { id: string; handle: string; name: string }[] = [];
    for (let n = 0; n < 9; n += 1) {
      clock.advance(60_000);
      const pal = await person(n === 0 ? "pages/photo.webp" : null);
      await friends(me.id, pal.id);
      pals.push(pal);
    }
    // The first friendship gets newer: its second follow comes last.
    const first = pals[0];
    if (first === undefined) throw new Error("no friends made");
    clock.advance(60_000);
    await db().makerFollow.deleteMany({ where: { followerId: first.id, makerId: me.id } });
    await follow(first.id, me.id);

    const faces = await sends.friendsOf(me.id);
    expect(faces.map((face) => face.handle)).toEqual(
      [first, ...pals.slice(1).reverse()].slice(0, 8).map((pal) => pal.handle),
    );
    expect(faces[0]).toEqual({
      handle: first.handle,
      name: first.name,
      photo: "https://media.test/pages/photo.webp",
    });
    expect(faces[1]?.photo).toBeNull();
  });
});

describe("sending a game", () => {
  it("sends once, and sending again is the same row", async () => {
    const ana = await person();
    const ben = await person();
    await friends(ana.id, ben.id);
    const g = await game();
    expect(await sends.send(ana.id, g.slug, ben.handle)).toBe("sent");
    expect(await sends.send(ana.id, g.slug, ben.handle)).toBe("sent");
    expect(await db().gameSend.findMany({ where: { toId: ben.id } })).toMatchObject([
      { fromId: ana.id, gameId: g.id, seenAt: null },
    ]);
  });

  it("makes one row from two sends at the same moment", async () => {
    const ana = await person();
    const ben = await person();
    await friends(ana.id, ben.id);
    const g = await game();
    expect(
      await Promise.all([sends.send(ana.id, g.slug, ben.handle), sends.send(ana.id, g.slug, ben.handle)]),
    ).toEqual(["sent", "sent"]);
    expect(await db().gameSend.count({ where: { toId: ben.id } })).toBe(1);
  });

  it("refuses a game that is not live, an address with no page, yourself and a stranger, saving nothing", async () => {
    const ana = await person();
    const ben = await person();
    const stranger = await person();
    await friends(ana.id, ben.id);
    await follow(ana.id, stranger.id);
    const g = await game();
    const draft = await game("age_12", false);
    expect(await sends.send(ana.id, draft.slug, ben.handle)).toBe("no game");
    expect(await sends.send(ana.id, "no-such-game", ben.handle)).toBe("no game");
    expect(await sends.send(ana.id, g.slug, "nobody-here")).toBe("no person");
    expect(await sends.send(ana.id, g.slug, ana.handle)).toBe("self");
    expect(await sends.send(ana.id, g.slug, stranger.handle)).toBe("not friends");
    expect(await db().gameSend.count({ where: { fromId: ana.id } })).toBe(0);
  });

  it("refuses over the limit, saving nothing", async () => {
    const ana = await person();
    const ben = await person();
    await friends(ana.id, ben.id);
    const [one, two] = [await game(), await game()];
    limits = { rules: [{ name: "test", rule: { max: 1, windowMs: 60_000 } }] };
    try {
      expect(await sends.send(ana.id, one.slug, ben.handle)).toBe("sent");
      const over = await sends.send(ana.id, two.slug, ben.handle);
      expect(typeof over === "object" && over.limited > 0).toBe(true);
    } finally {
      limits = STAND_IN_SEND_LIMITS;
    }
    expect(await db().gameSend.count({ where: { fromId: ana.id } })).toBe(1);
  });

  it("the table refuses a send to yourself", async () => {
    const ana = await person();
    const g = await game();
    await expect(
      db().gameSend.create({ data: { fromId: ana.id, toId: ana.id, gameId: g.id, sentAt: new Date() } }),
    ).rejects.toThrow();
  });
});

describe("the list", () => {
  it("lists newest first with the sender's name, marks seen, and keeps a game after an unfollow", async () => {
    const ana = await person();
    const ben = await person();
    await friends(ana.id, ben.id);
    const [old, recent] = [await game(), await game()];
    await sends.send(ana.id, old.slug, ben.handle);
    clock.advance(60_000);
    await sends.send(ana.id, recent.slug, ben.handle);
    await db().makerFollow.deleteMany({ where: { followerId: ana.id, makerId: ben.id } });

    expect(await sends.hasNew(ben.id, never)).toBe(true);
    const list = await sends.listOf(ben.id, never);
    expect(list.map((row) => [row.slug, row.from])).toEqual([
      [recent.slug, ana.name],
      [old.slug, ana.name],
    ]);
    expect(list[0]?.still).toMatch(/^\/api\/still\/clips\/.+\?at=0&width=240$/);

    await sends.markSeen(ben.id);
    expect(await sends.hasNew(ben.id, never)).toBe(false);
    const rows = await db().gameSend.findMany({ where: { toId: ben.id } });
    expect(rows.every((row) => row.seenAt?.getTime() === clock.epochMs())).toBe(true);
    // Nobody else's list is touched, and the sender's own list holds nothing.
    expect(await sends.listOf(ana.id, always)).toEqual([]);
  });

  it("shows an 18+ game only to a known adult, and a game taken off to nobody", async () => {
    const ana = await person();
    const ben = await person();
    await friends(ana.id, ben.id);
    const grown = await game("age_18");
    const gone = await game();
    await sends.send(ana.id, grown.slug, ben.handle);
    await sends.send(ana.id, gone.slug, ben.handle);
    await db().game.update({ where: { id: gone.id }, data: { state: "thrown_away", livePullId: null } });

    expect(await sends.listOf(ben.id, never)).toEqual([]);
    expect(await sends.hasNew(ben.id, never)).toBe(false);
    await adult(ben.id);
    expect((await sends.listOf(ben.id, always)).map((row) => row.slug)).toEqual([grown.slug]);
    expect(await sends.hasNew(ben.id, always)).toBe(true);
  });

  it("removes only the receiver's own row", async () => {
    const ana = await person();
    const ben = await person();
    await friends(ana.id, ben.id);
    const g = await game();
    await sends.send(ana.id, g.slug, ben.handle);
    const [row] = await db().gameSend.findMany({ where: { toId: ben.id } });
    if (row === undefined) throw new Error("not sent");
    expect(await sends.remove(ana.id, row.id)).toBe("not found");
    expect(await db().gameSend.count({ where: { id: row.id } })).toBe(1);
    expect(await sends.remove(ben.id, row.id)).toBe("removed");
    expect(await db().gameSend.count({ where: { id: row.id } })).toBe(0);
    // Removed, the same game may come again and shows as new.
    expect(await sends.send(ana.id, g.slug, ben.handle)).toBe("sent");
    expect(await sends.hasNew(ben.id, never)).toBe(true);
  });
});

describe("stopping a sender", () => {
  // The Stop button is gone (the owner, 2026-11-28: "drop it and let unfollow do the job"): unfollowing is how a person
  // stops a friend sending games, and a stop kept from before no longer keeps anything out.
  it("is unfollowing, and a stop kept from before keeps nothing out", async () => {
    const ana = await person();
    const ben = await person();
    await friends(ana.id, ben.id);
    const [one, two] = [await game(), await game()];
    await db().sendStop.create({ data: { stopperId: ben.id, stoppedId: ana.id, stoppedAt: new Date() } });
    expect(await sends.send(ana.id, one.slug, ben.handle)).toBe("sent");
    expect((await sends.listOf(ben.id, never)).map((row) => row.slug)).toEqual([one.slug]);

    await db().makerFollow.deleteMany({ where: { followerId: ben.id, makerId: ana.id } });
    expect(await sends.send(ana.id, two.slug, ben.handle)).toBe("not friends");
    expect((await sends.listOf(ben.id, never)).map((row) => row.slug)).toEqual([one.slug]);
  });
});
