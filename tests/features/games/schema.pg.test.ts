import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPublicId } from "../../../src/features/games/ids.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// These tests use plain SQL on purpose: they check what the database itself refuses (the CHECK rules,
// the append-only trigger, the unique keys), whatever the application code does.

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

let counter = 0;

async function newMaker(): Promise<string> {
  counter += 1;
  const user = await db().user.create({
    data: { name: "Maker", email: `maker-${String(counter)}@example.test` },
  });
  return user.id;
}

/** The values a test may change; everything else is a plain, valid game. */
interface GameValues {
  publicId?: string;
  slug?: string;
  repoFolder?: string;
  state?: "draft" | "live";
  livePullId?: string | null;
  /** Null makes a game that was never asked who it is for. The default is a game that was. */
  ageRating?: "age_12" | null;
}

/** One game row, by plain SQL, so a test can offer the database values the application would never make. */
async function insertGame(makerUserId: string, values: GameValues = {}): Promise<string> {
  counter += 1;
  const id = randomUUID();
  const publicId = values.publicId ?? "abcdefghij";
  const slug = values.slug ?? `game-${String(counter)}`;
  const repoFolder = values.repoFolder ?? "";
  const state = values.state ?? "draft";
  const livePullId = values.livePullId ?? null;
  const ageRating = values.ageRating === undefined ? "age_12" : values.ageRating;
  await db().$executeRaw`
    INSERT INTO "Game"
      ("id", "publicId", "slug", "makerUserId", "name", "oneLine", "playsOn", "state", "repoFullName",
       "repoFolder", "livePullId", "ageRating", "updatedAt")
    VALUES
      (${id}, ${publicId}, ${slug}, ${makerUserId}, 'A game', 'A game about a thing.',
       'phone_and_computer'::"GamePlaysOn", ${state}::"GameState", 'acme/game', ${repoFolder}, ${livePullId},
       ${ageRating}::"AgeRating", now())`;
  return id;
}

/** One pull row; the commit and the counts are the ones a test may want to spoil. */
async function insertPull(input: {
  gameId: string;
  commitSha?: string;
  fileCount?: number;
  totalBytes?: bigint;
}): Promise<string> {
  const id = randomUUID();
  const commitSha = input.commitSha ?? "a".repeat(40);
  const fileCount = input.fileCount ?? 3;
  const totalBytes = input.totalBytes ?? 1_000n;
  await db().$executeRaw`
    INSERT INTO "GamePull"
      ("id", "gameId", "commitSha", "fileCount", "totalBytes", "connectHosts", "pulledAt")
    VALUES
      (${id}, ${input.gameId}, ${commitSha}, ${fileCount}, ${totalBytes}, ARRAY[]::TEXT[], now())`;
  return id;
}

async function insertClip(gameId: string, shape: "upright" | "wide", key: string): Promise<void> {
  await db().$executeRaw`
    INSERT INTO "GameClip" ("id", "gameId", "shape", "key", "contentType", "bytes", "updatedAt")
    VALUES (${randomUUID()}, ${gameId}, ${shape}::"ClipShape", ${key}, 'video/mp4', 1000, now())`;
}

/**
 * Gives a game a rating and marks, by plain SQL. The values are the test's own fixed words, never typed by a
 * person, so they are written into the statement: Postgres will not take an array of enum labels as a parameter.
 */
async function setRatingAndMarks(gameId: string, ageRating: string | null, marks: string[]): Promise<void> {
  const rating = ageRating === null ? "NULL" : `'${ageRating}'::"AgeRating"`;
  const list = marks.map((mark) => `'${mark}'`).join(", ");
  await db().$executeRawUnsafe(
    `UPDATE "Game" SET "ageRating" = ${rating}, "contentMarks" = ARRAY[${list}]::"ContentMark"[] WHERE "id" = $1`,
    gameId,
  );
}

