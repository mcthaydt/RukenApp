import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The site is a Cloudflare Worker (design 7.3). These tests read the files that make it one, as text, so a
// change that points the journeys at a real database, adds a secret, or brings Netlify back fails here first.

const read = (path: string) => readFileSync(path, "utf8");

interface WranglerConfig {
  main?: string;
  assets?: { binding?: string; directory?: string };
  compatibility_flags?: string[];
  hyperdrive?: Record<string, unknown>[];
  r2_buckets?: Record<string, unknown>[];
  workers_dev?: boolean;
  preview_urls?: boolean;
  triggers?: { crons?: string[] };
  [key: string]: unknown;
}

/**
 * A JSON file that allows comments (wrangler.jsonc, tsconfig.json): the lines that start with // are dropped
 * (the comments sit on lines of their own) and so is a comma before a closing bracket, which the formatter adds.
 */
function jsoncText(path: string): string {
  return read(path)
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n")
    .replace(/,(\s*[}\]])/g, "$1");
}
const wrangler = () => JSON.parse(jsoncText("wrangler.jsonc")) as WranglerConfig;

describe("wrangler.jsonc", () => {
  it("names the built Worker and its static files", () => {
    expect(wrangler().main).toBe(".svelte-kit/cloudflare/_worker.js");
    expect(wrangler().assets).toEqual({ binding: "ASSETS", directory: ".svelte-kit/cloudflare" });
  });

  it("asks for Node's crypto, async_hooks and process.env", () => {
    expect(wrangler().compatibility_flags).toContain("nodejs_compat");
  });

  it("binds the database as HYPERDRIVE", () => {
    expect(wrangler().hyperdrive?.[0]?.binding).toBe("HYPERDRIVE");
  });

  // The id names a Hyperdrive setting in the Owner's Cloudflare account. It is not a credential and is useless without
  // the Owner's login (Owner, 2026-11-13: committed here). The thirty-two zeros are the stand-in that only
  // `wrangler dev` accepts; a real deploy needs the Owner's id.
  it("holds the Owner's Hyperdrive id: 32 lowercase hex characters, not the zeros", () => {
    const id = wrangler().hyperdrive?.[0]?.id;
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toMatch(/^0+$/);
    expect(id).toBe("eb64483c638e4f5eab2ce9dd1b7ea081");
  });

  // Games and clips live in one bucket the Owner makes by hand (G1). Local runs get Miniflare's own bucket; a
  // `remote` key or a preview bucket would point a journey or a preview at the real one.
  it("binds one R2 bucket, GAME_FILES on ruken-games, local in the journeys", () => {
    expect(wrangler().r2_buckets).toEqual([{ binding: "GAME_FILES", bucket_name: "ruken-games" }]);
  });

  // Until the Owner buys the site's domain, the site runs on its free workers.dev address (Owner, 2026-11-14:
  // "Yes, give me the commands to do it"). The games Worker gets no such address (its own test). Preview addresses
  // stay off, so a build never goes live on an address nobody chose. When the custom domain is added, workers_dev
  // goes back to false and this test with it.
  it("runs on its workers.dev address until the custom domain exists, and has no preview addresses", () => {
    expect(wrangler().workers_dev).toBe(true);
    expect(wrangler().preview_urls).toBe(false);
  });

  it("holds no variables and no route: those are the Owner's, set in Cloudflare", () => {
    for (const key of ["vars", "route", "routes"]) expect(wrangler()).not.toHaveProperty(key);
  });

  it("cannot be pointed at a real database by a change here: no remote, no local connection string", () => {
    expect(wrangler().hyperdrive?.[0]).not.toHaveProperty("remote");
    expect(wrangler().hyperdrive?.[0]).not.toHaveProperty("localConnectionString");
  });

  it("holds no address or key of a real service", () => {
    const text = read("wrangler.jsonc");
    for (const secret of ["postgres://", "postgresql://", "sk_live", "sk_test", "whsec_"]) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toMatch(/\bre_[A-Za-z0-9]{8,}/);
  });
});

