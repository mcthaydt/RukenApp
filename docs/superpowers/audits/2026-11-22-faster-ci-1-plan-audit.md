# Plan audit 1: faster CI

**636c072 FAIL: 3 red**

- Spec: `docs/superpowers/specs/2026-11-22-faster-ci-design.md` at 636c072 (branch `claude/project-thread-g0gcfn`, no pull request yet).
- Audited 2026-11-22 01:31 UTC by a fresh session (Opus 5.5, medium), against `release` "Fast CI", "Making CI fast" and "Docs only", `build` (Tests, "A change does not quietly edit its own check"), and CLAUDE.md.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What I checked and it holds

- **No test, device or engine dropped.** Six pieces, 2 workers, the three projects in `playwright.config.ts:145-148`, unit and database tests all stay. A9 counts journeys before and after. Holds.
- **No retries, sleeps or wider timeouts.** None added; `retries: 0` stays (`playwright.config.ts:18`). Holds.
- **Required check names.** `gate` and `gate (quick, draft)` keep their names (ci.yml:417), so branch protection is unchanged. Holds.
- **Only the gate waits.** Item 3.1.1 removes `what changed`, `which screens changed` and `browser`; the eight jobs left have no `needs`. Matches "no required check waits on another". Holds (but see R1).
- **Image digest.** `mcr.microsoft.com/v2/playwright/manifests/v1.63.0-noble` answers `docker-content-digest: sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27` (checked 01:30 UTC), the digest in the spec. `package.json` pins `@playwright/test` 1.63.0. Holds.
- **Cited run 44970082873.** Created 01:09:13, `what changed` started 01:10:12 (59 s), `which screens changed` started 01:11:16, 57 s after `what changed` ended. `pnpm build` took 12 s in `verify`, so two builds per piece at about 30 s is plausible. Holds.
- **Full run p50 14.1 min.** My recount over the same window gives 14.1 min too (but see R3 for p95 and the split).
- **Shard planner.** Greedy longest-first gives a slowest piece at most the mean plus the largest pair, so the T test ("within the largest single pair of the mean") is a true property. Falls back to `--shard` with no times; the union check catches any loss. Holds.
- **Lanes and split.** W touches only `.github/` (lane 3, plan audit and implementation audit), T touches `tests/browser/support/` and `playwright.config.ts` (lane 2, one review). W lands first, with no product code and no tests, as `build` asks. Holds.
- **CRUD.** The change adds nothing a user can make. Not applicable.

## Red

### R1. The docs-only gate rule cannot be built as written, and the deciding job is gone

- **What is wrong.** Item 3.1.1 drops `what changed` and has every job run `docs-only.sh` and skip its work. `gate` then "passes only when all three succeeded, or when the docs-only script said yes and every piece skipped its work". `gate` has no way to see either part of the second clause: a job whose steps are skipped by an `if` still reports `success`, and a matrix job has one result and no per-piece outputs. So in practice the gate is "all succeeded", and on a docs-only pull request it passes on each job's own unchecked say-so.
- **Evidence.** `release`, Docs only: "a job skipped by a condition can report success without proving anything ... Its first job decides from the diff which checks apply, and one final aggregate gate job ... passes only when every applicable check ran and passed and every other check was marked not applicable by that first job." Today the `browser` job reads `needs.changes.outputs.docs_only` (ci.yml:391-401); the spec removes both the job that decides and the one that reads it.
- **Expected.** One named authority decides docs-only, and `gate` reads that authority, not the jobs' own results, before it lets skipped work count.
- **Bounded fix (spec text only).** Say that `gate` itself checks out with full history and runs `docs-only.sh` (a few seconds, and it is the job that already waits), or keep `what changed` as a job that only `gate` needs. Then: if docs-only, `gate` passes when no job failed or was cancelled; if not docs-only, `gate` needs all three to succeed and, on a full run, the union check (item 5) proves the pieces really ran. Add to A3: on the `.md` plus `.ts` change, the gate log shows the docs-only answer "no" and the union check passing.

### R2. "A draft's quick run is no slower than today" has no check, and the plan can make drafts slower

