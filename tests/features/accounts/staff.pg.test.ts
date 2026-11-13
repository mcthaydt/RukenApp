import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { staffRolesOf } from "../../../src/features/accounts/staff.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

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

async function newUser(email: string): Promise<string> {
  const user = await db().user.create({ data: { name: "Player", email } });
  return user.id;
}

describe("staffRolesOf", () => {
  it("answers nothing for a person with no StaffAssignment row", async () => {
    const userId = await newUser("player@example.test");
    expect(await staffRolesOf(db(), userId)).toEqual([]);
  });

  it("answers the roles a person has been given, read fresh each time", async () => {
    const userId = await newUser("staff@example.test");
    await db().staffAssignment.create({ data: { userId, role: "owner" } });
    expect(await staffRolesOf(db(), userId)).toEqual(["owner"]);

    await db().staffAssignment.create({ data: { userId, role: "support" } });
    expect((await staffRolesOf(db(), userId)).sort()).toEqual(["owner", "support"]);
  });
});
