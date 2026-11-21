// The merge permission rule (docs/superpowers/specs/2026-11-21-sessions-merge-reviewed-prs-design.md):
// the rule hook answers for the three GitHub tools the settings allow. It runs the real hook
// against a scratch copy of .claude/ with a stub `gh` on PATH, so nothing touches the network.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

type Rules = { prFlow: { requireReview?: boolean; enabled?: boolean; lanePaths: Record<string, string[]> } };
type Entry = { matcher: string; hooks: { onFailure?: string }[] };
type Settings = { permissions: { allow: string[] }; hooks: { PreToolUse: Entry[] } };

const ROOT = resolve(import.meta.dirname, "..");
const HEAD = "abc1234" + "0123456789abcdef0123456789abcdef0"; // 40 hex digits
const SHORT = "abc1234";
const APP = { owner: "mcthaydt", repo: "RukenApp", pullNumber: 999 };

type State = { body: string; files: string[] | null; comments: string[] };
type Answer = { status: number | null; deny: string | null; stderr: string };

// A stand-in for `gh api <path>` that serves pull request 999 from a state file.
const STUB = `#!/usr/bin/env node
const fs = require("node:fs");
const s = JSON.parse(fs.readFileSync(process.env.STUB_STATE, "utf8"));
const path = process.argv[3] || "";
const out = (v) => { process.stdout.write(JSON.stringify(v)); process.exit(0); };
const fail = (m) => { process.stderr.write(m); process.exit(1); };
if (/\\/contents\\//.test(path)) fail("gh: Not Found (HTTP 404)");
if (/\\/pulls\\/999\\/files/.test(path)) { if (s.files === null) fail("boom"); out(s.files.map((f) => ({ filename: f }))); }
if (/\\/pulls\\/999\\/reviews/.test(path)) out([]);
if (/\\/issues\\/999\\/comments/.test(path)) out(s.comments.map((b, i) => ({ body: b, user: { login: "mcthaydt" }, created_at: "2026-11-21T00:0" + i + ":00Z" })));
if (/\\/pulls\\/999$/.test(path)) out({ number: 999, body: s.body, head: { sha: process.env.STUB_HEAD, ref: "feature" }, changed_files: (s.files ?? []).length });
fail("stub: unknown path " + path);
`;

let scratch = "";
let stateFile = "";

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "rules-merge-"));
  cpSync(join(ROOT, ".claude", "hooks"), join(scratch, ".claude", "hooks"), { recursive: true });
  cpSync(join(ROOT, "CLAUDE.md"), join(scratch, "CLAUDE.md"));
  mkdirSync(join(scratch, "bin"));
  writeFileSync(join(scratch, "bin", "gh"), STUB);
  chmodSync(join(scratch, "bin", "gh"), 0o755);
  stateFile = join(scratch, "state.json");
});
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

const setState = (s: Partial<State>) => {
  writeFileSync(stateFile, JSON.stringify({ body: "Lane 1", files: ["docs/x.md"], comments: [], ...s }));
};

function hook(tool: string, input: unknown, raw?: string): Answer {
  const payload =
    raw ??
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: input, cwd: scratch });
  const r = spawnSync(process.execPath, [join(scratch, ".claude", "hooks", "rules.mjs")], {
    input: payload,
    encoding: "utf8",
    cwd: scratch,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: scratch,
      PATH: `${join(scratch, "bin")}:${process.env.PATH ?? ""}`,
      STUB_STATE: stateFile,
      STUB_HEAD: HEAD,
    },
  });
  let deny: string | null = null;
  try {
    const o = JSON.parse(r.stdout.trim().split("\n").at(-1) ?? "") as {
      hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
    };
    if (o.hookSpecificOutput?.permissionDecision === "deny")
      deny = o.hookSpecificOutput.permissionDecisionReason ?? "";
  } catch {
    /* no output means allow */
  }
  return { status: r.status, deny, stderr: r.stderr };
}
const call = (tool: string, input: unknown) => hook(`mcp__github__${tool}`, input);
const merge = (extra: object = {}, repo = "RukenApp") =>
  call("merge_pull_request", { ...APP, repo, merge_method: "merge", expectedHeadSha: HEAD, ...extra });
const ready = (repo = "RukenApp") => call("update_pull_request", { ...APP, repo, draft: false });

const NO_REVIEW = "no passing review that names its head";
const OTHER_REPO = "covers mcthaydt/RukenApp only";