describe("the games tables", () => {
  it("are made by the migrations", async () => {
    const rows = await db().$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    expect(rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(["Game", "GamePull", "GameClip"]),
    );
  });

  describe("a game", () => {
    it("is refused a public id that is not ten characters of a-z and 2-7", async () => {
      const makerId = await newMaker();
      for (const publicId of ["FLOOR50", "abcdefghi1", "abcdefghi", "abcdefghijk"]) {
        await expect(insertGame(makerId, { publicId })).rejects.toThrow(/Game_publicId_check/);
      }
    });

    it("is refused a slug with a slash, a capital or a space", async () => {
      const makerId = await newMaker();
      for (const slug of ["a/b/c", "Floor-fifty", "floor fifty", "-floor", "floor-", "fl", "a".repeat(41)]) {
        await expect(insertGame(makerId, { slug })).rejects.toThrow(/Game_slug_check/);
      }
    });

    it("is refused a folder that climbs out of the repository", async () => {
      const makerId = await newMaker();
      for (const repoFolder of ["../x", "/x", "x/", "a/../b", "x".repeat(201)]) {
        await expect(insertGame(makerId, { repoFolder })).rejects.toThrow(/Game_repoFolder_check/);
      }
      await insertGame(makerId, { repoFolder: "", publicId: "aaaaaaaaaa" });
      await insertGame(makerId, { repoFolder: "web/build", publicId: "bbbbbbbbbb" });
    });

    it("is refused to be live with no files", async () => {
      const makerId = await newMaker();
      await expect(insertGame(makerId, { state: "live", livePullId: null })).rejects.toThrow(
        /Game_live_check/,
      );
    });

    it("is new with no rating, no marks and nothing to fix", async () => {
      const makerId = await newMaker();
      const id = await insertGame(makerId, { publicId: "jjjjjjjjjj", ageRating: null });
      const game = await db().game.findUniqueOrThrow({ where: { id } });
      expect(game.ageRating).toBeNull();
      expect(game.contentMarks).toEqual([]);
      expect(game.toFix).toEqual([]);
    });

    it("is refused marks unless it is 18+", async () => {
      const makerId = await newMaker();
      const id = await insertGame(makerId, { publicId: "kkkkkkkkkk" });
      for (const rating of ["age_3", "age_12", "age_16", null]) {
        await expect(setRatingAndMarks(id, rating, ["gore"])).rejects.toThrow(/Game_marks_check/);
      }
    });

    it("is refused None of these beside another mark", async () => {
      const makerId = await newMaker();
      const id = await insertGame(makerId, { publicId: "llllllllll" });
      await expect(setRatingAndMarks(id, "age_18", ["gore", "none"])).rejects.toThrow(/Game_marks_check/);
    });

    it("keeps an 18+ game's marks, and None of these on its own", async () => {
      const makerId = await newMaker();
      const id = await insertGame(makerId, { publicId: "mmmmmmmmmm" });
      await setRatingAndMarks(id, "age_18", ["gore", "drugs"]);
      await setRatingAndMarks(id, "age_18", ["none"]);
      const game = await db().game.findUniqueOrThrow({ where: { id } });
      expect(game.contentMarks).toEqual(["none"]);
    });

    it("keeps its public id and its address to itself", async () => {
      const makerId = await newMaker();
      await insertGame(makerId, { publicId: "cccccccccc", slug: "the-one" });
      await expect(insertGame(makerId, { publicId: "cccccccccc", slug: "another" })).rejects.toThrow(
        /Game_publicId_key/,
      );
      await expect(insertGame(makerId, { publicId: "dddddddddd", slug: "the-one" })).rejects.toThrow(
        /Game_slug_key/,
      );
    });
  });

  describe("a pull", () => {
    it("cannot be changed or deleted", async () => {
      const makerId = await newMaker();
      const gameId = await insertGame(makerId, { publicId: "eeeeeeeeee" });
      await insertPull({ gameId });
      await expect(db().$executeRaw`UPDATE "GamePull" SET "fileCount" = 99`).rejects.toThrow(
        /GamePull is append-only/,
      );
      await expect(db().$executeRaw`DELETE FROM "GamePull"`).rejects.toThrow(/GamePull is append-only/);
    });

    it("is refused a commit that is not 40 hex characters", async () => {
      const makerId = await newMaker();
      const gameId = await insertGame(makerId, { publicId: "ffffffffff" });
      for (const commitSha of ["main", "A".repeat(40), "a".repeat(39)]) {
        await expect(insertPull({ gameId, commitSha })).rejects.toThrow(/GamePull_commitSha_check/);
      }
    });

    it("is refused for a game of nothing", async () => {
      const makerId = await newMaker();
      const gameId = await insertGame(makerId, { publicId: "gggggggggg" });
      await expect(insertPull({ gameId, fileCount: 0 })).rejects.toThrow(/GamePull_counts_check/);
      await expect(insertPull({ gameId, totalBytes: 0n })).rejects.toThrow(/GamePull_counts_check/);
    });

    it("can be the files a game is live on", async () => {
      const makerId = await newMaker();
      const gameId = await insertGame(makerId, { publicId: "hhhhhhhhhh" });
      const pullId = await insertPull({ gameId });
      await db()
        .$executeRaw`UPDATE "Game" SET "state" = 'live', "livePullId" = ${pullId} WHERE "id" = ${gameId}`;
      const rows = await db().$queryRaw<
        { state: string }[]
      >`SELECT "state"::text FROM "Game" WHERE "id" = ${gameId}`;
      expect(rows).toEqual([{ state: "live" }]);
    });
  });

  describe("a clip", () => {
    it("is kept once per shape per game", async () => {
      const makerId = await newMaker();
      const gameId = await insertGame(makerId, { publicId: "iiiiiiiiii" });
      await insertClip(gameId, "upright", "clips/iiiiiiiiii/upright-0000000000000001.mp4");
      await insertClip(gameId, "wide", "clips/iiiiiiiiii/wide-0000000000000002.mp4");
      await expect(
        insertClip(gameId, "upright", "clips/iiiiiiiiii/upright-0000000000000003.mp4"),
      ).rejects.toThrow(/GameClip_gameId_shape_key/);
    });
  });
});

