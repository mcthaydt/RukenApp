import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// games-check.sh looks at the live games Worker after a deploy: the new version is at 100%, and the settings
// Cloudflare holds keep nothing about a visitor. A local server stands in for the Cloudflare API and a stub stands
// in for wrangler. The wait is injected so the failing cases are quick.

const script = join(process.cwd(), ".github/scripts/games-check.sh");
const VERSION = "11111111-2222-3333-4444-555555555555";
const ACCOUNT = "acct123";

type Settings = Record<string, unknown>;
type Reply = { status: number; json: unknown } | "silent";
let server: Server | undefined;
afterEach(() => server?.close());

const off: Settings = { observability: { enabled: false } };
const ok = (result: Settings): Reply => ({ status: 200, json: { success: true, errors: [], result } });

async function check(opts: {
  api: Reply | ((sinceStart: number) => Reply);
  wranglerSays?: string;
  versionId?: string;
}) {
  const startedAt = Date.now();
  const seen: string[] = [];
  const srv = createServer((req, res) => {
    seen.push(`${req.method ?? ""} ${req.url ?? ""} ${req.headers.authorization ?? ""}`);
    const reply = typeof opts.api === "function" ? opts.api(Date.now() - startedAt) : opts.api;
    if (reply === "silent") return; // never answers
    res.writeHead(reply.status, { "content-type": "application/json" });
    res.end(JSON.stringify(reply.json));
  });
  server = srv;
  await new Promise<void>((done) => srv.listen(0, "127.0.0.1", done));
  const port = (srv.address() as { port: number }).port;
  const dir = mkdtempSync(join(tmpdir(), "games-check-"));
  const wrangler = join(dir, "wrangler");
  // Answers only to `deployments status --name ruken-games`, so a script that asks the main Worker fails.
  writeFileSync(
    wrangler,
    `#!/usr/bin/env bash\n[ "$*" = "deployments status --name ruken-games" ] || exit 1\nprintf '%s\\n' "${opts.wranglerSays ?? `(100%) ${VERSION}`}"\n`,
  );
  chmodSync(wrangler, 0o755);
  const result = await new Promise<{ status: number | null; text: string }>((done) => {
    const p = spawn("bash", [script], {
      env: {
        PATH: process.env.PATH,
        VERSION_ID: opts.versionId ?? VERSION,
        CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
        CLOUDFLARE_API_TOKEN: "secret-token",
        API_URL: `http://127.0.0.1:${String(port)}`,
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
  return { ...result, seen };
}

describe("games-check.sh", () => {
  it("passes on the new version at 100% and every setting off, asking the right address with the token", async () => {
    const r = await check({ api: ok(off) });
    expect(r.status).toBe(0);
    expect(r.text).toMatch(/Games check passed/);
    expect(r.seen[0]).toBe(
      `GET /accounts/${ACCOUNT}/workers/scripts/ruken-games/script-settings Bearer secret-token`,
    );
  });

  it("passes when logs, traces, logpush and tail consumers are listed but off or empty", async () => {
    const r = await check({
      api: ok({
        observability: { enabled: false, logs: { enabled: false }, traces: { enabled: false } },
        logpush: false,
        tail_consumers: [],
      }),
    });
    expect(r.status).toBe(0);
  });

  it("fails when observability is on", async () => {
    const r = await check({ api: ok({ observability: { enabled: true } }) });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*observability.*on/i);
  });

  it("fails when the top switch is off but logs are on", async () => {
    const r = await check({ api: ok({ observability: { enabled: false, logs: { enabled: true } } }) });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*logs.*on/i);
  });

  it("fails when the top switch is off but traces are on", async () => {
    const r = await check({ api: ok({ observability: { enabled: false, traces: { enabled: true } } }) });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*traces.*on/i);
  });

  it("fails when the observability setting is missing: off must be seen, not assumed", async () => {
    const r = await check({ api: ok({}) });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*observability.*(missing|not)/i);
  });

  it("fails when logpush is on", async () => {
    const r = await check({ api: ok({ observability: { enabled: false }, logpush: true }) });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*logpush/i);
  });

  it("fails when a tail consumer is attached", async () => {
    const r = await check({
      api: ok({ observability: { enabled: false }, tail_consumers: [{ service: "someone" }] }),
    });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*tail/i);
  });

  it("fails when Cloudflare says success: false", async () => {
    const r = await check({ api: { status: 200, json: { success: false, errors: [{ message: "nope" }] } } });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*settings/i);
  });

  it("fails on a non-200 answer", async () => {
    const r = await check({ api: { status: 403, json: { success: false } } });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*403/);
  });

  it("fails when wrangler does not show the new version at 100%", async () => {
    const r = await check({ api: ok(off), wranglerSays: "(50%) " + VERSION + "\\n(50%) 99999999-old" });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*version.*100%/i);
  });

  it("fails at once when the deploy gave no version id", async () => {
    const r = await check({ api: ok(off), versionId: "", wranglerSays: "(100%) 99999999-old" });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::.*no version id/i);
  });

  it("waits for new settings to arrive: wrong at first, right a moment later", async () => {
    const r = await check({
      api: (since) => (since < 800 ? ok({ observability: { enabled: true } }) : ok(off)),
    });
    expect(r.status).toBe(0);
  });

  it("fails, within the wait, on an API that never answers", async () => {
    const started = Date.now();
    const r = await check({ api: "silent" });
    expect(r.status).not.toBe(0);
    expect(r.text).toMatch(/::error::/);
    expect(Date.now() - started).toBeLessThan(10_000);
  }, 15_000);
});
