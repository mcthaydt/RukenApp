import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { grantFirstOwner, staffRolesOf } from "../../../src/features/accounts/staff.ts";
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

describe("grantFirstOwner", () => {
  // The rule is about a table with no row in it, so each case starts from an empty one (rows may be removed).
  beforeEach(async () => {
    await db().staffAssignment.deleteMany();
  });

  it("makes the account with that address the owner, when nobody is staff yet", async () => {
    const userId = await newUser("first@example.test");

    expect(await grantFirstOwner(db(), "first@example.test")).toBe("granted");

    expect(await staffRolesOf(db(), userId)).toEqual(["owner"]);
  });

  it("finds the account whatever the case or spaces of what was typed", async () => {
    const userId = await newUser("typed@example.test");

    expect(await grantFirstOwner(db(), "  Typed@Example.TEST ")).toBe("granted");

    expect(await staffRolesOf(db(), userId)).toEqual(["owner"]);
  });

  it("never makes a second staff account, for anyone, and adds nothing", async () => {
    await newUser("one@example.test");
    const other = await newUser("two@example.test");
    await grantFirstOwner(db(), "one@example.test");

    expect(await grantFirstOwner(db(), "two@example.test")).toBe("already_one");
    expect(await grantFirstOwner(db(), "one@example.test")).toBe("already_one");

    expect(await staffRolesOf(db(), other)).toEqual([]);
    expect(await db().staffAssignment.count()).toBe(1);
  });

  it("says there is no account for an address nobody signed up with, and adds nothing", async () => {
    expect(await grantFirstOwner(db(), "nobody@example.test")).toBe("no_account");

    expect(await db().staffAssignment.count()).toBe(0);
  });

  it("makes one owner and not two when two calls come at the same moment", async () => {
    await newUser("race-a@example.test");
    await newUser("race-b@example.test");

    const answers = await Promise.all([
      grantFirstOwner(db(), "race-a@example.test"),
      grantFirstOwner(db(), "race-b@example.test"),
    ]);

    expect([...answers].sort()).toEqual(["already_one", "granted"]);
    expect(await db().staffAssignment.count()).toBe(1);
  });
});
