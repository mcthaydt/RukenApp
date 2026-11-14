// The rules for a link on a maker's page. Pure, so the form, the service and the tests all say the same thing.

/** A page can have this many links. */
export const MAX_LINKS = 30;
export const LINK_TITLE_MAX = 60;
export const LINK_URL_MAX = 500;

/** The address as the browser reads it, when it is one a visitor may be sent on to; otherwise null. */
export function cleanLinkUrl(raw: string): string | null {
  throw new Error(`not built yet: cleanLinkUrl ${raw}`);
}

/** What is wrong with a link a maker typed, in a person's words, or null when it is fine. */
export function linkProblem(input: { title: string; url: string }): string | null {
  throw new Error(`not built yet: linkProblem ${input.title}`);
}

/** Where a game somewhere else lives, for its card: "Steam", "itch.io", or the address's own name. */
export function siteNameOf(url: string): string {
  throw new Error(`not built yet: siteNameOf ${url}`);
}

/** The list with `id` swapped with its neighbour; unchanged at either end or for an id that is not in it. */
export function moveLink(ids: readonly string[], id: string, direction: "up" | "down"): string[] {
  throw new Error(`not built yet: moveLink ${String(ids.length)} ${id} ${direction}`);
}
