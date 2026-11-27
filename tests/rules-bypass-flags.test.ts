// The hook's no-retries rule and the owner's one allowed line (spec 2026-11-27-retry-flaky-tests-on-main, 4.4,
// criteria A2 to A5). The real hook runs against a scratch copy of .claude/hooks.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const SPEC = join(ROOT, "docs/superpowers/specs/2026-11-27-retry-flaky-tests-on-main-design.md");
const rules = JSON.parse(readFileSync(join(ROOT, ".claude/hooks/rules.json"), "utf8")) as {
  bypassFlags: { allowedLines?: { file: string; line: string }[] };
};
const ALLOWED = rules.bypassFlags.allowedLines ?? [];
const LINE = ALLOWED[0]?.line ?? "";
let scratch = "";

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "rules-bypass-"));
  cpSync(join(ROOT, ".claude", "hooks"), join(scratch, ".claude", "hooks"), { recursive: true });
  cpSync(join(ROOT, "CLAUDE.md"), join(scratch, "CLAUDE.md"));
  mkdirSync(join(scratch, ".github", "workflows"), { recursive: true });
  writeFileSync(join(scratch, ".github/workflows/ci.yml"), "name: CI\n");
  writeFileSync(join(scratch, ".github/workflows/deploy.yml"), "name: Deploy\n");
  writeFileSync(join(scratch, "playwright.config.ts"), "export default { retries: 0 };\n");
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: scratch });
  git("init", "-q", "-b", "main");
  git(
    "-c",
    "user.name=McThayDT",
    "-c",
    "user.email=107786093+mcthaydt@users.noreply.github.com",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "base",
  );
});
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function denied(tool: string, input: object): string | null {
  const r = spawnSync(process.execPath, [join(scratch, ".claude", "hooks", "rules.mjs")], {
    input: JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: tool,
      tool_input: input,
      cwd: scratch,
    }),
    encoding: "utf8",
    cwd: scratch,
    env: { ...process.env, CLAUDE_PROJECT_DIR: scratch },
  });
  try {
    const o = JSON.parse(r.stdout.trim().split("\n").at(-1) ?? "") as {
      hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
    };
    return o.hookSpecificOutput?.permissionDecision === "deny"
      ? (o.hookSpecificOutput.permissionDecisionReason ?? "")
      : null;
  } catch {
    return null;
  }
}
const command = (c: string) => denied("Bash", { command: c });
const write = (file: string, content: string) => denied("Write", { file_path: join(scratch, file), content });

describe("on the command line, any retries value but a plain 0 is refused (A2)", () => {
  test.each([
    "pnpm exec playwright test --retries=2",
    "pnpm test:browser --retries=$N",
    "pnpm exec playwright test --retries ${R}",
    "pnpm exec playwright test --retries 2",
    "pnpm exec playwright test --retry=1",
  ])("refuses %s", (c) => {
    expect(command(c)).toContain("no retries until green");
  });
  test("allows --retries=0", () => {
    expect(command("pnpm exec playwright test --retries=0")).toBeNull();
  });
});

describe("in a config file, only the one allowed line may add retries (A3)", () => {
  test.each([
    ["playwright.config.ts", "export default { retries: 2 };\n"],
    [".github/workflows/ci.yml", "name: CI\n        run: pnpm exec playwright test --retries=3\n"],
    [
      ".github/workflows/ci.yml",
      "name: CI\n        run: pnpm exec playwright test --retries=${{ vars.R }}\n",
    ],
    [".github/workflows/ci.yml", `name: CI\n        ${LINE} --workers=1\n`],
    [".github/workflows/ci.yml", `name: CI\n        ${LINE.replace("--retries=", "--retries ")}\n`],
    [".github/workflows/deploy.yml", `name: Deploy\n        ${LINE}\n`],
    [".github/workflows/ci.yml", `name: CI\n        ${LINE}\n        run: vitest --passWithNoTests\n`],
    // A value on the next line, or behind a quote, is still a retry.
    [".github/workflows/ci.yml", "name: CI\n        run: pnpm exec playwright test --retries\n          2\n"],
    [
      ".github/workflows/ci.yml",
      "name: CI\n        run: >\n          pnpm exec playwright test --retries\n          2\n",
    ],
    ["playwright.config.ts", "export default {\n  retries:\n    2,\n};\n"],
    [".github/workflows/ci.yml", 'name: CI\n        run: pnpm exec playwright test --retries="2"\n'],
    [".github/workflows/ci.yml", "name: CI\n        run: pnpm exec playwright test --retries='2'\n"],
    [".github/workflows/ci.yml", `name: CI\n        ${LINE}\n        run: y --retries=2\n`],
  ])("refuses %s gaining a retry or a no-tests pass (case %#)", (file, content) => {
    expect(write(file, content)).toContain("Never loosen a check");
  });
  test("allows the allowed line, indented, in ci.yml", () => {
    expect(write(".github/workflows/ci.yml", `name: CI\n        ${LINE}\n`)).toBeNull();
  });
  test.each(["--retries=0", '--retries="0"'])("allows a plain %s in a workflow", (flag) => {
    expect(
      write(".github/workflows/ci.yml", `name: CI\n        run: pnpm exec playwright test ${flag}\n`),
    ).toBeNull();
  });
  // The shell joins quoted parts to the digits beside them, so each of these gives Playwright 1 or 2 retries.
  test.each([
    `--retries=0"2"`,
    "--retries=0'1'",
    `--retries="0"2`,
    `--retries="0""2"`,
    "--retries=''2",
    "--retries=0\\\n          2",
    `--retries=" 2"`,
    // Playwright reads a leading + as part of the number.
    "--retries +2",
    "--retries=+2",
  ])("refuses %s in a workflow", (flag) => {
    expect(
      write(".github/workflows/ci.yml", `name: CI\n        run: pnpm exec playwright test ${flag}\n`),
    ).toContain("Never loosen a check");
  });
  test.each([
    [".github/workflows/ci.yml", "name: CI\n# Pull request runs never pass --retries here\n"],
    [
      ".github/workflows/ci.yml",
      "name: CI\n      # main retries with --retries (see CLAUDE.md)\n      - run: pnpm test\n",
    ],
    [
      ".github/workflows/ci.yml",
      `name: CI\n        run: >\n          x --retries\n          ${LINE}\n          2\n`,
    ],
    ["playwright.config.ts", "export default { retries: 0 };\n// keep --retry off\n"],
    ["package.json", '{\n  "description": "no --retries anywhere"\n}\n'],
  ])("allows prose that only names the flag in %s", (file, content) => {
    expect(write(file, content)).toBeNull();
  });
});

describe("the exception is one exact line (A4, A5)", () => {
  test("allowedLines has exactly one entry, for ci.yml", () => {
    expect(ALLOWED).toHaveLength(1);
    expect(ALLOWED[0]?.file).toBe(".github/workflows/ci.yml");
  });
  test("its line is, character for character, the line the spec writes out", () => {
    const fenced = readFileSync(SPEC, "utf8")
      .split("\n")
      .filter((l) => l.trim().startsWith("run: pnpm test:browser"));
    expect(fenced).toHaveLength(1);
    expect(LINE).toBe(fenced[0]?.trim());
    expect(LINE).toBe(
      "run: pnpm test:browser ${{ steps.pick.outputs.args }} --reporter=list,html,json --retries=${{ github.event_name == 'push' && github.ref == 'refs/heads/main' && 2 || 0 }}",
    );
  });
});
