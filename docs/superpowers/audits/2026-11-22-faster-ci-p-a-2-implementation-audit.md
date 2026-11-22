# Implementation audit 2: faster CI unit P-a (PR #322)

- Examined: 1c1fa8e (`.github/scripts/ci-times.js` only; the fix since audit 1 is 9ecf1be, the rest are live-state commits).
- Against: audit 1 (`2026-11-22-faster-ci-p-a-1-implementation-audit.md`, 22b2784 FAIL, R1), spec `docs/superpowers/specs/2026-11-22-faster-ci-design.md` section 3.5, plan audit 9 note N8.
- Lane 3 (`.github/**`). Reviewer: Opus 5.5, medium. Graphify not used (a single standalone script with no callers in the repo).
- Verdict: **PASS, 0 red.** Notes N1 and N2.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was run

Data fetched 2026-11-22 14:17 UTC: every completed CI run created after 2026-11-22T07:57:54Z (38 runs) from `GET actions/workflows/ci.yml/runs?status=completed`, each run's `GET actions/runs/<id>/jobs?per_page=100`, and `GET actions/runs/<id>/attempts/1/jobs?per_page=100` for the three runs with `run_attempt` 2 (45002767457, 45001251809, 45028852127).

1. **R1 fixed.** `node ci-times.js <dir> 6 2026-11-22T07:57:54Z` at 1c1fa8e prints full runs' longest piece wait `45011227560:94 45010214545:41 45007516224:2 45006700371:2 45002767457:177 45001251809:2`, the six values spec 3.5 lists. Independently, the attempt-1 files give piece waits `64,30,171,152,170,177` (max 177) and `2,2,2,2,2,2` (max 2), every job `run_attempt` 1.
2. **Without the files.** The same command with the three `-attempt-1.json` files moved away prints `45002767457:re-run 45001251809:re-run`; the other four full values and all draft values are unchanged. Diffing the two outputs shows only that line.
3. **Nothing else moved.** `main`'s script against 1c1fa8e's on the same data, count 6 and count 10: the only differences are the two new wait lines and the two rows `browser shard n of 6` relabelled `browser shard n`; every count and number is identical. With count 10 the third re-run, 45028852127, shows 2, matching its first attempt.
4. **Header** names the attempt-1 fetch (lines 9 and 10). The printed label is now `run:seconds` (audit 1 N2 taken up).
5. `pnpm exec eslint .github/scripts/ci-times.js` exit 0; `pnpm exec prettier --check` passes. CI on 1c1fa8e was still running when checked (draft pieces queued); this audit does not cover its result.

## Red

None.

## Notes (not blocking, not fixed here)

- N1. A re-run whose first attempt has no started browser piece prints nothing for that run (same as a first-attempt run with none), so the line can hold fewer ids than "run ids". Fine for A8's use; say so in the header if it ever confuses a reader.
- N2. Carried over from audit 1: N1 (negative per-job waits on re-runs in the `wait` column) and N3 (tick the spec's P-a line on merge) are still open follow-ups.
