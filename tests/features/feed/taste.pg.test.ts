import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPublicId } from "../../../src/features/games/ids.ts";
import { createTaste, type Taste } from "../../../src/features/feed/taste.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// Your feed's rows (learned feed spec, unit D): chips of more and less, the Learn from what I do switch, Start over and
// Good pick, against Postgres.

let database: TestDatabase | undefined;
const clock = new TestClock("2026-11-27T12:00:00Z");
let taste: Taste;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  taste = createTaste({ db: db(), clock });
});

afterAll(async () => {
  await database?.stop();
});

/** A person of 30, whose feed may learn. */
async function adult(): Promise<string> {
  const id = await createUser(db());
  await db().user.update({ where: { id }, data: { adultOn: new Date("2014-01-01T00:00:00Z") } });
  return id;
}

let made = 0;

/** A maker with a page and a live game. */
async function makerWithGame(): Promise<{ makerId: string; gameId: string; slug: string; name: string }> {
  made += 1;
  const makerId = await adult();
  await db().makerPage.create({
    data: { userId: makerId, handle: `maker-${String(made)}`, name: `Maker ${String(made)}` },
  });
  const game = await db().game.create({
    data: {
      publicId: newPublicId(),
      slug: `tasted-${String(made)}`,
      makerUserId: makerId,
      name: `Game ${String(made)}`,
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
      ageRating: "age_12",
    },
  });
  // A live game names the copy that is live.
  const pull = await db().gamePull.create({
    data: {
      id: crypto.randomUUID(),
      gameId: game.id,
      commitSha: "a".repeat(40),
      fileCount: 1,
      totalBytes: 10n,
      connectHosts: [],
      pulledAt: new Date(clock.epochMs()),
    },
  });
  await db().game.update({ where: { id: game.id }, data: { state: "live", livePullId: pull.id } });
  return { makerId, gameId: game.id, slug: game.slug, name: game.name };
}

describe("chips", () => {
  it("adds, reads back and removes mood, genre and maker chips, more and less", async () => {
    const me = await adult();
    const { makerId } = await makerWithGame();

    expect(await taste.add(me, "more", "mood", "cosy")).toBe("added");
    expect(await taste.add(me, "more", "genre", "puzzle")).toBe("added");
    expect(await taste.add(me, "more", "maker", makerId)).toBe("added");
    expect(await taste.add(me, "less", "genre", "racing_sports")).toBe("added");

    const view = await taste.view(me);
    expect(view.learning).toBe("on");
    expect(view.more.map((chip) => chip.words)).toEqual(["Cosy", "Puzzle", expect.stringMatching(/^Maker /)]);
    expect(view.less.map((chip) => chip.words)).toEqual(["Racing and sports"]);
    expect(view.sentence).toBe("Lately you've been into cosy and puzzle games.");
    expect(view.choices.moods.some((choice) => choice.value === "cosy")).toBe(false);
    expect(view.choices.makers.some((choice) => choice.value === makerId)).toBe(false);
    expect(view.suggestions).toHaveLength(2);

    const [cosy] = view.more;
    if (cosy === undefined) throw new Error("no chip");
    await taste.remove(me, cosy.id);
    expect((await taste.view(me)).more.map((chip) => chip.words)).not.toContain("Cosy");
  });

  it("keeps one row however often it is pressed, and moves it when the other direction is picked", async () => {
    const me = await adult();
    await taste.add(me, "more", "mood", "spooky");
    await taste.add(me, "more", "mood", "spooky");
    expect(await db().feedTaste.count({ where: { userId: me } })).toBe(1);
    await taste.add(me, "less", "mood", "spooky");
    expect(await db().feedTaste.findMany({ where: { userId: me }, select: { direction: true } })).toEqual([
      { direction: "less" },
    ]);
  });

  it("refuses a word that is not a mood or genre, a maker with no page, and the person themselves", async () => {
    const me = await adult();
    await db().makerPage.create({ data: { userId: me, handle: `me-${String(made)}`, name: "Me" } });
    expect(await taste.add(me, "more", "mood", "angry")).toBe("unknown");
    expect(await taste.add(me, "more", "genre", "cosy")).toBe("unknown");
    expect(await taste.add(me, "more", "maker", await createUser(db()))).toBe("unknown");
    expect(await taste.add(me, "more", "maker", me)).toBe("own");
    expect(await db().feedTaste.count({ where: { userId: me } })).toBe(0);
  });

  it("does not let one person remove another's chip", async () => {
    const me = await adult();
    const someoneElse = await adult();
    await taste.add(me, "more", "mood", "bold");
    const [chip] = (await taste.view(me)).more;
    if (chip === undefined) throw new Error("no chip");
    await taste.remove(someoneElse, chip.id);
    expect((await taste.view(me)).more).toHaveLength(1);
  });

  it("More and Less like this keep a game chip, but not for the person's own game or one that is not live", async () => {
    const me = await adult();
    const game = await makerWithGame();
    expect(await taste.aboutGame(me, game.slug, "more")).toBe("added");
    expect((await taste.view(me)).more.map((chip) => chip.words)).toEqual([game.name]);
    expect(await taste.aboutGame(me, game.slug, "less")).toBe("added");
    expect((await taste.view(me)).less.map((chip) => chip.words)).toEqual([game.name]);
    expect((await taste.view(me)).more).toEqual([]);

    expect(await taste.aboutGame(game.makerId, game.slug, "more")).toBe("own");
    expect(await taste.aboutGame(me, "no-such-game", "more")).toBe("unknown");
    // A game that came off Ruken has nothing to show: its chip is not shown.
    await db().game.update({ where: { id: game.gameId }, data: { state: "taken_off" } });
    expect((await taste.view(me)).less).toEqual([]);
  });

  it("holds the database to a maker chip naming its maker and a game chip its game", async () => {
    const me = await adult();
    const { makerId, gameId } = await makerWithGame();
    const at = new Date(clock.epochMs());
    await expect(
      db().feedTaste.create({
        data: { userId: me, direction: "more", kind: "maker", value: makerId, createdAt: at },
      }),
    ).rejects.toThrow();
    await expect(
      db().feedTaste.create({
        data: { userId: me, direction: "more", kind: "game", value: makerId, gameId, createdAt: at },
      }),
    ).rejects.toThrow();
    await expect(
      db().feedTaste.create({
        data: { userId: me, direction: "more", kind: "mood", value: "cosy", gameId, createdAt: at },
      }),
    ).rejects.toThrow();
  });
});

