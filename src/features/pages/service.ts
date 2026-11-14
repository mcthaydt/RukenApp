import type { PageLinkKind, PrismaClient } from "../../lib/server/db.ts";
import { cleanHandle, HANDLE_TAKEN, handleProblem } from "./handle.ts";
import { cleanLinkUrl, linkProblem, MAX_LINKS, moveLink, siteNameOf } from "./links.ts";
import { offeredTheme, themeById, type Theme } from "./themes.ts";

// What a maker does with their page, and what a visitor gets from it. It is built from what it needs (the database)
// so a test hands it a database of its own.

const NAME_MAX = 40;
const ONE_LINE_MAX = 100;

export type PageErrorCode = "INVALID" | "TAKEN" | "NOT_FOUND";

/** A refusal, with words for a person in `message` and a code the caller can act on. */
export class PageError extends Error {
  readonly code: PageErrorCode;

  constructor(code: PageErrorCode, message: string) {
    super(message);
    this.name = "PageError";
    this.code = code;
  }
}

export interface PagesServiceDeps {
  db: PrismaClient;
}

/** A maker's own view of their page: everything, with the counts and the links they hid. */
export interface OwnPage {
  handle: string;
  name: string;
  oneLine: string;
  themeId: number;
  photoKey: string | null;
  views: number;
  links: { id: string; kind: PageLinkKind; title: string; url: string; hidden: boolean; taps: number }[];
}

/** A visitor's view: no address of a link, no count, no hidden link. */
export interface PublicPage {
  id: string;
  makerUserId: string;
  handle: string;
  name: string;
  oneLine: string;
  theme: Theme;
  photoKey: string | null;
  links: { id: string; kind: PageLinkKind; title: string; site: string }[];
}

export type PagesService = ReturnType<typeof createPagesService>;

/** Whether Prisma's "unique constraint failed" error (P2002) was about this column. */
function brokeUniqueKey(error: unknown, column: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002")
    return false;
  // Where Prisma names the column depends on whether the driver adapter or the engine raised it, so the whole
  // description is searched for the column's name. A column's name is never part of another column's constraint.
  const where = JSON.stringify("meta" in error ? (error.meta ?? null) : null);
  return where.includes(column);
}

