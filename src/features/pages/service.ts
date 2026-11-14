import type { PageLinkKind, PrismaClient } from "../../lib/server/db.ts";
import type { Theme } from "./themes.ts";

// What a maker does with their page, and what a visitor gets from it. It is built from what it needs (the database)
// so a test hands it a database of its own.

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

export function createPagesService(deps: PagesServiceDeps) {
  const notBuilt = (name: string): Error => new Error(`not built yet: ${name} ${typeof deps.db}`);

  return {
    savePage(
      userId: string,
      input: { handle: string; name: string; oneLine: string },
    ): Promise<{ handle: string }> {
      return Promise.reject(notBuilt(`savePage ${userId} ${input.handle}`));
    },
    saveTheme(userId: string, themeId: number): Promise<void> {
      return Promise.reject(notBuilt(`saveTheme ${userId} ${String(themeId)}`));
    },
    addLink(userId: string, input: { kind: PageLinkKind; title: string; url: string }): Promise<void> {
      return Promise.reject(notBuilt(`addLink ${userId} ${input.title}`));
    },
    moveLinkOf(userId: string, linkId: string, direction: "up" | "down"): Promise<void> {
      return Promise.reject(notBuilt(`moveLinkOf ${userId} ${linkId} ${direction}`));
    },
    setHidden(userId: string, linkId: string, hidden: boolean): Promise<void> {
      return Promise.reject(notBuilt(`setHidden ${userId} ${linkId} ${String(hidden)}`));
    },
    removeLink(userId: string, linkId: string): Promise<void> {
      return Promise.reject(notBuilt(`removeLink ${userId} ${linkId}`));
    },
    pageOf(userId: string): Promise<OwnPage | null> {
      return Promise.reject(notBuilt(`pageOf ${userId}`));
    },
    pageByHandle(handle: string): Promise<PublicPage | null> {
      return Promise.reject(notBuilt(`pageByHandle ${handle}`));
    },
    countView(pageId: string, viewerUserId: string | null): Promise<void> {
      return Promise.reject(notBuilt(`countView ${pageId} ${String(viewerUserId)}`));
    },
    tapLink(handle: string, linkId: string, viewerUserId: string | null): Promise<string | null> {
      return Promise.reject(notBuilt(`tapLink ${handle} ${linkId} ${String(viewerUserId)}`));
    },
    handlesOf(userIds: readonly string[]): Promise<Map<string, string>> {
      return Promise.reject(notBuilt(`handlesOf ${String(userIds.length)}`));
    },
  };
}
