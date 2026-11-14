import { beforeEach, describe, expect, it } from "vitest";
import { isPhotoKey } from "../../../src/features/pages/photo.ts";
import { handleGameRequest } from "../../../src/features/play/gate.ts";
import { makePass, type PassClaims } from "../../../src/features/play/pass.ts";
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

const RAN_OUT = "This game's link has run out. Go back and press Play again.";
const PAGE = "<html>page</html>";
const MAIN = "console.log(1);";
const CLIP_KEY = "clips/aaaaaaaaaa/upright-0123456789abcdef.mp4";
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
  await put(PHOTO_KEY, PNG_BYTES);
  files.reads.length = 0;
});

/** One request to the gate. The host is a game's own name unless a test says otherwise. */
function get(
  path: string,
  options: { host?: string; nowMs?: number; method?: string; headers?: Record<string, string> } = {},
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

  // Review Focus 20: the pass says which servers the game may reach; the browser enforces it.
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

  // Review Focus 22: a service worker could go on serving the game after its pass ran out.
  it("refuses to hand out a service worker", async () => {
    const response = await get(`/${pass}/main.js`, { headers: { "service-worker": "script" } });
    expect(response.status).toBe(403);
    expect(files.reads).toEqual([]);
  });

  // Review Focus 1
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

  // Review Focus 3
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

  // Review Focus 2. A browser's address parser folds `..` and `%2e%2e` away before a request is sent, and so does
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

  // Review Focus 11
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
  // Clips are shown on pages before anyone plays, so anyone may have them.
  it("sends a clip to anyone, to keep for a year", async () => {
    const response = await get(`/${CLIP_KEY}`, { host: "media.games.test" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
  });

  it("answers a byte range of a clip, so a video can be skipped through", async () => {
    const response = await get(`/${CLIP_KEY}`, { host: "media.games.test", headers: { range: "bytes=4-7" } });
    expect(response.status).toBe(206);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0x66, 0x74, 0x79, 0x70]));
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
    const response = await get("/clips/aaaaaaaaaa/wide-0123456789abcdef.mp4", { host: "media.games.test" });
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

  // Review Focus 13: the media name serves a clip or a photo and nothing else, and never reaches the store to find out.
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

describe("the gate as a whole", () => {
  it("answers its health check on any name, and says nothing is indexed", async () => {
    const health = await get("/__ruken/health", { host: "media.games.test" });
    expect(health.status).toBe(200);
    expect(await health.text()).toBe("ok");
    expect(health.headers.get("cache-control")).toBe("no-store");
    const robots = await get("/robots.txt");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
  });

  // Review Focus 14
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
