import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// live-check.sh looks at the live site after a deploy. A local server stands in for ruken.io, and a stub
// stands in for wrangler. The wait is injected so the failing cases are quick.

const script = join(process.cwd(), ".github/scripts/live-check.sh");
const VERSION = "11111111-2222-3333-4444-555555555555";

type Reply = { status: number; body?: string; location?: string } | "silent";
// A reply can change with time, to stand in for a new version still spreading to every Cloudflare location.
type Answer = Reply | ((sinceStart: number) => Reply);
let server: Server | undefined;
afterEach(() => server?.close());
const privateFeed: Reply = { status: 200, body: '{"ranker":"private","health":"defaults"}' };

async function check(opts: {
  home: Answer;
  http: Answer;
  feed?: Answer;
  wranglerSays?: string;
  versionId?: string;
}) {
  const startedAt = Date.now();
  const srv = createServer((req, res) => {
    const answer =
      req.url === "/sign-in"
        ? opts.http
        : req.url === "/healthz/feed"
          ? (opts.feed ?? privateFeed)
          : opts.home;
    const reply = typeof answer === "function" ? answer(Date.now() - startedAt) : answer;
    if (reply === "silent") return; // never answers
    res.writeHead(reply.status, reply.location ? { location: reply.location } : {});
    res.end(reply.body ?? "");
  });
  server = srv;
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  const port = (srv.address() as { port: number }).port;
  const dir = mkdtempSync(join(tmpdir(), "live-check-"));
  const wrangler = join(dir, "wrangler");
  // Answers only to `deployments status`, so a script that asks wrangler something else fails.
  writeFileSync(
    wrangler,
    `#!/usr/bin/env bash\n[ "$*" = "deployments status" ] || exit 1\nprintf '%s\\n' "${opts.wranglerSays ?? `(100%) ${VERSION}`}"\n`,
  );
  chmodSync(wrangler, 0o755);
  return await new Promise<{ status: number | null; text: string }>((done) => {
    const p = spawn("bash", [script], {
      env: {
        PATH: process.env.PATH,
        VERSION_ID: opts.versionId ?? VERSION,
        SITE_URL: `http://127.0.0.1:${String(port)}`,
        HTTP_URL: `http://127.0.0.1:${String(port)}/sign-in`,
        EXPECTED_LOCATION: "https://ruken.io/sign-in",
        WRANGLER_CMD: wrangler,
        WAIT_SECONDS: "2",
        INTERVAL: "0.2",
        CURL_MAX_TIME: "1",
      },
    });
    let text = "";
    p.stdout.on("data", (d: Buffer) => {
      text += d.toString();
    });
    p.stderr.on("data", (d: Buffer) => {
      text += d.toString();
    });
    p.on("close", (status) => {
      done({ status, text });
    });
  });
}

const good = { status: 200, body: "<html><title>Ruken - The Everyday Console</title></html>" };
const redirect = { status: 308, location: "https://ruken.io/sign-in" };

describe("live-check.sh", () => {
  it("passes on a live version, a 200 with the title and a 308 to https", async () => {
    const r = await check({ home: good, http: redirect });
    expect(r.status).toBe(0);
  });

  it("fails when wrangler does not show the new version at 100%", async () => {
    const r = await check({ home: good, http: redirect, wranglerSays: "(50%) other-version" });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*version.*100%/i);
  });

  it("fails when our version is only at 50%", async () => {
    const r = await check({
      home: good,
      http: redirect,
      wranglerSays: `(50%) ${VERSION}\\n(50%) 99999999-old`,
    });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*100%/i);
  });

  it("fails at once when the deploy gave no version id", async () => {
    const r = await check({ home: good, http: redirect, versionId: "", wranglerSays: "(100%) 99999999-old" });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*no version id/i);
  });

  it("waits for a new version to arrive: wrong at first, right a moment later", async () => {
    const r = await check({
      home: (since) => (since < 800 ? { status: 500 } : good),
      http: (since) => (since < 800 ? { status: 200 } : redirect),
    });
    expect(r.status).toBe(0);
    expect(r.text).toMatch(/Live check passed/);
  });

  it("fails on an http address that answers 200 instead of redirecting", async () => {
    const r = await check({ home: good, http: { status: 200 } });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*sign-in.*308.*got 200/i);
  });

  it("fails on a 308 that goes to the wrong place", async () => {
    const r = await check({ home: good, http: { status: 308, location: "https://example.com/" } });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*location.*example\.com/i);
  });

  it("fails when the open order answers the feed instead of the private one", async () => {
    const r = await check({
      home: good,
      http: redirect,
      feed: { status: 200, body: '{"ranker":"open","health":"defaults"}' },
    });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*healthz\/feed.*private.*"ranker":"open"/);
  });

  it("fails when /healthz/feed is not there", async () => {
    const r = await check({ home: good, http: redirect, feed: { status: 404 } });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*healthz\/feed.*200.*got 404/);
  });

  it("fails on a 500", async () => {
    const r = await check({ home: { status: 500 }, http: redirect });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*home page.*200.*got 500/i);
  });

  it("fails on a page without the Ruken title", async () => {
    const r = await check({ home: { status: 200, body: "<title>Other</title>" }, http: redirect });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*title/i);
  });

  it("fails, within the wait, on a server that never answers", async () => {
    const started = Date.now();
    const r = await check({ home: "silent", http: redirect });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::/);
    expect(Date.now() - started).toBeLessThan(10_000);
  }, 15_000);
});
