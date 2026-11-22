# Implementation audit 1: faster CI unit P-a (PR #322)

- Examined: 22b2784 (`.github/scripts/ci-times.js` only; `git diff origin/main...22b2784` is 1 file, 14 in, 3 out).
- Against: spec `docs/superpowers/specs/2026-11-22-faster-ci-design.md` section 3.5, P-a checklist line, and plan audit 9 note N8.
- Lane 3 (`.github/**`). Reviewer: Opus 5.5, medium. Graphify not used (a single standalone script, no callers in the repo).
- Verdict: **FAIL, 1 red.** Notes N1 to N3.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was run

Data: every completed CI run created after 2026-11-22T07:57:54Z (35 runs), `runs-*.json` from `GET actions/workflows/ci.yml/runs?status=completed` and `jobs/<id>.json` from `GET actions/runs/<id>/jobs?per_page=100`, fetched 2026-11-22 14:13 UTC.

1. `node ci-times.js <dir> 6 2026-11-22T07:57:54Z`, `main`'s copy against 22b2784's. The diff of the two outputs is exactly: two new lines after "run ids", and the two rows `browser shard n of 6` relabelled `browser shard n`. Every number is the same (full p50 10.6 p95 24.5; draft p50 6.0 p95 9.8; both piece rows 36 jobs with the same wait, setup and run). The six full run ids are the spec's six. **Checklist line passes.**
2. A made-up run set: two 12-piece full runs, one 6-piece full run, one 6-piece draft run named `browser shard <i> of 6 (quick, draft)`. New: one `full: browser shard n` row of 30 jobs and one `draft: browser shard n` row of 6; longest waits 300, 120, 1 and 10 s, by run id, as built. `main`'s copy splits the 12-piece jobs into `browser shard 1 of 12` ... `12 of 12` rows. **P4 will hold.**
3. Regex edges: `/shard \d+ of \d+/` is applied after ` (quick, draft)` is removed, so drafts group too; two-digit numbers on both sides match; it is unanchored, but no other CI job name contains "shard". The per-run filter `^browser shard \d+ of \d+` is start-anchored and matches draft names (the suffix comes after). A run with no started piece is skipped by `if (pieces.length)`, so `Math.max()` of nothing never prints `-Infinity`.
4. Backward compatibility: output lines before and after are unchanged apart from the row label the spec asks to change; the new lines print only with `[since]`; the per-job `wait` column still uses the job's `created_at` (spec section 1). No file in the repo reads this script's output (`grep -rn "ci-times\|shard n of"` finds only the script and the spec).

## Red

**R1.** UNIT: `.github/scripts/ci-times.js`, the new "longest piece wait" line (lines 75 to 78 at 22b2784). VERDICT: red. REQUIREMENT: spec 3.5, "each run's id and its longest piece wait listed" so "the two causes can be told apart" (A8 report), measured as in 3.5 "for each full run's first attempt, the longest wait of any piece from job created to job started"; the spec lists the six runs' values. REASON: on a re-run, the jobs API returns the latest attempt, whose carried-over pieces have the new attempt's `created_at` but the first attempt's `started_at`, so the listed number is neither attempt's wait. EVIDENCE: the script prints `45002767457:15` and `45001251809:9`; the spec says 177 and 2. Both are `run_attempt` 2. Their piece waits from the latest-attempt file are `14,15,-867,-725,-744,-732` and `8,9,-573,-578,-579,-582`; `GET actions/runs/45001251809/attempts/1/jobs` gives a longest wait of 2, as the spec says. A third re-run after the window, 45028852127, has `2,-572,-577,-580,-580,-581`. Meanwhile the same runs' times are counted from the first attempt's `created_at` (24.5 min p95 comes from such a run), so the line pairs a long run with a short wait and points the reader at the wrong cause, which is what the line exists to tell apart. EXPECTED: for a run whose `run_attempt` is over 1, the line shows the first attempt's longest piece wait, or says plainly that it is a re-run instead of a number. FIX: in `ci-times.js` only, either (a) read `jobs/<id>-attempt-1.json` (from `GET actions/runs/<id>/attempts/1/jobs?per_page=100`) for runs with `run_attempt > 1`, and name that fetch in the header comment, or (b) print `<id>:re-run` for them. Checked by re-running item 1: 45002767457 shows 177 (a) or `re-run` (b), 45001251809 shows 2 or `re-run`, the other four unchanged, and every other line still identical to `main`'s.

## Notes (not blocking, not fixed here)

- N1. Pre-existing, not this change: carried-over jobs on re-runs also put negative waits (down to -867 s) into the per-job `wait` column and its p50. The fix for R1 does not need to touch it; a follow-up can skip jobs whose `started_at` is before their `created_at`.
- N2. The header says "longest browser-piece wait" but the printed label is "longest piece wait, run:s"; the unit is seconds. Fine as is; "run:seconds" would read more plainly.
- N3. The spec's P-a checklist line (3.5) is still unticked on `main`; the builder or coordinator ticks it when P-a merges.
