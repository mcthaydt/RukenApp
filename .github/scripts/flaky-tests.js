// node .github/scripts/flaky-tests.js <folder> <pieces>
// Reads <folder>/ran-<n>/playwright-json/report.json for n = 1 to <pieces> (the browser pieces' Playwright JSON
// reports) and prints a Markdown list of the tests that passed only on a retry, with one ::warning:: line each, for
// the run's summary (spec 2026-11-27-retry-flaky-tests-on-main, 4.3). A flaky test never fails it; a missing or
// unreadable report does, naming the piece, so a flaky pass can never deploy unlisted.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [folder, piecesArg] = process.argv.slice(2);
const pieces = Number(piecesArg);
if (!folder || !Number.isInteger(pieces) || pieces < 1) {
  console.error("usage: flaky-tests.js <folder> <pieces>, with pieces a whole number of 1 or more");
  process.exit(1);
}

const problems = [];
const flaky = [];
const walk = (suite, titles) => {
  const here = suite.title ? [...titles, suite.title] : titles;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      if (t.status !== "flaky") continue;
      flaky.push({
        where: `${spec.file}:${spec.line}`,
        device: t.projectName,
        title: [...here, spec.title].join(" › "),
        tries: t.results?.length ?? 0,
      });
    }
  }
  for (const child of suite.suites ?? []) walk(child, here);
};

for (let n = 1; n <= pieces; n++) {
  const file = join(folder, `ran-${n}`, "playwright-json", "report.json");
  let report;
  try {
    report = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    problems.push(
      `piece ${n}: ${e.code === "ENOENT" ? "no report" : "the report could not be read"} (${file})`,
    );
    continue;
  }
  if (!Array.isArray(report?.suites)) {
    problems.push(`piece ${n}: not a Playwright JSON report, no suites (${file})`);
    continue;
  }
  // The suites at the top are files; their titles are the file names, already in spec.file.
  for (const suite of report.suites) walk({ ...suite, title: "" }, []);
}

if (problems.length) {
  for (const p of problems) console.error(`::error::${p}`);
  process.exit(1);
}

console.log("## Tests that passed only on a retry\n");
if (flaky.length === 0) {
  console.log("No test needed a retry.");
} else {
  console.log('Each is a defect: record it under "Flaky tests" in docs/superpowers/progress.md.\n');
  for (const f of flaky) console.log(`- \`${f.where}\` "${f.title}" [${f.device}]: passed on try ${f.tries}`);
  for (const f of flaky)
    console.error(`::warning::Passed only on try ${f.tries}: ${f.where} "${f.title}" [${f.device}]`);
}
