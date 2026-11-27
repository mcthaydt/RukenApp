// The flaky-test report the gate writes into main's run summary (spec 2026-11-27-retry-flaky-tests-on-main, 4.3,
// criterion A1). Reports are built in a scratch folder in the shape the browser pieces upload.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

const SCRIPT = resolve(import.meta.dirname, "../.github/scripts/flaky-tests.js");
const folders: string[] = [];
afterEach(() => {
  for (const f of folders.splice(0)) rmSync(f, { recursive: true, force: true });
});

type Status = "expected" | "unexpected" | "flaky" | "skipped";
const t = (projectName: string, status: Status, tries = 1) => ({
  projectName,
  status,
  results: Array.from({ length: tries }, () => ({})),
});
const report = (
  file: string,
  specs: { title: string; line: number; tests: object[] }[],
  describeTitle?: string,
) => {
  const s = specs.map((x) => ({ ...x, file, column: 3 }));
  return {
    suites: [
      describeTitle
        ? { title: file, suites: [{ title: describeTitle, specs: s }] }
        : { title: file, specs: s },
    ],
  };
};

// Writes piece n's report (an object, or raw text) for each entry; undefined leaves that piece out.
function pieces(entries: (object | string | undefined)[]): string {
  const dir = mkdtempSync(join(tmpdir(), "flaky-"));
  folders.push(dir);
  entries.forEach((e, i) => {
    if (e === undefined) return;
    const at = join(dir, `ran-${String(i + 1)}`, "playwright-json");
    mkdirSync(at, { recursive: true });
    writeFileSync(join(at, "report.json"), typeof e === "string" ? e : JSON.stringify(e));
  });
  return dir;
}
const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
const empty = { suites: [] };

describe("lists the tests that passed only on a retry", () => {
  test("every flaky test across the pieces, with device, file:line, title and try; nothing else", () => {
    const dir = pieces([
      report("real-buttons.test.ts", [
        { title: "a big button", line: 201, tests: [t("phone", "flaky", 2), t("tablet", "expected")] },
      ]),
      empty,
      report(
        "cookie-consent.test.ts",
        [
          { title: "Take it back", line: 204, tests: [t("tablet", "flaky", 3)] },
          { title: "Broken", line: 300, tests: [t("computer", "unexpected", 3)] },
          { title: "Skipped", line: 310, tests: [t("phone", "skipped", 0)] },
        ],
        "cookies",
      ),
      empty,
      empty,
      empty,
    ]);
    const r = run(dir, "6");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('- `real-buttons.test.ts:201` "a big button" [phone]: passed on try 2');
    expect(r.stdout).toContain(
      '- `cookie-consent.test.ts:204` "cookies › Take it back" [tablet]: passed on try 3',
    );
    expect(r.stdout).not.toMatch(/\[tablet\]: passed on try 1|Broken|Skipped/);
    expect(r.stdout.match(/^- /gm)).toHaveLength(2);
    expect(r.stderr.match(/^::warning::/gm)).toHaveLength(2);
    expect(r.stderr).toContain(
      '::warning::Passed only on try 2: real-buttons.test.ts:201 "a big button" [phone]',
    );
  });

  test("says so when no test needed a retry", () => {
    const dir = pieces([
      report("a.test.ts", [{ title: "ok", line: 1, tests: [t("phone", "expected")] }]),
      empty,
      empty,
      empty,
      empty,
      empty,
    ]);
    const r = run(dir, "6");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("No test needed a retry.");
    expect(r.stderr).not.toContain("::warning::");
  });
});

describe("fails, naming the piece, when a report is missing or unreadable", () => {
  test.each([
    [4, "no report", [empty, empty, empty, undefined, empty, empty]],
    [2, "could not be read", [empty, "{ not json", empty, empty, empty, empty]],
    [5, "no suites", [empty, empty, empty, empty, { stats: {} }, empty]],
  ] as const)("piece %s's report: %s", (piece, words, entries) => {
    const r = run(pieces([...entries]), "6");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`::error::piece ${String(piece)}: `);
    expect(r.stderr).toContain(words);
  });

  test.each([[[]], [["six"]], [["0"]]])("a missing, non-number or zero pieces count: %j", (extra) => {
    const r = run(pieces([empty]), ...extra);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("usage:");
  });
});
