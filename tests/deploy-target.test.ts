import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// deploy-target.sh decides which commit the Deploy workflow ships. `gh` is a stub that answers from files, so
// no network is touched.

const script = join(process.cwd(), ".github/scripts/deploy-target.sh");

interface Run {
  name: string;
  status: string;
  conclusion: string | null;
  run_number: number;
  run_attempt: number;
  html_url: string;
}

function decide(opts: { runSha: string; tip: string; runs: Run[] }) {
  const dir = mkdtempSync(join(tmpdir(), "deploy-target-"));
  writeFileSync(join(dir, "runs.json"), JSON.stringify({ workflow_runs: opts.runs }));
  writeFileSync(
    join(dir, "gh"),
    `#!/usr/bin/env bash
case "$*" in
  *"commits/main"*) echo "${opts.tip}" ;;
  *"actions/runs?head_sha=${opts.tip}&event=push"*) cat "${dir}/runs.json" ;;
  *) echo "unexpected gh call: $*" >&2; exit 1 ;;
esac
`,
  );
  chmodSync(join(dir, "gh"), 0o755);
  const out = join(dir, "output");
  writeFileSync(out, "");
  const r = spawnSync("bash", [script], {
    env: { PATH: `${dir}:${process.env.PATH ?? ""}`, REPO: "o/r", RUN_SHA: opts.runSha, GITHUB_OUTPUT: out },
    encoding: "utf8",
  });
  const output = Object.fromEntries(
    readFileSync(out, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  return { status: r.status, text: `${r.stdout}${r.stderr}`, output };
}

const run = (over: Partial<Run>): Run => ({
  name: "CI",
  status: "completed",
  conclusion: "success",
  run_number: 1,
  run_attempt: 1,
  html_url: "https://github.com/o/r/actions/runs/1",
  ...over,
});

describe("deploy-target.sh", () => {
  it("deploys the run's own commit when it is the tip of main", () => {
    const r = decide({ runSha: "aaa", tip: "aaa", runs: [] });
    expect(r.status).toBe(0);
    expect(r.output).toEqual({ deploy: "true", sha: "aaa" });
    expect(r.text).toMatch(/tip of main/i);
  });

  it("deploys the tip when it is newer than the run and its own CI run is green", () => {
    const r = decide({ runSha: "aaa", tip: "bbb", runs: [run({})] });
    expect(r.status).toBe(0);
    expect(r.output).toEqual({ deploy: "true", sha: "bbb" });
    expect(r.text).toMatch(/newer commit bbb.*green/i);
  });

  it("deploys nothing when the newer commit's run is red", () => {
    const r = decide({ runSha: "aaa", tip: "bbb", runs: [run({ conclusion: "failure" })] });
    expect(r.status).toBe(0);
    expect(r.output).toEqual({ deploy: "false" });
    expect(r.text).toMatch(/failed/i);
    expect(r.text).toMatch(/newer commit's own run decides/i);
  });

  it("deploys nothing when the newer commit's run is still going", () => {
    const r = decide({ runSha: "aaa", tip: "bbb", runs: [run({ status: "in_progress", conclusion: null })] });
    expect(r.output).toEqual({ deploy: "false" });
    expect(r.text).toMatch(/still running/i);
  });

  it("deploys nothing when the newer commit has no CI run yet", () => {
    const r = decide({ runSha: "aaa", tip: "bbb", runs: [] });
    expect(r.output).toEqual({ deploy: "false" });
    expect(r.text).toMatch(/no CI run yet/i);
  });

  it("reads the newest attempt: a re-run that passed beats the first failure", () => {
    const r = decide({
      runSha: "aaa",
      tip: "bbb",
      runs: [run({ conclusion: "failure", run_attempt: 1 }), run({ conclusion: "success", run_attempt: 2 })],
    });
    expect(r.output).toEqual({ deploy: "true", sha: "bbb" });
  });

  it("ignores workflows that are not CI", () => {
    const r = decide({ runSha: "aaa", tip: "bbb", runs: [run({ name: "commit-authors" })] });
    expect(r.output).toEqual({ deploy: "false" });
    expect(r.text).toMatch(/no CI run yet/i);
  });
});
