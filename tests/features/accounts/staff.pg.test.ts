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

let made = 0;
/** A person with the phone number given (their stand-in email is made up, as sign-up makes it). */
async function newUser(phoneNumber: string): Promise<string> {
  made += 1;
  const user = await db().user.create({
    data: { name: "Player", email: `staff-${String(made)}@phone.ruken.invalid`, phoneNumber },
  });
  return user.id;
}

describe("staffRolesOf", () => {
  it("answers nothing for a person with no StaffAssignment row", async () => {
    const userId = await newUser("+13125550101");
    expect(await staffRolesOf(db(), userId)).toEqual([]);
  });

  it("answers the roles a person has been given, read fresh each time", async () => {
    const userId = await newUser("+13125550102");
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

  it("makes the account with that number the owner, when nobody is staff yet", async () => {
    const userId = await newUser("+13125550103");

    expect(await grantFirstOwner(db(), "+13125550103")).toBe("granted");

    expect(await staffRolesOf(db(), userId)).toEqual(["owner"]);
  });

  it("finds the account whatever way the number was typed", async () => {
    const userId = await newUser("+13125550104");

    expect(await grantFirstOwner(db(), " +1 (312) 555-0104 ")).toBe("granted");

    expect(await staffRolesOf(db(), userId)).toEqual(["owner"]);
  });

  it("never makes a second staff account, for anyone, and adds nothing", async () => {
    await newUser("+13125550105");
    const other = await newUser("+13125550106");
    await grantFirstOwner(db(), "+13125550105");

    expect(await grantFirstOwner(db(), "+13125550106")).toBe("already_one");
    expect(await grantFirstOwner(db(), "+13125550105")).toBe("already_one");

    expect(await staffRolesOf(db(), other)).toEqual([]);
    expect(await db().staffAssignment.count()).toBe(1);
  });

  it("says there is no account for a number nobody signed up with, and adds nothing", async () => {
    expect(await grantFirstOwner(db(), "+13125550107")).toBe("no_account");

    expect(await db().staffAssignment.count()).toBe(0);
  });

  it("makes one owner and not two when two calls come at the same moment", async () => {
    await newUser("+13125550108");
    await newUser("+13125550109");

    const answers = await Promise.all([
      grantFirstOwner(db(), "+13125550108"),
      grantFirstOwner(db(), "+13125550109"),
    ]);

    expect([...answers].sort()).toEqual(["already_one", "granted"]);
    expect(await db().staffAssignment.count()).toBe(1);
  });
});
