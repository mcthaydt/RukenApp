import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The game gate is a second Worker, so a game's files never come from Ruken's own address (design 7.3). These tests
// read the files that make it one, as text, so a change that gives it a route, a variable, a database or a real
// address fails here first.

const read = (path: string) => readFileSync(path, "utf8");

interface GateConfig {
  name?: string;
  main?: string;
  compatibility_flags?: string[];
  workers_dev?: boolean;
  preview_urls?: boolean;
  r2_buckets?: Record<string, unknown>[];
  [key: string]: unknown;
}

/** wrangler.jsonc allows comments: the lines that start with // are dropped, and so is a comma before a closing bracket. */
function jsoncText(path: string): string {
  return read(path)
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n")
    .replace(/,(\s*[}\]])/g, "$1");
}

const CONFIG = "cloudflare/games/wrangler.jsonc";
const config = () => JSON.parse(jsoncText(CONFIG)) as GateConfig;

describe("the gate's wrangler.jsonc", () => {
  it("is the Worker ruken-games, run from worker.ts", () => {
    expect(config().name).toBe("ruken-games");
    expect(config().main).toBe("worker.ts");
  });

  it("asks for Node's crypto, which checking a play pass needs", () => {
    expect(config().compatibility_flags).toContain("nodejs_compat");
  });

  it("has no workers.dev address and no preview addresses", () => {
    expect(config().workers_dev).toBe(false);
    expect(config().preview_urls).toBe(false);
  });

  it("reads the one bucket the site writes to", () => {
    expect(config().r2_buckets).toEqual([{ binding: "GAME_FILES", bucket_name: "ruken-games" }]);
  });

  it("holds no variable, no route and no database: those are the Owner's, or the site's", () => {
    for (const key of ["vars", "route", "routes", "hyperdrive"]) expect(config()).not.toHaveProperty(key);
  });

  it("names no real address: the repository is public and the games domain is the Owner's", () => {
    // The schema's own line is the one place a web address may sit.
    const withoutSchema = read(CONFIG).replace(/^.*\$schema.*$/m, "");
    expect(withoutSchema).not.toContain("https://");
    expect(withoutSchema).not.toMatch(/[a-z0-9-]+\.(com|net|org|io|dev|gg|games)\b/);
  });
});

describe("the gate's worker.ts", () => {
  // play.ts, the feature's entry, brings the database with it, and this Worker has none.
  it("imports the gate and the R2 store directly, and nothing else", () => {
    const source = read("cloudflare/games/worker.ts");
    const imports = [...source.matchAll(/^import .* from "(.*)";$/gm)].map((match) => match[1]);
    expect(imports.sort()).toEqual(["../../src/features/play/gate.ts", "../../src/lib/files/r2-store.ts"]);
  });
});
