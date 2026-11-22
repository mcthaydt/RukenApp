// Criterion A16: the package runs from where npm puts it. It is packed, installed in a folder outside the repo, and run.
// Also A12's cheap half: the words a person reads hold none of the words that need explaining.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PACKAGE = resolve(import.meta.dirname, "../../packages/ruken");

describe("the ruken package", () => {
  it("packs, installs outside the repo, and prints its help", { timeout: 120_000 }, () => {
    const work = mkdtempSync(join(tmpdir(), "ruken-pack-"));
    try {
      const out = join(work, "out");
      mkdirSync(out);
      const tarball = JSON.parse(
        execFileSync("npm", ["pack", "--json", "--pack-destination", out], {
          cwd: PACKAGE,
          encoding: "utf8",
        }),
      ) as { filename: string }[];
      const file = join(out, tarball[0]?.filename ?? "");

      const app = join(work, "app");
      mkdirSync(app);
      writeFileSync(
        join(app, "package.json"),
        JSON.stringify({ name: "a-maker", version: "1.0.0", private: true }),
      );
      execFileSync("npm", ["install", "--no-audit", "--no-fund", file], { cwd: app, encoding: "utf8" });

      const help = execFileSync("npx", ["--no-install", "ruken", "--help"], { cwd: app, encoding: "utf8" });
      expect(help).toContain("npx ruken sign-in");
      expect(help).toContain("npx ruken video <game> upright|wide <file>");
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });

  it("asks for node 22 or newer and nothing else", () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8")) as {
      engines: { node: string };
      dependencies?: unknown;
    };
    expect(manifest.engines.node).toBe(">=22");
    expect(manifest.dependencies).toBeUndefined();
  });

  it("says nothing in words that need explaining", () => {
    const files = readdirSync(join(PACKAGE, "words")).filter((name) => name !== "prefix.js");
    for (const name of files) {
      const text = readFileSync(join(PACKAGE, "words", name), "utf8")
        // Only what a person reads: the quoted words, not the code around them.
        .match(/(["`])(?:\\.|(?!\1).)*\1/g)
        ?.join(" ");
      expect(text ?? "", name).not.toMatch(/\b(slug|clip|submit|token|api|endpoint|auth)\b/i);
    }
  });
});
