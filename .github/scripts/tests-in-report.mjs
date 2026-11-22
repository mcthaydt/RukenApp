// node tests-in-report.mjs <ran|listed> <Playwright JSON report>
// Prints one line per test, sorted: "<device profile>|<file>:<line>:<column>|<title path>".
// "ran" keeps the tests that have a result in the report (what this piece really ran); "listed" keeps every
// test, as `playwright test --list --reporter=json` gives them.
import { readFileSync } from "node:fs";

const [mode, file] = process.argv.slice(2);
if (mode !== "ran" && mode !== "listed") throw new Error(`mode must be ran or listed, not ${mode}`);
const report = JSON.parse(readFileSync(file, "utf8"));
const lines = [];
const walk = (suite, titles) => {
  const here = suite.title ? [...titles, suite.title] : titles;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      if (mode === "ran" && !(t.results?.length > 0)) continue;
      lines.push(`${t.projectName}|${spec.file}:${spec.line}:${spec.column}|${[...here, spec.title].join(" › ")}`);
    }
  }
  for (const child of suite.suites ?? []) walk(child, here);
};
for (const suite of report.suites ?? []) walk(suite, []);
process.stdout.write(lines.sort().join("\n") + (lines.length ? "\n" : ""));
