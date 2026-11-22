# Faster CI, with every test still run

Date: 2026-11-22. Status: **spec, revised after plan audit 1 (636c072 FAIL, 3 red; audit a6f62ea).**

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-22 01:20 UTC:** "how can we speed up our CI? We don't have enough built in the app for it to take this long"
- **Owner, 2026-11-22 01:20 UTC:** "We should have primarily e2e tests", then at 01:21: "doesn't our workflow instruct that already?" The kit already says so (`build`, Verification). Pruning unit and database tests that journeys cover is its own thread ("Make tests primarily end-to-end") and is out of scope here.
- The coordinator's brief: find where the time goes and make CI faster without dropping coverage. No test, browser engine or device profile (phone in WebKit, tablet, computer) is cut. Speed comes only from how CI runs. Paid runners are out (money).
- The yardstick is `release`, "Making CI fast": audit first and fix the biggest bucket; lint, typecheck, build and tests run in parallel and no required check waits on another (only the gate waits); shards are filled by the test times `main` records, and the shards together are shown to have run every file; a job that drives a browser runs in an image that already holds the browsers, pinned by digest; installs are cached; a slow job that only takes pictures stays off the path to the required checks; before and after numbers from real runs. And "Docs only": one first decision on what applies, which the gate reads.

## 1. What is slow today (measured)

Measured by the program in the appendix (`ci-times.mjs`), which also judges A8 and A10. Its rules: the newest finished CI runs that ended in success or failure (cancelled runs left out); a run is **full** when it has a job named exactly `gate` and **draft** when it has `gate (quick, draft)`; a run's time is its last job's `completed_at` minus the run's `created_at`; per job, **wait** is `started_at` minus the job's `created_at` (the job is created once its `needs` are met), **setup** runs from `started_at` to the end of the last setup step (checkout, pnpm, Node, install, cache, container start, browser install), and **run** is the rest; percentiles are nearest-rank.

**The last 150 runs** (2026-11-21 01:23 to 2026-11-22 01:21 UTC; 84 full, 66 draft):

| | p50 | p95 |
|---|---|---|
| Full run | 11.0 min | 26.6 min |
| Draft run | 3.1 min | 16.0 min |

| Job (full runs) | n | wait p50/p95 s | setup p50/p95 s | run p50/p95 s |
|---|---|---|---|---|
| what changed | 84 | 2/121 | 3/7 | 2/3 |
| which screens changed | 54 | 27/210 | 16/23 | 22/30 |
| verify | 84 | 2/220 | 17/23 | 144/188 |
| postgres | 84 | 2/154 | 30/39 | 69/92 |
| browser shard n of 6 | 426 | 4/400 | 66/99 | 242/561 |
| browser | 84 | 4/234 | 1/1 | 2/4 |
| gate | 84 | 6/132 | 1/1 | 2/4 |

| Job (draft runs) | n | wait p50/p95 s | setup p50/p95 s | run p50/p95 s |
|---|---|---|---|---|
| what changed | 66 | 2/62 | 3/7 | 2/3 |
| which screens changed | 13 | 33/228 | 17/24 | 20/31 |
| verify | 66 | 2/131 | 14/25 | 91/173 |
| postgres | 66 | 2/75 | 26/39 | 58/92 |
| browser shard n of 6 | 204 | 2/180 | 68/102 | 69/431 |
| browser | 66 | 2/144 | 1/1 | 2/4 |
| gate | 66 | 2/53 | 1/1 | 2/3 |

**The last 60 runs** (2026-11-21 14:59 to 2026-11-22 01:21 UTC; 49 full, 11 draft), the same program: full run p50 14.1 min, p95 30.5; draft run p50 5.7, p95 31.3. Waits per full-run hop grew in this window as more pull requests ran at once: `what changed` 23/195 s, `which screens changed` 44/210, browser shard 89/423, `browser` 21/311, `gate` 35/298.

Where a full run's time goes:

