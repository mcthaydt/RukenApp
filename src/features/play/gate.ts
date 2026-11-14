import { matchesEtag, parseRange } from "../../lib/files/byte-range.ts";
import { servedTypeFor } from "../../lib/files/content-types.ts";
import { normalizePath } from "../../lib/files/safe-path.ts";
import type { FileStore } from "../../lib/files/store.ts";
import { checkPass } from "./pass.ts";

// The game gate, as one function: Cloudflare's request in, an answer out. It serves two kinds of thing from one
// bucket. A game's files, under a play pass that Ruken's app signed and this checks on every request; and the clips,
// to anyone. It runs as its own Worker on addresses of its own, so a game never runs on Ruken's address, and it imports
// only plain helpers (no feature entry, no database, no SvelteKit): the Worker has none of them.
//
// It never sets a cookie and never reads one: browsers block cookies in a frame from another site anyway, and a
// game must not be able to tell a person from one.

export interface GateDeps {
  files: FileStore;
  passSecret: string;
  /** Ruken's own address (`https://…`), the only one allowed to put a game in a frame. */
  siteOrigin: string;
  nowMs: number;
}

// The words a person may see, inside the game's frame under Ruken's bar. One line each, saying what to do.
const RUN_OUT = "This game's link has run out. Go back and press Play again.";
const NOT_FOUND = "Not found.";
const UNREADABLE = "We could not read that address.";
const NOT_ALLOWED = "Not allowed.";

/** A game's own name: `g-` and its ten-character public id. */
const GAME_HOST = /^g-([a-z2-7]{10})$/;
/** Written out here, not imported: a clip's key, as the games feature makes it. Nothing else is served as a clip. */
const CLIP_KEY = /^clips\/[a-z2-7]{10}\/(?:upright|wide)-[0-9a-f]{16}\.(?:mp4|webm)$/;

/** What a game may ask the browser for. It asks for nothing that reaches a person or their machine. */
const PERMISSIONS =
  "gamepad=(self), fullscreen=(self), autoplay=(self), clipboard-write=(self), web-share=(self), " +
  "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

/** The headers every answer has. `referrer-policy` keeps a pass in an address from being sent on to a third site. */
function commonHeaders(): Headers {
  return new Headers({
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex",
  });
}

/** An answer that is not a file: a line of plain text, and nothing a browser could run. */
function plain(status: number, body: string, deps: GateDeps, extra: Record<string, string> = {}): Response {
  const headers = commonHeaders();
  headers.set("content-type", "text/plain; charset=utf-8");
  headers.set("content-security-policy", `default-src 'none'; frame-ancestors ${deps.siteOrigin}`);
  headers.set("cache-control", "no-store");
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return new Response(body, { status, headers });
}

/**
 * Serves one stored file with `headers` (the ones that depend on what kind of file it is). The type comes from the
 * file's name and never from its contents, so a game cannot get a browser to run a file as something it is not.
 */
async function serveFile(request: Request, deps: GateDeps, key: string, headers: Headers): Promise<Response> {
  const stored = await deps.files.head(key);
  if (stored === null) return plain(404, NOT_FOUND, deps);

  const type = servedTypeFor(key);
  headers.set("content-type", type.contentType);
  headers.set("etag", stored.etag);
  if (type.encoding === undefined) headers.set("accept-ranges", "bytes");
  else headers.set("content-encoding", type.encoding);

  if (matchesEtag(request.headers.get("if-none-match"), stored.etag)) {
    return new Response(null, { status: 304, headers });
  }

  // A precompressed file goes out whole, as it is: a range of compressed bytes is no use to a browser.
  const range = type.encoding === undefined ? parseRange(request.headers.get("range"), stored.size) : "none";
  if (range === "unsatisfiable") {
    headers.set("content-range", `bytes */${String(stored.size)}`);
    return new Response(null, { status: 416, headers });
  }
  if (range === "none") {
    headers.set("content-length", String(stored.size));
  } else {
    headers.set("content-length", String(range.length));
    headers.set(
      "content-range",
      `bytes ${String(range.offset)}-${String(range.offset + range.length - 1)}/${String(stored.size)}`,
    );
  }
  const status = range === "none" ? 200 : 206;
  if (request.method === "HEAD") return new Response(null, { status, headers });

  const found = await deps.files.get(key, range === "none" ? undefined : range);
  if (found === null) return plain(404, NOT_FOUND, deps);
  // `encodeBody: "manual"` tells Cloudflare the bytes are already encoded: it must not compress them a second time.
  return new Response(found.body, {
    status,
    headers,
    ...(type.encoding === undefined ? {} : { encodeBody: "manual" as const }),
  });
}

