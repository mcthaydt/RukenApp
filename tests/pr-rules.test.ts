// pr-rules (docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md, 3.1 and criteria 1 to 7):
// the check GitHub runs on every pull request event. The real script runs against a stub GitHub API on a
// local port, and a real git fixture for the clean-merge rule, so nothing touches the network.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const HOOKS = join(ROOT, ".claude", "hooks");
const SCRIPT = join(HOOKS, "pr-rules.mjs");
const REPO = "mcthaydt/RukenApp";
// The open limit as configured (rules.json, prFlow.maxOpenPrs), so these tests follow a change to it.
const MAX = (
  JSON.parse(readFileSync(join(HOOKS, "rules.json"), "utf8")) as { prFlow: { maxOpenPrs: number } }
).prFlow.maxOpenPrs;
const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const named = (n: number) =>
  upTo(n)
    .map((i) => `#${i}`)
    .join(", ");
const OK_BODY =
  "## Lane\nLane 1: docs only.\n\n## Acceptance criteria\n- it reads well\n\nRequested by **McThayDT**";

type Item = Record<string, unknown>;
type Pr = {
  number: number;
  state: string;
  draft: boolean;
  body: string;
  created_at: string;
  changed_files: number;
  head: { sha: string; repo: { full_name: string } | null };
};
type Calls = { status: Item[]; comments: Item[]; patches: Item[] };
type World = {
  prs: Pr[]; // what GET pulls/<n> and the open list answer from
  files: Record<number, string[]>;
  comments: Record<number, Item[]>;
  reviews: Record<number, Item[]>;
  fail: Set<string>; // path fragments that answer 500
};

let world: World;
let calls: Calls;
let server: Server;
let base = "";
let scratch = "";

const sha = (n: number) => n.toString(16).padStart(40, "0");
const own = { full_name: REPO };
const mk = (number: number, over: Partial<Pr> = {}): Pr => ({
  number,
  state: "open",
  draft: false,
  body: OK_BODY,
  created_at: "2026-11-21T10:" + String(number % 60).padStart(2, "0") + ":00Z",
  changed_files: 1,
  head: { sha: sha(number), repo: own },
  ...over,
});
// A pull request that is in the world with its files.
const add = (number: number, files: string[], over: Partial<Pr> = {}) => {
  const p = mk(number, { changed_files: files.length, ...over });
  world.prs.push(p);
  world.files[number] = files;
  return p;
};

const page = (all: unknown[], q: URLSearchParams) => {
  const per = Number(q.get("per_page") ?? 30);
  const n = Number(q.get("page") ?? 1);
  return all.slice((n - 1) * per, n * per);
};

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), "pr-rules-"));
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const path = url.pathname.replace(/^\//, "");
    const send = (code: number, v: unknown) => {
      res.statusCode = code;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(v));
    };
    let raw = "";
    req.on("data", (c: Buffer) => (raw += c.toString()));
    req.on("end", () => {
      const json = (raw ? JSON.parse(raw) : {}) as Item;
      if ([...world.fail].some((f) => path.includes(f))) {
        send(500, { message: "boom" });
        return;
      }
      const pre = `repos/${REPO}/`;
      if (req.method === "POST" && path.startsWith(`${pre}statuses/`)) {
        calls.status.push({ sha: path.slice(`${pre}statuses/`.length), ...json });
        send(201, {});
        return;
      }
      if (req.method === "POST" && /\/issues\/\d+\/comments$/.test(path)) {
        calls.comments.push(json);
        send(201, {});
        return;
      }
      if (req.method === "PATCH" && /\/pulls\/\d+$/.test(path)) {
        calls.patches.push({ number: Number(path.split("/").at(-1)), ...json });
        send(200, {});
        return;
      }
      if (req.method !== "GET") {
        send(405, {});
        return;
      }
      if (path === `${pre}pulls`) {
        const open = world.prs.filter((p) => p.state === "open");
        send(200, page(open, url.searchParams));
        return;
      }
      const m = /^repos\/[^/]+\/[^/]+\/(pulls|issues)\/(\d+)(?:\/(files|comments|reviews))?$/.exec(path);
      if (!m) {
        send(404, { message: "no route " + path });
        return;
      }
      const n = Number(m[2]);
      const pr = world.prs.find((p) => p.number === n);
      if (m[3] === undefined) {
        if (pr && m[1] === "pulls") send(200, pr);
        else send(404, { message: "Not Found" });
        return;
      }
      if (m[3] === "files") {
        send(
          200,
          page(
            (world.files[n] ?? []).map((f) => ({ filename: f })),
            url.searchParams,
          ),
        );
        return;
      }
      if (m[3] === "comments") {
        send(200, page(world.comments[n] ?? [], url.searchParams));
        return;
      }
      send(200, page(world.reviews[n] ?? [], url.searchParams));
    });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  base = "http://127.0.0.1:" + String((server.address() as AddressInfo).port);
});
afterAll(async () => {
  await new Promise((ok) => server.close(ok));
  rmSync(scratch, { recursive: true, force: true });
});
beforeEach(() => {
  world = { prs: [], files: {}, comments: {}, reviews: {}, fail: new Set() };
  calls = { status: [], comments: [], patches: [] };
});

