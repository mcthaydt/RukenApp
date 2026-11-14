import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { THEMES } from "../../../src/features/pages/themes.ts";
import { createPagesService, type PagesService } from "../../../src/features/pages/service.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

let database: TestDatabase | undefined;
let service: PagesService;

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  service = createPagesService({ db: db() });
});

afterAll(async () => {
  await database?.stop();
});

let made = 0;

/** A person with a page of their own, at an address nobody else in this file has. */
async function makerWithPage(): Promise<{ userId: string; handle: string; pageId: string }> {
  made += 1;
  const userId = await createUser(db());
  const handle = `maker-${String(made)}`;
  await service.savePage(userId, { handle, name: "A maker", oneLine: "" });
  const page = await db().makerPage.findUniqueOrThrow({ where: { userId }, select: { id: true } });
  return { userId, handle, pageId: page.id };
}

/** The id of a maker's link, found by its title. */
async function idOf(userId: string, title: string): Promise<string> {
  const link = (await service.pageOf(userId))?.links.find((candidate) => candidate.title === title);
  if (link === undefined) throw new Error(`there is no link called ${title}`);
  return link.id;
}

/** The titles of a maker's links, in the order they sit. */
async function titlesOf(userId: string): Promise<string[]> {
  const page = await service.pageOf(userId);
  return (page?.links ?? []).map((link) => link.title);
}

