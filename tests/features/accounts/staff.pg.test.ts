import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  attachPhoneToAccount,
  firstGameStaff,
  GAME_STAFF_ROLES,
  grantFirstOwner,
  staffRolesOf,
} from "../../../src/features/accounts/staff.ts";
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

describe("firstGameStaff", () => {
  // Like the first-owner rule, this is about the whole table, so each case starts from an empty one.
  beforeEach(async () => {
    await db().staffAssignment.deleteMany();
  });

  it("is the roles that check games, and no other", () => {
    expect(GAME_STAFF_ROLES).toEqual(["owner", "head_curator", "curator"]);
  });

  it("is null with no staff at all", async () => {
    expect(await firstGameStaff(db())).toBeNull();
  });

  it("is null when the only staff role is one that does not check games", async () => {
    const userId = await newUser("+13125550202");
    await db().staffAssignment.create({ data: { userId, role: "finance" } });

    expect(await firstGameStaff(db())).toBeNull();
  });

  it("is the older of two curators", async () => {
    const older = await newUser("+13125550203");
    const newer = await newUser("+13125550204");
    await db().staffAssignment.create({ data: { userId: older, role: "curator" } });
    await db().staffAssignment.create({ data: { userId: newer, role: "curator" } });

    expect(await firstGameStaff(db())).toBe(older);
  });

  it("is the owner that grantFirstOwner made", async () => {
    const userId = await newUser("+13125550205");
    await grantFirstOwner(db(), "+13125550205");

    expect(await firstGameStaff(db())).toBe(userId);
  });
});

describe("attachPhoneToAccount", () => {
  /** An account made by email before sign-in moved to phone numbers: an email and no number. */
  async function oldAccount(email: string): Promise<string> {
    return (await db().user.create({ data: { name: "Old", email } })).id;
  }

  it("gives an account with no number its number, and changes nothing else about it", async () => {
    const userId = await oldAccount("old-one@example.test");
    await db().staffAssignment.create({ data: { userId, role: "owner" } });

    expect(await attachPhoneToAccount(db(), "old-one@example.test", "+1 (312) 555-0301")).toBe("attached");

    const user = await db().user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.phoneNumber).toBe("+13125550301");
    expect(user.email).toBe("old-one@example.test");
    expect(await staffRolesOf(db(), userId)).toContain("owner");
  });

  it("stores the 18th birthday it is given for an account with no age, and keeps one already on file", async () => {
    const none = await oldAccount("old-age-none@example.test");
    const known = await oldAccount("old-age-known@example.test");
    await db().user.update({ where: { id: known }, data: { adultOn: new Date("2030-05-05T00:00:00Z") } });

    expect(await attachPhoneToAccount(db(), "old-age-none@example.test", "+13125550311", "2000-01-02")).toBe(
      "attached",
    );
    expect(await attachPhoneToAccount(db(), "old-age-known@example.test", "+13125550312", "2000-01-02")).toBe(
      "attached",
    );

    expect((await db().user.findUniqueOrThrow({ where: { id: none } })).adultOn?.toISOString()).toBe(
      "2000-01-02T00:00:00.000Z",
    );
    expect((await db().user.findUniqueOrThrow({ where: { id: known } })).adultOn?.toISOString()).toBe(
      "2030-05-05T00:00:00.000Z",
    );
  });

  it("finds the account whatever the case of its email", async () => {
    await oldAccount("Old-Two@Example.test");

    expect(await attachPhoneToAccount(db(), " old-two@example.test ", "+13125550302")).toBe("attached");
  });

  it("says so when there is no account with that email, and adds no number", async () => {
    expect(await attachPhoneToAccount(db(), "nobody@example.test", "+13125550303")).toBe("no_account");
    expect(await db().user.count({ where: { phoneNumber: "+13125550303" } })).toBe(0);
  });

  it("will not replace a number the account already has", async () => {
    await newUser("+13125550304");
    const user = await db().user.findFirstOrThrow({ where: { phoneNumber: "+13125550304" } });

    expect(await attachPhoneToAccount(db(), user.email, "+13125550305")).toBe("has_number");

    expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).phoneNumber).toBe("+13125550304");
  });

  it("will not give a number another account already has", async () => {
    await newUser("+13125550306");
    const old = await oldAccount("old-three@example.test");

    expect(await attachPhoneToAccount(db(), "old-three@example.test", "+13125550306")).toBe("number_taken");

    expect((await db().user.findUniqueOrThrow({ where: { id: old } })).phoneNumber).toBeNull();
  });

  it("refuses a number that is not a phone number", async () => {
    const old = await oldAccount("old-four@example.test");

    expect(await attachPhoneToAccount(db(), "old-four@example.test", "banana")).toBe("bad_number");

    expect((await db().user.findUniqueOrThrow({ where: { id: old } })).phoneNumber).toBeNull();
  });
});
