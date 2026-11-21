// Says which screens a change reaches, so CI attaches a `look:` picture only for those (ci.yml, the `screens` job).
//
//   node tests/browser/support/changed-screens.ts <change build output> <base build output> <changed-paths file>
//
// Each argument is a SvelteKit `.svelte-kit/output/` folder (two builds, the change and its base) or, for the third, a
// file with one changed path per line. It prints the answer as one line of JSON on stdout (the log goes to stderr) and
// never fails: whatever goes wrong, it answers `all`, so a doubt shoots every screen, as a doubt never skips a test.
//
// It compares what the build makes, not the source: two builds of one commit differ only in two per-build stamps, so a
// file that differs after those are blanked is a file the change changed. `showTheOwner` (look.ts) then shoots a screen
// only when the page loaded one of them. The reasoning is in docs/superpowers/specs/2026-11-21-ci-shoots-changed-screens-design.md.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

export type ChangedNode = {
  index: number;
  /** The page's route key, for the log. */
  key: string;
  /** The address of the node's own client chunk, which every page made of the node loads. */
  chunk: string;
};

export type Answer =
  | { all: true; reason: string; notes: string[] }
  | {
      all: false;
      reason: string;
      nodes: ChangedNode[];
      /** Client files (real addresses in the change build) whose content is not in the base build. */
      changedClient: string[];
      /** Every `/_app/immutable/` file the change build made, to tell when a page loaded a file of some other build. */
      immutableFiles: string[];
      /** The `tests/browser/*.test.ts` files the change touches: their own pictures are shot. */
      changedJourneys: string[];
      notes: string[];
    };

/** How many entries the browser keeps of the files a page loaded before it silently drops new ones. */
export const RESOURCE_BUFFER_SIZE = 250;

const TEXT_FILE = /\.(js|mjs|json|css|html|txt)$/;

/** Files no page loads, and files that only mirror another file (the client copy carries the change). */
function isLeftOut(path: string): boolean {
  return (
    path.endsWith(".map") ||
    path.startsWith("client/.vite/") ||
    path.startsWith("server/.vite/") ||
    path.startsWith("server/_app/")
  );
}

function listFiles(dir: string, from = ""): string[] {
  return readdirSync(join(dir, from), { withFileTypes: true }).flatMap((entry) => {
    const path = from === "" ? entry.name : `${from}/${entry.name}`;
    return entry.isDirectory() ? listFiles(dir, path) : [path];
  });
}

/** What one build made: its files by path (the left-out ones removed), normalised and hashed. */
type Build = {
  /** Normalised content hash of every file that is not left out. */
  hashes: Map<string, string>;
  /** The text of the server files, to follow their imports. */
  serverText: Map<string, string>;
};

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The names the build itself hashed: every `file`, `css` and `assets` entry of its own client manifest. They are read
 * from the manifest, never guessed from a name's shape, which would also match real names such as `instance.js`.
 */
function hashedBasenames(dir: string): string[] {
  const manifestPath = join(dir, "client/.vite/manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`${manifestPath} is missing`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
    string,
    { file?: string; css?: string[]; assets?: string[] }
  >;
  const names = new Set<string>();
  for (const entry of Object.values(manifest)) {
    for (const file of [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]) {
      if (file !== undefined) names.add(posix.basename(file));
    }
  }
  return [...names];
}

/** `app.BOEBdELy.js` becomes `app.#.js`; a chunk named by its hash alone, `BaNbYf_w.js`, becomes `#.js`. */
function placeholderFor(basename: string): string {
  const parts = basename.split(".");
  const extension = parts.pop() ?? "";
  if (parts.length <= 1) return `#.${extension}`;
  return [...parts.slice(0, -1), "#", extension].join(".");
}

function readBuild(dir: string): Build {
  const names = hashedBasenames(dir).sort((a, b) => b.length - a.length);
  const nameMatcher = names.length === 0 ? null : new RegExp(names.map(escapeForRegex).join("|"), "g");
  const versionFile = join(dir, "client/_app/version.json");
  const version = existsSync(versionFile)
    ? (JSON.parse(readFileSync(versionFile, "utf8")) as { version?: string }).version
    : undefined;

  const hashes = new Map<string, string>();
  const serverText = new Map<string, string>();
  for (const path of listFiles(dir)) {
    if (isLeftOut(path)) continue;
    const content = readFileSync(join(dir, path));
    let normalised: Buffer | string = content;
    if (TEXT_FILE.test(path)) {
      let text = content.toString("utf8");
      if (nameMatcher !== null) text = text.replace(nameMatcher, placeholderFor);
      // The two per-build stamps: the version string and SvelteKit's `__sveltekit_<id>` global.
      if (version !== undefined && version !== "") text = text.split(version).join("<version>");
      text = text.replace(/__sveltekit_[a-z0-9]+/g, "__sveltekit_<id>");
      normalised = text;
      if (path.startsWith("server/")) serverText.set(path, content.toString("utf8"));
    }
    hashes.set(path, createHash("sha1").update(normalised).digest("hex"));
  }
  return { hashes, serverText };
}

/** The files a server file imports, statically or with `import(...)`, that exist in the build. */
function importsOf(path: string, text: string, known: Map<string, unknown>): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g)) {
    const specifier = match[1] ?? "";
    if (!specifier.startsWith(".")) continue;
    const target = posix.join(posix.dirname(path), specifier);
    if (known.has(target)) found.push(target);
  }
  return found;
}