export function createPagesService(deps: PagesServiceDeps) {
  const { db } = deps;

  /** The page's id, for a person who has one; otherwise the refusal. */
  async function pageIdOf(userId: string): Promise<string> {
    const page = await db.makerPage.findUnique({ where: { userId }, select: { id: true } });
    if (page === null) throw new PageError("NOT_FOUND", "You don't have a page yet.");
    return page.id;
  }

  /**
   * Makes the person's page, or changes it. Every thing wrong is checked before anything is written. An address
   * another page has is found first, and again from the database's own refusal: two people saving the same address
   * at the same moment both pass the first look, and only one write gets in.
   */
  async function savePage(
    userId: string,
    input: { handle: string; name: string; oneLine: string },
  ): Promise<{ handle: string }> {
    const handle = cleanHandle(input.handle);
    const problem = handleProblem(handle);
    if (problem !== null) throw new PageError(problem === HANDLE_TAKEN ? "TAKEN" : "INVALID", problem);
    const name = input.name.trim();
    if (name === "") throw new PageError("INVALID", "Your page needs a name.");
    if (name.length > NAME_MAX)
      throw new PageError("INVALID", `A name can be up to ${String(NAME_MAX)} characters.`);
    const oneLine = input.oneLine.trim();
    if (oneLine.length > ONE_LINE_MAX) {
      throw new PageError("INVALID", `The one line can be up to ${String(ONE_LINE_MAX)} characters.`);
    }

    const holder = await db.makerPage.findUnique({ where: { handle }, select: { userId: true } });
    if (holder !== null && holder.userId !== userId) throw new PageError("TAKEN", HANDLE_TAKEN);

    // Twice at most: the second try is for a person who saved twice at once, so the page the first save just made
    // is there to change.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const own = await db.makerPage.findUnique({ where: { userId }, select: { id: true } });
        if (own === null) await db.makerPage.create({ data: { userId, handle, name, oneLine } });
        else await db.makerPage.update({ where: { id: own.id }, data: { handle, name, oneLine } });
        return { handle };
      } catch (error) {
        if (brokeUniqueKey(error, "handle")) throw new PageError("TAKEN", HANDLE_TAKEN);
        if (!brokeUniqueKey(error, "userId")) throw error;
      }
    }
    throw new PageError("INVALID", "We couldn't save that. Try again.");
  }

  /** Gives the page one of the offered colours, or Ruken's own (0). Anything else is refused and nothing changes. */
  async function saveTheme(userId: string, themeId: number): Promise<void> {
    if (themeId !== 0 && offeredTheme(themeId) === null) {
      throw new PageError("INVALID", "Pick one of the colours shown.");
    }
    const changed = await db.makerPage.updateMany({ where: { userId }, data: { themeId } });
    if (changed.count === 0) throw new PageError("NOT_FOUND", "You don't have a page yet.");
  }

  /** Adds a link at the end of the page. Its address is kept as `cleanLinkUrl` read it. */
  async function addLink(
    userId: string,
    input: { kind: PageLinkKind; title: string; url: string },
  ): Promise<void> {
    const problem = linkProblem(input);
    if (problem !== null) throw new PageError("INVALID", problem);
    const url = cleanLinkUrl(input.url);
    // `linkProblem` already said null, so the address is good; this is for the compiler.
    if (url === null) throw new PageError("INVALID", "A link starts with https://");
    const pageId = await pageIdOf(userId);

    const count = await db.pageLink.count({ where: { pageId } });
    if (count >= MAX_LINKS) {
      throw new PageError("INVALID", `A page can have up to ${String(MAX_LINKS)} links. Remove one first.`);
    }
    // After the last one, even when removals have left gaps in the numbers.
    const last = await db.pageLink.aggregate({ where: { pageId }, _max: { position: true } });
    const position = (last._max.position ?? -1) + 1;
    await db.pageLink.create({
      data: { pageId, kind: input.kind, title: input.title.trim(), url, position },
    });
  }

  /** Swaps a link with its neighbour; the page's links are numbered 0, 1, 2 again in one transaction. */
  async function moveLinkOf(userId: string, linkId: string, direction: "up" | "down"): Promise<void> {
    await db.$transaction(async (tx) => {
      const links = await tx.pageLink.findMany({
        where: { page: { userId } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      const ids = links.map((link) => link.id);
      if (!ids.includes(linkId)) throw new PageError("NOT_FOUND", "We can't find that link.");
      const moved = moveLink(ids, linkId, direction);
      for (const [position, id] of moved.entries()) {
        await tx.pageLink.update({ where: { id }, data: { position } });
      }
    });
  }

  /** Hides a link from visitors, or shows it again. Only the page's own maker can. */
  async function setHidden(userId: string, linkId: string, hidden: boolean): Promise<void> {
    const changed = await db.pageLink.updateMany({
      where: { id: linkId, page: { userId } },
      data: { hidden },
    });
    if (changed.count === 0) throw new PageError("NOT_FOUND", "We can't find that link.");
  }

  /** Removes a link. Only the page's own maker can. */
  async function removeLink(userId: string, linkId: string): Promise<void> {
    const removed = await db.pageLink.deleteMany({ where: { id: linkId, page: { userId } } });
    if (removed.count === 0) throw new PageError("NOT_FOUND", "We can't find that link.");
  }

  /** The maker's own view of their page, or null when they have none. */
  async function pageOf(userId: string): Promise<OwnPage | null> {
    return db.makerPage.findUnique({
      where: { userId },
      select: {
        handle: true,
        name: true,
        oneLine: true,
        themeId: true,
        photoKey: true,
        views: true,
        links: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { id: true, kind: true, title: true, url: true, hidden: true, taps: true },
        },
      },
    });
  }

  /**
   * A visitor's view of a page: only the links that are not hidden, and for each one no address and no count. The
   * address stays on the server; a tap goes through `tapLink`, which counts it first.
   */
  async function pageByHandle(handle: string): Promise<PublicPage | null> {
    const page = await db.makerPage.findUnique({
      where: { handle },
      select: {
        id: true,
        userId: true,
        handle: true,
        name: true,
        oneLine: true,
        themeId: true,
        photoKey: true,
        links: {
          where: { hidden: false },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { id: true, kind: true, title: true, url: true },
        },
      },
    });
    if (page === null) return null;
    return {
      id: page.id,
      makerUserId: page.userId,
      handle: page.handle,
      name: page.name,
      oneLine: page.oneLine,
      theme: themeById(page.themeId),
      photoKey: page.photoKey,
      links: page.links.map((link) => ({
        id: link.id,
        kind: link.kind,
        title: link.title,
        site: siteNameOf(link.url),
      })),
    };
  }

  /** Counts one more opening of a page, in the database, unless the person opening it is the page's maker. */
  async function countView(pageId: string, viewerUserId: string | null): Promise<void> {
    const notTheMaker = viewerUserId === null ? {} : { userId: { not: viewerUserId } };
    await db.makerPage.updateMany({
      where: { id: pageId, ...notTheMaker },
      data: { views: { increment: 1 } },
    });
  }

  /**
   * Where a tap on a link goes, or null when there is nowhere to send the visitor: a link that is hidden, is on
   * another page or is made up. The tap is counted unless the person tapping is the page's maker.
   */
  async function tapLink(
    handle: string,
    linkId: string,
    viewerUserId: string | null,
  ): Promise<string | null> {
    const link = await db.pageLink.findFirst({
      where: { id: linkId, hidden: false, page: { handle } },
      select: { url: true, page: { select: { userId: true } } },
    });
    if (link === null) return null;
    if (link.page.userId !== viewerUserId) {
      await db.pageLink.update({ where: { id: linkId }, data: { taps: { increment: 1 } } });
    }
    return link.url;
  }

  /** The address of each of these accounts that has a page. */
  async function handlesOf(userIds: readonly string[]): Promise<Map<string, string>> {
    const pages = await db.makerPage.findMany({
      where: { userId: { in: [...userIds] } },
      select: { userId: true, handle: true },
    });
    return new Map(pages.map((page) => [page.userId, page.handle]));
  }

  return {
    savePage,
    saveTheme,
    addLink,
    moveLinkOf,
    setHidden,
    removeLink,
    pageOf,
    pageByHandle,
    countView,
    tapLink,
    handlesOf,
  };
}
