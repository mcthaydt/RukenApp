# Implementation audit 1: faster CI, the measuring program

**8cd363e PASS**

- Change: PR #299, branch `claude/project-thread-946eq8`, head 8cd363e. It adds `.github/scripts/ci-times.js` (89 lines) and nothing else, net of main. Checked against `docs/superpowers/specs/2026-11-22-faster-ci-design.md` section 3.1 item 6, its appendix, plan audit 2's note N9 (a start time for "the first 10 runs after a merge"), and `release` "Making CI fast" (the last 150 runs, each job's waiting, setup and running time at p50 and p95).
- Audited 2026-11-22 03:08 UTC by the session that audited unit W (Opus 5.5, medium). Lane 3 (`.github/`).
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was checked, and how

- **Same answers as the spec's appendix, by running both.** I fetched the 4 newest pages of completed `ci.yml` runs with plain `gh api` (250 runs that ended in success or failure, back to 2026-11-20T03:41:55Z) and the jobs of each one. I ran the appendix program, taken from the spec as written, and `ci-times.js` from 8cd363e on the same files, three ways: the spec's 150-run window (runs created up to 01:22 UTC), the spec's 60-run window, and all 250 runs. All three outputs are byte for byte the same (`diff` empty).
- **The spec's numbers reproduce.** 150 runs: 2026-11-21T01:23:59Z to 2026-11-22T01:21:41Z, full 84, draft 66; full p50 11.0, p95 26.6 min; draft 3.1 / 16.0; every row of both job tables in section 1. 60 runs: full 49, draft 11; full 14.1 / 30.5; draft 5.7 / 31.3.
- **`[since]` (N9).** With `3 2026-11-22T00:00:00Z` it takes 6 runs and lists their ids. Full runs: 44965757525, 44966924867 and 44968868276. Draft runs: 44971096022, 44973784013 and 44976297198. A separate program that takes the first 3 of each kind created after that time picks the same runs. The runs are counted the same way as without `[since]` (success or failure only, kind from the gate's name). A start time with no runs after it gives 0 runs and NaN, not a crash.
- **`.js`, not `.mjs`.** `package.json` has `"type": "module"`, so Node loads the file as a module. The PR's draft run passed `verify (quick, draft)`, which runs `pnpm lint` and `pnpm typecheck`.
- **Scope.** One file in `.github/scripts/`. No workflow, test or product file changed. CRUD does not apply.
- **Fits unit W.** The setup steps list already covers W's new `Initialize containers` and `Run pnpm install --frozen-lockfile`. W's step "Only .md files changed?" runs between checkout and the install, so it falls inside setup, and W's "Fetch main's test times" after the install falls in run. Both take about a second, so neither moves A8 or A10.

## Red

None.

## Notes (not blocking)

- **N1. A start time that is not a date passes silently.** `notadate` gives `Date.parse` NaN, so no run is taken, and the output looks the same as "no runs yet" (0 runs, NaN). Exiting with an error when `[since]` does not parse would stop a mistyped A8 or A10 check from being read as empty.
- **N2. The fetch steps are not in the file.** The spec's appendix names the two `gh api` calls, and the header comment names only the endpoints. Copying the two commands into the header would make the file usable without the spec.
