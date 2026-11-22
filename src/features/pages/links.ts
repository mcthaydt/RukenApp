// The rules for a link on a maker's page. Pure, so the form, the service and the tests all say the same thing.

/** A page can have this many links. */
export const MAX_LINKS = 30;
export const LINK_TITLE_MAX = 60;
export const LINK_URL_MAX = 500;

/**
 * The address as the browser reads it, when it is an https address with a real host and no name or password,
 * whatever its length. Null for anything else.
 *
 * The address kept is the parsed one (`URL.href`), never the one typed. The parser is more forgiving than the
 * database's rule (lower-case `https://` first) and than a redirect (a header may hold no control character): it
 * reads `HTTPS://x.com` and `https:\\x.com`, drops a tab or a line break pasted into the middle, and writes
 * non-ASCII characters out in ASCII. What it answers is accepted by both, so a link that passes here can never
 * fail later, in the database or when a visitor taps it.
 */
function readHttpsAddress(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const hasRealHost = url.hostname.includes(".");
  const hasLogin = url.username !== "" || url.password !== "";
  if (url.protocol !== "https:" || !hasRealHost || hasLogin) return null;
  return url.href;
}

/** The address to keep, or null when a visitor may not be sent there or it is longer than the database takes. */
export function cleanLinkUrl(raw: string): string | null {
  const address = readHttpsAddress(raw);
  return address !== null && address.length <= LINK_URL_MAX ? address : null;
}

/** What is wrong with a link a maker typed, in a person's words, or null when it is fine. First problem found wins. */
export function linkProblem(input: { title: string; url: string }): string | null {
  const title = input.title.trim();
  if (title === "") return "Give the link a name.";
  if (title.length > LINK_TITLE_MAX)
    return `A link's name can be up to ${String(LINK_TITLE_MAX)} characters.`;
  // Measured twice: as typed (so a huge paste is refused before it is parsed) and as kept (a short address with
  // non-ASCII characters grows once they are written out).
  if (input.url.trim().length > LINK_URL_MAX) return "That address is too long.";
  const address = readHttpsAddress(input.url);
  if (address === null) return "A link starts with https://";
  if (address.length > LINK_URL_MAX) return "That address is too long.";
  return null;
}

export type LinkKind = "link" | "game_elsewhere" | "social";

/** The kind a maker's answer names: anything but the two special ones is a plain link. */
export function linkKindOf(answer: unknown): LinkKind {
  return answer === "game_elsewhere" || answer === "social" ? answer : "link";
}

/** The three choices for a link, in the words a maker sees. */
export const LINK_KIND_CHOICES: readonly { value: LinkKind; title: string }[] = [
  { value: "link", title: "A plain link" },
  { value: "game_elsewhere", title: "A game somewhere else" },
  { value: "social", title: "A small icon, for YouTube, Discord and the like" },
];

/** Where a game somewhere else lives, by the host of its address, for its card. */
const SITE_NAMES: ReadonlyMap<string, string> = new Map([
  ["store.steampowered.com", "Steam"],
  ["itch.io", "itch.io"],
  ["play.google.com", "Google Play"],
  ["apps.apple.com", "the App Store"],
  ["store.epicgames.com", "Epic Games"],
  ["www.gog.com", "GOG"],
  ["gog.com", "GOG"],
]);

/** Where a game somewhere else lives, for its card: "Steam", "itch.io", or the address's own name. */
export function siteNameOf(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    // An address that was kept has passed `cleanLinkUrl`, so this is only a safety net.
    return url;
  }
  // Every maker has their own `name.itch.io`.
  if (host.endsWith(".itch.io")) return "itch.io";
  return SITE_NAMES.get(host) ?? host.replace(/^www\./, "");
}

/** A site that has a small icon on a maker's page: the id its mark is kept under, its name, and the hosts it lives at. */
export const SOCIAL_SITES: readonly { id: string; name: string; hosts: readonly string[] }[] = [
  { id: "youtube", name: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { id: "twitch", name: "Twitch", hosts: ["twitch.tv"] },
  { id: "discord", name: "Discord", hosts: ["discord.com", "discord.gg"] },
  { id: "x", name: "X", hosts: ["x.com", "twitter.com"] },
  { id: "bluesky", name: "Bluesky", hosts: ["bsky.app"] },
  { id: "instagram", name: "Instagram", hosts: ["instagram.com"] },
  { id: "tiktok", name: "TikTok", hosts: ["tiktok.com"] },
  { id: "steam", name: "Steam", hosts: ["store.steampowered.com", "steamcommunity.com"] },
  { id: "itchio", name: "itch.io", hosts: ["itch.io"] },
  { id: "github", name: "GitHub", hosts: ["github.com"] },
];

/**
 * The site an address belongs to, when it has an icon, else null. A host matches when it is a listed host or a
 * subdomain of one ("www.youtube.com", "maker.itch.io"); "notyoutube.com" and "youtube.com.evil.example" do not.
 */
export function socialSiteOf(url: string): { id: string; name: string } | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const site of SOCIAL_SITES) {
    if (site.hosts.some((known) => host === known || host.endsWith(`.${known}`))) {
      return { id: site.id, name: site.name };
    }
  }
  return null;
}

/** The list with `id` swapped with its neighbour; unchanged at either end or for an id that is not in it. */
export function moveLink(ids: readonly string[], id: string, direction: "up" | "down"): string[] {
  const moved = [...ids];
  const from = moved.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  const mine = moved[from];
  const neighbour = moved[to];
  // An id that is not here, or a move off either end, leaves the list as it was.
  if (mine === undefined || neighbour === undefined) return moved;
  moved[from] = neighbour;
  moved[to] = mine;
  return moved;
}
