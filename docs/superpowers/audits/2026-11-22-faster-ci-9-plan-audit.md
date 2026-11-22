# Faster CI spec, section 3.5 (unit P, twelve browser pieces): plan audit 9

- Examined: 3a801cb (draft PR #316 head), against plan audit 8 at 42b75f1 (`2026-11-22-faster-ci-8-plan-audit.md`, FAIL, 1 red).
- Lane 3 plan audit, recheck. Reviewer: Opus 5.5, medium. Written 2026-11-22 14:04 UTC.
- Verdict: **PASS, 0 red.** Notes N5 to N8 below.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What changed since audit 8

`git diff f0e23f0 3a801cb` touches one file, `docs/superpowers/specs/2026-11-22-faster-ci-design.md`, 5 lines in, 4 out, all in 3.5. Commits: 8128f6c (live state), 22dee52 (the fix), 3a801cb (live state removed; no `docs/superpowers/live/` file is left). Nothing else in the spec, code or rules moved.

- The estimate's heading now reads "with every piece starting at once".
- The replay bullet ("which matches what happened") and the "If about 4 in 10…" bullet are gone.
- Three new bullets: the measured waits at six pieces; the six quiet runs' waits and that 7.0 to 7.3 min holds only when pieces start at once; that A8's p50 may be missed when GitHub is busy, twelve stays, and gaps are reported with each run's longest piece wait.
- The P-b line for A7 and A8 now lists each run's longest piece wait.

## Audit 8 R1, rechecked: fixed

Every point of R1's EXPECTED is in 3.5: the measured waits with window, method and source; "the 7.0 to 7.3 min for twelve pieces is for a run whose pieces start at once, as 16 of 93 did"; "at busy times the wait, not the pieces, sets the run's time … the 8-minute p50 (A8) may be missed when GitHub is busy". The call stays twelve with its reason. The figures are audit 8's, which R1's FIX allowed.

Checked against the jobs API again, independently:

- The six quiet runs, first attempt, longest wait of any `browser shard` job from created to started: 45001251809 2 s, 45002767457 177 s, 45006700371 2 s, 45007516224 2 s, 45010214545 41 s, 45011227560 94 s. All six match the spec.
- 44992933874: created 06:15:48, last piece started 06:29:43 (wait 835 s). Matches, except the first piece start (N5).
- A recount of every CI run created 2026-11-21T20:00Z to 2026-11-22T13:45Z (226 runs, first attempts, a run is full when it has a job named `gate`, pieces with a runner): 109 full runs; longest piece wait p50 261 s, p75 383 s, p90 536 s, max 1,112 s; 91 over 60 s, 69 over 180 s, 18 all within a minute; 02:00 to 07:59 UTC 66 runs, 52 over 200 s. Success and failure runs only: 92 full runs, p50 261, p75 380, p90 519, max 1,112, 14 all within a minute. The max, p75 and busy-hours counts match the spec exactly; p50 and p90 differ by method (N6). Either way most full runs waited minutes and only about one in six started every piece within a minute, which is what the spec now says, so no call changes.

## Rest of 3.5 and the spec, rechecked

- The estimate table, the twelve-piece call, the drafts note and P-a/P-b are unchanged since audit 8 and still hold (audit 8, "Audit 7 findings, rechecked" and "Checked and fine").
- Section 4's A8 (line 196) still says "after T merges, by `ci-times.mjs`"; 3.5's P-b line measures it again after P-b merges by `ci-times.js`. That was so at audit 8 and is consistent: the P-b line is an extra measure, not a new definition.
- No other line of the spec still claims pieces start at once or never wait.

## Notes (recorded, not blocking)

- N5. Example run 44992933874: "pieces started 06:24:32 to 06:29:43" should be 06:23:15 to 06:29:43 (`browser shard 3 of 6` started 06:23:15). The error was in audit 8's evidence and was copied. Fix in 3.5 when next touched.
- N6. The wait figures cite audit 8's method by name but not its run filter. A recount by the stated rules gives p50 261 and p90 519 to 536 s, not 257 and 586. Say which full runs count (for example "first attempts of runs with a `gate` job, any conclusion") so A8's report can repeat it.
- N7. "this repository never reached 20" (new bullet) and "never reached 20" (bullet above, unchanged): CI first attempts alone reach 20 running jobs at 03:09:58Z, for about 11 s, as audit 8 also measured. It does not change the point (the waits happen while the repository has 1 to 18 running), but say "reached 20 once, for about 11 s" instead of "never".
- N8. The P-b line asks A8's report to list each run's longest piece wait, but `ci-times.js` prints wait percentiles per job and the run ids, not a per-run longest wait. It can be read from the same `jobs/<run id>.json` files; P-a can add that line, or the report can compute it from those files. Either way, name which.
- Audit 8's N1 to N4 stand as recorded.
