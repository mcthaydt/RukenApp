import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { THEMES } from "../../../src/features/pages/themes.ts";
import { createPagesService, PageError, type PagesService } from "../../../src/features/pages/service.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createUser } from "../../support/create-user.ts";
import { queriesAsked } from "../../support/count-queries.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";

let database: TestDatabase | undefined;
let service: PagesService;
const files = new MemoryFileStore();

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

beforeAll(async () => {
  database = await startTestDatabase();
  service = createPagesService({ db: db(), files });
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

/** Gives a maker links with these titles, last after last. */
async function addSome(userId: string, ...titles: string[]): Promise<void> {
  for (const title of titles) {
    await service.addLink(userId, { kind: "link", title, url: `https://example.com/${title}` });
  }
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
    [
      { handle: "a".repeat(31), name: "A", oneLine: "" },
      "INVALID",
      "That's too long. Use 30 characters or fewer.",
    ],
    [{ handle: "night owl", name: "A", oneLine: "" }, "INVALID", "Use only letters, numbers and hyphens."],
    [
      { handle: "fine-one", name: "a".repeat(41), oneLine: "" },
      "INVALID",
      "A name can be up to 40 characters.",
    ],
  ] as const)("says what is wrong with %j in words", async (input, code, message) => {
    const userId = await createUser(db());
    await expect(service.savePage(userId, input)).rejects.toMatchObject({ code, message });
    expect(await service.pageOf(userId)).toBeNull();
  });

  it("gives an address to one person only", async () => {
    const a = await createUser(db());
    const b = await createUser(db());
    await service.savePage(a, { handle: "maker-one", name: "A", oneLine: "" });
    await expect(service.savePage(b, { handle: "Maker-One", name: "B", oneLine: "" })).rejects.toMatchObject({
      code: "TAKEN",
      message: "That one is taken. Pick another.",
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
      "listed",
      "makerUserId",
      "name",
      "oneLine",
      "photoKey",
      "theme",
    ]);
  });

  // The follow plus and /cookies find a page by its address, so an unlisted page is still found; only the address
  // route answers the missing page for it.
  it("finds an unlisted page by its address, saying it is unlisted", async () => {
    const userId = await createUser(db());
    const { handle } = await service.makeUnlistedPage(userId, "Hidden Hana");
    expect(await service.pageByHandle(handle)).toMatchObject({ handle, name: "Hidden Hana", listed: false });
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

  it("finds the address, name and photo of each maker it is asked about, and leaves out one with no page", async () => {
    const a = await makerWithPage();
    const b = await makerWithPage();
    await db().makerPage.update({ where: { userId: b.userId }, data: { listed: false } });
    const c = await createUser(db());
    await service.savePhoto(a.userId, { contentType: "image/png", bytes: PNG });
    const pageA = await service.pageOf(a.userId);
    const pageB = await service.pageOf(b.userId);

    expect(await service.makersOf([a.userId, b.userId, c])).toEqual(
      new Map([
        [a.userId, { handle: a.handle, name: pageA?.name, photoKey: pageA?.photoKey, listed: true }],
        [b.userId, { handle: b.handle, name: pageB?.name, photoKey: null, listed: false }],
      ]),
    );
    expect(pageA?.photoKey).not.toBeNull();
    expect(await service.makersOf([])).toEqual(new Map());
  });
});

// The first bytes of a PNG: all a photo is checked for, and all a test needs.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

/** The key a maker's page holds for its photo, which a test that has just saved one knows is there. */
async function photoKeyOf(userId: string): Promise<string> {
  const key = (await service.pageOf(userId))?.photoKey;
  if (key === null || key === undefined) throw new Error("the page has no photo");
  return key;
}

describe("a maker's photo", () => {
  it("refuses a photo that breaks a rule, and stores nothing", async () => {
    const { userId } = await makerWithPage();
    const put = vi.spyOn(files, "put");
    try {
      const page = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
      await expect(
        service.savePhoto(userId, { contentType: "image/png", bytes: page }),
      ).rejects.toMatchObject({
        code: "INVALID",
        message: "That file doesn't look like a picture. Save it as a JPEG or PNG and try again.",
      });
      await expect(service.savePhoto(userId, { contentType: "image/gif", bytes: PNG })).rejects.toMatchObject(
        {
          code: "INVALID",
          message: "A photo is a JPEG, PNG or WebP picture.",
        },
      );
      expect(put).not.toHaveBeenCalled();
      expect((await service.pageOf(userId))?.photoKey).toBeNull();
    } finally {
      put.mockRestore();
    }
  });

  it("leaves the photo a page has when a new one is refused", async () => {
    const { userId } = await makerWithPage();
    await service.savePhoto(userId, { contentType: "image/png", bytes: PNG });
    const kept = await photoKeyOf(userId);

    await expect(
      service.savePhoto(userId, { contentType: "image/png", bytes: new Uint8Array([1, 2, 3]) }),
    ).rejects.toBeInstanceOf(PageError);

    expect(await photoKeyOf(userId)).toBe(kept);
    expect(await files.head(kept)).not.toBeNull();
  });

  it("says so when the person has no page yet, and stores nothing", async () => {
    const userId = await createUser(db());
    const put = vi.spyOn(files, "put");
    try {
      await expect(service.savePhoto(userId, { contentType: "image/png", bytes: PNG })).rejects.toMatchObject(
        {
          code: "NOT_FOUND",
        },
      );
      expect(put).not.toHaveBeenCalled();
    } finally {
      put.mockRestore();
    }
  });

  it("removes nothing, without a fuss, from a page that has no photo", async () => {
    const { userId } = await makerWithPage();
    await expect(service.removePhoto(userId)).resolves.toBeUndefined();
    expect((await service.pageOf(userId))?.photoKey).toBeNull();
  });

  it("says so when the person has no page to take a photo off", async () => {
    const userId = await createUser(db());
    await expect(service.removePhoto(userId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("shows visitors the photo's key, and no other page's", async () => {
    const mine = await makerWithPage();
    const other = await makerWithPage();
    await service.savePhoto(mine.userId, {
      contentType: "image/webp",
      bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
    });

    expect((await service.pageByHandle(mine.handle))?.photoKey).toBe(await photoKeyOf(mine.userId));
    expect((await service.pageByHandle(other.handle))?.photoKey).toBeNull();
  });
});

describe("changing a link's words and address", () => {
  it("changes a link in place: its place, its tap count and its hidden mark stay", async () => {
    const { userId } = await makerWithPage();
    await addSome(userId, "first", "second");
    const second = await idOf(userId, "second");
    await service.setHidden(userId, second, true);
    await db().pageLink.update({ where: { id: second }, data: { taps: 7 } });

    await service.updateLink(userId, second, {
      kind: "game_elsewhere",
      title: "  Renamed ",
      url: "https://store.example.com/new",
    });

    const links = (await service.pageOf(userId))?.links ?? [];
    expect(links.map((link) => link.title)).toEqual(["first", "Renamed"]);
    expect(links[1]).toMatchObject({
      id: second,
      kind: "game_elsewhere",
      url: "https://store.example.com/new",
      hidden: true,
      taps: 7,
    });
  });

  it("refuses in the words an added link is refused in, and changes nothing", async () => {
    const { userId } = await makerWithPage();
    await addSome(userId, "keep");
    const link = await idOf(userId, "keep");
    const before = (await service.pageOf(userId))?.links;
    await expect(
      service.updateLink(userId, link, { kind: "link", title: "x", url: "http://nope.example.com" }),
    ).rejects.toMatchObject({ code: "INVALID", message: "A link starts with https://" });
    await expect(
      service.updateLink(userId, link, { kind: "link", title: " ", url: "https://ok.example.com" }),
    ).rejects.toMatchObject({ code: "INVALID", message: "Give the link a name." });
    expect((await service.pageOf(userId))?.links).toEqual(before);
  });

  it("lets nobody change another maker's link", async () => {
    const a = await makerWithPage();
    const b = await makerWithPage();
    await addSome(a.userId, "mine");
    const link = await idOf(a.userId, "mine");
    await expect(
      service.updateLink(b.userId, link, { kind: "link", title: "x", url: "https://x.example.com" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await service.pageOf(a.userId))?.links).toMatchObject([{ title: "mine" }]);
  });
});

describe("taking a page down", () => {
  it("removes the page, its links and its photo, and frees the address", async () => {
    const { userId, handle } = await makerWithPage();
    await addSome(userId, "one", "two");
    await service.savePhoto(userId, {
      contentType: "image/png",
      bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
    });
    const key = (await service.pageOf(userId))?.photoKey ?? "";
    expect(files.keys()).toContain(key);

    await service.removePage(userId);

    expect(await service.pageOf(userId)).toBeNull();
    expect(await service.pageByHandle(handle)).toBeNull();
    expect(await db().pageLink.count({ where: { page: { handle } } })).toBe(0);
    expect(files.keys()).not.toContain(key);
    // The address is free again, for the same maker or anyone.
    await service.savePage(userId, { handle, name: "Back again", oneLine: "" });
    expect((await service.pageOf(userId))?.links).toEqual([]);
  });

  it("says there is no page to take down when there is none, and touches no other page", async () => {
    const lonely = await createUser(db());
    const other = await makerWithPage();
    await expect(service.removePage(lonely)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await service.pageOf(other.userId)).not.toBeNull();
  });
});

describe("cardOf", () => {
  it("answers the few things a game's page shows of its maker, or nothing for a person with no page", async () => {
    const { userId, handle } = await makerWithPage();
    await service.savePage(userId, { handle, name: "Night Owl", oneLine: "Hard games." });

    expect(await service.cardOf(userId)).toEqual({
      handle,
      name: "Night Owl",
      oneLine: "Hard games.",
      photoKey: null,
      listed: true,
    });
    expect(await service.cardOf(await createUser(db()))).toBeNull();
    const unlisted = await createUser(db());
    await service.makeUnlistedPage(unlisted, "Quiet Quinn");
    expect(await service.cardOf(unlisted)).toMatchObject({ name: "Quiet Quinn", listed: false });
  });

  // A game's page waits on this, and each statement is a wait on the site: the page's links are not asked for.
  it("asks the database once", async () => {
    const { userId } = await makerWithPage();
    let card: unknown = null;

    const asked = await queriesAsked(database?.url ?? "", async (counted) => {
      card = await createPagesService({ db: counted, files }).cardOf(userId);
    });

    expect(card).not.toBeNull();
    expect(asked).toHaveLength(1);
  });
});

describe("the page sign-up makes from a name", () => {
  it("makes one unlisted page with the name, at an address made from it", async () => {
    const userId = await createUser(db());
    const { handle } = await service.makeUnlistedPage(userId, "  Sunny\u200B Day  ");
    expect(handle).toBe("sunny-day");
    expect(await service.pageOf(userId)).toMatchObject({ handle, name: "Sunny Day", listed: false });
  });

  it("refuses an empty name and one over 40 characters, and makes nothing", async () => {
    const userId = await createUser(db());
    await expect(service.makeUnlistedPage(userId, " \u200B ")).rejects.toThrow("Type a name.");
    await expect(service.makeUnlistedPage(userId, "a".repeat(41))).rejects.toThrow(
      "A name can be up to 40 characters.",
    );
    expect(await service.pageOf(userId)).toBeNull();
  });

  it("gives two accounts with one name two addresses, one after the other and at the same moment", async () => {
    const [a, b, c, d] = await Promise.all([1, 2, 3, 4].map(() => createUser(db())));
    const first = await service.makeUnlistedPage(a ?? "", "Twin Name");
    const second = await service.makeUnlistedPage(b ?? "", "Twin Name");
    expect(first.handle).toBe("twin-name");
    expect(second.handle).toMatch(/^twin-name-\d{4}$/);

    const atOnce = await Promise.all([
      service.makeUnlistedPage(c ?? "", "Same Moment"),
      service.makeUnlistedPage(d ?? "", "Same Moment"),
    ]);
    expect(new Set(atOnce.map((page) => page.handle)).size).toBe(2);
  });

  it("tries 6 digits after 5 taken 4-digit addresses, then says try again", async () => {
    const fixed = createPagesService({ db: db(), files, digits: (count) => "9".repeat(count) });
    await fixed.makeUnlistedPage(await createUser(db()), "Busy");
    const fourDigits = await fixed.makeUnlistedPage(await createUser(db()), "Busy");
    const sixDigits = await fixed.makeUnlistedPage(await createUser(db()), "Busy");
    expect([fourDigits.handle, sixDigits.handle]).toEqual(["busy-9999", "busy-999999"]);
    const late = await createUser(db());
    await expect(fixed.makeUnlistedPage(late, "Busy")).rejects.toThrow("We couldn't save that. Try again.");
    expect(await fixed.pageOf(late)).toBeNull();
  });

  it("keeps the page an account has when it saves twice, one after the other and at the same moment", async () => {
    const userId = await createUser(db());
    const first = await service.makeUnlistedPage(userId, "Once Only");
    expect(await service.makeUnlistedPage(userId, "Second Try")).toEqual(first);

    const other = await createUser(db());
    const atOnce = await Promise.all([
      service.makeUnlistedPage(other, "Double Tap"),
      service.makeUnlistedPage(other, "Double Tap"),
    ]);
    expect(atOnce[0]).toEqual(atOnce[1]);
    expect(await db().makerPage.count({ where: { userId: { in: [userId, other] } } })).toBe(2);
  });

  it("changes the name only, never the address", async () => {
    const userId = await createUser(db());
    const { handle } = await service.makeUnlistedPage(userId, "Old Name");
    await service.renamePage(userId, "  New Name ");
    expect(await service.pageOf(userId)).toMatchObject({ handle, name: "New Name", listed: false });
    await expect(service.renamePage(userId, "")).rejects.toThrow("Type a name.");
    await expect(service.renamePage(await createUser(db()), "Nobody")).rejects.toThrow(PageError);
  });

  it("lists the page at the editor's address, keeping the name", async () => {
    const userId = await createUser(db());
    await service.makeUnlistedPage(userId, "Editor Ed");
    expect(await service.listInEditor(userId, " @Ed-Makes ")).toEqual({ handle: "ed-makes" });
    expect(await service.pageOf(userId)).toMatchObject({
      handle: "ed-makes",
      name: "Editor Ed",
      listed: true,
    });

    const other = await createUser(db());
    await service.makeUnlistedPage(other, "Other One");
    await expect(service.listInEditor(other, "ed-makes")).rejects.toThrow("That one is taken. Pick another.");
    await expect(service.listInEditor(other, "admin")).rejects.toThrow("That one is taken. Pick another.");
    expect(await service.pageOf(other)).toMatchObject({ listed: false });
  });
});