describe("only this repo (3.2) and no base changes (3.3)", () => {
  test("merge, disable auto-merge and ready on another repo are denied before any read", () => {
    setState({});
    expect(merge({}, "RukenPrivate").deny).toContain(OTHER_REPO);
    expect(call("disable_pr_auto_merge", { ...APP, repo: "RukenPrivate" }).deny).toContain(OTHER_REPO);
    expect(ready("RukenPrivate").deny).toContain(OTHER_REPO);
  });
  test("other updates on another repo are not denied by it (j)", () => {
    setState({});
    expect(call("update_pull_request", { ...APP, repo: "RukenPrivate", title: "New title" }).deny).toBeNull();
    expect(
      call("update_pull_request", { ...APP, repo: "RukenPrivate", body: "x\n\nRequested by **McThayDT**" })
        .deny,
    ).toBeNull();
  });
  test("disable auto-merge on this repo is allowed", () => {
    setState({});
    expect(call("disable_pr_auto_merge", APP).deny).toBeNull();
  });
  test("a squash merge is denied (b)", () => {
    setState({ body: "Lane 1" });
    expect(merge({ merge_method: "squash" }).deny).toContain("merge_method squash");
  });
  test("a base change is denied on this repo (c)", () => {
    setState({});
    expect(call("update_pull_request", { ...APP, base: "some-branch" }).deny).toContain(
      "base is changed by the owner",
    );
  });
});

describe("the lane comes from the files too (3.4, d)", () => {
  const cases: [string, string[] | null, boolean][] = [
    ["settings", [".claude/settings.json"], true],
    ["docs only", ["docs/x.md"], false],
    ["root CLAUDE.md", ["CLAUDE.md"], true],
    ["src/lib", ["src/lib/a.ts"], true],
    ["files read fails", null, true],
    ["this-repo skill", [".claude/skills/this-repo/SKILL.md"], false],
  ];
  for (const [name, files, denied] of cases) {
    test(`a lane 1 body with ${name}`, () => {
      setState({ body: "Lane 1", files });
      for (const a of [merge(), ready()]) {
        if (denied) expect(a.deny).toContain(NO_REVIEW);
        else expect(a.deny).toBeNull();
      }
    });
  }
});

describe("a review still holds (e)", () => {
  test("lane 3 needs a PASS on the head", () => {
    setState({ body: "Lane 3", files: ["docs/x.md"] });
    expect(merge().deny).toContain(NO_REVIEW);
    setState({ body: "Lane 3", files: ["docs/x.md"], comments: [`${SHORT} PASS`] });
    expect(merge().deny).toBeNull();
    expect(ready().deny).toBeNull();
  });
});

describe("a merge names the head it was checked on (3.6, i)", () => {
  test("missing or other expectedHeadSha is denied, the full head is not", () => {
    setState({ body: "Lane 3", files: ["docs/x.md"], comments: [`${SHORT} PASS`] });
    expect(merge({ expectedHeadSha: undefined }).deny).toContain("expectedHeadSha");
    expect(merge({ expectedHeadSha: "f".repeat(40) }).deny).toContain("expectedHeadSha");
    expect(merge({ expectedHeadSha: SHORT }).deny).toContain("expectedHeadSha");
    expect(merge().deny).toBeNull();
  });
  test("the pin holds on lane 1 and when review checks are switched off", () => {
    setState({ body: "Lane 1", files: ["docs/x.md"] });
    expect(merge({ expectedHeadSha: undefined }).deny).toContain("expectedHeadSha");
    const path = join(scratch, ".claude", "hooks", "rules.json");
    const original = readFileSync(path, "utf8");
    try {
      const cfg = JSON.parse(original) as Rules;
      cfg.prFlow.requireReview = false;
      writeFileSync(path, JSON.stringify(cfg));
      expect(merge({ expectedHeadSha: undefined }).deny).toContain("expectedHeadSha");
      expect(merge({ expectedHeadSha: "f".repeat(40) }).deny).toContain("expectedHeadSha");
      expect(merge().deny).toBeNull();
      cfg.prFlow.enabled = false;
      writeFileSync(path, JSON.stringify(cfg));
      expect(merge({ expectedHeadSha: undefined }).deny).toContain("expectedHeadSha");
    } finally {
      writeFileSync(path, original);
    }
  });
});

