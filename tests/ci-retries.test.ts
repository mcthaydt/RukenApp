import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Main's browser journeys retry a failed test so a flake does not hold the deploy; pull request runs never do. The
// number lives in three places (CLAUDE.md Settings, ci.yml, and the hook's one allowed line in rules.json), so these
// tests fail when they drift apart, when the retry reaches anything but a push to main, or when the step that lists
// the flaky passes stops running.

const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const claude = readFileSync("CLAUDE.md", "utf8");
const rules = JSON.parse(readFileSync(".claude/hooks/rules.json", "utf8")) as {
  bypassFlags: { allowedLines: { file: string; line: string }[] };
};

// Comments are not rules, and some of them name the flag.
const code = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

// Throws, naming what is missing, so a later expectation never runs on nothing.
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`ci-retries: ${what} not found`);
  return value;
}

const RETRY_FLAG = /(?:^|[\s"'`])--retr(?:y|ies)\b/;

const ciCode = code(ci);
const retryLines = ciCode.split("\n").filter((line) => RETRY_FLAG.test(line));

describe("ci.yml: retries reach only a push to main", () => {
  it("passes a retry on exactly one line, the one the hook allows", () => {
    expect(retryLines).toHaveLength(1);
    expect(rules.bypassFlags.allowedLines).toHaveLength(1);
    const allowed = must(rules.bypassFlags.allowedLines[0], "the allowed line");
    expect(allowed.file).toBe(".github/workflows/ci.yml");
    expect(must(retryLines[0], "the retry line").trim()).toBe(allowed.line);
    expect(allowed.line.startsWith("run: pnpm test:browser ")).toBe(true);
  });

  it("gives main the number in CLAUDE.md Settings and everything else 0", () => {
    const setting = must(
      /^- Retries on main: (\d+), for the browser journeys on a push to `main` only\b/m.exec(claude)?.[1],
      "the Settings number",
    );
    const line = must(retryLines[0], "the retry line").trim();
    const body = must(/--retries=\$\{\{ (.*) \}\}$/.exec(line)?.[1], "the retry expression");
    expect(body).toContain("github.event_name == 'push'");
    expect(body).toContain("github.ref == 'refs/heads/main'");
    expect(body).toMatch(/\|\| 0$/);
    expect(body).toBe(`github.event_name == 'push' && github.ref == 'refs/heads/main' && ${setting} || 0`);
  });

  it("runs on pull requests and on pushes to main only", () => {
    const on = must(/\non:\n((?: {2}.*\n|\n)*?)(?=\S)/.exec(ciCode)?.[1], "the on: block");
    const triggers = [...on.matchAll(/^ {2}([a-z_]+):/gm)].map((m) => m[1]);
    expect(triggers.sort()).toEqual(["pull_request", "push"]);
    expect(must(/^ {2}push:\n((?: {4}.*\n)*)/m.exec(on)?.[1], "on.push")).toBe("    branches: [main]\n");
  });

  it("no other workflow passes a retry", () => {
    for (const name of readdirSync(".github/workflows")) {
      if (name === "ci.yml") continue;
      const lines = code(readFileSync(`.github/workflows/${name}`, "utf8"))
        .split("\n")
        .filter((line) => RETRY_FLAG.test(line));
      expect(lines, name).toEqual([]);
    }
  });
});

describe("ci.yml: the gate lists the tests that passed only on a retry", () => {
  const gateAt = ciCode.search(/^ {2}gate:\n/m);
  const gate = ciCode.slice(gateAt).split(/\n(?= {2}[a-z-]+:\n)/)[0] ?? "";
  const step = gate
    .split(/^ {6}- /m)
    .find((s) => s.startsWith("name: List the tests that passed only on a retry\n"));

  it("has the step, and runs it on every push run, even after a failure", () => {
    expect(gateAt).toBeGreaterThan(0);
    expect(step, "the gate has the step").toBeDefined();
    expect(step).toMatch(/^ {8}if: always\(\) && github\.event_name == 'push'$/m);
  });

  it("downloads the pieces' reports into its own folder and reads every piece", () => {
    const shards = must(/^ {8}shard: \[([\d, ]+)\]$/m.exec(ciCode)?.[1], "the browser-shard matrix");
    const pieces = String(shards.split(",").length);
    expect(step).toContain("--pattern 'ran-*' --dir flaky-reports");
    expect(step).toContain(
      `node .github/scripts/flaky-tests.js flaky-reports ${pieces} >> "$GITHUB_STEP_SUMMARY"`,
    );
  });
});
