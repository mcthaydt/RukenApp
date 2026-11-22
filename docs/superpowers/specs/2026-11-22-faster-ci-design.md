# Faster CI, with every test still run

Date: 2026-11-22. Status: **spec, waiting for its plan audit.**

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-22 01:20 UTC:** "how can we speed up our CI? We don't have enough built in the app for it to take this long"
- **Owner, 2026-11-22 01:20 UTC:** "We should have primarily e2e tests", then at 01:21: "doesn't our workflow instruct that already?" The kit already says so (`build`, Verification). Pruning unit and database tests that journeys cover is its own thread ("Make tests primarily end-to-end") and is out of scope here.
- The coordinator's brief: find where the time goes and make CI faster without dropping coverage. No test, browser engine or device profile (phone in WebKit, tablet, computer) is cut. Speed comes only from how CI runs. Paid runners are out (money).
- The yardstick is `release`, "Making CI fast": audit first and fix the biggest bucket; lint, typecheck, build and tests run in parallel and no required check waits on another (only the gate waits); shards are filled by the test times `main` records, and the shards together are shown to have run every file; a job that drives a browser runs in an image that already holds the browsers, pinned by digest; installs are cached; a slow job that only takes pictures stays off the path to the required checks; before and after numbers from real runs.

## 1. What is slow today (measured)

The last 60 finished CI runs (2026-11-21 13:00 UTC to 2026-11-22 01:20 UTC; 42 full, 18 draft), from `gh api repos/mcthaydt/RukenApp/actions/runs/<id>/jobs`.

| Measure | p50 | p95 |
|---|---|---|
| Full run, start to end | 14.1 min | 26.9 min |
| Draft run, start to end | 4.5 min | 23.4 min |
| Wait for a runner, per job | 49 s | 399 s |
| Slowest browser piece: its tests | 356 s | 484 s |
| Slowest browser piece: setup before its tests | 66 s | 101 s |
| Rest of a full run (waiting and the jobs before and after the pieces) | 379 s | 1,247 s |
| Slowest piece ÷ mean piece (test time) | 1.4 | 1.7 |

Where a full run's median 14 minutes goes:

- **W1. Waiting, about 6 minutes, the biggest bucket.** The run is a chain of five hops, each a fresh wait for a runner: `what changed` → `which screens changed` → six `browser shard`s → `browser` → `gate`. `verify` and `postgres` also wait on `what changed`. Run 44970082873 (main, 01:09 UTC, nothing else running) waited 59 s for the first job, 57 s for `which screens changed`, 26 to 98 s for the pieces and 16 s for the gate. Under load it is far worse: in run 44954272768 a piece started 15 minutes after the run did. A full run is 13 jobs, and the account runs at most 20 at once on GitHub's free runners, so two runs at once already queue.
- **W2. Uneven pieces, about 2 minutes.** Playwright deals whole files to pieces by count, not by time. From the six piece logs of run 44970082873: 1,512 journeys, 2,691 test-seconds, so an even split is about 224 s per piece at 2 workers; the slowest piece took 391 s. The largest single file in one device profile is `make-live-changes.test.ts` on phone, 130 s, well under an even share, so a split by time can come close to even.
- **W3. Browser setup, about 1 minute per piece.** `playwright install --with-deps chromium webkit` takes 25 to 62 s even with the browser cache hit, because the system libraries are installed with apt every time.
- **Not slow.** Unit tests (33 s) and database tests (78 s) run beside the pieces and finish long before them. `pnpm lint` takes 121 s, but inside `verify`, which ends before the pieces. Neither is on the path to the result, so neither is changed here.

## 2. The outcome

A ready pull request's full run takes **at most 8 minutes at the median and 12 at p95** with no other run at the same time, measured over at least 5 full runs after the change, against the 14.1 / 26.9 above, with the same journeys, devices, unit and database tests. A draft's quick run is no slower than today.

**Call:** the kit's aim (under 1 minute median) is not reachable on 6 free runners with 1,512 browser journeys of about 2,700 test-seconds; even a perfect split needs about 4 minutes of tests. The aim stays the direction; this spec reports the gap rather than hiding it.

## 3. The change

Two pull requests, because `build` says a CI workflow changes in a pull request with no product code and no tests, and lands first.

### 3.1 Unit W: the workflow (`.github/workflows/ci.yml` only, lane 3)

1. **No job waits but the gate.** `what changed`, `which screens changed` and `browser` go away. `verify`, `postgres` and the six pieces all start at once. The run is two hops: those jobs, then `gate`.
   - The docs-only test moves into one small script, `.github/scripts/docs-only.sh` (same rule as today: a pull request whose diff, with `--no-renames`, is all `.md` files; an empty diff, a push to `main` or any doubt is not docs-only). Each job runs it right after its checkout and skips its work when it says yes, as today.
   - The screens answer is worked out inside each piece, with the same steps the `which screens changed` job runs today (the decide step, then build change and base, then the picker), and the same rule that any doubt shoots every screen. **Call:** six pieces each building the base once costs about 30 s per piece, against a hop that costs 49 s at the median and up to 399 s; and `release` keeps a job that only takes pictures off the path to the required checks.
   - `gate` needs `verify`, `postgres` and `browser-shard` directly, and passes only when all three succeeded, or when the docs-only script said yes and every piece skipped its work. Its name, `gate`, and the draft name `gate (quick, draft)` stay, so branch protection (`gate`, `commit-authors`) is unchanged.
