// The layer rule (feature folders, and tests only in tests/):
// - tests never sit in src/;
// - a feature imports only from features below it, so features cannot form a cycle;
// - another feature reaches a feature only through its entry file, src/features/<feature>/<feature>.ts;
// - a feature's library/ data is read only by that feature;
// - src/lib/ holds shared helpers with no feature logic, so it imports no feature.
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

const sourceFiles = filesUnder(SRC);

/** A file whose code is sent to a visitor's browser: a screen's own script, a +page.ts that runs there too, or a route matcher. */
const isPageScript = (file: string): boolean =>
  file.endsWith(".svelte") || /\+page\.ts$/.test(file) || file.startsWith(join(SRC, "params") + sep);

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
        } else if (isPageScript(file)) {
          // A page's own script is downloaded by every visitor, so it reaches a feature only through its browser entry,
          // or, from a route, a screen the feature draws (a .svelte file, which imports no server code). A route matcher is built by
          // Node, which cannot load a .svelte file, so a matcher takes the browser entry alone.
          const isScreen = to.inside.endsWith(".svelte") && file.startsWith(join(SRC, "routes") + sep);
          if (to.inside !== `${to.feature}.browser.ts` && !isScreen)
            broken.push(`${where}: a page's script imports ${to.feature} through ${to.feature}.browser.ts`);
        } else if (to.inside.replace(/\.ts$/, "") !== to.feature) {
          broken.push(`${where}: import ${to.feature} through ${to.feature}.ts`);
        }
      }
    }

    expect(broken).toEqual([]);
  });
});

describe("what a browser entry may reach", () => {
  // `<feature>.browser.ts` is what a page's own script may import from a feature. Nothing it reaches may carry the
  // database, a Node module or server code into the visitor's download.
  const entries = sourceFiles.filter((file) => /features\/[^/]+\/[^/]+\.browser\.ts$/.test(file));

  /** Every file a browser entry reaches by relative imports, itself included. */
  function reachedFrom(entry: string): string[] {
    const seen = new Set<string>();
    const queue = [entry];
    for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
      if (seen.has(file)) continue;
      seen.add(file);
      for (const target of importsOf(file)) {
        const path = resolveImport(file, target);
        if (path !== null && path.endsWith(".ts")) queue.push(path);
      }
    }
    return [...seen];
  }

  test("a browser entry reaches no server code, no Node module and no generated database client", () => {
    const broken: string[] = [];
    for (const entry of entries) {
      for (const file of reachedFrom(entry)) {
        for (const target of importsOf(file)) {
          const path = resolveImport(file, target);
          const where = `${relative(ROOT, file)} imports "${target}"`;
          if (target.startsWith("node:")) broken.push(`${where}: a Node module`);
          if (path === null) continue;
          if (path.startsWith(join(LIB, "server"))) broken.push(`${where}: src/lib/server/`);
          if (path.includes(`${sep}generated${sep}`)) broken.push(`${where}: the generated database client`);
          const inFeature = featureOf(path);
          if (inFeature !== null && inFeature.inside.replace(/\.ts$/, "") === inFeature.feature)
            broken.push(`${where}: a feature's server entry`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
