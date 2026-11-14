import { readFileSync, readdirSync } from "node:fs";
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
  workers_dev?: boolean;
  preview_urls?: boolean;
  [key: string]: unknown;
}

/** wrangler.jsonc, with the lines that start with // dropped: the comments sit on lines of their own. */
function wranglerText(): string {
  return read("wrangler.jsonc")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}
const wrangler = () => JSON.parse(wranglerText()) as WranglerConfig;

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

  it("has one address only: no workers.dev and no preview addresses", () => {
    expect(wrangler().workers_dev).toBe(false);
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

  it("the build keeps Prisma's WebAssembly for Wrangler, and leaves the adapter out of Vitest", () => {
    const vite = read("vite.config.ts");
    expect(vite).toContain("process.env.VITEST");
    expect(vite).toContain(".wasm?module");
  });

  it("typechecking sees what Wrangler writes about the Worker's bindings", () => {
    expect((JSON.parse(read("tsconfig.json")) as { include: string[] }).include).toContain(
      "worker-configuration.d.ts",
    );
  });

  it("package.json names neither Netlify's adapter nor nodemailer", () => {
    const text = read("package.json");
    expect(text).not.toContain("@sveltejs/adapter-netlify");
    expect(text).not.toContain("nodemailer");
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