- **What is wrong.** Section 2 promises it, but A8 measures only full runs, and no criterion covers drafts. Item 3.1.1 moves the base and change builds into all six pieces without saying whether a piece whose "Pick the journeys" step finds nothing (ci.yml:328-347, `run=false`) still does them. If it does, every draft pays six double builds that today one side job pays.
- **Evidence.** Spec section 2 and A1 to A9 (no draft measure). Today's `screens` job runs on drafts too (ci.yml:203-205).
- **Expected.** Every promise in the outcome has a criterion a program or person can observe.
- **Bounded fix.** State that a piece picks its journeys first and runs the screens steps only when `run=true`. Add a criterion: draft run p50 and p95 over at least 5 draft runs after the change, against today's draft numbers, by the same script as A8.

### R3. The baseline is not reproducible and is not the audit `release` asks for

- **What is wrong.** A8 says "measured by the same script as section 1", but the spec neither includes nor names that script. Recounting the same window (2026-11-21 13:00 to 2026-11-22 01:20 UTC, 60 non-cancelled runs), with "full" meaning the run has a job named exactly `gate`, I get 49 full and 11 draft runs, full p50 14.1 min and **p95 30.5 min**, against the spec's 42 and 18 and **26.9 min**. The difference is how "full" and the percentile are defined, which the spec does not say, so A8's pass or fail depends on an unstated choice. `release` also asks for "the last 150 runs, every job split into waiting, setup and running, at p50 and p95"; the spec uses 60 and reports only selected buckets.
- **Evidence.** `gh api repos/mcthaydt/RukenApp/actions/workflows/ci.yml/runs` and `.../runs/<id>/jobs`, duration = last job's `completed_at` minus the run's `created_at`, nearest-rank percentiles.
- **Expected.** The yardstick for A8 is a committed program with its rules written down, and the baseline follows `release`'s audit.
- **Bounded fix.** Commit the measuring script (say `.github/scripts/ci-times.sh` in W, or as a block in the spec), stating how a run is classed full or draft, what start and end are, and the percentile method. Rerun it over the last 150 finished runs, with each job's wait, setup and run at p50 and p95, and put those numbers in section 1. A8 and the new draft criterion use it.

## Notes (not blocking)

- **N1. The container changes more than setup time.** Journeys open `g-….localhost:8788` and `media.localhost` addresses in the browser (`tests/browser/play.test.ts:347`, `tests/browser/edit-page.test.ts:54`), and the phone profile is WebKit. On the runner, name lookup goes through the host's resolver; in a job container it goes through Docker's. Say that the fallback in 3.1.2 (keep the install) also applies when any journey behaves differently in the container, and that no journey or timeout is changed to fit the container.
- **N2. Keep the HTML report.** Adding the JSON reporter on the command line (`--reporter=json`) replaces the config's `list` and `html` reporters, and the HTML report carries the look's screenshots the owner reads (ci.yml:369-376). Say to add it as `--reporter=list,html,json` with `PLAYWRIGHT_JSON_OUTPUT_NAME`, or in the config.
- **N3. "Pairs it ran" comes from the run, not the plan.** For item 5 to prove anything, each piece's list must come from its JSON report of what ran, not from `--list` with its own arguments. And when `RUKEN_SHARD` is set, `--shard` must not also be passed. A6 would catch both; saying so saves a round.
- **N4. Where the planner's full list comes from.** The config cannot call `playwright test --list` on itself. Say that it lists `testDir` with the same match rule, sorted, so all six pieces deal the same plan whatever order the disk returns.
- **N5. Picture work on the path.** The spec cites `release` ("a slow job that only takes pictures stays off the path") as the reason for moving the screens builds into the pieces, which puts them on the path to `gate`. It is still a gain over today's extra hop, and about 25 s by the 12 s build measured above, but the reason should say that. The piece's web server builds the change again anyway (`playwright.config.ts:72`), so only the base build is new work.
- **N6. Job count.** Run 44970082873 has 12 jobs, not 13 (`commit-authors` is its own workflow). After W it is 9, or 10 on `main`.
- **N7. `test-times`.** With a plain `needs`, it is skipped when a piece fails on `main`, which is right (no times from a broken run). Saying so keeps a builder from adding `always()`.

## Verdict

636c072 FAIL: 3 red. All three are spec text; R3 also needs one script run. A recheck needs only the changed sections and the script's output.
