import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  purgeDueAccounts,
  requestDeletion,
  restoreOnSignIn,
} from "../../../src/features/accounts/deletion.ts";
import { hashNumber } from "../../../src/features/accounts/phone.ts";
import { newPublicId } from "../../../src/features/games/ids.ts";
import { createWishlist } from "../../../src/features/launch/wishlist.ts";
import type { FileStore } from "../../../src/lib/files/store.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";
import { TestClock } from "../../support/test-clock.ts";

// The daily job that finishes a deletion once its 14 days are over.

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

// The test file shares one database, so a deletion an earlier test left waiting would come due in a later test that
// moves the clock on. Each test starts with none waiting.
beforeEach(async () => {
  await db().deletionRequest.updateMany({
    where: { cancelledAt: null, purgedAt: null },
    data: { cancelledAt: new Date(0) },
  });
});

// The bucket a person's photo is kept in.
const files = new MemoryFileStore();

const SECRET = "test-secret-that-is-long-enough";
const DAY_MS = 24 * 60 * 60 * 1000;
const START = "2026-10-14T17:00:00Z";

let made = 0;

/** A person who has everything the purge removes: a password, a session, and a mail link waiting for them. */
async function seedPerson() {
  made += 1;
  const email = `leaving-${String(made)}@example.test`;
  const number = `+1312556${String(made).padStart(4, "0")}`;
  const user = await db().user.create({
    data: {
      name: "Leaving",
      email,
      emailVerified: true,
      phoneNumber: number,
      phoneNumberVerified: true,
      phoneConfirmedAt: new Date("2026-10-01T00:00:00Z"),
      paperEmail: `paid-${String(made)}@example.test`,
      image: "https://example.test/me.png",
      adultOn: new Date("2030-01-01"),
    },
  });
  await db().account.create({
    data: { userId: user.id, accountId: user.id, providerId: "credential", password: "hash" },
  });
  await db().session.create({
    data: { userId: user.id, token: `token-${user.id}`, expiresAt: new Date("2026-12-01T00:00:00Z") },
  });
  // The three ways a mail link is stored: by address, by address in the value, and by the person's id.
  const expiresAt = new Date("2026-12-01T00:00:00Z");
  await db().verification.createMany({
    data: [
      { identifier: email, value: "token-a", expiresAt },
      { identifier: "reset-password:abc", value: user.id, expiresAt },
      { identifier: "email-otp", value: email, expiresAt },
      // A texted code is kept by the number, and a password-reset code by the number and a suffix.
      { identifier: number, value: "123456:0", expiresAt },
      { identifier: `${number}-request-password-reset`, value: "654321:0", expiresAt },
    ],
  });
  // A sign-up this number started and never finished.
  await db().pendingSignUp.create({
    data: {
      numberHash: hashNumber(number, SECRET),
      browserHash: "b".repeat(64),
      passwordHash: "hash",
      adultOn: new Date("2008-01-01"),
      expiresAt,
    },
  });
  return { id: user.id, email, number };
}

let gamesMade = 0;

/**
 * A game of `makerUserId`'s in `state`, with a pull, an upright video and a file in the bucket. A live game is live on
 * its pull, and a waiting one waits on it.
 */
async function seedGame(
  makerUserId: string,
  state: "draft" | "waiting" | "live" | "sent_back" | "taken_off",
) {
  gamesMade += 1;
  const publicId = newPublicId();
  const answered = state !== "draft";
  const game = await db().game.create({
    data: {
      publicId,
      slug: `purged-maker-game-${String(gamesMade)}`,
      makerUserId,
      name: `Game ${String(gamesMade)}`,
      ...(answered
        ? {
            oneLine: "A game about a thing.",
            playsOn: "phone_and_computer" as const,
            repoFullName: "acme/game",
            ageRating: "age_12" as const,
          }
        : {}),
    },
  });
  const pull = await db().gamePull.create({
    data: {
      id: crypto.randomUUID(),
      gameId: game.id,
      commitSha: "a".repeat(40),
      fileCount: 1,
      totalBytes: 10n,
      connectHosts: [],
      pulledAt: new Date(START),
    },
  });
  await db().game.update({
    where: { id: game.id },
    data: {
      state,
      ...(state === "live" ? { livePullId: pull.id } : {}),
      ...(state === "waiting" ? { pendingPullId: pull.id, pendingSince: new Date(START) } : {}),
    },
  });
  const clipKey = `clips/${publicId}/upright-${"0".repeat(16)}.mp4`;
  await db().gameClip.create({
    data: { gameId: game.id, shape: "upright", key: clipKey, contentType: "video/mp4", bytes: 3 },
  });
  await files.put(clipKey, new Uint8Array([1, 2, 3]));
  await files.put(`files/${publicId}/${pull.id}/index.html`, new Uint8Array([1, 2, 3]));
  return { id: game.id, publicId, slug: game.slug };
}

