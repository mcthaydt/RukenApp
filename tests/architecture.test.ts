// The layer rule (CLAUDE.md, "Feature folders, and tests only in tests/"):
// - tests never sit in src/;
// - a feature imports only from features below it, so features cannot form a cycle;
// - another feature reaches a feature only through its entry file, src/features/<feature>/<feature>.ts;
// - a feature's library/ data is read only by that feature;
// - src/lib/ holds shared helpers with no feature logic, so it imports no feature;
// - a page's own script reaches a feature only through its browser entry, src/features/<feature>/<feature>.browser.ts,
//   and nothing reachable from a browser entry is server code, so the database never ends up in a visitor's download.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, test } from "vitest";

/** The features, lowest first (design 7.1). A new feature is added here, in its place, before it is built. */
const FEATURE_ORDER = [
  "accounts",
  "membership",
  "games",
  "launch",
  "play",
  "money",
  "pages",
  "feed",
  "make",
  "moderation",
  "admin",
];

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const FEATURES = join(SRC, "features");
const LIB = join(SRC, "lib");

/** Every file under a folder, as absolute paths. */
function filesUnder(folder: string): string[] {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/** The import targets written in a source file: `from "x"`, `import "x"` and `import("x")`. */
function importsOf(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const pattern = /(?:from\s+|import\s*\(?\s*)["']([^"']+)["']/g;
  return [...text.matchAll(pattern)].map((match) => match[1] ?? "");
}

/** Where an import points on disk, or null for a package from node_modules. */
function resolveImport(fromFile: string, target: string): string | null {
  if (target.startsWith(".")) return resolve(dirname(fromFile), target);
  if (target === "$lib" || target.startsWith("$lib/")) return join(LIB, target.slice("$lib".length));
  return null;
}

/** The feature a path belongs to, and the rest of its path inside that feature, or null if outside features/. */
function featureOf(path: string): { feature: string; inside: string } | null {
  const fromFeatures = relative(FEATURES, path);
  if (fromFeatures.startsWith("..")) return null;
  const [feature = "", ...rest] = fromFeatures.split(sep);
  return { feature, inside: rest.join("/") };
}

/** A feature's entry: `<feature>.ts` for the server, `<feature>.browser.ts` for a page's own script. */
function isEntry(to: { feature: string; inside: string }): boolean {
  return to.inside === `${to.feature}.ts` || to.inside === `${to.feature}.browser.ts`;
}

/** The file an import names: the path as written, or with `.ts` added, as the bundler finds it. */
function fileOf(path: string): string | null {
  for (const candidate of [path, `${path}.ts`]) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

const sourceFiles = filesUnder(SRC);

describe("the layer rule", () => {
  test("no test sits in src/", () => {
    const testsInSrc = sourceFiles.filter((file) => /\.(test|spec)\.[jt]s$/.test(file));
    expect(testsInSrc.map((file) => relative(ROOT, file))).toEqual([]);
  });

  test("every feature folder is in the feature order", () => {
    const folders = readdirSync(FEATURES, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(folders.filter((name) => !FEATURE_ORDER.includes(name))).toEqual([]);
  });

  test("imports go down, through entry files, and library/ stays private", () => {
    const broken: string[] = [];

    for (const file of sourceFiles) {
      const from = featureOf(file);
      const fromLib = !relative(LIB, file).startsWith("..");

      for (const target of importsOf(file)) {
        const path = resolveImport(file, target);
        if (path === null) continue;
        const to = featureOf(path);
        if (to === null) continue;
        const where = `${relative(ROOT, file)} imports "${target}"`;

        if (fromLib) {
          broken.push(`${where}: src/lib/ may not import a feature`);
          continue;
        }
        if (from !== null && from.feature === to.feature) continue;

        if (from !== null && FEATURE_ORDER.indexOf(to.feature) >= FEATURE_ORDER.indexOf(from.feature)) {
          broken.push(`${where}: ${from.feature} may only import features below it`);
        }
        if (to.inside.startsWith("library/")) {
          broken.push(`${where}: ${to.feature}'s library/ is read only by ${to.feature}`);
        } else if (!isEntry(to)) {
          broken.push(`${where}: import ${to.feature} through ${to.feature}.ts`);
        }
      }
    }

    expect(broken).toEqual([]);
  });
});

describe("a page's own script and the browser entries", () => {
  const ROUTES = join(SRC, "routes");

  // A `.svelte` file, a `.svelte.ts` helper and a `+page.ts` or `+layout.ts` run in the visitor's browser too, so they
  // may only reach a feature through its browser entry. A `+page.server.ts`, a `+server.ts` and the hooks run only on
  // the server and keep using `<feature>.ts`.
  test("code that runs in the browser reaches a feature only through its .browser.ts entry", () => {
    const inBrowser = sourceFiles.filter(
      (file) =>
        !relative(ROUTES, file).startsWith("..") &&
        (/\.svelte(\.ts)?$/.test(file) || /[/\\]\+(page|layout)\.ts$/.test(file)),
    );
    const broken: string[] = [];
    for (const file of inBrowser) {
      for (const target of importsOf(file)) {
        const path = resolveImport(file, target);
        const to = path === null ? null : featureOf(path);
        if (to !== null && to.inside !== `${to.feature}.browser.ts`) {
          broken.push(`${relative(ROOT, file)} imports "${target}": use ${to.feature}.browser.ts`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  // Followed file by file from each browser entry: nothing on the way may be the server's (src/lib/server/), Node's
  // own modules, a feature's server entry or the generated database client.
  test("nothing reachable from a browser entry is server code", () => {
    const entries = sourceFiles.filter((file) => {
      const at = featureOf(file);
      return at !== null && at.inside === `${at.feature}.browser.ts`;
    });
    expect(entries.length).toBeGreaterThan(0);
    const broken: string[] = [];
    for (const entry of entries) {
      const seen = new Set<string>();
      const waiting = [entry];
      while (waiting.length > 0) {
        const file = waiting.pop() ?? "";
        if (seen.has(file)) continue;
        seen.add(file);
        for (const target of importsOf(file)) {
          const where = `${relative(ROOT, entry)} reaches ${relative(ROOT, file)}, which imports "${target}"`;
          if (target.startsWith("node:")) broken.push(`${where}: a Node module`);
          if (/prisma/i.test(target)) broken.push(`${where}: the database client`);
          const path = resolveImport(file, target);
          if (path === null) continue;
          const found = fileOf(path);
          if (found === null) continue;
          if (!relative(join(LIB, "server"), found).startsWith("..")) broken.push(`${where}: server code`);
          const to = featureOf(found);
          if (to !== null && to.inside === `${to.feature}.ts`)
            broken.push(`${where}: a feature's server entry`);
          waiting.push(found);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
