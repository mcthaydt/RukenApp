import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agree, hasAgreed, MAKER_AGREEMENT_VERSION } from "../../../src/features/make/make.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

let database: TestDatabase | undefined;
const clock = new TestClock("2026-11-14T12:00:00Z");

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

describe("what a maker agreed to", () => {
  it("is not agreed to, and then is", async () => {
    const maker = await createUser(db());
    expect(await hasAgreed(db(), maker)).toBe(false);

    await agree(db(), clock, maker);

    expect(await hasAgreed(db(), maker)).toBe(true);
    expect(await db().makerAgreement.findUniqueOrThrow({ where: { userId: maker } })).toMatchObject({
      version: MAKER_AGREEMENT_VERSION,
      acceptedAt: new Date(clock.epochMs()),
    });
  });

  it("is one row, however many times it is agreed to", async () => {
    const maker = await createUser(db());

    await agree(db(), clock, maker);
    clock.advance(1_000);
    await agree(db(), clock, maker);

    expect(await db().makerAgreement.count({ where: { userId: maker } })).toBe(1);
  });

  it("is another maker's own: one maker agreeing does not agree for another", async () => {
    const one = await createUser(db());
    const two = await createUser(db());
    await agree(db(), clock, one);

    expect(await hasAgreed(db(), two)).toBe(false);
  });

  it("is only ever added: a row cannot be changed or deleted", async () => {
    const maker = await createUser(db());
    await agree(db(), clock, maker);

    await expect(
      db().$executeRaw`UPDATE "MakerAgreement" SET "version" = '2' WHERE "userId" = ${maker}`,
    ).rejects.toThrow(/MakerAgreement is append-only/);
    await expect(db().$executeRaw`DELETE FROM "MakerAgreement"`).rejects.toThrow(
      /MakerAgreement is append-only/,
    );
  });
});