/** The test's bucket, except that deleting the folder `prefix` fails, as a bucket that is down does. */
function brokenFor(prefix: string): FileStore {
  return {
    head: (key) => files.head(key),
    get: (key, range) => files.get(key, range),
    put: (key, bytes) => files.put(key, bytes),
    delete: (key) => files.delete(key),
    deleteAll: (folder) =>
      folder === prefix ? Promise.reject(new Error("the bucket is down")) : files.deleteAll(folder),
    hasAny: (folder) => files.hasAny(folder),
  };
}

/** A person's account status. */
async function statusOf(userId: string): Promise<string> {
  return (await db().user.findUniqueOrThrow({ where: { id: userId }, select: { status: true } })).status;
}

/** Where a game stands, and the address and pulls that go with it. */
function stateOf(gameId: string) {
  return db().game.findUniqueOrThrow({
    where: { id: gameId },
    select: { state: true, slug: true, livePullId: true, pendingPullId: true },
  });
}

/** Asks to be deleted at START, with a clock the test can move on. */
async function askToBeDeleted(userId: string) {
  const clock = new TestClock(START);
  await requestDeletion({ prisma: db(), clock }, userId);
  return clock;
}

describe("purgeDueAccounts", () => {
  it("leaves an account alone until its 14 days are over", async () => {
    const { id } = await seedPerson();
    const clock = await askToBeDeleted(id);

    clock.advance(13 * DAY_MS);

    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(0);
    const user = await db().user.findUniqueOrThrow({ where: { id } });
    expect(user.status).toBe("pending_deletion");
    expect(user.name).toBe("Leaving");
    expect(await db().account.count({ where: { userId: id } })).toBe(1);
  });

  it("removes the email, the number, the password and the sessions, keeps the row, and marks the request done", async () => {
    const { id, email, number } = await seedPerson();
    const clock = await askToBeDeleted(id);
    await db().session.create({
      data: { userId: id, token: `late-${id}`, expiresAt: new Date("2026-12-01T00:00:00Z") },
    });

    clock.advance(15 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(1);

    expect(await db().user.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "deleted",
      email: `deleted-${id}@deleted.invalid`,
      name: "Deleted",
      emailVerified: false,
      phoneNumber: null,
      phoneNumberVerified: false,
      phoneConfirmedAt: null,
      paperEmail: null,
      image: null,
      adultOn: null,
    });
    expect(
      await db().verification.count({
        where: { identifier: { in: [number, `${number}-request-password-reset`] } },
      }),
    ).toBe(0);
    expect(await db().pendingSignUp.count({ where: { numberHash: hashNumber(number, SECRET) } })).toBe(0);
    expect(await db().account.count({ where: { userId: id } })).toBe(0);
    expect(await db().session.count({ where: { userId: id } })).toBe(0);
    expect(
      await db().verification.count({
        where: { OR: [{ identifier: email }, { value: email }, { value: id }] },
      }),
    ).toBe(0);
    expect((await db().deletionRequest.findFirstOrThrow({ where: { userId: id } })).purgedAt).toEqual(
      new Date(clock.epochMs()),
    );
  });

  it("does nothing the second time", async () => {
    const { id } = await seedPerson();
    const clock = await askToBeDeleted(id);
    clock.advance(15 * DAY_MS);
    await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET });

    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(0);
  });

  it("skips a request that signing in cancelled", async () => {
    const { id } = await seedPerson();
    const clock = await askToBeDeleted(id);
    clock.advance(3 * DAY_MS);
    expect(await restoreOnSignIn(db(), clock, id)).toBe(true);

    clock.advance(12 * DAY_MS);

    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(0);
    const user = await db().user.findUniqueOrThrow({ where: { id } });
    expect(user.status).toBe("active");
    expect(user.name).toBe("Leaving");
  });

  it("lets the same number and address sign up again afterwards", async () => {
    const { id, email, number } = await seedPerson();
    const clock = await askToBeDeleted(id);
    clock.advance(15 * DAY_MS);
    await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET });

    const again = await db().user.create({ data: { name: "Back", email, phoneNumber: number } });

    expect(again.id).not.toBe(id);
  });

  // The GitHub connection is a person's data (slice 2): what GitHub said they can reach goes with them.
  it("removes the person's GitHub installations and repositories, and no one else's", async () => {
    const leaving = await seedPerson();
    const staying = await seedPerson();
    for (const [userId, installationId, fullName] of [
      [leaving.id, 11n, "leaving/game"],
      [staying.id, 12n, "staying/game"],
    ] as const) {
      await db().gitHubInstallation.create({
        data: {
          userId,
          installationId,
          accountLogin: "someone",
          repositories: { create: [{ fullName, defaultBranch: "main" }] },
        },
      });
    }
    const clock = await askToBeDeleted(leaving.id);

    clock.advance(15 * DAY_MS);
    await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET });

    expect(await db().gitHubInstallation.count({ where: { userId: leaving.id } })).toBe(0);
    expect(await db().gitHubRepository.count({ where: { fullName: "leaving/game" } })).toBe(0);
    expect(await db().gitHubInstallation.count({ where: { userId: staying.id } })).toBe(1);
    expect(await db().gitHubRepository.count({ where: { fullName: "staying/game" } })).toBe(1);
  });

  // A maker's page is a person's data (slice 3): it stays up while the 14 days run, and goes with the person.
  it("keeps a person's page up for the 14 days, then removes it and its links, and frees the address", async () => {
    const leaving = await seedPerson();
    const staying = await seedPerson();
    for (const [userId, handle] of [
      [leaving.id, "leaving-maker"],
      [staying.id, "staying-maker"],
    ] as const) {
      await db().makerPage.create({
        data: {
          userId,
          handle,
          name: "A maker",
          links: {
            create: [
              { kind: "link", title: "One", url: "https://example.com/1", position: 0 },
              { kind: "link", title: "Two", url: "https://example.com/2", position: 1 },
            ],
          },
        },
      });
    }
    const clock = await askToBeDeleted(leaving.id);

    clock.advance(13 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(0);
    expect(await db().makerPage.count({ where: { userId: leaving.id } })).toBe(1);
    expect(await db().pageLink.count({ where: { page: { userId: leaving.id } } })).toBe(2);

    clock.advance(2 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(1);

    expect(await db().makerPage.count({ where: { userId: leaving.id } })).toBe(0);
    expect(await db().pageLink.count({ where: { page: { handle: "leaving-maker" } } })).toBe(0);
    expect((await db().user.findUniqueOrThrow({ where: { id: leaving.id } })).status).toBe("deleted");
    // Another account can take the address at once.
    await expect(
      db().makerPage.create({
        data: { userId: (await seedPerson()).id, handle: "leaving-maker", name: "New" },
      }),
    ).resolves.toMatchObject({ handle: "leaving-maker" });
    // Nobody else's page is touched.
    expect(await db().makerPage.count({ where: { userId: staying.id } })).toBe(1);
    expect(await db().pageLink.count({ where: { page: { userId: staying.id } } })).toBe(2);
  });

  // A photo is a person's data too, and is public by its address until it is deleted.
  it("removes a person's photo from the store with their page, and leaves everyone else's", async () => {
    const leaving = await seedPerson();
    const staying = await seedPerson();
    const keys = {
      leaving: "photos/00000000000000a1.png",
      staying: "photos/00000000000000b2.png",
    };
    for (const [userId, handle, photoKey] of [
      [leaving.id, "leaving-with-photo", keys.leaving],
      [staying.id, "staying-with-photo", keys.staying],
    ] as const) {
      await db().makerPage.create({ data: { userId, handle, name: "A maker", photoKey } });
      await files.put(photoKey, new Uint8Array([1, 2, 3]));
    }
    // A leaving person with no photo is no trouble either.
    const without = await seedPerson();
    await db().makerPage.create({
      data: { userId: without.id, handle: "leaving-no-photo", name: "A maker" },
    });
    const clock = await askToBeDeleted(leaving.id);
    await requestDeletion({ prisma: db(), clock }, without.id);

    clock.advance(15 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(2);

    expect(await files.head(keys.leaving)).toBeNull();
    expect(await files.head(keys.staying)).not.toBeNull();
    expect(await db().makerPage.count({ where: { userId: leaving.id } })).toBe(0);
  });

  // The games a person wanted are theirs (the wishlist, before launch). The launch email's row holds only an id and a
  // time, and is add-only, so it stays.
  it("keeps a person's wishlist for the 14 days, then removes it, and keeps the launch email's row", async () => {
    const leaving = await seedPerson();
    const staying = await seedPerson();
    const maker = await seedPerson();
    const game = await db().game.create({
      data: {
        publicId: newPublicId(),
        slug: "wanted-game",
        makerUserId: maker.id,
        name: "A game",
        oneLine: "A game about a thing.",
        playsOn: "phone_and_computer",
        repoFullName: "acme/game",
      },
    });
    for (const userId of [leaving.id, staying.id]) {
      await db().wishlist.create({ data: { userId, gameId: game.id, addedAt: new Date(START) } });
    }
    await db().wishlistMail.create({ data: { userId: leaving.id, sentAt: new Date(START) } });
    const clock = await askToBeDeleted(leaving.id);
    const wishlist = createWishlist({ db: db(), clock });

    clock.advance(13 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(0);
    expect(await db().wishlist.count({ where: { userId: leaving.id } })).toBe(1);
    expect(await wishlist.countFor(game.id, maker.id)).toBe(2);

    clock.advance(2 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(1);

    expect(await db().wishlist.count({ where: { userId: leaving.id } })).toBe(0);
    expect(await wishlist.countFor(game.id, maker.id)).toBe(1);
    expect(await db().wishlistMail.count({ where: { userId: leaving.id } })).toBe(1);
    // Nobody else's list is touched.
    expect(await db().wishlist.count({ where: { userId: staying.id } })).toBe(1);
  });

  // What a person told Ruken about games is theirs (report-a-game spec): it goes with the account, after the 14 days.
  it("removes a person's reports after the 14 days, and leaves everyone else's", async () => {
    const leaving = await seedPerson();
    const staying = await seedPerson();
    const maker = await seedPerson();
    const game = await db().game.create({
      data: { publicId: newPublicId(), slug: "reported-game", makerUserId: maker.id, name: "A game" },
    });
    for (const userId of [leaving.id, staying.id]) {
      await db().gameReport.create({
        data: { userId, gameId: game.id, reason: "ads", madeAt: new Date(START), changedAt: new Date(START) },
      });
    }
    const clock = await askToBeDeleted(leaving.id);

    clock.advance(13 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(0);
    expect(await db().gameReport.count({ where: { userId: leaving.id } })).toBe(1);

    clock.advance(2 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(1);
    expect(await db().gameReport.count({ where: { userId: leaving.id } })).toBe(0);
    expect(await db().gameReport.count({ where: { userId: staying.id } })).toBe(1);
  });

  // Your feed (learned feed spec, unit D): a person's chips and Good pick answers go with them, and so does every other
  // player's chip for them or one of their games.
  it("removes a person's feed chips and Good pick answers, and others' chips for them, after the 14 days", async () => {
    const leaving = await seedPerson();
    const staying = await seedPerson();
    const theirGame = await seedGame(leaving.id, "live");
    const otherGame = await seedGame(staying.id, "live");
    const at = new Date(START);
    await db().feedTaste.createMany({
      data: [
        { userId: leaving.id, direction: "more", kind: "mood", value: "cosy", createdAt: at },
        { userId: staying.id, direction: "more", kind: "mood", value: "cosy", createdAt: at },
        {
          userId: staying.id,
          direction: "more",
          kind: "maker",
          value: leaving.id,
          makerUserId: leaving.id,
          createdAt: at,
        },
        {
          userId: staying.id,
          direction: "less",
          kind: "game",
          value: theirGame.id,
          gameId: theirGame.id,
          createdAt: at,
        },
        {
          userId: staying.id,
          direction: "more",
          kind: "game",
          value: otherGame.id,
          gameId: otherGame.id,
          createdAt: at,
        },
      ],
    });
    await db().goodPickAsked.createMany({
      data: [
        { userId: leaving.id, gameId: otherGame.id, askedAt: at },
        { userId: staying.id, gameId: otherGame.id, askedAt: at },
      ],
    });
    const clock = await askToBeDeleted(leaving.id);

    clock.advance(13 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(0);
    expect(await db().feedTaste.count()).toBeGreaterThanOrEqual(5);

    clock.advance(2 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(1);
    expect(await db().feedTaste.count({ where: { userId: leaving.id } })).toBe(0);
    expect(await db().goodPickAsked.count({ where: { userId: leaving.id } })).toBe(0);
    const left = await db().feedTaste.findMany({
      where: { userId: staying.id },
      select: { kind: true, value: true },
    });
    expect(left).toEqual(
      expect.arrayContaining([
        { kind: "mood", value: "cosy" },
        { kind: "game", value: otherGame.id },
      ]),
    );
    expect(left).toHaveLength(2);
    expect(await db().goodPickAsked.count({ where: { userId: staying.id } })).toBe(1);
  });

  // Both sides of a follow name an account (maker-credit-and-follow spec): whom the person followed and who followed
  // them both go with the account, after the 14 days, and nobody else's follows are touched.
  it("removes the follows a person made and the follows of them after the 14 days", async () => {
    const leaving = await seedPerson();
    const fan = await seedPerson();
    const maker = await seedPerson();
    const at = new Date(START);
    await db().makerFollow.createMany({
      data: [
        { followerId: leaving.id, makerId: maker.id, followedAt: at },
        { followerId: fan.id, makerId: leaving.id, followedAt: at },
        { followerId: fan.id, makerId: maker.id, followedAt: at },
      ],
    });
    const clock = await askToBeDeleted(leaving.id);

    clock.advance(13 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(0);
    expect(await db().makerFollow.count({ where: { followerId: { in: [leaving.id, fan.id] } } })).toBe(3);

    clock.advance(2 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(1);
    expect(
      await db().makerFollow.count({ where: { OR: [{ followerId: leaving.id }, { makerId: leaving.id }] } }),
    ).toBe(0);
    expect(
      await db().makerFollow.findMany({
        where: { followerId: { in: [leaving.id, fan.id] } },
        select: { followerId: true, makerId: true },
      }),
    ).toEqual([{ followerId: fan.id, makerId: maker.id }]);
  });

  // The owner's decision (2026-11-21): a maker's games come off Ruken with their account, once the 14 days are over.
  it("takes the person's games off after the 14 days, with their files and videos, and leaves everyone else's", async () => {
    const leaving = await seedPerson();
    const staying = await seedPerson();
    const made = {
      live: await seedGame(leaving.id, "live"),
      waiting: await seedGame(leaving.id, "waiting"),
      sentBack: await seedGame(leaving.id, "sent_back"),
      draft: await seedGame(leaving.id, "draft"),
      takenOff: await seedGame(leaving.id, "taken_off"),
      others: await seedGame(staying.id, "live"),
    };
    const clock = await askToBeDeleted(leaving.id);

    // Still up during the 14 days, so changing their mind loses nothing.
    clock.advance(13 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(0);
    expect(await stateOf(made.live.id)).toMatchObject({ state: "live" });

    clock.advance(2 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(1);

    for (const game of [made.live, made.waiting])
      expect(await stateOf(game.id)).toEqual({
        state: "taken_off",
        slug: game.slug,
        livePullId: null,
        pendingPullId: null,
      });
    for (const game of [made.sentBack, made.draft])
      expect(await stateOf(game.id)).toEqual({
        state: "thrown_away",
        slug: `x-${game.publicId}`,
        livePullId: null,
        pendingPullId: null,
      });
    expect(await stateOf(made.takenOff.id)).toMatchObject({ state: "taken_off", slug: made.takenOff.slug });
    for (const game of [made.live, made.waiting, made.sentBack, made.draft, made.takenOff]) {
      expect(await files.hasAny(`files/${game.publicId}/`)).toBe(false);
      expect(await files.hasAny(`clips/${game.publicId}/`)).toBe(false);
      expect(await db().gameClip.count({ where: { gameId: game.id } })).toBe(0);
    }
    // The rows stay, since money and records may point at them.
    expect(await db().game.count({ where: { makerUserId: leaving.id } })).toBe(5);

    // Someone else's game is untouched.
    expect(await stateOf(made.others.id)).toMatchObject({ state: "live", slug: made.others.slug });
    expect(await files.hasAny(`files/${made.others.publicId}/`)).toBe(true);
    expect(await files.hasAny(`clips/${made.others.publicId}/`)).toBe(true);
    expect(await db().gameClip.count({ where: { gameId: made.others.id } })).toBe(1);
  });

  // A live game's change that waits for a yes goes with the game (unit A): the database holds such a change to a live
  // game, so the purge must clear it in the same write that takes the game off, or it could not finish.
  it("finishes for a maker whose live game holds a new video and rating, and leaves nothing of them behind", async () => {
    const leaving = await seedPerson();
    const live = await seedGame(leaving.id, "live");
    const heldKey = `clips/${live.publicId}/wide-${"1".repeat(16)}.mp4`;
    await files.put(heldKey, new Uint8Array([4, 5, 6]));
    await db().gameHeldClip.create({
      data: { gameId: live.id, shape: "wide", key: heldKey, contentType: "video/mp4", bytes: 3 },
    });
    await db().game.update({
      where: { id: live.id },
      data: { heldAgeRating: "age_18", heldContentMarks: ["gore"] },
    });
    const clock = await askToBeDeleted(leaving.id);

    clock.advance(15 * DAY_MS);
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(1);

    expect(await stateOf(live.id)).toMatchObject({ state: "taken_off" });
    expect(await db().gameHeldClip.count({ where: { gameId: live.id } })).toBe(0);
    expect(await db().game.findUniqueOrThrow({ where: { id: live.id } })).toMatchObject({
      heldAgeRating: null,
      heldContentMarks: [],
    });
    expect(await files.head(heldKey)).toBeNull();
    expect(await files.hasAny(`clips/${live.publicId}/`)).toBe(false);
  });

  // Staff's yes locks the game and then its held rows. The purge takes them in the same order, so a yes that is being
  // made while a maker's account is deleted finishes first and neither waits on the other (a deadlock Postgres ends by
  // cancelling one of them).
  it("does not deadlock with a yes that is being made on the leaving maker's game", async () => {
    const leaving = await seedPerson();
    const live = await seedGame(leaving.id, "live");
    const heldKey = `clips/${live.publicId}/wide-${"2".repeat(16)}.mp4`;
    await files.put(heldKey, new Uint8Array([4, 5, 6]));
    const held = await db().gameHeldClip.create({
      data: { gameId: live.id, shape: "wide", key: heldKey, contentType: "video/mp4", bytes: 3 },
    });
    const clock = await askToBeDeleted(leaving.id);
    clock.advance(15 * DAY_MS);
    if (database === undefined) throw new Error("the database did not start");
    // A connection of its own, so the yes holds the game while the purge runs on the client's.
    const staff = new pg.Client({ connectionString: database.url });
    await staff.connect();
    try {
      await staff.query("BEGIN");
      await staff.query('SELECT "id" FROM "Game" WHERE "id" = $1 FOR UPDATE', [live.id]);
      const purge = purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET });
      purge.catch(() => undefined);
      // Readiness, not a guess: the purge is stuck on the game's lock when the server shows it.
      for (let tries = 0; ; tries += 1) {
        const waiting = await staff.query<{ n: string }>(
          "SELECT count(*) AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()",
        );
        if (Number(waiting.rows[0]?.n ?? 0) > 0) break;
        if (tries > 400) throw new Error("the purge is not waiting for the game's lock");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      // What a yes does to the held row it made live.
      await staff.query('DELETE FROM "GameHeldClip" WHERE "id" = $1', [held.id]);
      await staff.query("COMMIT");
      expect(await purge).toBe(1);
    } finally {
      await staff.end();
    }

    expect(await stateOf(live.id)).toMatchObject({ state: "taken_off" });
    expect(await db().gameHeldClip.count({ where: { gameId: live.id } })).toBe(0);
  });

  // One account the bucket fails on must not stop everyone else's deletion, today or on any later day.
  it("finishes the other accounts when one fails, reports the failure, and finishes that one on the next run", async () => {
    const failing = await seedPerson();
    const fine = await seedPerson();
    const failingGame = await seedGame(failing.id, "live");
    const fineGame = await seedGame(fine.id, "live");
    const clock = await askToBeDeleted(failing.id);
    await requestDeletion({ prisma: db(), clock }, fine.id);
    clock.advance(15 * DAY_MS);

    const broken = brokenFor(`files/${failingGame.publicId}/`);
    await expect(purgeDueAccounts({ prisma: db(), clock, files: broken, secret: SECRET })).rejects.toThrow(
      "1 account(s) could not be deleted; 1 were.",
    );
    expect(await statusOf(fine.id)).toBe("deleted");
    expect(await stateOf(fineGame.id)).toMatchObject({ state: "taken_off" });
    expect(await statusOf(failing.id)).toBe("pending_deletion");
    expect(await stateOf(failingGame.id)).toMatchObject({ state: "live" });
    expect(
      await db().deletionRequest.count({ where: { userId: failing.id, purgedAt: null, cancelledAt: null } }),
    ).toBe(1);

    // The next run, with the bucket working, finishes it.
    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(1);
    expect(await statusOf(failing.id)).toBe("deleted");
    expect(await stateOf(failingGame.id)).toMatchObject({ state: "taken_off" });
    expect(await files.hasAny(`files/${failingGame.publicId}/`)).toBe(false);
  });

  // The money rows are the ledger, so they outlive the person's details. The purge only
  // turns the user row into a tombstone; these rows point at it and must all still be there, unchanged.
  it("leaves the payment, the membership start and the membership rows as they were", async () => {
    const { id } = await seedPerson();
    const paidAt = new Date("2026-10-14T17:00:00Z");
    await db().billingCustomer.create({ data: { userId: id, stripeCustomerId: `cus_${id}` } });
    await db().premiumMembership.create({
      data: {
        userId: id,
        stripeSubscriptionId: `sub_${id}`,
        plan: "monthly",
        state: "active",
        currentPeriodEnd: new Date("2026-11-14T17:00:00Z"),
      },
    });
    await db().membershipPayment.create({
      data: {
        stripeInvoiceId: `in_${id}`,
        userId: id,
        stripeSubscriptionId: `sub_${id}`,
        plan: "monthly",
        periodStart: paidAt,
        paidAt,
        grossCents: 999n,
        taxCents: 0n,
        cardFeeCents: 59n,
      },
    });
    await db().membershipStart.create({
      data: {
        checkoutIntentId: `intent_${id}`,
        userId: id,
        stripeSubscriptionId: `sub_${id}`,
        plan: "monthly",
        startedAt: paidAt,
      },
    });
    const before = await moneyRowsOf(id);
    const clock = await askToBeDeleted(id);

    clock.advance(15 * DAY_MS);

    expect(await purgeDueAccounts({ prisma: db(), clock, files, secret: SECRET })).toBe(1);
    expect(await moneyRowsOf(id)).toEqual(before);
    expect(before.payments).toHaveLength(1);
    expect(before.starts).toHaveLength(1);
    expect(before.memberships).toHaveLength(1);
    expect(before.customers).toHaveLength(1);
  });
});

/** Every money row that names the person, as stored, so a test can compare before and after. */
async function moneyRowsOf(userId: string) {
  return {
    customers: await db().billingCustomer.findMany({ where: { userId } }),
    memberships: await db().premiumMembership.findMany({ where: { userId } }),
    payments: await db().membershipPayment.findMany({ where: { userId } }),
    starts: await db().membershipStart.findMany({ where: { userId } }),
  };
}