type Run = { code: number | null; out: string; status: Item | undefined };
async function judge(
  n: number,
  action = "opened",
  opts: { event?: string; cwd?: string } = {},
): Promise<Run> {
  const eventFile = join(scratch, `event-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(eventFile, JSON.stringify({ action }));
  const child = spawn(process.execPath, [SCRIPT], {
    cwd: opts.cwd ?? ROOT,
    env: {
      ...process.env,
      PR_NUMBER: String(n),
      GH_TOKEN: "t",
      GITHUB_REPOSITORY: REPO,
      GITHUB_API_URL: base,
      GITHUB_EVENT_PATH: eventFile,
      GITHUB_EVENT_NAME: opts.event ?? "pull_request_target",
    },
  });
  let out = "";
  child.stdout.on("data", (c: Buffer) => (out += c.toString()));
  child.stderr.on("data", (c: Buffer) => (out += c.toString()));
  const code = await new Promise<number | null>((ok) => child.on("close", ok));
  return { code, out, status: calls.status.at(-1) };
}
const passes = (r: Run) => {
  expect(r.out).not.toContain("::error::");
  expect(r.code).toBe(0);
  expect(r.status?.state).toBe("success");
};
const fails = (r: Run, text: string) => {
  expect(r.code).toBe(1);
  expect(r.status?.state).toBe("failure");
  expect(r.out).toContain(text);
};

describe("the open limit (criteria 1 and 2)", () => {
  const OVER = MAX + 1;
  test("with the limit open, one more opened pull request fails and is closed with a comment naming them", async () => {
    for (const n of upTo(MAX)) add(n, ["docs/a.md"]);
    add(OVER, ["src/features/x/a.ts"]);
    const r = await judge(OVER, "opened");
    fails(r, `${MAX} pull requests are already open (${named(MAX)})`);
    expect(calls.patches).toEqual([{ number: OVER, state: "closed" }]);
    expect(String(calls.comments[0]?.body)).toBe(
      `Closed: ${MAX} pull requests are already open (${named(MAX)}). Reopen this when one merges or closes.`,
    );
  });
  test("its reopened event does the same", async () => {
    for (const n of upTo(MAX)) add(n, ["docs/a.md"]);
    add(OVER, ["docs/b.md"]);
    fails(await judge(OVER, "reopened"), `${MAX} pull requests are already open`);
    expect(calls.patches).toEqual([{ number: OVER, state: "closed" }]);
  });
  test("with one under the limit open, the last place passes this rule", async () => {
    for (const n of upTo(MAX)) add(n, ["docs/a.md"]);
    passes(await judge(MAX, "opened"));
    expect(calls.patches).toEqual([]);
  });
  test("a docs-only one over the limit is treated the same", async () => {
    for (const n of upTo(OVER)) add(n, ["docs/a.md"]);
    fails(await judge(OVER, "opened"), "over the limit");
    expect(calls.patches).toHaveLength(1);
  });
  test("forks are not counted and not closed", async () => {
    for (const n of upTo(MAX)) add(n, ["docs/a.md"]);
    for (const n of [101, 102])
      add(n, ["docs/a.md"], { head: { sha: sha(n), repo: { full_name: "someone/RukenApp" } } });
    add(OVER, ["docs/b.md"]);
    fails(await judge(OVER, "opened"), "over the limit");
    expect(calls.patches).toEqual([{ number: OVER, state: "closed" }]);
    // a fork's own pull request: neither counted nor closed
    calls.patches = [];
    calls.comments = [];
    passes(await judge(101, "opened"));
    expect(calls.patches).toEqual([]);
  });
  test("with one under the limit of ours plus 3 from forks, the last of ours passes; a deleted fork counts as a fork", async () => {
    for (const n of upTo(MAX - 1)) add(n, ["docs/a.md"]);
    for (const n of [101, 102])
      add(n, ["docs/a.md"], { head: { sha: sha(n), repo: { full_name: "someone/RukenApp" } } });
    add(103, ["docs/a.md"], { head: { sha: sha(103), repo: null } });
    add(MAX, ["docs/b.md"]);
    passes(await judge(MAX, "opened"));
  });
  test("with one over the limit open (one opened before the check), the newest fails, the oldest pass, nothing is closed", async () => {
    for (const n of upTo(OVER)) add(n, ["docs/a.md"]);
    for (const action of ["synchronize", "edited"]) {
      fails(await judge(OVER, action), "over the limit");
      for (const n of upTo(MAX)) passes(await judge(n, action));
    }
    expect(calls.patches).toEqual([]);
    expect(calls.comments).toEqual([]);
  });
  test("every page is read: 150 open, 148 from forks, 2 of ours", async () => {
    for (let n = 1; n <= 148; n++)
      add(1000 + n, ["docs/a.md"], { head: { sha: sha(n), repo: { full_name: "x/y" } } });
    add(1, ["docs/a.md"]);
    add(2, ["docs/a.md"]);
    passes(await judge(2, "opened"));
  });
  test("a pull request on the second page is still counted: 100 forks first, then one over the limit of ours", async () => {
    for (let n = 1; n <= 100; n++)
      add(1000 + n, ["docs/a.md"], { head: { sha: sha(n), repo: { full_name: "x/y" } } });
    for (const n of upTo(OVER)) add(n, ["docs/a.md"]);
    fails(await judge(OVER, "opened"), "over the limit");
  });
});

describe("lane, criteria and workflows (criteria 3, 4, 6b)", () => {
  test("a body with no lane fails; lane 3 passes where files are lane 3", async () => {
    add(1, ["docs/a.md"], { body: "## Acceptance criteria\n- x\n\nRequested by **McThayDT**" });
    fails(await judge(1), "names no lane");
    add(2, [".claude/hooks/rules.mjs"], { body: "## Lane\nLane 1\n\n## Acceptance criteria\n- x" });
    fails(await judge(2), "names lane 1 but its files are lane 3");
    add(3, [".claude/hooks/rules.mjs"], {
      body: "## Lane\nLane 3\n\n## Acceptance criteria\n- x",
      draft: true,
    });
    passes(await judge(3));
  });
  test("acceptance criteria are needed beyond docs, not for docs only", async () => {
    add(1, ["src/features/x/a.ts"], { body: "## Lane\nLane 1" });
    fails(await judge(1), "Acceptance criteria");
    add(2, ["docs/a.md"], { body: "## Lane\nLane 1" });
    passes(await judge(2));
  });
  test("a change to the hooks alone, with no criteria, fails (the docs list leaves out .claude)", async () => {
    add(1, [".claude/hooks/rules.mjs"], { body: "## Lane\nLane 3", draft: true });
    fails(await judge(1), "Acceptance criteria");
  });
  test("a workflow change fails with a lane 1 body and passes with lane 3", async () => {
    add(1, [".github/workflows/x.yml"], { body: "## Lane\nLane 1\n\n## Acceptance criteria\n- x" });
    const bad = await judge(1);
    fails(bad, "needs a body that names lane 3");
    add(2, [".github/workflows/x.yml"], {
      body: "## Lane\nLane 3\n\n## Acceptance criteria\n- x",
      draft: true,
    });
    passes(await judge(2));
  });
  test("the shared library is judged lane 3", async () => {
    add(1, [".claude/hooks/pr-rules-lib.mjs"], {
      body: "## Lane\nLane 1\n\n## Acceptance criteria\n- x",
      draft: true,
    });
    fails(await judge(1), "its files are lane 3");
  });
  test("the highest lane named anywhere in the body wins", async () => {
    add(1, ["docs/a.md"], { body: "## Lane\nLane 1\n\n## Why\nlane 3 would need the owner" });
    fails(await judge(1), "no passing review");
  });
  test("the criteria need an Acceptance criteria heading, not only the words", async () => {
    add(1, ["src/features/x/a.ts"], { body: "## Lane\nLane 1\n\nThe acceptance criteria are in my head." });
    fails(await judge(1), "Acceptance criteria");
    add(2, ["src/features/x/a.ts"], { body: "## Lane\nLane 1\n\n## Acceptance criteria\n- x" });
    passes(await judge(2));
  });
});

// ---------- the git fixture for clean merges ----------
const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=T", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args],
    {
      cwd,
      encoding: "utf8",
    },
  ).trim();
type Fixture = { ci: string; reviewed: string; mergeHead: string; plainHead: string };
let fx: Fixture;
beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "pr-rules-git-"));
  const origin = join(dir, "origin.git");
  const seed = join(dir, "seed");
  mkdirSync(seed);
  git(dir, "init", "-q", "--bare", "-b", "main", origin);
  git(seed, "init", "-q", "-b", "main");
  git(seed, "remote", "add", "origin", origin);
  writeFileSync(join(seed, "f.txt"), "a\n");
  git(seed, "add", ".");
  git(seed, "commit", "-q", "-m", "A");
  git(seed, "checkout", "-q", "-b", "pr");
  writeFileSync(join(seed, "r.txt"), "r\n");
  git(seed, "add", ".");
  git(seed, "commit", "-q", "-m", "R");
  const reviewed = git(seed, "rev-parse", "HEAD");
  // a plain commit after the reviewed one: not a merge of main
  git(seed, "checkout", "-q", "-b", "plain");
  writeFileSync(join(seed, "p.txt"), "p\n");
  git(seed, "add", ".");
  git(seed, "commit", "-q", "-m", "P");
  const plainHead = git(seed, "rev-parse", "HEAD");
  // main moves on; the pull request merges it cleanly
  git(seed, "checkout", "-q", "main");
  writeFileSync(join(seed, "m.txt"), "m\n");
  git(seed, "add", ".");
  git(seed, "commit", "-q", "-m", "M1");
  git(seed, "push", "-q", "origin", "main");
  git(seed, "checkout", "-q", "pr");
  git(seed, "merge", "-q", "--no-ff", "-m", "merge main", "main");
  const mergeHead = git(seed, "rev-parse", "HEAD");
  // The pull request's commits live only at refs/pull/<n>/head, as on GitHub.
  git(seed, "push", "-q", "origin", `${mergeHead}:refs/pull/7/head`, `${plainHead}:refs/pull/9/head`);
  const ci = join(dir, "ci");
  git(dir, "clone", "-q", "--no-local", "--branch", "main", origin, ci);
  fx = { ci, reviewed, mergeHead, plainHead };
});

describe("the draft rule and verdicts (criterion 5)", () => {
  const lane2 = "## Lane\nLane 2\n\n## Acceptance criteria\n- x";
  const verdict = (text: string, login = "mcthaydt", at = "2026-11-21T11:00:00Z") => ({
    body: text,
    user: { login },
    created_at: at,
  });
  const ready = (n: number, headSha = sha(n), over: Partial<Pr> = {}) =>
    add(n, ["src/lib/a.ts"], { body: lane2, head: { sha: headSha, repo: own }, ...over });
  const short = (s: string) => s.slice(0, 7);

  test("no verdict fails; a draft passes", async () => {
    ready(1);
    fails(await judge(1), "no passing review");
    ready(2, sha(2), { draft: true });
    passes(await judge(2));
  });
  test("a PASS naming the head passes; a FAIL as the latest verdict fails", async () => {
    ready(1);
    world.comments[1] = [verdict(`${short(sha(1))} PASS`)];
    passes(await judge(1));
    world.comments[1] = [
      verdict(`${short(sha(1))} PASS`),
      verdict(`${short(sha(1))} FAIL: 2 red`, "mcthaydt", "2026-11-21T12:00:00Z"),
    ];
    fails(await judge(1), "no passing review");
  });
  test("a review (not a comment) by the owner counts too", async () => {
    ready(1);
    world.reviews[1] = [
      { body: `${short(sha(1))} PASS`, user: { login: "mcthaydt" }, submitted_at: "2026-11-21T11:00:00Z" },
    ];
    passes(await judge(1));
  });
  test("only mcthaydt's verdicts count: an outsider's PASS does not pass and an outsider's FAIL does not fail", async () => {
    ready(1);
    world.comments[1] = [verdict(`${short(sha(1))} PASS`, "stranger")];
    fails(await judge(1), "no passing review");
    world.comments[1] = [
      verdict(`${short(sha(1))} PASS`),
      verdict(`${short(sha(1))} FAIL`, "stranger", "2026-11-21T12:00:00Z"),
    ];
    passes(await judge(1));
  });
  test("a PASS naming an older commit passes when every later commit is a clean merge of main (the script fetches the pull request's commits)", async () => {
    ready(7, fx.mergeHead);
    world.comments[7] = [verdict(`${short(fx.reviewed)} PASS`)];
    passes(await judge(7, "synchronize", { cwd: fx.ci }));
  });
  test("it fails when a later commit is not a clean merge of main", async () => {
    ready(9, fx.plainHead);
    world.comments[9] = [verdict(`${short(fx.reviewed)} PASS`)];
    fails(await judge(9, "synchronize", { cwd: fx.ci }), "no passing review");
  });
  test("a fetch that fails gives a failure status, never a success", async () => {
    ready(8, fx.mergeHead); // refs/pull/8/head does not exist in the fixture
    world.comments[8] = [verdict(`${short(fx.reviewed)} PASS`)];
    const r = await judge(8, "synchronize", { cwd: fx.ci });
    fails(r, "could not fetch refs/pull/8/head");
    expect(r.status?.state).toBe("failure");
  });
});

describe("reads that fail, events and the status (criteria 6a)", () => {
  test("a read that fails writes a failure status naming the head, never success", async () => {
    add(1, ["docs/a.md"]);
    world.fail.add("/pulls/1/files");
    const r = await judge(1);
    expect(r.code).toBe(1);
    expect(r.status).toMatchObject({ state: "failure", context: "pr-rules", sha: sha(1) });
    expect(String(r.status?.description)).toContain("could not finish reading");
  });
  test("the status names the head it read, on a comment event too", async () => {
    add(5, ["docs/a.md"]);
    const r = await judge(5, "created", { event: "issue_comment" });
    expect(r.status).toMatchObject({ sha: sha(5), state: "success", context: "pr-rules" });
    expect(calls.patches).toEqual([]);
  });
  test("a plain issue's number writes no status and closes nothing", async () => {
    add(5, ["docs/a.md"]);
    const r = await judge(44, "created", { event: "issue_comment" });
    expect(r.code).toBe(0);
    expect(calls.status).toEqual([]);
    expect(calls.patches).toEqual([]);
    expect(calls.comments).toEqual([]);
  });
  test("a closed pull request writes nothing", async () => {
    add(6, ["docs/a.md"], { state: "closed" });
    const r = await judge(6, "created", { event: "issue_comment" });
    expect(r.code).toBe(0);
    expect(calls.status).toEqual([]);
  });
});

describe("one library (criterion 7)", () => {
  const rules = readFileSync(join(HOOKS, "rules.mjs"), "utf8");
  const script = readFileSync(SCRIPT, "utf8");
  test("the hook and the script import their logic from pr-rules-lib.mjs", () => {
    for (const src of [rules, script]) {
      const names = /import \{([^}]*)\} from '\.\/pr-rules-lib\.mjs'/.exec(src)?.[1] ?? "";
      for (const name of ["laneOf", "hasCriteria", "onlyCleanMerges", "ownBranchPrs", "reviewPasses"])
        expect(names).toMatch(new RegExp(`\\b${name}\\b`));
    }
  });
  test("rules.mjs no longer defines them", () => {
    for (const name of ["laneOf", "verdicts", "onlyCleanMerges", "ownBranchPrs", "hasCriteria"])
      expect(rules).not.toMatch(new RegExp(`(const|function) ${name}\\b`));
  });
});