describe("the hook fails closed for these tools (3.5, f)", () => {
  const path = () => join(scratch, ".claude", "hooks", "rules.json");
  test("broken rules.json", () => {
    const original = readFileSync(path(), "utf8");
    try {
      writeFileSync(path(), "{ broken");
      expect(merge().status).not.toBe(0);
      expect(call("disable_pr_auto_merge", APP).status).not.toBe(0);
      expect(hook("Read", { file_path: "x" }).status).toBe(0);
    } finally {
      writeFileSync(path(), original);
    }
  });
  test("missing rules.json", () => {
    const original = readFileSync(path(), "utf8");
    try {
      rmSync(path());
      expect(merge().status).not.toBe(0);
    } finally {
      writeFileSync(path(), original);
    }
  });
  test("input that is not JSON", () => {
    expect(hook("", null, "not json").status).not.toBe(0);
  });
  test("a normal call still exits 0", () => {
    setState({});
    expect(merge().status).toBe(0);
  });
});

describe("settings (g)", () => {
  const settings = JSON.parse(readFileSync(join(ROOT, ".claude", "settings.json"), "utf8")) as Settings;
  test("the allow list is exactly the three tools", () => {
    expect(settings.permissions.allow).toEqual([
      "mcp__github__merge_pull_request",
      "mcp__github__disable_pr_auto_merge",
      "mcp__github__update_pull_request",
    ]);
  });
  test("a second PreToolUse entry blocks on failure and today's entry is unchanged", () => {
    const entries = settings.hooks.PreToolUse;
    expect(entries).toHaveLength(3);
    const [first, second] = entries as [Entry, Entry, Entry];
    expect(first.matcher).toBe("Bash|Write|Edit|MultiEdit|Agent|Workflow|mcp__.*");
    expect(first.hooks[0]?.onFailure).toBeUndefined();
    expect(second.matcher).toBe(
      "^mcp__github__(merge_pull_request|disable_pr_auto_merge|update_pull_request)$",
    );
    expect(second.hooks[0]?.onFailure).toBe("block");
  });
});

// The lane lists in rules.json copy CLAUDE.md's Risk section; a later rule change edits both.
const globToRegExp = (glob: string) =>
  new RegExp(
    "^" +
      glob
        .split("**")
        .map((p) =>
          p
            .split("*")
            .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
            .join("[^/]*"),
        )
        .join(".*") +
      "$",
  );
const matchesAny = (path: string, globs: string[]) => globs.some((g) => globToRegExp(g).test(path));
const NOT_PATHS = new Set(["release", ".md"]);
const EXTRA_ENTRIES = new Set(["CLAUDE.md", "**/CLAUDE.md", ".claude/**"]);