describe("Learn from what I do and Start over", () => {
  it("off hides the chips and refuses new ones; on again starts fresh", async () => {
    const me = await adult();
    await taste.add(me, "more", "mood", "cosy");
    expect(await taste.setLearning(me, false)).toBe("done");
    const off = await taste.view(me);
    expect(off.learning).toBe("off");
    expect(off.more).toEqual([]);
    expect(await taste.add(me, "more", "mood", "bold")).toBe("not-learning");
    expect(await db().feedTaste.count({ where: { userId: me } })).toBe(1);

    clock.advance(60_000);
    expect(await taste.setLearning(me, true)).toBe("done");
    const user = await db().user.findUniqueOrThrow({ where: { id: me } });
    expect(user.feedPersonal).toBe(true);
    expect(user.feedResetAt).toEqual(new Date(clock.epochMs()));
    expect(await db().feedTaste.count({ where: { userId: me } })).toBe(0);
  });

  it("is locked off for an under-18 or anyone of unknown age, who can keep nothing", async () => {
    const teen = await createUser(db());
    await db().user.update({ where: { id: teen }, data: { adultOn: new Date("2030-01-01T00:00:00Z") } });
    const unknown = await createUser(db());
    for (const id of [teen, unknown]) {
      expect((await taste.view(id)).learning).toBe("locked");
      expect(await taste.setLearning(id, true)).toBe("locked");
      expect(await taste.add(id, "more", "mood", "cosy")).toBe("not-learning");
    }
  });

  it("Start over forgets the person's chips and Good pick answers, and nobody else's", async () => {
    const me = await adult();
    const other = await adult();
    const game = await makerWithGame();
    for (const id of [me, other]) {
      await taste.add(id, "more", "mood", "cosy");
      await taste.asking(id, game.gameId);
    }
    clock.advance(60_000);
    await taste.startOver(me);
    expect(await db().feedTaste.count({ where: { userId: me } })).toBe(0);
    expect(await db().goodPickAsked.count({ where: { userId: me } })).toBe(0);
    expect((await db().user.findUniqueOrThrow({ where: { id: me } })).feedResetAt).toEqual(
      new Date(clock.epochMs()),
    );
    expect(await db().feedTaste.count({ where: { userId: other } })).toBe(1);
    expect(await db().goodPickAsked.count({ where: { userId: other } })).toBe(1);
  });
});

describe("Good pick?", () => {
  it("is asked once per game, answered once, and Yes and No keep a game chip", async () => {
    const me = await adult();
    const yes = await makerWithGame();
    const no = await makerWithGame();
    expect(await taste.answer(me, yes.slug, true)).toBe("not-asked");

    expect(await taste.asking(me, yes.gameId)).toBe(true);
    expect(await taste.asking(me, yes.gameId)).toBe(false);
    expect(await taste.answer(me, yes.slug, true)).toBe("saved");
    expect(await taste.answer(me, yes.slug, false)).toBe("not-asked");

    await taste.asking(me, no.gameId);
    expect(await taste.answer(me, no.slug, false)).toBe("saved");

    const view = await taste.view(me);
    expect(view.more.map((chip) => chip.words)).toEqual([yes.name]);
    expect(view.less.map((chip) => chip.words)).toEqual([no.name]);
    expect(
      (
        await db().goodPickAsked.findMany({
          where: { userId: me },
          orderBy: { askedAt: "asc" },
          select: { answer: true },
        })
      )
        .map((row) => row.answer)
        .sort(),
    ).toEqual(["no", "yes"]);
  });
});