2. **Browsers in the image.** Each piece runs in `mcr.microsoft.com/playwright:v1.63.0-noble` pinned by digest (`sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`, the index for v1.63.0-noble, checked 2026-11-22), the same version `package.json` pins. `playwright install` goes away. Postgres stays a service container, reached by its service name inside the job container. Node still comes from `.nvmrc` through `setup-node`, and installs stay cached by `cache: pnpm`. **Call:** if the image's start takes longer than today's install at the median over the build's measuring runs, the build reports that with numbers and keeps the install, and only this item is dropped.
3. **Pieces filled by recorded times.** A piece reads `ci-test-times.json` (per file and device profile, the seconds `main` last recorded) from the Actions cache, restored by the prefix `ci-test-times-`, and passes it to the planner (unit T) through `RUKEN_SHARD_TIMES` and `RUKEN_SHARD=<n>/6`. Until unit T is on `main` (no planner file), or when no times are cached, it runs Playwright's own `--shard=<n>/6` as today.
4. **Recording the times.** A job `test-times`, on a push to `main` only, after the pieces and needed by nothing, reads the six pieces' JSON reports (each piece adds Playwright's `json` reporter to its run and uploads the file), sums seconds per file and device profile, and saves them to the cache under `ci-test-times-<sha>`.
5. **Every file ran.** Each piece uploads the list of (file, device profile) pairs it ran, and piece 1 also uploads the full list from `playwright test --list --reporter=json` with no shard. `gate`, on a full run, downloads them and fails when the union of the pieces' lists differs from the full list, naming each missing or doubled pair. On a draft (only the tests the change reaches) this check is skipped, as now nothing promises every file there.
6. Concurrency, cancel rules, `ready_for_review`, `RUN_EVERYTHING_WHEN`, `SHOOT_EVERYTHING_WHEN`, the quick-run rules, artifacts and timeouts stay as they are, except where 1 to 5 say otherwise.

### 3.2 Unit T: the planner (lane 2)

- `tests/browser/support/shard-plan.ts`: given the full list of (file, device profile) pairs, the recorded seconds (a pair with no time gets the median), and the number of pieces, it deals the pairs out longest first, each to the piece with the least time so far. Ties go to the lower piece number, so every piece computes the same plan.
- `playwright.config.ts`: when `RUKEN_SHARD` and `RUKEN_SHARD_TIMES` are set and the file is readable, each device profile's `testMatch` is the files the plan gives this piece for that profile; otherwise the config is as today. Unknown or unreadable input falls back to today's behavior, never to running fewer tests.
- `tests/browser/support/shard-plan.test.ts` (unit project): every pair lands in exactly one piece; the same input gives the same plan; a pair missing from the times still runs; the plan's slowest piece is within the largest single pair of the mean.

### 3.3 Not changed, and why

- Workers stay at 2 per piece: the four-core runner also runs two browsers' worth of pages, `wrangler dev` for the site and the game gate, and Postgres, and `playwright.config.ts` records answers taking over 5 s at today's load (run 44835171025). Raising it is a separate measured change.
- Six pieces stay (Settings in CLAUDE.md). More pieces mean more jobs against the 20-runner limit.
- Lint, typecheck and the unit and database tests are untouched: they are off the path to the result.

## 4. Acceptance criteria

- A1. On a ready pull request, the run's jobs are `verify`, `postgres`, `browser shard 1..6 of 6` and `gate` (plus `test-times` on `main`); none of the first eight lists a `needs`. Checked by reading the run's job list.
- A2. `gate` fails when any of `verify`, `postgres` or a piece fails or is cancelled. Checked by a run with a journey broken on purpose (a throwaway commit on the W branch, reverted), and its result reported.
- A3. A pull request that changes only `.md` files passes `gate` with no tests run, and one that changes a `.md` and a `.ts` file runs everything. Both checked by real runs.
- A4. The screens answer each piece logs is the same one today's `which screens changed` job gives for the same change: checked on one change that shoots all and one that shoots a subset (a one-page Svelte change).
- A5. No piece runs `playwright install`; each piece's container image is the pinned digest. Checked from the run log. (Or, per 3.1 item 2, the measured numbers that kept the install.)
- A6. On a full run, the union check passes, and it fails when a pair is left out on purpose (a throwaway commit, reverted).
- A7. After unit T: the six pieces' test times on a full run are within 1.15× of their mean, at the median over the measuring runs.
- A8. The outcome in section 2: full run p50 ≤ 8 min and p95 ≤ 12 min over at least 5 full runs with no other CI run in progress, with each run's id, measured by the same script as section 1. If not met, the gap is reported with numbers, never rounded.
- A9. The number of journeys run on a full run (sum over the pieces) equals the number before the change for the same commit of `tests/browser`: no test, device or engine is lost.

## 5. Plan

| Unit | Waits on | Owns | Output | Check | Lane |
|---|---|---|---|---|---|
| W | this spec merged | `.github/workflows/ci.yml`, `.github/scripts/docs-only.sh` | one PR | A1 to A6, A9 on real runs | 3 |
| T | W merged | `tests/browser/support/shard-plan.ts`, `tests/browser/support/shard-plan.test.ts`, `playwright.config.ts` | one PR | its unit test, A7, A8, A9 | 2 |

- Expected duration: W about 3 hours including measuring runs; T about 2 hours.
- Budget: GitHub's free runners only. No new dependency, service or secret. The Playwright image is Microsoft's public image of the version already pinned.
- Audits: W, plan audit (this spec) and implementation audit; T, one fresh review. Merge under the standing permission in `progress.md` (History, Standing permissions) once audits pass and CI is green.

## 6. Open product decisions

None. A heads-up for the owner, not a question: raising the open pull request limit to 6 puts more runs against the same 20 runners, so waits grow when many are open at once. W cuts a run from 13 jobs to 9, which helps.
