// The picker that says which screens a change reaches (tests/browser/support/changed-screens.ts), and the choice
// `showTheOwner` makes from its answer. The output trees below have the shapes of a real `.svelte-kit/output/` (seen
// on real builds): hashed client names, hash-only shared chunks, nodes naming their client and server files, manifests
// importing every node, and the two per-build stamps. Each name's hash comes from the file's content, as Vite's does.
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { pickChangedScreens, shouldShoot, type Answer } from "../tests/browser/support/changed-screens.ts";

const made: string[] = [];
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

const hash = (text: string) => createHash("sha1").update(text).digest("base64url").slice(0, 8);

type App = {
  heading: string;
  /** The text of the shared client chunk (a component two pages use; its name is its hash alone). */
  shared: string;
  css: string;
  font: string;
  pageServer: string;
  /** Server code that the forgot-password page's server file imports. */
  serverShared: string;
  /** Who else imports the shared server file: nothing, the endpoint, the hooks. */
  serverSharedAlso: "nobody" | "endpoint" | "hooks" | "no one at all";
  /** The route table in the manifests. */
  routes: string;
  version: string;
  id: string;
};

const BASE: App = {
  heading: "Forgot your password?",
  shared: "export const Points = () => 1;",
  css: "body { color: black }",
  font: "font-bytes",
  pageServer: "export const load = () => 1;",
  serverShared: "export const helper = 1;",
  serverSharedAlso: "nobody",
  routes: "forgot-password,sign-in",
  version: "1795254870139",
  id: "1c2jc9k",
};

