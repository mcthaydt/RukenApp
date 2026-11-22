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
let server: Server | undefined;
afterEach(() => server?.close());

async function check(opts: { home: Reply; http: Reply; wranglerSays?: string }) {
  const srv = createServer((req, res) => {
    const reply = req.url === "/sign-in" ? opts.http : opts.home;
    if (reply === "silent") return; // never answers
    res.writeHead(reply.status, reply.location ? { location: reply.location } : {});
    res.end(reply.body ?? "");
  });
  server = srv;
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  const port = (srv.address() as { port: number }).port;
  const dir = mkdtempSync(join(tmpdir(), "live-check-"));
  const wrangler = join(dir, "wrangler");
  writeFileSync(wrangler, `#!/usr/bin/env bash\necho "${opts.wranglerSays ?? `(100%) ${VERSION}`}"\n`);
  chmodSync(wrangler, 0o755);
  return await new Promise<{ status: number | null; text: string }>((done) => {
    const p = spawn("bash", [script], {
      env: {
        PATH: process.env.PATH,
        VERSION_ID: VERSION,
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
