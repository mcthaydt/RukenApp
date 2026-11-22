// node .github/scripts/ci-times.js <dir> [count] [since]
// <dir> holds runs-*.json (GET actions/workflows/ci.yml/runs?status=completed) and jobs/<run id>.json
// (GET actions/runs/<id>/jobs?per_page=100). Without [since]: the newest [count] (default 150) runs that ended in
// success or failure (the baseline). With [since] (an ISO time, such as a merge commit's): the first [count] full
// and the first [count] draft runs created after it, so the check reads the same runs whenever it is run. A run is "full" when it has a job named exactly "gate", "draft" when it has
// "gate (quick, draft)". Run time = the last job's completed_at minus the run's created_at.
// Per job: wait = started_at - created_at; setup = started_at to the end of the last setup step
// (SETUP below); run = the rest of the job. Percentiles are nearest-rank. Pieces group as "browser shard n" whatever
// their count. With [since], each run's longest browser-piece wait is listed too, by run id.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [dir, countArg, since] = process.argv.slice(2);
const count = Number(countArg ?? 150);
const SETUP =
  /^(Set up job|Initialize containers|Run actions\/checkout|Run pnpm\/action-setup|Run actions\/setup-node|Run pnpm install|Install|Run actions\/cache|Find Playwright's version|Run pnpm exec playwright install)/;
const t = (s) => Date.parse(s) / 1000;
const pct = (xs, q) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length ? a[Math.max(0, Math.ceil(q * a.length) - 1)] : NaN;
};
const finished = readdirSync(dir)
  .filter((f) => /^runs-\d+\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")).workflow_runs)
  .filter((r) => r.conclusion === "success" || r.conclusion === "failure");
const jobsOf = (run) => JSON.parse(readFileSync(join(dir, "jobs", `${run.id}.json`), "utf8")).jobs;
const kindOf = (jobs) =>
  jobs.some((j) => j.name === "gate")
    ? "full"
    : jobs.some((j) => j.name === "gate (quick, draft)")
      ? "draft"
      : null;
let runs;
if (since) {
  const taken = { full: 0, draft: 0 };
  runs = finished
    .filter((r) => t(r.created_at) > t(since))
    .sort((a, b) => t(a.created_at) - t(b.created_at))
    .filter((r) => {
      const kind = kindOf(jobsOf(r));
      return kind !== null && taken[kind]++ < count;
    })
    .reverse();
} else {
  runs = finished.sort((a, b) => t(b.created_at) - t(a.created_at)).slice(0, count);
}

const total = { full: [], draft: [] };
const waits = { full: [], draft: [] };
const perJob = new Map();
const add = (name, key, v) => {
  const k = `${name}|${key}`;
  if (!perJob.has(k)) perJob.set(k, []);
  perJob.get(k).push(v);
};
for (const run of runs) {
  const jobs = jobsOf(run);
  const kind = kindOf(jobs);
  const ended = jobs.filter((j) => j.completed_at).map((j) => t(j.completed_at));
  if (kind && ended.length) total[kind].push((Math.max(...ended) - t(run.created_at)) / 60);
  if (!kind) continue;
  for (const j of jobs) {
    if (!j.started_at || !j.completed_at || j.conclusion === "skipped") continue;
    // Any number of pieces groups in one row: "browser shard 3 of 6" and "browser shard 11 of 12" are "browser shard n".
    const name = `${kind}: ${j.name.replace(/ \(quick, draft\)/, "").replace(/shard \d+ of \d+/, "shard n")}`;
    const steps = (j.steps ?? []).filter((s) => s.started_at && s.completed_at);
    const setupEnd = Math.max(
      t(j.started_at),
      ...steps.filter((s) => SETUP.test(s.name)).map((s) => t(s.completed_at)),
    );
    add(name, "wait", t(j.started_at) - t(j.created_at));
    add(name, "setup", setupEnd - t(j.started_at));
    add(name, "run", t(j.completed_at) - setupEnd);
  }
  // A run ends at its latest piece's start plus that piece's work, so its longest piece wait is listed with it (spec 3.5).
  const pieces = jobs.filter((j) => j.started_at && /^browser shard \d+ of \d+/.test(j.name));
  const longest = Math.max(...pieces.map((j) => t(j.started_at) - t(j.created_at)));
  if (pieces.length) waits[kind].push(`${run.id}:${longest.toFixed(0)}`);
}
const first = runs.at(-1)?.created_at,
  last = runs[0]?.created_at;
console.log(
  `${runs.length} runs, ${first} to ${last}; full ${total.full.length}, draft ${total.draft.length}`,
);
if (since) {
  console.log(`run ids: ${runs.map((r) => r.id).join(" ")}`);
  for (const k of ["full", "draft"])
    console.log(`${k} runs' longest piece wait, run:s: ${waits[k].join(" ")}`);
}
for (const k of ["full", "draft"])
  console.log(
    `${k} run, minutes: p50 ${pct(total[k], 0.5).toFixed(1)} p95 ${pct(total[k], 0.95).toFixed(1)}`,
  );
console.log("job | n | wait p50/p95 s | setup p50/p95 s | run p50/p95 s");
const names = [...new Set([...perJob.keys()].map((k) => k.split("|")[0]))].sort();
for (const n of names) {
  const g = (key) => perJob.get(`${n}|${key}`) ?? [];
  const f = (key) => `${pct(g(key), 0.5).toFixed(0)}/${pct(g(key), 0.95).toFixed(0)}`;
  console.log(`${n} | ${g("wait").length} | ${f("wait")} | ${f("setup")} | ${f("run")}`);
}
