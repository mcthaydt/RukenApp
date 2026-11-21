import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { isPhotoKey } from "../../../src/features/pages/photo.ts";
import { handleGameRequest } from "../../../src/features/play/gate.ts";
import { makePass, type PassClaims } from "../../../src/features/play/pass.ts";
import { makeMediaPass } from "../../../src/lib/files/media-pass.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";

const SECRET = "test-play-pass-secret";
const SITE = "https://ruken.test";
const EXPIRES_AT = 1_800_000_000_000;
/** One hour before the pass runs out, unless a test says otherwise. */
const NOW = EXPIRES_AT - 3_600_000;

const claims: PassClaims = {
  id: "AAAAAAAAAAAAAAAAAAAAAA",
  game: "aaaaaaaaaa",
  pull: "p1",
  connect: ["api.example.com"],
  expiresAtMs: EXPIRES_AT,
};
const pass = makePass(claims, SECRET);

/** What the site signs for a clip: good for one hour from NOW, as a pass for a video lasts at least that long. */
const clipPass = (key: string, expiresAtMs = EXPIRES_AT) => makeMediaPass(key, expiresAtMs, SECRET);
const VIDEO_RAN_OUT = "This video's link has run out. Go back and open the page again.";
const RAN_OUT = "This game's link has run out. Go back and press Play again.";
const PAGE = "<html>page</html>";
const MAIN = "console.log(1);";
const CLIP_KEY = "clips/aaaaaaaaaa/upright-0123456789abcdef.mp4";
const MOV_CLIP_KEY = "clips/aaaaaaaaaa/wide-0123456789abcdef.mov";
const PHOTO_KEY = "photos/0123456789abcdef.png";
// The first bytes of a PNG: the gate takes the type from the key's name and never looks inside.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let files: MemoryFileStore;

beforeEach(async () => {
  files = new MemoryFileStore();
  const put = (key: string, content: string | Uint8Array) =>
    files.put(key, typeof content === "string" ? new TextEncoder().encode(content) : content);
  await put("files/aaaaaaaaaa/p1/index.html", PAGE);
  await put("files/aaaaaaaaaa/p1/main.js", MAIN);
  await put("files/aaaaaaaaaa/p1/img/dot.png", new Uint8Array([1, 2, 3]));
  await put("files/aaaaaaaaaa/p1/data/level.bin", new Uint8Array([9, 9]));
  await put("files/aaaaaaaaaa/p1/LICENSE", "no extension");
  await put("files/aaaaaaaaaa/p1/big.js.br", new Uint8Array([1, 2, 3, 4]));
  await put(CLIP_KEY, new Uint8Array([0, 0, 0, 32, 0x66, 0x74, 0x79, 0x70]));
  await put(MOV_CLIP_KEY, new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]));
  await put(PHOTO_KEY, PNG_BYTES);
  files.reads.length = 0;
});

/** One request to the gate. The host is a game's own name unless a test says otherwise. */
function get(
  path: string,
  options: {
    host?: string;
    nowMs?: number;
    method?: string;
    headers?: Record<string, string>;
    pathHost?: string;
  } = {},
): Promise<Response> {
  const request = new Request(`http://${options.host ?? "g-aaaaaaaaaa.games.test"}${path}`, {
    method: options.method ?? "GET",
    headers: options.headers ?? {},
  });
  return handleGameRequest(request, {
    files,
    passSecret: SECRET,
    siteOrigin: SITE,
    nowMs: options.nowMs ?? NOW,
    ...(options.pathHost === undefined ? {} : { pathHost: options.pathHost }),
  });
}