/** A game with nothing answered but its name: no line, no place to play, no repository, no rating. */
async function insertBareGame(makerUserId: string, publicId: string, state = "draft"): Promise<string> {
  counter += 1;
  const id = randomUUID();
  await db().$executeRawUnsafe(
    `INSERT INTO "Game" ("id", "publicId", "slug", "makerUserId", "name", "state", "updatedAt")
     VALUES ($1, $2, $3, $4, 'A game', '${state}'::"GameState", now())`,
    id,
    publicId,
    `bare-${String(counter)}`,
    makerUserId,
  );
  return id;
}

describe("a game that is answered one question at a time", () => {
  it("is kept as a draft with no line, no place to play and no repository", async () => {
    const makerId = await newMaker();
    const id = await insertBareGame(makerId, "nnnnnnnnnn");
    const game = await db().game.findUniqueOrThrow({ where: { id } });
    expect(game).toMatchObject({ oneLine: null, playsOn: null, repoFullName: null, state: "draft" });
  });

  it("is refused as waiting while an answer is missing", async () => {
    const makerId = await newMaker();
    const id = await insertBareGame(makerId, "pppppppppp");
    await expect(db().$executeRaw`UPDATE "Game" SET "state" = 'waiting' WHERE "id" = ${id}`).rejects.toThrow(
      /Game_answered_check/,
    );
  });

  it("is refused as waiting when it is 18+ and has no marks, and kept once it has them", async () => {
    const makerId = await newMaker();
    const id = await insertGame(makerId, { publicId: "qqqqqqqqqq" });
    await setRatingAndMarks(id, "age_18", []);
    await expect(db().$executeRaw`UPDATE "Game" SET "state" = 'waiting' WHERE "id" = ${id}`).rejects.toThrow(
      /Game_answered_check/,
    );

    await setRatingAndMarks(id, "age_18", ["none"]);
    await db().$executeRaw`UPDATE "Game" SET "state" = 'waiting' WHERE "id" = ${id}`;
  });

  it("can be thrown away", async () => {
    const makerId = await newMaker();
    const id = await insertBareGame(makerId, "rrrrrrrrrr");
    await db().$executeRaw`UPDATE "Game" SET "state" = 'thrown_away' WHERE "id" = ${id}`;
  });
});

