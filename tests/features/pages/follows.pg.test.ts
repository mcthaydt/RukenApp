import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFollows, type Follows } from "../../../src/features/pages/follows.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// Follow a maker (maker-credit-and-follow spec): one row per person and maker, made by the plus and taken away by
// the check.

let database: TestDatabase | undefined;
const clock = new TestClock("2026-11-27T12:00:00Z");
let follows: Follows;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  follows = createFollows({ db: db(), clock });
});

afterAll(async () => {
  await database?.stop();
});

let made = 0;

/** A maker with a page at an address nobody else in this file has. */
async function maker(): Promise<{ userId: string; handle: string }> {
  made += 1;
  const userId = await createUser(db());
  const handle = `maker-${String(made)}`;
  await db().makerPage.create({ data: { userId, handle, name: `Maker ${String(made)}` } });
  return { userId, handle };
}

describe("following a maker", () => {
  it("follows once, with the clock's time, and following again changes nothing", async () => {
    const fan = await createUser(db());
    const ada = await maker();
    expect(await follows.follow(fan, ada.handle)).toBe("followed");
    clock.advance(60_000);
    expect(await follows.follow(fan, ada.handle)).toBe("followed");
    expect(await db().makerFollow.findMany({ where: { followerId: fan } })).toMatchObject([
      { followerId: fan, makerId: ada.userId, followedAt: new Date(clock.epochMs() - 60_000) },
    ]);
  });

  it("makes one row from two presses at the same moment", async () => {
    const fan = await createUser(db());
    const ada = await maker();
    expect(await Promise.all([follows.follow(fan, ada.handle), follows.follow(fan, ada.handle)])).toEqual([
      "followed",
      "followed",
    ]);
    expect(await db().makerFollow.count({ where: { followerId: fan } })).toBe(1);
  });

  it("unfollows, and unfollowing someone not followed is not an error", async () => {
    const fan = await createUser(db());
    const ada = await maker();
    await follows.follow(fan, ada.handle);
    expect(await follows.unfollow(fan, ada.handle)).toBe("unfollowed");
    expect(await follows.unfollow(fan, ada.handle)).toBe("unfollowed");
    expect(await db().makerFollow.count({ where: { followerId: fan } })).toBe(0);
  });

  it("refuses an address with no page, and saves nothing", async () => {
    const fan = await createUser(db());
    expect(await follows.follow(fan, "nobody-here")).toBe("no page");
    expect(await follows.unfollow(fan, "nobody-here")).toBe("no page");
    expect(await db().makerFollow.count({ where: { followerId: fan } })).toBe(0);
  });

  it("refuses following your own page, and so does the table", async () => {
    const ada = await maker();
    expect(await follows.follow(ada.userId, ada.handle)).toBe("own");
    expect(await db().makerFollow.count({ where: { followerId: ada.userId } })).toBe(0);
    await expect(
      db().$executeRaw`INSERT INTO "MakerFollow" (id, "followerId", "makerId", "followedAt")
        VALUES ('x-self', ${ada.userId}, ${ada.userId}, now())`,
    ).rejects.toThrow();
  });

  it("says which of some makers a person follows, and never another person's", async () => {
    const [one, two] = [await createUser(db()), await createUser(db())];
    const [ada, bo, cy] = [await maker(), await maker(), await maker()];
    await follows.follow(one, ada.handle);
    await follows.follow(one, cy.handle);
    await follows.follow(two, bo.handle);
    const ids = [ada.userId, bo.userId, cy.userId];
    expect(await follows.followedAmong(one, ids)).toEqual(new Set([ada.userId, cy.userId]));
    expect(await follows.followedAmong(two, ids)).toEqual(new Set([bo.userId]));
    expect(await follows.followedAmong(one, [])).toEqual(new Set());
  });

  it("lists the makers a person follows, the newest follow first", async () => {
    const fan = await createUser(db());
    const [ada, bo, cy] = [await maker(), await maker(), await maker()];
    for (const one of [bo, ada, cy]) {
      await follows.follow(fan, one.handle);
      clock.advance(1_000);
    }
    expect(await follows.followedMakerIds(fan)).toEqual([cy.userId, ada.userId, bo.userId]);
    expect(await follows.followedMakerIds(await createUser(db()))).toEqual([]);
  });
});