describe("a game's files", () => {
  it("serves the game's page under a good pass", async () => {
    const response = await get(`/${pass}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(PAGE);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors https://ruken.test");
    expect(response.headers.get("permissions-policy")).toContain("web-share=(self)");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  });

  it("serves a file by its path, and index.html by name", async () => {
    expect(await (await get(`/${pass}/main.js`)).text()).toBe(MAIN);
    expect(await (await get(`/${pass}/index.html`)).text()).toBe(PAGE);
    const dot = await get(`/${pass}/img/dot.png`);
    expect(dot.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await dot.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    // Only the path counts, not a query.
    expect((await get(`/${pass}/main.js?v=2`)).status).toBe(200);
  });

  it("sends /<pass> on to /<pass>/", async () => {
    const response = await get(`/${pass}`);
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`/${pass}/`);
  });

  // Design 8: someone who has not paid has no pass, so nothing loads.
  it("loads nothing without a pass", async () => {
    for (const path of [
      "/",
      "/index.html",
      "/main.js",
      "/files/aaaaaaaaaa/p1/index.html",
      "/v1.x.y/index.html",
    ]) {
      expect((await get(path)).status).toBe(403);
    }
    expect(files.reads).toEqual([]);
  });

  // The pass says which servers the game may reach; the browser enforces it.
  it("lets the game reach its own files and the servers in its pass, and nothing else", async () => {
    expect((await get(`/${pass}/`)).headers.get("content-security-policy")).toBe(
      "frame-ancestors https://ruken.test; connect-src 'self' blob: data: https://api.example.com wss://api.example.com",
    );
    const none = makePass({ ...claims, connect: [] }, SECRET);
    expect((await get(`/${none}/`)).headers.get("content-security-policy")).toBe(
      "frame-ancestors https://ruken.test; connect-src 'self' blob: data:",
    );
  });

  it("keeps a file in the browser only as long as its pass works", async () => {
    expect((await get(`/${pass}/main.js`)).headers.get("cache-control")).toBe("private, max-age=3600");
    const early = await get(`/${pass}/main.js`, { nowMs: EXPIRES_AT - 86_400_000 });
    expect(early.headers.get("cache-control")).toBe("private, max-age=86400");
  });

  // A service worker could go on serving the game after its pass ran out.
  it("refuses to hand out a service worker", async () => {
    const response = await get(`/${pass}/main.js`, { headers: { "service-worker": "script" } });
    expect(response.status).toBe(403);
    expect(files.reads).toEqual([]);
  });

  it("refuses a pass made for another game", async () => {
    const other = makePass({ ...claims, game: "bbbbbbbbbb" }, SECRET);
    const response = await get(`/${other}/index.html`);
    expect(response.status).toBe(403);
    expect(files.reads).toEqual([]);
  });

  it("refuses a pass made with another secret, or changed", async () => {
    const forged = makePass(claims, "not-the-secret");
    expect((await get(`/${forged}/index.html`)).status).toBe(403);
    expect((await get(`/${pass}x/index.html`)).status).toBe(403);
    expect(files.reads).toEqual([]);
  });

  it("refuses a pass that has run out, in words a person can act on", async () => {
    const response = await get(`/${pass}/main.js`, { nowMs: EXPIRES_AT });
    expect(response.status).toBe(403);
    expect(await response.text()).toBe(RAN_OUT);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; frame-ancestors https://ruken.test",
    );
    expect(files.reads).toEqual([]);
  });

  // A browser's address parser folds `..` and `%2e%2e` away before a request is sent, and so does
  // `new Request` here, so those two reach the gate as a different path and fail the pass; the other three still
  // reach it as they are. Whichever way, nothing is served and the bucket is never asked.
  it.each(["../p2/index.html", "..%2fp2/index.html", "a//b", "a%5cb", "%2e%2e/%2e%2e/clips/x"])(
    "refuses the path %j and never asks the bucket",
    async (rest) => {
      const response = await get(`/${pass}/${rest}`);
      expect([400, 403, 404]).toContain(response.status);
      expect(files.reads).toEqual([]);
    },
  );

  it("says it could not read an address with an encoded slash or backslash", async () => {
    for (const rest of ["a%2fb", "a%5cb", "a//b"]) {
      const response = await get(`/${pass}/${rest}`);
      expect(response.status).toBe(400);
      expect(await response.text()).toBe("We could not read that address.");
    }
  });

  it("says a file is not found when it is not there", async () => {
    const response = await get(`/${pass}/missing.js`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found.");
  });

  it("serves a file it does not know as plain bytes", async () => {
    for (const path of ["data/level.bin", "LICENSE"]) {
      const response = await get(`/${pass}/${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/octet-stream");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });

  it("answers a byte range", async () => {
    const response = await get(`/${pass}/main.js`, { headers: { range: "bytes=1-2" } });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(`bytes 1-2/${String(MAIN.length)}`);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(await response.text()).toBe("on");
  });

  it("answers 416 to a range past the end", async () => {
    const response = await get(`/${pass}/main.js`, { headers: { range: "bytes=999-" } });
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe(`bytes */${String(MAIN.length)}`);
  });

  it("answers 304 to a matching etag", async () => {
    const first = await get(`/${pass}/main.js`);
    const etag = first.headers.get("etag") ?? "";
    expect(etag).not.toBe("");
    const again = await get(`/${pass}/main.js`, { headers: { "if-none-match": etag } });
    expect(again.status).toBe(304);
    expect(await again.text()).toBe("");
  });

  it("sends a precompressed file as it is, and never as a range", async () => {
    const response = await get(`/${pass}/big.js.br`, { headers: { range: "bytes=1-2" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-encoding")).toBe("br");
    expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(response.headers.get("accept-ranges")).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("answers HEAD with the headers and no body, without reading the file", async () => {
    const response = await get(`/${pass}/main.js`, { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe(String(MAIN.length));
    expect(await response.text()).toBe("");
    expect(files.reads).toEqual(["files/aaaaaaaaaa/p1/main.js"]);
  });
});

describe("a game's clips", () => {
  // A clip plays only under a media pass for that one clip, which the site signs for someone who may see the page.
  it("sends a clip under a good pass, to keep until the pass runs out", async () => {
    const response = await get(`/${CLIP_KEY}?pass=${clipPass(CLIP_KEY)}`, { host: "media.games.test" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
  });

  // A Mac saves its screen recordings as QuickTime, and the Owner said Ruken takes them.
  it("sends a QuickTime clip as video/quicktime", async () => {
    const response = await get(`/${MOV_CLIP_KEY}?pass=${clipPass(MOV_CLIP_KEY)}`, {
      host: "media.games.test",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/quicktime");
  });

  it("answers a byte range of a clip, so a video can be skipped through", async () => {
    const response = await get(`/${CLIP_KEY}?pass=${clipPass(CLIP_KEY)}`, {
      host: "media.games.test",
      headers: { range: "bytes=4-7" },
    });
    expect(response.status).toBe(206);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0x66, 0x74, 0x79, 0x70]));
  });

  // No pass, a changed one, one that ran out and one for another video: each is refused before the bucket is read.
  it.each([
    ["no pass", ""],
    ["an empty pass", "?pass="],
    ["a changed pass", `?pass=${clipPass(CLIP_KEY).slice(0, -2)}AA`],
    ["a pass that ran out", `?pass=${clipPass(CLIP_KEY, NOW)}`],
    ["a pass for another video", `?pass=${clipPass(MOV_CLIP_KEY)}`],
  ])("refuses a clip with %s", async (_name, query) => {
    for (const [host, path] of [
      ["media.games.test", `/${CLIP_KEY}${query}`],
      ["games.test", `/media/${CLIP_KEY}${query}`],
    ] as const) {
      const response = await get(path, { host, pathHost: "games.test" });
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).toBe(VIDEO_RAN_OUT);
    }
    expect(files.reads).toEqual([]);
  });

  it("refuses a range request with no pass too", async () => {
    const response = await get(`/${CLIP_KEY}`, { host: "media.games.test", headers: { range: "bytes=0-3" } });
    expect(response.status).toBe(403);
    expect(files.reads).toEqual([]);
  });

  it("serves nothing else from the media name", async () => {
    for (const path of [
      "/files/aaaaaaaaaa/p1/index.html",
      `/${pass}/index.html`,
      "/clips/aaaaaaaaaa/../../files/aaaaaaaaaa/p1/main.js",
      "/clips/aaaaaaaaaa/upright-0123456789abcdef.html",
      "/clips/aaaaaaaaaa/upright-XYZ.mp4",
    ]) {
      expect((await get(path, { host: "media.games.test" })).status).toBe(404);
    }
    expect(files.reads).toEqual([]);
  });

  it("says a clip is not found when it is not there", async () => {
    const missing = "clips/aaaaaaaaaa/wide-0123456789abcdef.mp4";
    const response = await get(`/${missing}?pass=${clipPass(missing)}`, { host: "media.games.test" });
    expect(response.status).toBe(404);
  });
});

describe("a maker's photo", () => {
  // A photo is shown on a maker's page before anyone plays, so anyone may have it, as a clip is.
  it("sends a photo to anyone, to keep for a year", async () => {
    const response = await get(`/${PHOTO_KEY}`, { host: "media.games.test" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
  });

  // The media name serves a clip or a photo and nothing else, and never reaches the store to find out.
  it("serves nothing from the media name that is not a clip or a photo", async () => {
    for (const path of [
      "/photos/0123456789abcdef.svg",
      "/photos/0123456789abcdef.html",
      "/photos/../files/aaaaaaaaaa/p1/index.html",
      "/photos/",
      "/photos",
    ]) {
      expect((await get(path, { host: "media.games.test" })).status).toBe(404);
    }
    expect(files.reads).toEqual([]);
  });

  it("never serves a photo from a game's own name", async () => {
    const response = await get(`/${PHOTO_KEY}`);
    // Like any address with no pass: refused, and the store is not asked.
    expect(response.status).toBe(403);
    expect(await response.text()).toBe(RAN_OUT);
    expect(files.reads).toEqual([]);
  });

  // The gate keeps its own copy of the key's shape (it imports no feature), so the two must never drift apart.
  it("takes the keys the pages feature makes and refuses the ones it refuses", async () => {
    const keys = [
      "photos/0123456789abcdef.jpg",
      "photos/0123456789abcdef.png",
      "photos/0123456789abcdef.webp",
      "photos/0123456789abcdef.svg",
      "photos/0123456789abcdef.html",
      "photos/0123456789abcdef.png.exe",
      "photos/123456789abcdef.png",
      "photos/0123456789ABCDEF.png",
      "photos/x/0123456789abcdef.png",
      "photos/0123456789abcdef0.png",
      "files/0123456789abcdef.png",
    ];
    for (const key of keys) {
      // Every key is in the store, so a 404 can only be the gate's own refusal.
      await files.put(key, PNG_BYTES);
      const response = await get(`/${key}`, { host: "media.games.test" });
      expect(response.status, key).toBe(isPhotoKey(key) ? 200 : 404);
    }
  });
});

// Cloudflare's own cache keeps an answer only when the Worker's code puts it there. If the gate ever did, an address
// that has run out could go on playing from the edge, and a purge would be needed.
describe("the gate's answers stay out of Cloudflare's cache", () => {
  it.each(["src/features/play/gate.ts", "cloudflare/games/worker.ts"])(
    "%s uses no cache and no outgoing fetch",
    (path) => {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(/\bcaches\./);
      // The Worker's own handler, `fetch(request: Request, env: Env)`, is a definition, not an outgoing call: allowed.
      expect(source).not.toMatch(/(?<![\w.])fetch\((?!request: Request)/);
      expect(source).not.toMatch(/globalThis\.fetch/);
    },
  );
});

describe("the gate as a whole", () => {
  it("answers its health check on any name, and says nothing is indexed", async () => {
    const health = await get("/__ruken/health", { host: "media.games.test" });
    expect(health.status).toBe(200);
    expect(await health.text()).toBe("ok");
    expect(health.headers.get("cache-control")).toBe("no-store");
    const robots = await get("/robots.txt");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
  });

  it("never sets a cookie and never reads one", async () => {
    const paths = [
      `/${pass}/`,
      `/${pass}/main.js`,
      `/${pass}/missing.js`,
      `/${pass}/a%2fb`,
      "/",
      "/robots.txt",
    ];
    for (const path of paths) {
      const plain = await get(path);
      const withCookie = await get(path, { headers: { cookie: `session=abc; ${pass}=1` } });
      expect(plain.headers.get("set-cookie")).toBeNull();
      expect(withCookie.headers.get("set-cookie")).toBeNull();
      expect(withCookie.status).toBe(plain.status);
      expect(await withCookie.text()).toBe(await plain.text());
    }
  });

  it("refuses a POST", async () => {
    const response = await get(`/${pass}/main.js`, { method: "POST" });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expect(files.reads).toEqual([]);
  });

  it("is not found on any other name", async () => {
    for (const host of ["www.games.test", "games.test", "g-short.games.test"]) {
      expect((await get(`/${pass}/index.html`, { host })).status).toBe(404);
    }
    expect(files.reads).toEqual([]);
  });
});

// Until the games' domain exists every game shares one free address, and the game is the first part of the path:
// `/g-<id>/<pass>/<path>`. Everything below runs on that one host, "games.test".
describe("on the one free address", () => {
  const FREE = "games.test";
  const here = (path: string, options: Parameters<typeof get>[1] = {}) =>
    get(path, { host: FREE, pathHost: FREE, ...options });
  // A pass made for another game, whose files are in the bucket too: a climb that got through would find one.
  const other = makePass({ ...claims, game: "bbbbbbbbbb" }, SECRET);
  const otherPass = makePass({ ...claims, pull: "p9" }, SECRET);

  beforeEach(async () => {
    await files.put("files/bbbbbbbbbb/p1/index.html", new TextEncoder().encode("<html>other</html>"));
    files.reads.length = 0;
  });

  it("serves a game's page and its files from the game's folder", async () => {
    const page = await here(`/g-aaaaaaaaaa/${pass}/`);
    expect(page.status).toBe(200);
    expect(await page.text()).toBe(PAGE);
    expect(await (await here(`/g-aaaaaaaaaa/${pass}/main.js`)).text()).toBe(MAIN);
  });

  it("sends /g-<id>/<pass> on to /g-<id>/<pass>/", async () => {
    const response = await here(`/g-aaaaaaaaaa/${pass}`);
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`/g-aaaaaaaaaa/${pass}/`);
  });

  // A pass made for one game, used under another game's folder.
  it("refuses a pass made for another game", async () => {
    expect((await here(`/g-bbbbbbbbbb/${pass}/`)).status).toBe(403);
    expect((await here(`/g-aaaaaaaaaa/${other}/`)).status).toBe(403);
    expect(await (await here(`/g-bbbbbbbbbb/${pass}/`)).text()).toBe(RAN_OUT);
    expect(files.reads).not.toContain("files/bbbbbbbbbb/p1/index.html");
    // A pass for the same game but a pull that holds no such file is only a missing file, never another game's.
    expect((await here(`/g-aaaaaaaaaa/${otherPass}/index.html`)).status).toBe(404);
  });

  // A path that climbs out of the game's folder into another's.
  it("refuses a path that climbs into another game's folder", async () => {
    const encoded = await here(`/g-aaaaaaaaaa/${pass}/..%2f..%2fbbbbbbbbbb/p1/index.html`);
    expect(encoded.status).toBe(400);
    expect(files.reads).toEqual([]);
    // The address folds the dots before the gate sees it, so it arrives as a request for the other game, with no pass.
    expect((await here(`/g-aaaaaaaaaa/${pass}/../../g-bbbbbbbbbb/p1/index.html`)).status).toBe(403);
    expect(files.reads).toEqual([]);
  });

  it("loads nothing without a pass", async () => {
    expect((await here("/g-aaaaaaaaaa/")).status).toBe(403);
    expect((await here("/g-aaaaaaaaaa/index.html")).status).toBe(403);
    expect(files.reads).toEqual([]);
  });

  it("sends a clip under a pass and a photo to anyone", async () => {
    const clip = await here(`/media/${CLIP_KEY}?pass=${clipPass(CLIP_KEY)}`);
    expect(clip.status).toBe(200);
    expect(clip.headers.get("cache-control")).toBe("private, max-age=3600");
    const photo = await here(`/media/${PHOTO_KEY}`);
    expect(photo.status).toBe(200);
    expect(photo.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("serves nothing else from /media", async () => {
    expect((await here("/media/files/aaaaaaaaaa/p1/index.html")).status).toBe(404);
  });

  it("refuses to hand out a service worker", async () => {
    const response = await here(`/g-aaaaaaaaaa/${pass}/main.js`, { headers: { "service-worker": "script" } });
    expect(response.status).toBe(403);
  });

  it("is not found at the top or on a folder that is not a game", async () => {
    expect((await here("/")).status).toBe(404);
    expect((await here("/x/y")).status).toBe(404);
  });

  it("answers the health check and robots.txt as on any name", async () => {
    expect((await here("/__ruken/health")).status).toBe(200);
    expect((await here("/robots.txt")).status).toBe(200);
  });

  it("keeps the name's first label for every other host", async () => {
    const response = await get(`/${pass}/`, { host: "g-aaaaaaaaaa.games.example", pathHost: FREE });
    expect(response.status).toBe(200);
  });

  // A request that looks like the free address's, on any other name.
  it("answers no path as a game on any other host", async () => {
    expect((await get(`/g-aaaaaaaaaa/${pass}/`, { host: "other.test", pathHost: FREE })).status).toBe(404);
    expect((await get(`/g-aaaaaaaaaa/${pass}/`, { host: FREE })).status).toBe(404);
  });

  it("gives the same headers as on a game's own name", async () => {
    const own = await get(`/${pass}/`);
    const shared = await here(`/g-aaaaaaaaaa/${pass}/`);
    for (const name of ["content-security-policy", "cross-origin-resource-policy", "cache-control"]) {
      expect(shared.headers.get(name)).toBe(own.headers.get(name));
    }
  });
});