/** Writes the output tree of a build of this app and returns its directory. */
function build(app: App): string {
  const out = mkdtempSync(join(tmpdir(), "screens-"));
  made.push(out);
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), text);
  };

  const sharedName = hash(app.shared);
  const cssName = `0.${hash(app.css)}.css`;
  const node0Client = `css=${cssName};`;
  const node0Name = `0.${hash(node0Client)}.js`;
  // Pages 5 (forgot password) and 7 (a page that shares the chunk) import the shared chunk; 6 is on its own.
  const node5Client = `import "../chunks/${sharedName}.js";heading=${app.heading}`;
  const node5Name = `5.${hash(node5Client)}.js`;
  const node6Client = "heading=Sign in";
  const node6Name = `6.${hash(node6Client)}.js`;
  const node7Client = `import "../chunks/${sharedName}.js";heading=Points`;
  const node7Name = `7.${hash(node7Client)}.js`;
  const fontName = "fonts/young-serif.woff2";
  const appEntry = `nodes=${[node0Name, node5Name, node6Name, node7Name].join(",")};routes=${app.routes}`;
  const appName = `app.${hash(appEntry)}.js`;

  put(`client/_app/immutable/chunks/${sharedName}.js`, app.shared);
  put(`client/_app/immutable/assets/${cssName}`, app.css);
  put(`client/_app/immutable/nodes/${node0Name}`, node0Client);
  put(`client/_app/immutable/nodes/${node5Name}`, node5Client);
  put(`client/_app/immutable/nodes/${node6Name}`, node6Client);
  put(`client/_app/immutable/nodes/${node7Name}`, node7Client);
  put(`client/_app/immutable/entry/${appName}`, appEntry);
  put(`client/_app/immutable/entry/start.DiiA6qVu.js`, "start");
  put(`client${"/" + fontName}`, app.font);
  put("client/_app/version.json", `{"version":"${app.version}"}`);
  put(`client/_app/immutable/nodes/${node5Name}.map`, `{"sourcesContent":["${app.heading}"]}`);
  put(
    "client/.vite/manifest.json",
    JSON.stringify({
      "app.js": { file: `_app/immutable/entry/${appName}`, isEntry: true },
      "start.js": { file: "_app/immutable/entry/start.DiiA6qVu.js", isEntry: true },
      "_shared.js": { file: `_app/immutable/chunks/${sharedName}.js` },
      "n0.js": { file: `_app/immutable/nodes/${node0Name}`, css: [`_app/immutable/assets/${cssName}`] },
      "n5.js": { file: `_app/immutable/nodes/${node5Name}`, imports: ["_shared.js"] },
      "n6.js": { file: `_app/immutable/nodes/${node6Name}` },
      "n7.js": { file: `_app/immutable/nodes/${node7Name}`, imports: ["_shared.js"] },
    }),
  );
  put("server/.vite/manifest.json", JSON.stringify({ mirrors: appName }));
  put(`server/_app/immutable/assets/${cssName}`, app.css);

  const nodeFile = (n: number, imports: string[], serverId: string, server?: string) =>
    [
      server === undefined
        ? ""
        : `import * as server from '../entries/pages/${server}/_page.server.ts.js';\n`,
      `export const index = ${String(n)};`,
      `let component_cache;`,
      `export const component = async () => (await import('../entries/pages/${serverId}/_page.svelte.js')).default;`,
      `export const server_id = "src/routes/${serverId}/+page.server.ts";`,
      `export const imports = ${JSON.stringify(imports)};`,
      `export const stylesheets = ${JSON.stringify(n === 0 ? [`_app/immutable/assets/${cssName}`] : [])};`,
      `export const fonts = ${JSON.stringify(n === 0 ? [fontName] : [])};`,
    ].join("\n");
  put("server/nodes/0.js", nodeFile(0, [`_app/immutable/nodes/${node0Name}`], "layout"));
  put(
    "server/nodes/5.js",
    nodeFile(
      5,
      [`_app/immutable/nodes/${node5Name}`, `_app/immutable/chunks/${sharedName}.js`],
      "forgot-password",
      "forgot-password",
    ),
  );
  put("server/nodes/6.js", nodeFile(6, [`_app/immutable/nodes/${node6Name}`], "sign-in"));
  put(
    "server/nodes/7.js",
    nodeFile(7, [`_app/immutable/nodes/${node7Name}`, `_app/immutable/chunks/${sharedName}.js`], "points"),
  );
  for (const page of ["layout", "sign-in", "points"]) {
    put(`server/entries/pages/${page}/_page.svelte.js`, `export default "${page}";`);
  }
  put("server/entries/pages/forgot-password/_page.svelte.js", `export default "${app.heading}";`);
  const importsShared = (also: string) =>
    app.serverSharedAlso === also ? `import { helper } from "../../../chunks/server-shared.js";\n` : "";
  put(
    "server/entries/pages/forgot-password/_page.server.ts.js",
    `${app.serverSharedAlso === "no one at all" ? "" : 'import { helper } from "../../../chunks/server-shared.js";\n'}${app.pageServer}`,
  );
  put("server/chunks/server-shared.js", app.serverShared);
  put(
    "server/entries/endpoints/api/_server.ts.js",
    `${importsShared("endpoint")}export const GET = () => 1;`,
  );
  put("server/entries/hooks.server.js", `${importsShared("hooks")}export const handle = () => 1;`);
  put("server/entries/params.js", "export const matchers = {};");
  put(
    `server/chunks/instance.js`,
    `const global = "__sveltekit_${app.id}"; const second = "__sveltekit_${app.id}";`,
  );
  put("server/chunks/internal.js", `response.headers.set("x-sveltekit-version", "${app.version}");`);
  put(
    "server/index.js",
    `import "./chunks/instance.js";\nimport "./chunks/internal.js";\nexport const Server = 1;`,
  );
  const manifest = `routes: "${app.routes}",
  app: "_app/immutable/entry/${appName}",
  imports: ["_app/immutable/chunks/${sharedName}.js", "_app/immutable/nodes/${node5Name}"],
  nodes: [
    () => import('./nodes/0.js'),
    () => import('./nodes/5.js'),
    () => import('./nodes/6.js'),
    () => import('./nodes/7.js')
  ],`;
  put("server/manifest.js", manifest);
  put("server/manifest-full.js", manifest);
  put("server/remote-entry.js", "export const remote = 1;");
  put("server/env.js", "export const env = 1;");
  return out;
}

const pick = (change: Partial<App>, paths: string[] = []) => {
  const dir = mkdtempSync(join(tmpdir(), "paths-"));
  made.push(dir);
  const file = join(dir, "changed-paths.txt");
  writeFileSync(file, paths.join("\n"));
  return pickChangedScreens(build({ ...BASE, ...change }), build(BASE), file);
};

const nodesOf = (answer: Answer) => (answer.all ? [] : answer.nodes.map((node) => node.index));

