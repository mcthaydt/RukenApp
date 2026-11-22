// node every-test-ran.mjs <listed.txt> <ran file>...
// Fails when the pieces together did not run every listed test exactly once, naming each test missing or run twice.
import { readFileSync } from "node:fs";

const [listedFile, ...ranFiles] = process.argv.slice(2);
const read = (f) => readFileSync(f, "utf8").split("\n").filter(Boolean);
const listed = new Set(read(listedFile));
const seen = new Map();
for (const f of ranFiles) for (const t of read(f)) seen.set(t, (seen.get(t) ?? 0) + 1);
const missing = [...listed].filter((t) => !seen.has(t));
const twice = [...seen].filter(([, n]) => n > 1).map(([t, n]) => `${t} (${n} times)`);
const unknown = [...seen.keys()].filter((t) => !listed.has(t));
console.log(`listed ${listed.size}, ran ${[...seen.values()].reduce((a, b) => a + b, 0)} in ${ranFiles.length} pieces`);
for (const [what, list] of [["not run", missing], ["run more than once", twice], ["run but not listed", unknown]]) {
  for (const t of list) console.log(`${what}: ${t}`);
}
if (listed.size === 0 || missing.length || twice.length || unknown.length) process.exit(1);
console.log("Every listed test ran exactly once.");
