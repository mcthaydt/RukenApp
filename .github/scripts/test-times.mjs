// node test-times.mjs <Playwright JSON report>...
// Prints {"<device profile>|<file>": seconds} summed over every result in the reports, sorted by key.
// The planner fills the browser pieces from these times (docs/superpowers/specs/2026-11-22-faster-ci-design.md).
import { readFileSync } from "node:fs";

const times = {};
const walk = (suite) => {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const key = `${t.projectName}|${spec.file}`;
      const ms = (t.results ?? []).reduce((sum, r) => sum + (r.duration ?? 0), 0);
      times[key] = (times[key] ?? 0) + ms / 1000;
    }
  }
  for (const child of suite.suites ?? []) walk(child);
};
for (const file of process.argv.slice(2)) for (const suite of JSON.parse(readFileSync(file, "utf8")).suites ?? []) walk(suite);
const sorted = Object.fromEntries(Object.keys(times).sort().map((k) => [k, Math.round(times[k] * 10) / 10]));
process.stdout.write(JSON.stringify(sorted, null, 2) + "\n");
