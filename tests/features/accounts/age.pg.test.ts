import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgeError, setBirthDate } from "../../../src/features/accounts/age.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// The age question is answered once, and only the 18th birthday is stored.

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

const clock = new TestClock("2026-10-14T17:00:00Z");

let counter = 0;
async function newUser(): Promise<string> {
  counter += 1;
  const user = await db().user.create({ data: { name: "Sam", email: `age${String(counter)}@example.test` } });
  return user.id;
}

async function adultOnOf(userId: string): Promise<string | null> {
  const row = await db().user.findUniqueOrThrow({ where: { id: userId } });
  return row.adultOn === null ? null : row.adultOn.toISOString().slice(0, 10);
}

describe("setBirthDate", () => {
  it("stores the 18th birthday, never the birth date, and answers whether the player is a minor", async () => {
    const minor = await newUser();
    expect(
      await setBirthDate(db(), clock, { userId: minor, date: { year: 2010, month: 5, day: 3 } }),
    ).toEqual({ minor: true });
    expect(await adultOnOf(minor)).toBe("2028-05-03");

    const adult = await newUser();
    expect(
      await setBirthDate(db(), clock, { userId: adult, date: { year: 1990, month: 1, day: 9 } }),
    ).toEqual({ minor: false });
    expect(await adultOnOf(adult)).toBe("2008-01-09");
  });

  it("is answered once: a second answer is AGE_ALREADY_SET and changes nothing", async () => {
    const userId = await newUser();
    await setBirthDate(db(), clock, { userId, date: { year: 2010, month: 5, day: 3 } });
    await expect(
      setBirthDate(db(), clock, { userId, date: { year: 1990, month: 1, day: 9 } }),
    ).rejects.toThrow(new AgeError("AGE_ALREADY_SET"));
    expect(await adultOnOf(userId)).toBe("2028-05-03");
  });

  it("refuses under 13 and writes nothing", async () => {
    const userId = await newUser();
    await expect(
      setBirthDate(db(), clock, { userId, date: { year: 2015, month: 1, day: 1 } }),
    ).rejects.toThrow(new AgeError("AGE_NOT_ALLOWED"));
    expect(await adultOnOf(userId)).toBeNull();
  });

  it("refuses an impossible or future date and writes nothing", async () => {
    const userId = await newUser();
    await expect(
      setBirthDate(db(), clock, { userId, date: { year: 2010, month: 2, day: 30 } }),
    ).rejects.toThrow(new AgeError("INVALID_DATE"));
    await expect(
      setBirthDate(db(), clock, { userId, date: { year: 2030, month: 1, day: 1 } }),
    ).rejects.toThrow(new AgeError("INVALID_DATE"));
    expect(await adultOnOf(userId)).toBeNull();
  });
});