- **W1. Waiting, the biggest bucket and the one that grows.** A full run is a chain of five hops, each a fresh wait for a runner: `what changed` → `which screens changed` → six `browser shard`s → `browser` → `gate`; `verify` and `postgres` also wait on `what changed`. The waits add up along the chain: in the last 60 runs the hop medians alone sum to over 3.5 minutes, and at p95 to over 20. A full run is 12 jobs (`commit-authors` is its own workflow), and the account runs at most 20 at once on GitHub's free runners, so two runs at once already queue.
- **W2. Uneven pieces, about 2 minutes.** Playwright deals whole files to pieces by count, not by time. In the six piece logs of run 44970082873: 1,512 journeys, 2,691 test-seconds, so an even split is about 224 s per piece at 2 workers; the slowest piece took 391 s. The largest single file in one device profile is `make-live-changes.test.ts` on phone, 130 s, well under an even share, so a split by time can come close to even.
- **W3. Browser setup, about 1 minute per piece** (66 s p50, 99 s p95). `playwright install --with-deps chromium webkit` installs the system libraries with apt every time, even with the browser cache hit.
- **Not on the path.** Unit and database tests and `pnpm lint` run inside `verify` and `postgres`, which end before the pieces (run p50 144 s and 69 s against the pieces' 66 + 242 s). Neither is changed here.

## 2. The outcome

- **Full runs:** p50 at most 8 min and p95 at most 15 min, over the first 10 full runs after unit T merges, as they come (no run is left out for load), against 11.0 / 26.6 over 150 runs and 14.1 / 30.5 over the last 60. Same journeys, devices, unit and database tests.
- **Draft runs:** p50 and p95 no higher than the baseline (3.1 / 16.0 over 150 runs), over the first 10 draft runs after W merges.

**Call:** the kit's aim (under 1 minute median) is not reachable on 6 free runners with 1,512 browser journeys of about 2,700 test-seconds; even a perfect split needs about 4 minutes of tests. The aim stays the direction; this spec reports the gap rather than hiding it.

## 3. The change

Two pull requests, because `build` says a CI workflow changes in a pull request with no product code and no tests, and lands first.

### 3.1 Unit W: the workflow (`.github/workflows/ci.yml` and `.github/scripts/`, lane 3)

1. **No job waits but the gate.** `what changed`, `which screens changed` and `browser` go away. `verify`, `postgres` and the six pieces all start at once. The run is two hops: those jobs, then `gate`.
   - **One authority for docs-only: the gate.** The docs-only rule moves into `.github/scripts/docs-only.sh`, unchanged: a pull request whose diff against `origin/main...HEAD`, with `--no-renames`, is all `.md` files; an empty diff, a push to `main` or any error is not docs-only. It prints `docs_only=true` or `docs_only=false`.
   - Each job runs the script after its checkout only to save work: when it says yes, the job skips its work, as today.
   - `gate` checks out with full history and runs the same script itself, and only its own answer counts. If its answer is yes, `gate` passes when no needed job failed or was cancelled. If no, `gate` passes only when `verify`, `postgres` and `browser-shard` all succeeded and, on a full run, the union check (item 5) passed. A job that skipped its work on its own answer while `gate`'s answer is no fails the union check, because its piece reports nothing ran. `gate` logs its answer.
   - **The screens answer moves into each piece, after "Pick the journeys".** A piece picks its journeys first (as today, ci.yml "Pick the journeys"). Only when it has journeys to run (`run=true`) does it work out the screens answer, with the same steps as today's `which screens changed` job (decide, then build the base and compare with the picker), and the same rule that any doubt shoots every screen. A piece with no journeys (common on drafts) does no build at all. **Call:** this puts the base build on the path to `gate`, which `release` would keep off it; it is still a net gain, because the piece's web server builds the change anyway (`playwright.config.ts` webServer), so the new work is one base build of about 12 s (measured in `verify`) plus the comparison, against a hop of 44 s p50 and 210 s p95 over the last 60 runs.
   - `gate` needs `verify`, `postgres` and `browser-shard` directly. Its names, `gate` and `gate (quick, draft)`, stay, so branch protection (`gate`, `commit-authors`) is unchanged.
2. **Browsers in the image.** Each piece runs in `mcr.microsoft.com/playwright:v1.63.0-noble` pinned by digest (`sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`, the index for v1.63.0-noble, checked 2026-11-22 and again by plan audit 1), the version `package.json` pins. `playwright install` goes away. Postgres stays a service container, reached by its service name inside the job container. Node still comes from `.nvmrc` through `setup-node`, and installs stay cached by `cache: pnpm`. Journeys open `*.localhost` addresses (a game at `g-….localhost:8788`, `media.localhost`) in both engines, and in a container name lookup goes through Docker's resolver, not the runner's.
   - **Fallback.** If the image's setup takes longer than today's install at the median over the build's measuring runs, **or any journey behaves differently in the container** (a failure, or a pass only after a change), the build keeps today's install for that item, reports why with numbers or the failing journey, and drops only this item. No journey, timeout or setting is changed to fit the container.
3. **Pieces filled by recorded times.** A piece reads `ci-test-times.json` (seconds per file and device profile, as `main` last recorded them) from the Actions cache, restored by the prefix `ci-test-times-`, and passes it to the planner (unit T) through `RUKEN_SHARD_TIMES` and `RUKEN_SHARD=<n>/6`. When those are set, `--shard` is not passed. Until unit T is on `main` (no planner file), or when no times are cached, it runs Playwright's own `--shard=<n>/6` as today.
4. **Recording the times.** Each piece adds Playwright's JSON reporter alongside the config's `list` and `html` (`--reporter=list,html,json` with `PLAYWRIGHT_JSON_OUTPUT_NAME`), so the HTML report with the look's screenshots is kept, and uploads the JSON. A job `test-times`, on a push to `main` only, `needs: browser-shard` without `always()` (so a broken run records nothing), sums seconds per file and device profile from the six JSON reports and saves them under `ci-test-times-<sha>`. Nothing needs `test-times`.
5. **Every file ran.** Each piece uploads the list of (file, device profile) pairs taken from its own JSON report of what ran, not from a listing. Piece 1 also uploads the full list from `playwright test --list --reporter=json` with no shard and no selection. On a full run, `gate` downloads them and fails when the union of the pieces' lists differs from the full list, naming each missing or doubled pair. On a draft (only the tests the change reaches) the union check is skipped, as nothing promises every file there.
6. **The measuring program** in the appendix is committed as `.github/scripts/ci-times.mjs`, so A8 and A10 use the same rules as section 1.
7. Concurrency, cancel rules, `ready_for_review`, `RUN_EVERYTHING_WHEN`, `SHOOT_EVERYTHING_WHEN`, the quick-run rules, artifacts and timeouts stay as they are, except where 1 to 6 say otherwise.

### 3.2 Unit T: the planner (lane 2)

- `tests/browser/support/shard-plan.ts`: given the full list of (file, device profile) pairs, the recorded seconds (a pair with no time gets the median), and the number of pieces, it deals the pairs out longest first, each to the piece with the least time so far. Ties go to the lower piece number, so every piece computes the same plan.
- The full list: `playwright.config.ts` cannot ask Playwright to list itself, so the planner lists `testDir` (`tests/browser`) with the config's own test match rule, sorted by path, crossed with the three device profiles, so all six pieces deal the same plan whatever order the disk returns.
- `playwright.config.ts`: when `RUKEN_SHARD` and `RUKEN_SHARD_TIMES` are set and the file is readable, each device profile's `testMatch` is the files the plan gives this piece for that profile; otherwise the config is as today. Unknown or unreadable input falls back to today's behavior, never to running fewer tests. The union check (3.1 item 5) catches anything the planner loses.
- `tests/browser/support/shard-plan.test.ts` (unit project): every pair lands in exactly one piece; the same input in any order gives the same plan; a pair missing from the times still runs; the plan's slowest piece is within the largest single pair of the mean.

### 3.3 Not changed, and why

- Workers stay at 2 per piece: the four-core runner also runs two browsers' worth of pages, `wrangler dev` for the site and the game gate, and Postgres, and `playwright.config.ts` records answers taking over 5 s at today's load (run 44835171025). Raising it is a separate measured change.
- Six pieces stay (Settings in CLAUDE.md). More pieces mean more jobs against the 20-runner limit.
- Lint, typecheck and the unit and database tests are untouched: they are off the path to the result.

### 3.4 Unit F: the pieces read main's times (lane 3, follow-up)

Found on #302's full run (run 44989252655): every piece logged "Split by Playwright (no planner or no recorded times)" and "Cache not found", although `main` had saved `ci-test-times-7e6c8ee…` at 05:06 UTC. `test-times` runs on the host runner, where `actions/cache` packs with zstd (its log: `tar … --use-compress-program zstdmt`, `cache.tzst`). The pieces run in Playwright's image, which has no zstd, so `actions/cache` there packs and unpacks with gzip (`cache.tgz`). The two count as different cache versions, so a piece never finds a time `main` saved, and the planner (unit T) never runs.

1. **Packed where it is read.** On a push to `main`, each piece saves its own times under `ci-piece-times-<sha>-<n>`, from inside the image. Its times are seconds per device profile and file, summed from its Playwright JSON report by the rule `test-times` uses today. `test-times` runs in the same image, pinned by the same digest. It restores the six by exact key, joins them and saves `ci-test-times-<sha>`. Every times cache is then packed and unpacked with gzip. Only `actions/cache`, already pinned, is used: no new action, tool or secret. `gh run download` leaves `test-times`; the `ran-*` artifacts and the gate are unchanged.
2. **One times file for all six.** A piece first restores `ci-test-times-<base>`. `<base>` is the pull request's base commit (`github.event.pull_request.base.sha`) or, on `main`, the commit before the push (`github.event.before`). Only when that key is missing does the piece fall back to the newest key by prefix. With the exact key, every piece reads the same file. In the fallback, a save that lands between two pieces' restores can still give them different files. The gate's union check then fails that run, so the run goes red but no test is lost. Each piece logs the key it matched (`cache-matched-key`) so the cause is plain.

Acceptance:

- F1. On the first full pull request run after F merges and `main` has recorded times, every piece logs "Split by main's recorded times" and the same matched key.
- F2. A9 holds on that run (the gate's union check passes).
- A7, and then A8, are measured from that point, as in section 4.

## 4. Acceptance criteria

- A1. On a ready pull request, the run's jobs are `verify`, `postgres`, `browser shard 1..6 of 6` and `gate` (plus `test-times` on `main`); none of the first eight lists a `needs`. Checked by reading the run's job list.
- A2. `gate` fails when any of `verify`, `postgres` or a piece fails or is cancelled. Checked by a run with a journey broken on purpose (a throwaway commit on the W branch, reverted), and its result reported.
- A3. A pull request that changes only `.md` files passes `gate` with no tests run, its log showing the gate's own docs-only answer "yes". One that changes a `.md` and a `.ts` file runs everything, its gate log showing the answer "no" and the union check passing. Both checked by real runs.
- A4. The screens answer each piece logs is the same one today's `which screens changed` job gives for the same change: checked on one change that shoots all and one that shoots a subset (a one-page Svelte change). A piece with no journeys logs no build.
- A5. No piece runs `playwright install`; each piece's container image is the pinned digest; every journey that passes on the runner passes in the container. Checked from the run log. (Or, per 3.1 item 2, the reported reason that kept the install.)
- A6. On a full run, the union check passes, and it fails when a pair is left out on purpose (a throwaway commit, reverted).
- A7. After unit T: the six pieces' test times on a full run are within 1.15× of their mean, at the median over the measuring runs.
- A8. Full runs, section 2: p50 ≤ 8 min and p95 ≤ 15 min over the first 10 full runs after T merges, by `ci-times.mjs`, each run's id listed. If not met, the gap is reported with numbers, never rounded.
- A9. The number of journeys run on a full run (sum over the pieces) equals the number before the change for the same commit of `tests/browser`: no test, device or engine is lost.
- A10. Draft runs, section 2: p50 ≤ 3.1 min and p95 ≤ 16.0 min over the first 10 draft runs after W merges, by `ci-times.mjs`, each run's id listed.

## 5. Plan

| Unit | Waits on | Owns | Output | Check | Lane |
|---|---|---|---|---|---|
| W | this spec merged | `.github/workflows/ci.yml`, `.github/scripts/docs-only.sh`, `.github/scripts/ci-times.mjs` | one PR | A1 to A6, A9 on real runs; A10 after merge | 3 |
| T | W merged | `tests/browser/support/shard-plan.ts`, `tests/browser/support/shard-plan.test.ts`, `playwright.config.ts` | one PR | its unit test, A9; A7 and A8 after F | 2 |
| F | T merged | `.github/workflows/ci.yml` | one PR | F1, F2, then A7; A8 after merge | 3 |

- Expected duration: W about 3 hours including measuring runs; T about 2 hours; F about 2 hours.
- Budget: GitHub's free runners only. No new dependency, service or secret. The Playwright image is Microsoft's public image of the version already pinned.
- Audits: W, plan audit (this spec) and implementation audit; T, one fresh review; F, a plan audit of section 3.4 and an implementation audit. Merge under the standing permission in `progress.md` (History, Standing permissions) once audits pass and CI is green.

## 6. Open product decisions

None. A heads-up for the owner, not a question: raising the open pull request limit to 6 puts more runs against the same 20 runners, so waits grow when many are open at once. W cuts a full run from 12 jobs to 8 (9 on `main`).

## Appendix: `ci-times.mjs`

Fetch with plain `gh`, then run `node ci-times.mjs <dir> [count]`:

```sh
gh api "repos/mcthaydt/RukenApp/actions/workflows/ci.yml/runs?per_page=100&status=completed&page=1" > <dir>/runs-1.json   # and page=2, page=3 until 150 success/failure runs
gh api "repos/mcthaydt/RukenApp/actions/runs/<run id>/jobs?per_page=100" > <dir>/jobs/<run id>.json                     # for each of those runs
```

```js
// node ci-times.mjs <dir> [count]
// <dir> holds runs-*.json (GET actions/workflows/ci.yml/runs?status=completed) and jobs/<run id>.json
// (GET actions/runs/<id>/jobs?per_page=100). Takes the newest [count] (default 150) runs that ended in
// success or failure. A run is "full" when it has a job named exactly "gate", "draft" when it has
// "gate (quick, draft)". Run time = the last job's completed_at minus the run's created_at.
// Per job: wait = started_at - created_at; setup = started_at to the end of the last setup step
// (SETUP below); run = the rest of the job. Percentiles are nearest-rank.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [dir, countArg] = process.argv.slice(2);
const count = Number(countArg ?? 150);
const SETUP = /^(Set up job|Initialize containers|Run actions\/checkout|Run pnpm\/action-setup|Run actions\/setup-node|Run pnpm install|Install|Run actions\/cache|Find Playwright's version|Run pnpm exec playwright install)/;
const t = (s) => Date.parse(s) / 1000;
const pct = (xs, q) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length ? a[Math.max(0, Math.ceil(q * a.length) - 1)] : NaN;
};
const runs = readdirSync(dir)
  .filter((f) => /^runs-\d+\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")).workflow_runs)
  .filter((r) => r.conclusion === "success" || r.conclusion === "failure")
  .sort((a, b) => t(b.created_at) - t(a.created_at))
  .slice(0, count);

const total = { full: [], draft: [] };
const perJob = new Map();
const add = (name, key, v) => {
  const k = `${name}|${key}`;
  if (!perJob.has(k)) perJob.set(k, []);
  perJob.get(k).push(v);
};
for (const run of runs) {
  const jobs = JSON.parse(readFileSync(join(dir, "jobs", `${run.id}.json`), "utf8")).jobs;
  const kind = jobs.some((j) => j.name === "gate") ? "full" : jobs.some((j) => j.name === "gate (quick, draft)") ? "draft" : null;
  const ended = jobs.filter((j) => j.completed_at).map((j) => t(j.completed_at));
  if (kind && ended.length) total[kind].push((Math.max(...ended) - t(run.created_at)) / 60);
  if (!kind) continue;
  for (const j of jobs) {
    if (!j.started_at || !j.completed_at || j.conclusion === "skipped") continue;
    const name = `${kind}: ${j.name.replace(/ \(quick, draft\)/, "").replace(/shard \d of 6/, "shard n of 6")}`;
    const steps = (j.steps ?? []).filter((s) => s.started_at && s.completed_at);
    const setupEnd = Math.max(t(j.started_at), ...steps.filter((s) => SETUP.test(s.name)).map((s) => t(s.completed_at)));
    add(name, "wait", t(j.started_at) - t(j.created_at));
    add(name, "setup", setupEnd - t(j.started_at));
    add(name, "run", t(j.completed_at) - setupEnd);
  }
}
const first = runs.at(-1)?.created_at, last = runs[0]?.created_at;
console.log(`${runs.length} runs, ${first} to ${last}; full ${total.full.length}, draft ${total.draft.length}`);
for (const k of ["full", "draft"]) console.log(`${k} run, minutes: p50 ${pct(total[k], 0.5).toFixed(1)} p95 ${pct(total[k], 0.95).toFixed(1)}`);
console.log("job | n | wait p50/p95 s | setup p50/p95 s | run p50/p95 s");
const names = [...new Set([...perJob.keys()].map((k) => k.split("|")[0]))].sort();
for (const n of names) {
  const g = (key) => perJob.get(`${n}|${key}`) ?? [];
  const f = (key) => `${pct(g(key), 0.5).toFixed(0)}/${pct(g(key), 0.95).toFixed(0)}`;
  console.log(`${n} | ${g("wait").length} | ${f("wait")} | ${f("setup")} | ${f("run")}`);
}
```