const isNode = (path: string) => path.startsWith("server/nodes/");

/**
 * The server files `start` reaches, itself included. It stops at nodes: the manifests route to the nodes but do not
 * run the nodes' code, so a page's own server code is not a root's.
 */
function reachFrom(start: string, text: Map<string, string>): Set<string> {
  const reached = new Set<string>([start]);
  const queue = [start];
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    for (const next of importsOf(path, text.get(path) ?? "", text)) {
      if (reached.has(next) || isNode(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

const ROOT_FILES = new Set([
  "server/entries/hooks.server.js",
  "server/entries/params.js",
  "server/index.js",
  "server/manifest.js",
  "server/manifest-full.js",
  "server/remote-entry.js",
]);
const isRoot = (path: string) => ROOT_FILES.has(path) || path.startsWith("server/entries/endpoints/");

function arrayFromNode(text: string, name: "imports" | "stylesheets" | "fonts"): string[] {
  const match = new RegExp(`export const ${name} = (\\[[^\\]]*\\]);`).exec(text);
  return match === null ? [] : (JSON.parse(match[1] ?? "[]") as string[]);
}

function answerAll(reason: string, notes: string[] = []): Answer {
  return { all: true, reason, notes };
}

/** Compares two builds. Throws only for an output that cannot be read; `pickChangedScreens` turns that into `all`. */
function compare(changeDir: string, baseDir: string, changedPaths: string): Answer {
  const change = readBuild(changeDir);
  const base = readBuild(baseDir);
  const notes: string[] = [];

  // Client files are compared by content, because shared chunks are named by their hash alone.
  const baseClient = new Map<string, string[]>();
  for (const [path, hash] of base.hashes) {
    if (path.startsWith("client/")) baseClient.set(hash, [...(baseClient.get(hash) ?? []), path]);
  }
  for (const [hash, paths] of baseClient) {
    if (paths.length > 1) {
      notes.push(
        `base client files with the same text, so a match is not one to one (${hash.slice(0, 8)}): ${paths.join(", ")}`,
      );
    }
  }
  const addressOf = (path: string) => path.slice("client".length);
  const changedClient: string[] = [];
  const immutableFiles: string[] = [];
  for (const [path, hash] of change.hashes) {
    if (!path.startsWith("client/")) continue;
    if (addressOf(path).startsWith("/_app/immutable/")) immutableFiles.push(addressOf(path));
    if (!baseClient.has(hash)) changedClient.push(addressOf(path));
  }
  const changedClientSet = new Set(changedClient);

  // Server files are compared by path; a file in only one build is changed.
  const changedServer = new Set<string>();
  const removedServer = new Set<string>();
  for (const [path, hash] of change.hashes) {
    if (path.startsWith("server/") && base.hashes.get(path) !== hash) changedServer.add(path);
  }
  for (const path of base.hashes.keys()) {
    if (path.startsWith("server/") && !change.hashes.has(path)) removedServer.add(path);
  }

  // Roots other than nodes: anything they reach that changed can change screens no node names.
  const roots = [...new Set([...change.hashes.keys(), ...base.hashes.keys()])].filter(isRoot);
  const reachedByARoot = new Set<string>();
  for (const root of roots) {
    if (changedServer.has(root) || removedServer.has(root)) {
      return answerAll(`${root} changed, and it can change any screen`, notes);
    }
    for (const file of reachFrom(root, change.serverText)) {
      reachedByARoot.add(file);
      if (changedServer.has(file)) {
        return answerAll(
          `${file} changed, and ${root} reaches it, so it can change screens no page names`,
          notes,
        );
      }
    }
  }

  const nodeFiles = [...change.serverText.keys()].filter(isNode).sort();
  const reachedByANode = new Set<string>();
  const nodes: ChangedNode[] = [];
  for (const nodeFile of nodeFiles) {
    const text = change.serverText.get(nodeFile) ?? "";
    const reach = reachFrom(nodeFile, change.serverText);
    for (const file of reach) reachedByANode.add(file);
    const clientFiles = [
      ...arrayFromNode(text, "imports"),
      ...arrayFromNode(text, "stylesheets"),
      ...arrayFromNode(text, "fonts"),
    ].map((file) => `/${file}`);
    const reaches = [...reach].some((file) => changedServer.has(file));
    if (!reaches && !clientFiles.some((file) => changedClientSet.has(file))) continue;
    const chunk = arrayFromNode(text, "imports").find((file) => file.startsWith("_app/immutable/nodes/"));
    const key =
      /export const server_id = "([^"]+)"/.exec(text)?.[1] ??
      /import\('\.\.\/(entries\/pages\/[^']+)'\)/.exec(text)?.[1] ??
      nodeFile;
    nodes.push({
      index: Number(/nodes\/(\d+)\.js$/.exec(nodeFile)?.[1]),
      key,
      chunk: chunk === undefined ? "" : `/${chunk}`,
    });
  }

  for (const file of changedServer) {
    if (!reachedByARoot.has(file) && !reachedByANode.has(file)) {
      return answerAll(
        `${file} changed and is reached by nothing, so nobody can say which screens it touches`,
        notes,
      );
    }
  }
  for (const file of removedServer) notes.push(`${file} is no longer in the build`);

  const journeys = readFileSync(changedPaths, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^tests\/browser\/[^/]+\.test\.ts$/.test(line));

  return {
    all: false,
    reason: nodes.length === 0 ? "no page changed" : `${String(nodes.length)} page part(s) changed`,
    nodes,
    changedClient: changedClient.sort(),
    immutableFiles: immutableFiles.sort(),
    changedJourneys: journeys,
    notes,
  };
}

export function pickChangedScreens(changeDir: string, baseDir: string, changedPaths: string): Answer {
  try {
    return compare(changeDir, baseDir, changedPaths);
  } catch (error) {
    return answerAll(
      `the builds could not be compared (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

/** The path of an address a page loaded, without its origin or query. */
function pathOf(address: string): string {
  try {
    return new URL(address, "http://same.origin").pathname;
  } catch {
    return address;
  }
}

/**
 * Whether `showTheOwner` takes a picture: a pure choice from the addresses the page loaded, the answer text
 * (`LOOK_CHANGED`) and the journey's own file, relative to the repository root. Any doubt shoots.
 */
export function shouldShoot(input: {
  loaded: string[];
  /** How many entries the browser holds in its raw list of loaded files, repeats and other origins included. */
  entryCount: number;
  answer: string | undefined;
  journey: string;
}): {
  shoot: boolean;
  why: string;
} {
  const text = input.answer?.trim() ?? "";
  if (text === "") return { shoot: true, why: "there is no answer to read" };
  let answer: Answer;
  try {
    answer = JSON.parse(text) as Answer;
  } catch {
    return { shoot: true, why: "the answer could not be read" };
  }
  // JSON.parse can give anything, whatever the type says.
  const shape: unknown = answer;
  if (typeof shape !== "object" || shape === null || typeof (shape as { all?: unknown }).all !== "boolean") {
    return { shoot: true, why: "the answer could not be read" };
  }
  if (answer.all) return { shoot: true, why: `every screen is shot: ${answer.reason}` };
  if (
    !Array.isArray(answer.nodes) ||
    !Array.isArray(answer.changedClient) ||
    !Array.isArray(answer.immutableFiles) ||
    !Array.isArray(answer.changedJourneys)
  ) {
    return { shoot: true, why: "the answer could not be read" };
  }
  if (answer.changedJourneys.includes(input.journey)) return { shoot: true, why: "this journey changed" };
  // The browser drops new entries silently once its raw list is full, so the raw count is what is compared.
  if (input.entryCount >= RESOURCE_BUFFER_SIZE) {
    return { shoot: true, why: "the browser's list of loaded files may be full" };
  }
  const loaded = input.loaded.map(pathOf);
  const known = new Set(answer.immutableFiles);
  const unknown = loaded.find((address) => address.startsWith("/_app/immutable/") && !known.has(address));
  if (unknown !== undefined)
    return { shoot: true, why: `${unknown} is not in the change build, so the builds did not match` };
  const changed = new Set([...answer.changedClient, ...answer.nodes.map((node) => node.chunk)]);
  const hit = loaded.find((address) => changed.has(address));
  if (hit !== undefined) return { shoot: true, why: `the page loaded ${hit}, which changed` };
  return { shoot: false, why: "the page loaded no changed file" };
}

if (process.argv[1]?.endsWith("changed-screens.ts")) {
  const [changeDir, baseDir, changedPaths] = process.argv.slice(2);
  const answer = pickChangedScreens(changeDir ?? "", baseDir ?? "", changedPaths ?? "");
  if (answer.all) {
    console.error(`Every screen is shot: ${answer.reason}`);
  } else {
    console.error(answer.reason);
    for (const node of answer.nodes) console.error(`  page part ${String(node.index)} (${node.key}) changed`);
    console.error(`  ${String(answer.changedClient.length)} client file(s) changed`);
  }
  for (const note of answer.notes) console.error(`Note: ${note}`);
  console.log(JSON.stringify(answer));
}
