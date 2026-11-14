import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPublicId } from "../../../src/features/games/ids.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// These tests use plain SQL on purpose: they check what the database itself refuses (the unique keys, the add-only
// trigger), whatever the application code does.

let database: TestDatabase | undefined;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.stop();
});

let made = 0;

async function newGameId(): Promise<string> {
  made += 1;
  const game = await db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `game-${String(made)}`,
      makerUserId: await createUser(db()),
      name: "A game",
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
    },
  });
  return game.id;
}

async function insertWishlist(userId: string, gameId: string): Promise<string> {
  const id = randomUUID();
  await db().$executeRaw`
    INSERT INTO "Wishlist" ("id", "userId", "gameId", "addedAt") VALUES (${id}, ${userId}, ${gameId}, now())`;
  return id;
}

async function insertMail(userId: string): Promise<void> {
  await db().$executeRaw`INSERT INTO "WishlistMail" ("userId", "sentAt") VALUES (${userId}, now())`;
}

describe("the launch tables", () => {
  it("are made by the migrations", async () => {
    const rows = await db().$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    expect(rows.map((row) => row.table_name)).toEqual(expect.arrayContaining(["Wishlist", "WishlistMail"]));
  });

  describe("a wishlist row", () => {
    it("is refused a second time for the same person and game", async () => {
      const userId = await createUser(db());
      const gameId = await newGameId();
      await insertWishlist(userId, gameId);
      await expect(insertWishlist(userId, gameId)).rejects.toThrow(/Wishlist_userId_gameId_key/);
    });

    it("can be deleted", async () => {
      const userId = await createUser(db());
      const id = await insertWishlist(userId, await newGameId());
      await db().$executeRaw`DELETE FROM "Wishlist" WHERE "id" = ${id}`;
      expect(await db().wishlist.count({ where: { userId } })).toBe(0);
    });
  });

  describe("a launch mail row", () => {
    it("cannot be changed or deleted", async () => {
      const userId = await createUser(db());
      await insertMail(userId);
      await expect(
        db().$executeRaw`UPDATE "WishlistMail" SET "sentAt" = now() WHERE "userId" = ${userId}`,
      ).rejects.toThrow(/WishlistMail is append-only/);
      await expect(db().$executeRaw`DELETE FROM "WishlistMail" WHERE "userId" = ${userId}`).rejects.toThrow(
        /WishlistMail is append-only/,
      );
    });

    it("is refused a second time for the same person", async () => {
      const userId = await createUser(db());
      await insertMail(userId);
      await expect(insertMail(userId)).rejects.toThrow(/WishlistMail_pkey/);
    });
  });
});