/** A clip: shown on pages before anyone plays, so anyone may have it, and a browser keeps it for a year. */
function serveClip(request: Request, url: URL, deps: GateDeps): Promise<Response> | Response {
  const key = url.pathname.slice(1);
  if (!CLIP_KEY.test(key)) return plain(404, NOT_FOUND, deps);
  const headers = commonHeaders();
  headers.set("content-security-policy", `frame-ancestors ${deps.siteOrigin}`);
  // A new upload gets a new address, so an old clip is never the one a browser still holds under the new name.
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("cross-origin-resource-policy", "cross-origin");
  return serveFile(request, deps, key, headers);
}

/** A game's file, only under a pass that was made for this game and has not run out. */
function serveGameFile(
  request: Request,
  url: URL,
  game: string,
  deps: GateDeps,
): Promise<Response> | Response {
  // A browser sends this when a page asks to install a service worker. The gate refuses: a service worker could go on
  // serving the game's files from the browser after the pass ran out, and the pass must stay the only way in.
  if (request.headers.get("service-worker") === "script") return plain(403, RUN_OUT, deps);

  // `/<pass>/<path>`: the pass is the first folder, so every file a game asks for by a relative address carries it.
  const path = url.pathname.slice(1);
  const slash = path.indexOf("/");
  const given = slash === -1 ? path : path.slice(0, slash);
  const claims = checkPass(given, deps.passSecret, deps.nowMs);
  if (claims === null || claims.game !== game) return plain(403, RUN_OUT, deps);

  if (slash === -1) return plain(308, "", deps, { location: `/${given}/` });
  const rest = path.slice(slash + 1);
  const name = rest === "" ? "index.html" : normalizePath(rest);
  if (name === null) return plain(400, UNREADABLE, deps);

  const connect = claims.connect.map((host) => ` https://${host} wss://${host}`).join("");
  const headers = commonHeaders();
  // Only Ruken's page may frame the game, and the game's scripts may connect to its own files, to what the browser
  // makes itself (`blob:` and `data:`, which engines read their sounds and pictures through) and to the servers its
  // maker listed: the browser refuses any other connection.
  headers.set(
    "content-security-policy",
    `frame-ancestors ${deps.siteOrigin}; connect-src 'self' blob: data:${connect}`,
  );
  headers.set("cross-origin-resource-policy", "same-origin");
  headers.set("permissions-policy", PERMISSIONS);
  // The browser keeps a file for exactly as long as its address works, and never past it.
  const secondsLeft = Math.max(0, Math.floor((claims.expiresAtMs - deps.nowMs) / 1000));
  headers.set("cache-control", `private, max-age=${String(secondsLeft)}`);
  return serveFile(request, deps, `files/${claims.game}/${claims.pull}/${name}`, headers);
}

/** Answers one request. The first label of the host decides what it is: `media`, a game's own name, or nothing. */
export async function handleGameRequest(request: Request, deps: GateDeps): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return plain(405, NOT_ALLOWED, deps, { allow: "GET, HEAD" });
  }
  const url = new URL(request.url);
  if (url.pathname === "/__ruken/health") return plain(200, "ok", deps);
  if (url.pathname === "/robots.txt") return plain(200, "User-agent: *\nDisallow: /\n", deps);

  const label = url.hostname.split(".")[0] ?? "";
  if (label === "media") return serveClip(request, url, deps);
  const game = GAME_HOST.exec(label)?.[1];
  if (game === undefined) return plain(404, NOT_FOUND, deps);
  return serveGameFile(request, url, game, deps);
}