describe("the parts of a review", () => {
  /** A sent-back review of a game, by plain SQL, and the id to hang its parts on. */
  async function insertReview(): Promise<string> {
    const makerId = await newMaker();
    const gameId = await insertGame(makerId, { publicId: newPublicId() });
    const pullId = await insertPull({ gameId });
    const reviewId = randomUUID();
    await db().$executeRaw`
      INSERT INTO "GameReview" ("id", "gameId", "pullId", "staffUserId", "decision", "decidedAt")
      VALUES (${reviewId}, ${gameId}, ${pullId}, ${makerId}, 'sent_back'::"ReviewDecision", now())`;
    return reviewId;
  }

  async function insertPart(reviewId: string, part: string, reason: string, note: string | null) {
    await db().$executeRawUnsafe(
      `INSERT INTO "GameReviewPart" ("id", "reviewId", "part", "reason", "note")
       VALUES ($1, $2, '${part}'::"GamePart", $3, $4)`,
      randomUUID(),
      reviewId,
      reason,
      note,
    );
  }

  it("is added and never changed or removed", async () => {
    const reviewId = await insertReview();
    await insertPart(reviewId, "name", "rude", null);

    await expect(db().$executeRaw`UPDATE "GameReviewPart" SET "reason" = 'x'`).rejects.toThrow(
      /GameReviewPart is append-only/,
    );
    await expect(db().$executeRaw`DELETE FROM "GameReviewPart"`).rejects.toThrow(
      /GameReviewPart is append-only/,
    );
  });

  it("holds a part once for a review", async () => {
    const reviewId = await insertReview();
    await insertPart(reviewId, "name", "rude", null);

    await expect(insertPart(reviewId, "name", "not_this_game", null)).rejects.toThrow(
      /GameReviewPart_reviewId_part_key/,
    );
  });

  it("needs staff's own line for Something else, and keeps a line to 500 characters", async () => {
    const reviewId = await insertReview();

    await expect(insertPart(reviewId, "one_line", "something_else", null)).rejects.toThrow(
      /GameReviewPart_note_check/,
    );
    await expect(insertPart(reviewId, "files", "breaks", "x".repeat(501))).rejects.toThrow(
      /GameReviewPart_note_check/,
    );
    await insertPart(reviewId, "one_line", "something_else", "Say what the game is.");
  });
});