describe("a maker's page", () => {
  it("makes a page, and changes it", async () => {
    const userId = await createUser(db());
    await service.savePage(userId, { handle: "first-name", name: "First", oneLine: "One" });
    await service.savePage(userId, { handle: "second-name", name: "  Second  ", oneLine: "  Two  " });
    expect(await db().makerPage.count({ where: { userId } })).toBe(1);
    expect(await service.pageOf(userId)).toMatchObject({
      handle: "second-name",
      name: "Second",
      oneLine: "Two",
      themeId: 0,
      views: 0,
      links: [],
    });
  });

  it("answers the address it kept, cleaned", async () => {
    const userId = await createUser(db());
    expect(await service.savePage(userId, { handle: " @Night-Owl ", name: "N", oneLine: "" })).toEqual({
      handle: "night-owl",
    });
  });

  it.each([
    [{ handle: "ab", name: "A", oneLine: "" }, "INVALID", "Use at least 3 letters or numbers."],
    [
      { handle: "a".repeat(31), name: "A", oneLine: "" },
      "INVALID",
      "That's too long. Use 30 characters or fewer.",
    ],
    [{ handle: "night owl", name: "A", oneLine: "" }, "INVALID", "Use only letters, numbers and hyphens."],
    [{ handle: "make", name: "A", oneLine: "" }, "TAKEN", "That one is taken. Pick another."],
    [{ handle: "fine-one", name: "  ", oneLine: "" }, "INVALID", "Your page needs a name."],
    [
      { handle: "fine-one", name: "a".repeat(41), oneLine: "" },
      "INVALID",
      "A name can be up to 40 characters.",
    ],
    [
      { handle: "fine-one", name: "A", oneLine: "a".repeat(101) },
      "INVALID",
      "The one line can be up to 100 characters.",
    ],
  ] as const)("says what is wrong with %j in words", async (input, code, message) => {
    const userId = await createUser(db());
    await expect(service.savePage(userId, input)).rejects.toMatchObject({ code, message });
    expect(await service.pageOf(userId)).toBeNull();
  });

  it("gives an address to one person only", async () => {
    // Review Focus 4
    const a = await createUser(db());
    const b = await createUser(db());
    await service.savePage(a, { handle: "maker-one", name: "A", oneLine: "" });
    await expect(service.savePage(b, { handle: "Maker-One", name: "B", oneLine: "" })).rejects.toMatchObject({
      code: "TAKEN",
      message: "That one is taken. Pick another.",
    });
  });

  it("lets a maker keep their own address when they save again", async () => {
    const a = await createUser(db());
    await service.savePage(a, { handle: "keeper", name: "A", oneLine: "" });
    await expect(service.savePage(a, { handle: "keeper", name: "A2", oneLine: "" })).resolves.toEqual({
      handle: "keeper",
    });
  });

  it("two people saving one address at once: one has it, one is told it is taken", async () => {
    const a = await createUser(db());
    const b = await createUser(db());
    const results = await Promise.allSettled([
      service.savePage(a, { handle: "same-one", name: "A", oneLine: "" }),
      service.savePage(b, { handle: "same-one", name: "B", oneLine: "" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "TAKEN", message: "That one is taken. Pick another." },
    });
  });

  it("one person saving twice at once ends with one page and no error", async () => {
    // The unique key on the person, not on the address, is what the second save meets.
    const a = await createUser(db());
    const results = await Promise.allSettled([
      service.savePage(a, { handle: "twice-one", name: "A", oneLine: "" }),
      service.savePage(a, { handle: "twice-two", name: "A", oneLine: "" }),
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await db().makerPage.count({ where: { userId: a } })).toBe(1);
  });

  it("frees the old address when a maker changes theirs", async () => {
    const a = await createUser(db());
    const b = await createUser(db());
    await service.savePage(a, { handle: "old-name", name: "A", oneLine: "" });
    await service.savePage(a, { handle: "new-name", name: "A", oneLine: "" });
    await expect(service.savePage(b, { handle: "old-name", name: "B", oneLine: "" })).resolves.toEqual({
      handle: "old-name",
    });
  });
});

describe("a page's colours", () => {
  it("keeps a page's colours when a number that is not offered is sent", async () => {
    // Review Focus 7
    const { userId } = await makerWithPage();
    const offered = THEMES[0];
    if (offered === undefined) throw new Error("no theme is offered");
    await service.saveTheme(userId, offered.id);
    for (const id of [349, -1, 1.5, Number.NaN]) {
      await expect(service.saveTheme(userId, id), String(id)).rejects.toMatchObject({
        code: "INVALID",
        message: "Pick one of the colours shown.",
      });
    }
    expect((await service.pageOf(userId))?.themeId).toBe(offered.id);
  });

  it("takes 0, which is Ruken's own colours", async () => {
    const { userId } = await makerWithPage();
    await service.saveTheme(userId, THEMES[0]?.id ?? 1);
    await service.saveTheme(userId, 0);
    expect((await service.pageOf(userId))?.themeId).toBe(0);
  });

  it("says there is no page to colour when the person has none", async () => {
    const userId = await createUser(db());
    await expect(service.saveTheme(userId, 0)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("a page's links", () => {
  async function addLinks(userId: string, ...titles: string[]): Promise<void> {
    for (const title of titles) {
      await service.addLink(userId, { kind: "link", title, url: `https://example.com/${title}` });
    }
  }

  it("adds links last, moves them, hides them and removes them", async () => {
    const { userId, handle } = await makerWithPage();
    await addLinks(userId, "x", "y", "z");
    expect(await titlesOf(userId)).toEqual(["x", "y", "z"]);

    const x = await idOf(userId, "x");
    const y = await idOf(userId, "y");
    const z = await idOf(userId, "z");
    await service.moveLinkOf(userId, z, "up");
    expect(await titlesOf(userId)).toEqual(["x", "z", "y"]);
    await service.moveLinkOf(userId, z, "up");
    expect(await titlesOf(userId)).toEqual(["z", "x", "y"]);
    await service.moveLinkOf(userId, z, "up");
    expect(await titlesOf(userId)).toEqual(["z", "x", "y"]);

    await service.setHidden(userId, x, true);
    await service.removeLink(userId, y);
    expect((await service.pageOf(userId))?.links).toMatchObject([
      { title: "z", hidden: false },
      { title: "x", hidden: true },
    ]);
    expect((await service.pageByHandle(handle))?.links.map((link) => link.title)).toEqual(["z"]);

    // A link added after a removal still goes last.
    await addLinks(userId, "w");
    expect(await titlesOf(userId)).toEqual(["z", "x", "w"]);
  });

  it("keeps the address as it was read, and the words as trimmed", async () => {
    const { userId } = await makerWithPage();
    await service.addLink(userId, { kind: "link", title: "  Steam  ", url: " HTTPS://Example.com/a b " });
    expect((await service.pageOf(userId))?.links).toMatchObject([
      { kind: "link", title: "Steam", url: "https://example.com/a%20b" },
    ]);
  });

  it("refuses a link that is not https and stores nothing", async () => {
    // Review Focus 5
    const { userId, pageId } = await makerWithPage();
    await expect(
      service.addLink(userId, { kind: "link", title: "Bad", url: "javascript:alert(1)" }),
    ).rejects.toMatchObject({ code: "INVALID", message: "A link starts with https://" });
    expect(await db().pageLink.count({ where: { pageId } })).toBe(0);
  });

  it("says there is no page to add a link to when the person has none", async () => {
    const userId = await createUser(db());
    await expect(
      service.addLink(userId, { kind: "link", title: "A", url: "https://example.com" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("stops at thirty links", async () => {
    const { userId, pageId } = await makerWithPage();
    await db().pageLink.createMany({
      data: Array.from({ length: 30 }, (_, index) => ({
        pageId,
        kind: "link" as const,
        title: `L${String(index)}`,
        url: "https://example.com",
        position: index,
      })),
    });
    await expect(
      service.addLink(userId, { kind: "link", title: "One more", url: "https://example.com" }),
    ).rejects.toMatchObject({
      code: "INVALID",
      message: "A page can have up to 30 links. Remove one first.",
    });
    expect(await db().pageLink.count({ where: { pageId } })).toBe(30);
  });

  it("lets nobody change another maker's link", async () => {
    const a = await makerWithPage();
    const b = await makerWithPage();
    await addLinks(a.userId, "mine");
    const link = await idOf(a.userId, "mine");
    await expect(service.moveLinkOf(b.userId, link, "up")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.setHidden(b.userId, link, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.removeLink(b.userId, link)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await service.pageOf(a.userId))?.links).toMatchObject([{ title: "mine", hidden: false }]);
  });

  it("says a link that is not there is not there", async () => {
    const { userId } = await makerWithPage();
    await expect(service.removeLink(userId, "made-up")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.moveLinkOf(userId, "made-up", "up")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("what a visitor sees and counts", () => {
  it("shows a visitor no hidden link, no address and no count", async () => {
    const { userId, handle } = await makerWithPage();
    await service.addLink(userId, {
      kind: "game_elsewhere",
      title: "On Steam",
      url: "https://store.steampowered.com/app/1",
    });
    await service.addLink(userId, { kind: "link", title: "Secret", url: "https://example.com/secret" });
    await service.setHidden(userId, await idOf(userId, "Secret"), true);

    const page = await service.pageByHandle(handle);
    expect(page?.links).toHaveLength(1);
    expect(Object.keys(page?.links[0] ?? {}).sort()).toEqual(["id", "kind", "site", "title"]);
    expect(page?.links[0]).toMatchObject({ kind: "game_elsewhere", title: "On Steam", site: "Steam" });
    expect(page).toMatchObject({ handle, name: "A maker", oneLine: "", photoKey: null });
    expect(page?.theme.id).toBe(0);
    expect(Object.keys(page ?? {}).sort()).toEqual([
      "handle",
      "id",
      "links",
      "makerUserId",
      "name",
      "oneLine",
      "photoKey",
      "theme",
    ]);
  });

  it("answers nothing for an address that has no page", async () => {
    expect(await service.pageByHandle("nobody-here")).toBeNull();
    expect(await service.pageOf(await createUser(db()))).toBeNull();
  });

  it("wears the colours of the theme the maker picked", async () => {
    const { userId, handle } = await makerWithPage();
    const offered = THEMES[0];
    if (offered === undefined) throw new Error("no theme is offered");
    await service.saveTheme(userId, offered.id);
    expect((await service.pageByHandle(handle))?.theme).toEqual(offered);
  });

  it("counts a visitor's view and tap, and not the maker's own", async () => {
    // Review Focus 9
    const { userId, handle, pageId } = await makerWithPage();
    const visitor = await createUser(db());
    await service.addLink(userId, { kind: "link", title: "X", url: "https://example.com/x" });
    const link = { id: await idOf(userId, "X") };

    await service.countView(pageId, null);
    await service.countView(pageId, visitor);
    await service.countView(pageId, userId);
    expect(await service.tapLink(handle, link.id, null)).toBe("https://example.com/x");
    expect(await service.tapLink(handle, link.id, userId)).toBe("https://example.com/x");
    expect(await service.pageOf(userId)).toMatchObject({ views: 2, links: [{ taps: 1 }] });
  });

  it("sends nobody on from a hidden link, another page's link or a made-up one", async () => {
    // Review Focus 6
    const a = await makerWithPage();
    const b = await makerWithPage();
    await service.addLink(a.userId, { kind: "link", title: "Hidden", url: "https://example.com/h" });
    await service.addLink(b.userId, { kind: "link", title: "Theirs", url: "https://example.com/t" });
    const hidden = await idOf(a.userId, "Hidden");
    const theirs = await idOf(b.userId, "Theirs");
    await service.setHidden(a.userId, hidden, true);

    expect(await service.tapLink(a.handle, hidden, null)).toBeNull();
    expect(await service.tapLink(a.handle, theirs, null)).toBeNull();
    expect(await service.tapLink(a.handle, "made-up", null)).toBeNull();
    expect(await service.tapLink("nobody-here", theirs, null)).toBeNull();
    expect((await service.pageOf(a.userId))?.links[0]?.taps).toBe(0);
    expect((await service.pageOf(b.userId))?.links[0]?.taps).toBe(0);
  });

  it("finds the addresses of the makers it is asked about", async () => {
    const a = await makerWithPage();
    const b = await makerWithPage();
    const c = await createUser(db());
    expect(await service.handlesOf([a.userId, b.userId, c])).toEqual(
      new Map([
        [a.userId, a.handle],
        [b.userId, b.handle],
      ]),
    );
    expect(await service.handlesOf([])).toEqual(new Map());
  });
});
