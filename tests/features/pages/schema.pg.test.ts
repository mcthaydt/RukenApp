import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// These tests use plain SQL on purpose: they check what the database itself refuses (the CHECK rules, the
// unique keys, the cascade), whatever the application code does.

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

async function newUser(): Promise<string> {
  counter += 1;
  const user = await db().user.create({
    data: { name: "Maker", email: `maker-${String(counter)}@example.test` },
  });
  return user.id;
}

/** The values a test may spoil; everything else is a plain, valid page. */
interface PageValues {
  handle?: string;
  name?: string;
  oneLine?: string;
  views?: number;
  themeId?: number;
}

/** One page row, by plain SQL, so a test can offer the database values the application would never make. */
async function insertPage(userId: string, values: PageValues = {}): Promise<string> {
  counter += 1;
  const id = randomUUID();
  const handle = values.handle ?? `maker-${String(counter)}`;
  const name = values.name ?? "A maker";
  const oneLine = values.oneLine ?? "";
  const views = values.views ?? 0;
  const themeId = values.themeId ?? 0;
  await db().$executeRaw`
    INSERT INTO "MakerPage" ("id", "userId", "handle", "name", "oneLine", "views", "themeId", "updatedAt")
    VALUES (${id}, ${userId}, ${handle}, ${name}, ${oneLine}, ${views}, ${themeId}, now())`;
  return id;
}

/** The values a test may spoil in a link. */
interface LinkValues {
  title?: string;
  url?: string;
  taps?: number;
}

async function insertLink(pageId: string, values: LinkValues = {}): Promise<string> {
  const id = randomUUID();
  const title = values.title ?? "Steam";
  const url = values.url ?? "https://x.test";
  const taps = values.taps ?? 0;
  await db().$executeRaw`
    INSERT INTO "PageLink" ("id", "pageId", "kind", "title", "url", "position", "taps", "updatedAt")
    VALUES (${id}, ${pageId}, 'link'::"PageLinkKind", ${title}, ${url}, 0, ${taps}, now())`;
  return id;
}

describe("the pages tables", () => {
  it("makes the pages tables", async () => {
    const rows = await db().$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    expect(rows.map((row) => row.table_name)).toEqual(expect.arrayContaining(["MakerPage", "PageLink"]));
  });

  it("gives one account one page, and one address one page", async () => {
    const owner = await newUser();
    await insertPage(owner, { handle: "first-one" });
    await expect(insertPage(owner, { handle: "second-one" })).rejects.toThrow();
    const other = await newUser();
    await expect(insertPage(other, { handle: "first-one" })).rejects.toThrow();
  });

  it("refuses an address with a capital, a slash, a space, a doubled hyphen, or of 2 or 31 characters", async () => {
    const bad = ["Maker", "ma/ker", "ma ker", "ma--ker", "-maker", "maker-", "ab", "a".repeat(31)];
    for (const handle of bad) {
      await expect(insertPage(await newUser(), { handle }), handle).rejects.toThrow();
    }
    await expect(insertPage(await newUser(), { handle: "abc" })).resolves.toEqual(expect.any(String));
    await expect(insertPage(await newUser(), { handle: "a-b-c" })).resolves.toEqual(expect.any(String));
    await expect(insertPage(await newUser(), { handle: "a".repeat(30) })).resolves.toEqual(
      expect.any(String),
    );
  });

  it("refuses a name of no characters or of 41, a one line of 101, and a count below zero", async () => {
    await expect(insertPage(await newUser(), { name: "" })).rejects.toThrow();
    await expect(insertPage(await newUser(), { name: "a".repeat(41) })).rejects.toThrow();
    await expect(insertPage(await newUser(), { oneLine: "a".repeat(101) })).rejects.toThrow();
    await expect(insertPage(await newUser(), { views: -1 })).rejects.toThrow();
    await expect(insertPage(await newUser(), { themeId: -1 })).rejects.toThrow();
    await expect(
      insertPage(await newUser(), { name: "a".repeat(40), oneLine: "a".repeat(100) }),
    ).resolves.toEqual(expect.any(String));
  });

  it("refuses a link that is not https", async () => {
    // Review Focus 5
    const page = await insertPage(await newUser());
    await expect(insertLink(page, { url: "http://x.test" })).rejects.toThrow();
    await expect(insertLink(page, { url: "javascript:alert(1)" })).rejects.toThrow();
    await expect(insertLink(page, { url: "HTTPS://x.test" })).rejects.toThrow();
    await expect(insertLink(page, { url: "https://x.test" })).resolves.toEqual(expect.any(String));
  });

  it("refuses a link's name of no characters or of 61, an address of 501, and a tap count below zero", async () => {
    const page = await insertPage(await newUser());
    await expect(insertLink(page, { title: "" })).rejects.toThrow();
    await expect(insertLink(page, { title: "a".repeat(61) })).rejects.toThrow();
    await expect(insertLink(page, { url: `https://${"a".repeat(493)}` })).rejects.toThrow();
    await expect(insertLink(page, { taps: -1 })).rejects.toThrow();
    await expect(
      insertLink(page, { title: "a".repeat(60), url: `https://${"a".repeat(492)}` }),
    ).resolves.toEqual(expect.any(String));
  });

  it("removes a page's links with the page", async () => {
    const page = await insertPage(await newUser());
    await insertLink(page);
    await insertLink(page);
    await db().$executeRaw`DELETE FROM "MakerPage" WHERE "id" = ${page}`;
    const left = await db().$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "PageLink" WHERE "pageId" = ${page}`;
    expect(left[0]?.n).toBe(0n);
  });

  it("will not let an account with a page be removed", async () => {
    const owner = await newUser();
    await insertPage(owner);
    await expect(db().$executeRaw`DELETE FROM "User" WHERE "id" = ${owner}`).rejects.toThrow();
  });
});