describe("decision days", () => {
  /** A review of a new game, by plain SQL, with the day it goes out on (null: it took effect at once). */
  async function insertReview(goesOutOn: string | null): Promise<string> {
    const makerId = await newMaker();
    const gameId = await insertGame(makerId, { publicId: newPublicId() });
    const pullId = await insertPull({ gameId });
    const reviewId = randomUUID();
    await db().$executeRaw`
      INSERT INTO "GameReview" ("id", "gameId", "pullId", "staffUserId", "decision", "decidedAt", "goesOutOn")
      VALUES (${reviewId}, ${gameId}, ${pullId}, ${makerId}, 'accepted'::"ReviewDecision", now(), ${goesOutOn}::date)`;
    return reviewId;
  }

  it("leave a decision's day empty when it took effect at once, and keep it when it was held", async () => {
    const atOnce = await insertReview(null);
    const held = await insertReview("2026-11-27");
    const rows = await db().$queryRaw<{ id: string; goesOutOn: string | null }[]>`
      SELECT "id", to_char("goesOutOn", 'YYYY-MM-DD') AS "goesOutOn" FROM "GameReview"
      WHERE "id" IN (${atOnce}, ${held})`;
    expect(rows.find((row) => row.id === atOnce)?.goesOutOn).toBeNull();
    expect(rows.find((row) => row.id === held)?.goesOutOn).toBe("2026-11-27");
  });

  it("never change the day a decision goes out on", async () => {
    const reviewId = await insertReview("2026-11-27");
    await expect(
      db().$executeRaw`UPDATE "GameReview" SET "goesOutOn" = '2026-12-04'::date WHERE "id" = ${reviewId}`,
    ).rejects.toThrow(/GameReview is append-only/);
  });

  it("hold a day once, added and never changed or removed", async () => {
    await db().$executeRaw`
      INSERT INTO "DecisionDay" ("id", "day", "seats", "wentOutAt")
      VALUES (${randomUUID()}, '2026-11-27'::date, 10, now())`;
    await expect(
      db().$executeRaw`
        INSERT INTO "DecisionDay" ("id", "day", "seats", "wentOutAt")
        VALUES (${randomUUID()}, '2026-11-27'::date, 10, now())`,
    ).rejects.toThrow(/DecisionDay_day_key/);
    await expect(db().$executeRaw`UPDATE "DecisionDay" SET "seats" = 11`).rejects.toThrow(
      /DecisionDay is append-only/,
    );
    await expect(db().$executeRaw`DELETE FROM "DecisionDay"`).rejects.toThrow(/DecisionDay is append-only/);
  });

  it("refuse a day with no seats, or more than 500", async () => {
    for (const seats of [0, 501]) {
      await expect(
        db().$executeRaw`
          INSERT INTO "DecisionDay" ("id", "day", "seats", "wentOutAt")
          VALUES (${randomUUID()}, '2030-01-04'::date, ${seats}, now())`,
      ).rejects.toThrow(/DecisionDay_seats_check/);
    }
  });

  it("hold one outcome for a review, added and never changed or removed", async () => {
    const reviewId = await insertReview("2026-12-04");
    await db().$executeRaw`
      INSERT INTO "DecisionOutcome" ("id", "reviewId", "result")
      VALUES (${randomUUID()}, ${reviewId}, 'applied'::"DecisionResult")`;
    await expect(
      db().$executeRaw`
        INSERT INTO "DecisionOutcome" ("id", "reviewId", "result")
        VALUES (${randomUUID()}, ${reviewId}, 'lapsed'::"DecisionResult")`,
    ).rejects.toThrow(/DecisionOutcome_reviewId_key/);
    await expect(
      db().$executeRaw`UPDATE "DecisionOutcome" SET "result" = 'lapsed'::"DecisionResult"`,
    ).rejects.toThrow(/DecisionOutcome is append-only/);
    await expect(db().$executeRaw`DELETE FROM "DecisionOutcome"`).rejects.toThrow(
      /DecisionOutcome is append-only/,
    );
  });

  it("refuse an outcome of a result that is neither applied nor lapsed", async () => {
    const reviewId = await insertReview("2026-12-11");
    await expect(
      db().$executeRaw`
        INSERT INTO "DecisionOutcome" ("id", "reviewId", "result")
        VALUES (${randomUUID()}, ${reviewId}, 'maybe'::"DecisionResult")`,
    ).rejects.toThrow(/invalid input value for enum "DecisionResult"/);
  });

  it("keep when the maker last changed a waiting game, and when they saw the Accepted screen, empty until then", async () => {
    const makerId = await newMaker();
    const gameId = await insertGame(makerId, { publicId: newPublicId() });
    const [row] = await db().$queryRaw<{ changedAt: Date | null; acceptedSeenAt: Date | null }[]>`
      SELECT "changedAt", "acceptedSeenAt" FROM "Game" WHERE "id" = ${gameId}`;
    expect(row).toEqual({ changedAt: null, acceptedSeenAt: null });
  });
});
