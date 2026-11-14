import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPublicId } from "../../../src/features/games/ids.ts";
import { LAUNCH_MS } from "../../../src/features/launch/switch.ts";
import { createWishlist, type Wishlist } from "../../../src/features/launch/wishlist.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

let database: TestDatabase | undefined;
const clock = new TestClock("2026-11-20T12:00:00Z");
let wishlist: Wishlist;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  wishlist = createWishlist({ db: db(), clock });
});

afterAll(async () => {
  await database?.stop();
});

const BEFORE = LAUNCH_MS - 1;
let made = 0;

/** A plain game with its own maker. */
async function newGame() {
  made += 1;
  const makerUserId = await createUser(db());
  const game = await db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `game-${String(made)}`,
      makerUserId,
      name: "A game",
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
    },
  });
  return game;
}

describe("the wishlist", () => {
  it("adds a game once, with the clock's time", async () => {
    const player = await createUser(db());
    const game = await newGame();
    expect(await wishlist.add(player, game.id, BEFORE)).toBe("added");
    expect(await wishlist.add(player, game.id, BEFORE)).toBe("added");
    expect(await db().wishlist.findMany({ where: { userId: player } })).toMatchObject([
      { userId: player, gameId: game.id, addedAt: new Date(clock.epochMs()) },
    ]);
  });

  it("makes one row from two presses at the same moment", async () => {
    const player = await createUser(db());
    const game = await newGame();
    expect(
      await Promise.all([wishlist.add(player, game.id, BEFORE), wishlist.add(player, game.id, BEFORE)]),
    ).toEqual(["added", "added"]);
    expect(await db().wishlist.count({ where: { userId: player } })).toBe(1);
  });

  it("removes it, and removing what is not there is not an error", async () => {
    const player = await createUser(db());
    const game = await newGame();
    await wishlist.add(player, game.id, BEFORE);
    expect(await wishlist.remove(player, game.id, BEFORE)).toBe("removed");
    expect(await db().wishlist.count({ where: { userId: player } })).toBe(0);
    expect(await wishlist.remove(player, game.id, BEFORE)).toBe("removed");
  });

  it("takes nothing from 11:00 on, and removes nothing", async () => {
    const player = await createUser(db());
    const game = await newGame();
    expect(await wishlist.add(player, game.id, LAUNCH_MS)).toBe("open");
    expect(await db().wishlist.count({ where: { userId: player } })).toBe(0);
    await wishlist.add(player, game.id, BEFORE);
    expect(await wishlist.remove(player, game.id, LAUNCH_MS)).toBe("open");
    expect(await db().wishlist.count({ where: { userId: player } })).toBe(1);
  });

  it("lists a person's games by slug, in the order they were added, and no one else's", async () => {
    const player = await createUser(db());
    const other = await createUser(db());
    const first = await newGame();
    const second = await newGame();
    const third = await newGame();
    await wishlist.add(player, second.id, BEFORE);
    clock.advance(1_000);
    await wishlist.add(player, first.id, BEFORE);
    await wishlist.add(other, third.id, BEFORE);
    expect(await wishlist.slugsOf(player)).toEqual([second.slug, first.slug]);
    expect(await wishlist.slugsOf(other)).toEqual([third.slug]);
  });

  it("counts the people who want a game, and not its maker", async () => {
    const game = await newGame();
    const elsewhere = await newGame();
    const one = await createUser(db());
    const two = await createUser(db());
    await wishlist.add(one, game.id, BEFORE);
    await wishlist.add(two, game.id, BEFORE);
    await wishlist.add(game.makerUserId, game.id, BEFORE);
    expect(await wishlist.countFor(game.id, game.makerUserId)).toBe(2);
    expect(await wishlist.countFor(elsewhere.id, elsewhere.makerUserId)).toBe(0);
  });
});