describe("what runs the site", () => {
  it("the journeys run in wrangler dev, the runtime the real site runs in", () => {
    expect(read("playwright.config.ts")).toContain("wrangler dev");
  });

  // The game gate (a second Worker) is started with the same folder, so both see the one local bucket.
  it("the journeys keep the local bucket in a folder the gate can be given too", () => {
    expect(read("playwright.config.ts")).toContain("--persist-to .wrangler/state");
  });

  it("the build keeps Prisma's WebAssembly for Wrangler, and leaves the adapter out of Vitest", () => {
    const vite = read("vite.config.ts");
    expect(vite).toContain("process.env.VITEST");
    expect(vite).toContain(".wasm?module");
  });

  it("typechecking sees what Wrangler writes about the Worker's bindings", () => {
    expect((JSON.parse(jsoncText("tsconfig.json")) as { include: string[] }).include).toContain(
      "worker-configuration.d.ts",
    );
  });

  it("package.json names neither Netlify's adapter nor nodemailer", () => {
    const text = read("package.json");
    expect(text).not.toContain("@sveltejs/adapter-netlify");
    expect(text).not.toContain("nodemailer");
  });
});

describe("deploying", () => {
  const scripts = () => (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;

  // Workers Builds runs the deploy command only for the production branch, so a preview build, if anyone ever
  // switched previews on, runs `build` and never reaches the real database.
  it("the deploy command migrates the database first, so the code never meets an older one", () => {
    const deploy = scripts().deploy ?? "";
    expect(deploy).toContain("prisma migrate deploy");
    expect(deploy).toContain("wrangler deploy");
    expect(deploy.indexOf("prisma migrate deploy")).toBeLessThan(deploy.indexOf("wrangler deploy"));
  });

  // The game gate is its own Worker, so a game's files never come from Ruken's address. It goes out after the app,
  // with the same build's token.
  it("the deploy command then deploys the game gate", () => {
    const deploy = scripts().deploy ?? "";
    const gate = "wrangler deploy --config cloudflare/games/wrangler.jsonc";
    expect(deploy).toContain(gate);
    expect(deploy.indexOf(gate)).toBeGreaterThan(deploy.indexOf("wrangler deploy cloudflare/worker.js"));
  });

  it("the build never migrates", () => {
    expect(scripts().build).not.toContain("migrate");
  });
});

describe("the daily job", () => {
  const scripts = () => (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;

  it("runs once a day, at 09:17 UTC", () => {
    expect(wrangler().triggers?.crons).toEqual(["17 9 * * *"]);
  });

  it("is a wrapper around the built site that knocks with the Worker's secret and holds none of its own", () => {
    expect(existsSync("cloudflare/worker.js")).toBe(true);
    const text = read("cloudflare/worker.js");
    expect(text).toContain("env.JOBS_SECRET");
    expect(text).not.toContain("test-only");
    expect(text).not.toMatch(/JOBS_SECRET\s*[:=]\s*["'`]/);
    // SvelteKit refuses a POST with no content type and no matching Origin, so the knock says what it sends.
    expect(text).toContain("content-type");
  });

  // `main` stays the adapter's file, because the adapter writes its output to whatever `main` names; the wrapper
  // is what gets run and deployed, so both commands name it.
  it("is what is deployed and what the journeys run", () => {
    expect(scripts().deploy).toContain("wrangler deploy cloudflare/worker.js");
    expect(read("playwright.config.ts")).toContain("wrangler dev cloudflare/worker.js");
    expect(read("playwright.config.ts")).toContain("--test-scheduled");
  });
});

describe("Netlify is gone", () => {
  const ROOTS = ["src", "tests"];
  const FILES = [
    "package.json",
    "pnpm-lock.yaml",
    "vite.config.ts",
    "playwright.config.ts",
    ".env.example",
    ".gitignore",
    ".prettierignore",
    "eslint.config.js",
  ];
  /** Every file under src/ and tests/ but this one and the generated clients. */
  const sources = ROOTS.flatMap((root) =>
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name)),
  ).filter((path) => !path.includes("generated") && path !== join("tests", "wrangler.test.ts"));

  it("no file the site is built or tested from names it", () => {
    const naming = [...FILES, ...sources].filter((path) => /netlify/i.test(read(path)));
    expect(naming).toEqual([]);
  });
});