function laneListProblems(claudeMd: string, lanePaths: Record<string, string[]>): string[] {
  const risk = claudeMd.split(/^## /m).find((s) => s.startsWith("Risk")) ?? "";
  const problems: string[] = [];
  for (const lane of ["2", "3"]) {
    const bullet = risk.split("\n").find((l) => l.startsWith(`- **Lane ${lane}**`)) ?? "";
    const tokens = [...bullet.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? "").filter((t) => !NOT_PATHS.has(t));
    const asPath = (t: string) => (t.endsWith("/") ? `${t}**` : t);
    if (!tokens.length) problems.push(`lane ${lane}: no paths read from CLAUDE.md`);
    const globs = lanePaths[lane] ?? [];
    for (const t of tokens)
      if (!matchesAny(asPath(t), globs))
        problems.push(`lane ${lane}: CLAUDE.md path ${t} is matched by no lanePaths entry`);
    for (const g of globs) {
      if (!tokens.some((t) => asPath(t) === g) && !EXTRA_ENTRIES.has(g))
        problems.push(`lane ${lane}: lanePaths entry ${g} is not in CLAUDE.md`);
    }
  }
  return problems;
}

describe("the lane lists match CLAUDE.md (3.4, h)", () => {
  const claudeMd = readFileSync(join(ROOT, "CLAUDE.md"), "utf8");
  const lanePaths = (JSON.parse(readFileSync(join(ROOT, ".claude", "hooks", "rules.json"), "utf8")) as Rules)
    .prFlow.lanePaths;
  test("today's CLAUDE.md and lanePaths agree", () => {
    expect(laneListProblems(claudeMd, lanePaths)).toEqual([]);
  });
  test("a new lane 2 path in a copy of CLAUDE.md is caught", () => {
    const changed = claudeMd.replace(/(- \*\*Lane 2\*\*[^\n]*?)`src\/lib\/`/, "$1`src/newlib/`, `src/lib/`");
    expect(changed).not.toBe(claudeMd);
    expect(laneListProblems(changed, lanePaths).join("\n")).toContain("src/newlib/");
  });
});

// The cloud setup script (3.7): cloud sessions never read the repo's settings, so it writes the allow
// list and a blocking hook entry into user settings, next to the four launcher entries.
type Hook = { command: string; onFailure?: string; timeout?: number };
type UserSettings = {
  permissions?: { allow?: string[] };
  hooks: Record<string, { matcher?: string; hooks: Hook[] }[]>;
};
const HOOKS_FILE = join(ROOT, ".claude", "hooks", "rules.mjs");
const MATCHER = "^mcp__github__(merge_pull_request|disable_pr_auto_merge|update_pull_request)$";
const ALLOW = [
  "mcp__github__merge_pull_request",
  "mcp__github__disable_pr_auto_merge",
  "mcp__github__update_pull_request",
];

describe("the cloud setup script writes user settings (3.7, 6)", () => {
  const homes: string[] = [];
  const newHome = () => {
    const h = mkdtempSync(join(tmpdir(), "rules-home-"));
    homes.push(h);
    return h;
  };
  afterAll(() => {
    for (const h of homes) rmSync(h, { recursive: true, force: true });
  });
  const settingsPath = (h: string) => join(h, ".claude", "settings.json");
  const read = (h: string) => JSON.parse(readFileSync(settingsPath(h), "utf8")) as UserSettings;
  const setup = spawnSync(process.execPath, [HOOKS_FILE, "--print-setup"], { encoding: "utf8" }).stdout;
  const printSetup = (h: string) =>
    spawnSync("bash", ["-c", setup], { encoding: "utf8", env: { ...process.env, HOME: h } });
  const installUser = (h: string) =>
    spawnSync(process.execPath, [HOOKS_FILE, "--install-user"], {
      encoding: "utf8",
      env: { ...process.env, HOME: h },
    });
  const count = (list: { matcher?: string }[] | undefined, matcher: string | undefined) =>
    (list ?? []).filter((e) => e.matcher === matcher).length;

  test("from no file: three allow names, four launcher entries, the blocking entry, each once", () => {
    const h = newHome();
    expect(printSetup(h).status).toBe(0);
    const s = read(h);
    expect(s.permissions?.allow).toEqual(ALLOW);
    const launcher = newHome();
    expect(installUser(launcher).status).toBe(0);
    const l = read(launcher);
    expect(Object.keys(s.hooks).sort()).toEqual(["PostToolUse", "PreToolUse", "SessionStart", "Stop"]);
    for (const ev of ["SessionStart", "PostToolUse", "Stop"]) expect(s.hooks[ev]).toEqual(l.hooks[ev]);
    expect(s.hooks.PreToolUse).toHaveLength(2);
    expect(s.hooks.PreToolUse?.[0]).toEqual(l.hooks.PreToolUse?.[0]);
    expect(count(s.hooks.PreToolUse, "Bash|Write|Edit|MultiEdit|Agent|Workflow|mcp__.*")).toBe(1);
    const block = s.hooks.PreToolUse?.[1];
    expect(block?.matcher).toBe(MATCHER);
    expect(block?.hooks).toHaveLength(1);
    expect(block?.hooks[0]?.onFailure).toBe("block");
    expect(block?.hooks[0]?.timeout).toBe(30);
    expect(block?.hooks[0]?.command.trim().endsWith("exit 1")).toBe(true);
    // --install-user alone writes neither the allow names nor the blocking entry.
    expect(l.permissions).toBeUndefined();
    expect(count(l.hooks.PreToolUse, MATCHER)).toBe(0);
  });

  test("run twice it changes nothing the second time", () => {
    const h = newHome();
    printSetup(h);
    const first = readFileSync(settingsPath(h), "utf8");
    expect(printSetup(h).status).toBe(0);
    expect(readFileSync(settingsPath(h), "utf8")).toBe(first);
  });

  test("the user's own allow entries and hooks stay", () => {
    const h = newHome();
    mkdirSync(join(h, ".claude"));
    writeFileSync(
      settingsPath(h),
      JSON.stringify({
        theme: "dark",
        permissions: { allow: ["Bash(ls)", ALLOW[0]], deny: ["Bash(rm *)"] },
        hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo mine" }] }] },
      }),
    );
    expect(printSetup(h).status).toBe(0);
    const s = read(h) as UserSettings & { theme: string; permissions: { allow: string[]; deny: string[] } };
    expect(s.theme).toBe("dark");
    expect(s.permissions.deny).toEqual(["Bash(rm *)"]);
    expect(s.permissions.allow).toEqual(["Bash(ls)", ...ALLOW]);
    expect(s.hooks.PreToolUse?.some((e) => e.hooks.some((x) => x.command === "echo mine"))).toBe(true);
    expect(count(s.hooks.PreToolUse, MATCHER)).toBe(1);
  });

  test("the user's own fail-closed hooks stay, and an older blocking entry is replaced", () => {
    const h = newHome();
    mkdirSync(join(h, ".claude"));
    const guard = { type: "command", command: "/usr/local/bin/my-guard || exit 1", onFailure: "block" };
    const old = {
      type: "command",
      command:
        'for f in "$CLAUDE_PROJECT_DIR"/*/.claude/hooks/rules.mjs; do [ -f "$f" ] && exec node "$f" --find-repo; done; exit 1',
      onFailure: "block",
    };
    writeFileSync(
      settingsPath(h),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            { matcher: "Bash", hooks: [guard] },
            { matcher: MATCHER, hooks: [old] },
          ],
        },
      }),
    );
    expect(printSetup(h).status).toBe(0);
    const s = read(h);
    expect(
      s.hooks.PreToolUse?.some(
        (e) => e.matcher === "Bash" && e.hooks.some((x) => x.command === guard.command),
      ),
    ).toBe(true);
    expect(count(s.hooks.PreToolUse, MATCHER)).toBe(1);
    expect(JSON.stringify(s)).not.toContain(old.command);
    expect(installUser(h).status).toBe(0);
    expect(JSON.stringify(read(h))).toContain(guard.command);
  });

  test("a file that is not JSON is left as it is", () => {
    const h = newHome();
    mkdirSync(join(h, ".claude"));
    writeFileSync(settingsPath(h), "{ nope");
    expect(printSetup(h).status).toBe(0);
    expect(readFileSync(settingsPath(h), "utf8")).toBe("{ nope");
    expect(installUser(h).status).toBe(1);
    expect(readFileSync(settingsPath(h), "utf8")).toBe("{ nope");
  });

  test("--install-user after the setup script keeps the allow names and the blocking entry", () => {
    const h = newHome();
    printSetup(h);
    expect(installUser(h).status).toBe(0);
    const s = read(h);
    expect(s.permissions?.allow).toEqual(ALLOW);
    expect(count(s.hooks.PreToolUse, MATCHER)).toBe(1);
    expect(count(s.hooks.PreToolUse, "Bash|Write|Edit|MultiEdit|Agent|Workflow|mcp__.*")).toBe(1);
  });

  describe("the written blocking command, run as a shell command", () => {
    const command = () => {
      const h = newHome();
      printSetup(h);
      return read(h).hooks.PreToolUse?.[1]?.hooks[0]?.command ?? "";
    };
    const input = (cwd: string, tool = "mcp__github__merge_pull_request") =>
      JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: tool,
        tool_input: { ...APP, merge_method: "merge", expectedHeadSha: HEAD },
        cwd,
      });
    const runIn = (projectDir: string, cwd: string, tool?: string) =>
      spawnSync("bash", ["-c", command()], {
        input: input(cwd, tool),
        encoding: "utf8",
        cwd,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: projectDir,
          PATH: `${join(scratch, "bin")}:${process.env.PATH ?? ""}`,
          STUB_STATE: stateFile,
          STUB_HEAD: HEAD,
        },
      });

    test("a folder with no repo blocks", () => {
      const empty = newHome();
      expect(runIn(empty, empty).status).toBe(1);
    });
    test("one folder above a repo that has no rules.json blocks", () => {
      const up = newHome();
      cpSync(join(ROOT, ".claude", "hooks"), join(up, "repo", ".claude", "hooks"), { recursive: true });
      rmSync(join(up, "repo", ".claude", "hooks", "rules.json"));
      expect(runIn(up, up).status).toBe(1);
    });
    test("one folder above the repo judges the call", () => {
      setState({ body: "Lane 3", files: ["docs/x.md"] });
      const up = newHome();
      cpSync(scratch, join(up, "repo"), { recursive: true });
      const r = runIn(up, join(up, "repo"));
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(NO_REVIEW);
    });
    test("a session in the repo folder itself is judged, not blocked", () => {
      setState({ body: "Lane 3", files: ["docs/x.md"] });
      const r = runIn(scratch, scratch);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(NO_REVIEW);
      expect(existsSync(join(scratch, ".claude", "hooks", "rules.mjs"))).toBe(true);
    });
    test("a Bash call from the repo folder still returns quietly", () => {
      const r = spawnSync(process.execPath, [join(scratch, ".claude", "hooks", "rules.mjs"), "--find-repo"], {
        input: JSON.stringify({
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: "ls" },
          cwd: scratch,
        }),
        encoding: "utf8",
        env: { ...process.env, CLAUDE_PROJECT_DIR: scratch },
      });
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe("");
    });
  });
});