describe("the picker", () => {
  test("two builds that differ only in the two stamps change nothing", () => {
    const answer = pick({ version: "1795254881805", id: "b7670w" });
    expect(answer.all).toBe(false);
    expect(nodesOf(answer)).toEqual([]);
  });

  test("a one-page change names that node only, though the manifests and the app entry carry its new name", () => {
    const answer = pick({ heading: "Forgot your password??" });
    expect(answer.all).toBe(false);
    expect(nodesOf(answer)).toEqual([5]);
  });

  test("a changed map next to a changed node file names that node only", () => {
    const answer = pick({ heading: "Another heading" });
    expect(nodesOf(answer)).toEqual([5]);
  });

  test("a change inside a shared chunk named by its hash alone gives its real address and every node that lists it", () => {
    const answer = pick({ shared: "export const Points = () => 2;" });
    if (answer.all) throw new Error(`answered all: ${answer.reason}`);
    expect(nodesOf(answer)).toEqual([5, 7]);
    const sharedName = `${hash("export const Points = () => 2;")}.js`;
    expect(answer.changedClient).toContain(`/_app/immutable/chunks/${sharedName}`);
  });

  test("an 8-letter real name such as instance.js is not taken for a hash", () => {
    // Were `instance.js` read as a hash, a real change to its text (beyond the stamp) would be blanked away with it.
    const dir = mkdtempSync(join(tmpdir(), "paths-"));
    made.push(dir);
    writeFileSync(join(dir, "p.txt"), "");
    const change = build({ ...BASE, version: "1795254881805", id: "b7670w" });
    appendFileSync(join(change, "server/chunks/instance.js"), "\nexport const more = 1;");
    const answer = pickChangedScreens(change, build(BASE), join(dir, "p.txt"));
    expect(answer.all).toBe(true);
    expect(answer.all && answer.reason).toContain("instance.js");
  });

  test("a page's server file, reached by the manifests only through its node, changes that node only", () => {
    expect(nodesOf(pick({ pageServer: "export const load = () => 2;" }))).toEqual([5]);
  });

  test("a stylesheet change marks the nodes that list it and does not answer all", () => {
    const answer = pick({ css: "body { color: red }" });
    if (answer.all) throw new Error(`answered all: ${answer.reason}`);
    expect(nodesOf(answer)).toEqual([0]);
    expect(answer.changedClient.some((address) => address.endsWith(".css"))).toBe(true);
  });

  test("server code shared by a page and an endpoint answers all, naming the endpoint", () => {
    const answer = pick({ serverShared: "export const helper = 2;", serverSharedAlso: "endpoint" });
    expect(answer.all).toBe(true);
    expect(answer.all && answer.reason).toContain("endpoints/api/_server.ts.js");
  });

  test("server code reached by the hooks answers all", () => {
    const answer = pick({ serverShared: "export const helper = 2;", serverSharedAlso: "hooks" });
    expect(answer.all).toBe(true);
    expect(answer.all && answer.reason).toContain("hooks.server.js");
  });

  test("a changed server file that nothing reaches answers all", () => {
    const answer = pick({ serverSharedAlso: "no one at all", serverShared: "export const helper = 2;" });
    expect(answer.all).toBe(true);
    expect(answer.all && answer.reason).toContain("reached by nothing");
  });

  test("a changed font gives its client address, and the nodes that list it", () => {
    const answer = pick({ font: "other-font-bytes" });
    if (answer.all) throw new Error(`answered all: ${answer.reason}`);
    expect(answer.changedClient).toEqual(["/fonts/young-serif.woff2"]);
    expect(nodesOf(answer)).toEqual([0]);
  });

  test("a new route (the manifests' route table changes) answers all, naming the manifest", () => {
    const answer = pick({ routes: "forgot-password,sign-in,new-page" });
    expect(answer.all).toBe(true);
    expect(answer.all && answer.reason).toContain("manifest");
  });

  test("a root file expected but missing from both builds is nothing to follow", () => {
    // params.js is written only while the app has a route matcher (N16): both builds here lack it.
    const dir = mkdtempSync(join(tmpdir(), "paths-"));
    made.push(dir);
    writeFileSync(join(dir, "p.txt"), "");
    const change = build(BASE);
    const base = build(BASE);
    for (const tree of [change, base]) rmSync(join(tree, "server/entries/params.js"));
    expect(pickChangedScreens(change, base, join(dir, "p.txt")).all).toBe(false);
  });

  test("a root file present in only one build counts as changed", () => {
    const dir = mkdtempSync(join(tmpdir(), "paths-"));
    made.push(dir);
    writeFileSync(join(dir, "p.txt"), "");
    const change = build(BASE);
    const base = build(BASE);
    rmSync(join(base, "server/entries/params.js"));
    const answer = pickChangedScreens(change, base, join(dir, "p.txt"));
    expect(answer.all).toBe(true);
    expect(answer.all && answer.reason).toContain("params.js");
  });

  test("an output tree that cannot be read answers all", () => {
    const answer = pickChangedScreens("/nowhere/at/all", "/nowhere/else", "/nowhere/paths.txt");
    expect(answer.all).toBe(true);
  });

  test("two base client files with equal normalised text are named in the notes", () => {
    const base = build(BASE);
    // A second chunk with the same text under a different hash.
    writeFileSync(join(base, "client/_app/immutable/chunks/ZZZZZZZZ.js"), BASE.shared);
    const dir = mkdtempSync(join(tmpdir(), "paths-"));
    made.push(dir);
    writeFileSync(join(dir, "p.txt"), "");
    const answer = pickChangedScreens(build(BASE), base, join(dir, "p.txt"));
    expect(answer.notes.join("\n")).toContain("same text");
  });

  test("it reports the changed journeys from the changed paths and lists every immutable file of the change", () => {
    const answer = pick({}, [
      "tests/browser/join.test.ts",
      "src/routes/x.svelte",
      "tests/browser/support/a.ts",
    ]);
    if (answer.all) throw new Error(`answered all: ${answer.reason}`);
    expect(answer.changedJourneys).toEqual(["tests/browser/join.test.ts"]);
    expect(answer.immutableFiles.length).toBeGreaterThan(5);
    expect(answer.immutableFiles.every((address) => address.startsWith("/_app/immutable/"))).toBe(true);
  });
});

describe("showTheOwner's choice", () => {
  const changeOne: Answer = {
    all: false,
    reason: "",
    nodes: [
      {
        index: 5,
        key: "src/routes/forgot-password/+page.server.ts",
        chunk: "/_app/immutable/nodes/5.AAAA.js",
      },
    ],
    changedClient: ["/_app/immutable/chunks/CCCC.js"],
    immutableFiles: [
      "/_app/immutable/nodes/5.AAAA.js",
      "/_app/immutable/nodes/6.BBBB.js",
      "/_app/immutable/chunks/CCCC.js",
      "/_app/immutable/chunks/DDDD.js",
    ],
    changedJourneys: ["tests/browser/join.test.ts"],
    notes: [],
  };
  const choose = (
    loaded: string[],
    answer: Answer | string | undefined,
    journey = "tests/browser/home.test.ts",
    entryCount = loaded.length,
  ) =>
    shouldShoot({
      loaded,
      entryCount,
      answer: typeof answer === "string" || answer === undefined ? answer : JSON.stringify(answer),
      journey,
    });

  test("shoots when the page loaded a changed node's chunk", () => {
    expect(choose(["/_app/immutable/nodes/5.AAAA.js"], changeOne).shoot).toBe(true);
  });

  test("shoots when the page loaded a changed client file", () => {
    expect(choose(["/_app/immutable/chunks/CCCC.js"], changeOne).shoot).toBe(true);
  });

  test("skips when the page loaded only unchanged files", () => {
    expect(
      choose(["/_app/immutable/nodes/6.BBBB.js", "/_app/immutable/chunks/DDDD.js", "/favicon.ico"], changeOne)
        .shoot,
    ).toBe(false);
  });

  test("shoots when a loaded /_app/immutable/ address is not in the change build's list", () => {
    const verdict = choose(["/_app/immutable/chunks/UNKNOWN.js"], changeOne);
    expect(verdict.shoot).toBe(true);
    expect(verdict.why).toContain("not in the change build");
  });

  test("shoots when the answer says all, and when it is missing, empty or unreadable", () => {
    expect(choose([], { all: true, reason: "x", notes: [] }).shoot).toBe(true);
    expect(choose([], undefined).shoot).toBe(true);
    expect(choose([], "").shoot).toBe(true);
    expect(choose([], "{not json").shoot).toBe(true);
  });

  test("shoots when the browser's raw list may be full (250 entries), though few addresses are different", () => {
    // join-done loads one address over and over: the raw list is full while the list without repeats has one.
    const verdict = choose(["/favicon.ico"], changeOne, undefined, 250);
    expect(verdict.shoot).toBe(true);
    expect(verdict.why).toContain("full");
    expect(choose(["/favicon.ico"], changeOne, undefined, 249).shoot).toBe(false);
  });

  test("shoots on its own changed journey, and only for that journey", () => {
    expect(choose([], changeOne, "tests/browser/join.test.ts").shoot).toBe(true);
    expect(choose([], changeOne, "tests/browser/home.test.ts").shoot).toBe(false);
  });
});
