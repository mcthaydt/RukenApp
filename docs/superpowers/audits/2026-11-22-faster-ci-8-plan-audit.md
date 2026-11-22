# Faster CI spec, section 3.5 (unit P, twelve browser pieces): plan audit 8

- Examined: 42b75f1 (draft PR #316 head), against plan audit 7 at 8283b0e (`2026-11-22-faster-ci-7-plan-audit.md`, FAIL, 5 red).
- Lane 3 plan audit, recheck. Reviewer: Opus 5.5, medium. Written 2026-11-22 13:57 UTC.
- Verdict: **FAIL, 1 red.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

Four of the five reds are fixed and the drafts note is handled well. What is left is one measured claim in the new "Running at the same time" paragraph: the jobs API shows that full runs already wait minutes for a runner at six pieces, which the spec says did not happen.

## Audit 7 findings, rechecked

- **R1, fixed.** 3.4 is whole again: item 2's last bullet ("Each piece adds its chosen key…"), then 3.4's own Acceptance with F1 and F2, then "### 3.5 Unit P". 3.5 ends just before "## 4. Acceptance criteria".
- **R2, fixed.** P is split into P-a (`.github/scripts/ci-times.js` alone) and P-b (`ci.yml`, `CLAUDE.md`, `.claude/skills/this-repo/SKILL.md`), in 3.5 and in the section 5 table. Checked against `.claude/hooks/rules.json` `ruleMix`: P-a has no rule path, so it passes; in P-b, `ci.yml` and `CLAUDE.md` are rule paths and `.claude/skills/this-repo/SKILL.md` is a doc path (`.claude/**`), so the mix is allowed.
- **R3, fixed.** The per-piece table matches the jobs API on every run: sums 2,329, 2,156, 2,139, 2,251, 2,529, 2,299 s and slowest ÷ mean 1.10, 1.14, 1.21, 1.11, 1.12, 1.22 (last attempt of each run, "Run the journeys" step). The model is recomputed and holds: (1,935 + 60N)/N gives 383, 302, 254, 221 s at 6, 8, 10, 12; × 1.13 to 1.22 plus 168 s gives 7.6 to 8.0 min at 10 and 7.0 to 7.3 min at 12. At 12 the largest pair (174 s) is above the packed share per piece (161 s), but 174 + 60 = 234 s stays under the 250 s low end, so the range holds. See N1 and N2.
- **R4, partly fixed; see R1 below.** The limit is now stated per account, with its source, and overlap is counted. The count matches mine in kind (I get 89 of 102 full-run attempts overlapping another, and a peak of 20 running jobs for 11 s at 03:09:58 once copied re-run jobs are counted once; the spec says 83 of 96 and 19). But the conclusion drawn from it does not hold.
- **R5, fixed.** P-a and P-b are `- [ ]` lines, one per step and check, so progress is a count of ticks. Every place the count appears in `ci.yml` today is covered: matrix (258), job name (241), the three `/6` in "Pick the journeys" (380, 382, 387), the restore steps and "Join the six" (577), and the comments (9, 15, 238, 297, 300, 371, 482, 537).
- **Drafts note, handled.** Drafts keep six by `github.event.pull_request.draft`, the same test `ci.yml` already uses for `CHANGED_ONLY` (line 60) and the job names. On a push to `main` there is no `pull_request`, so the expression gives twelve, which is what `test-times` expects. The required checks on `main` are `gate` and `commit-authors` (branch protection API), so renaming the pieces does not touch them. P2 checks the draft case and A10 is re-measured.
- **Audit 7 notes:** N1 (label "of 6") is in P-a's line; N3 (`this-repo` line 33) is in P-b; N4 (A7 "six") is fixed and `shard-plan.ts` line 1 is recorded as a follow-up.

## Red findings

### R1. Full runs already wait minutes for a runner at six pieces; the spec says they did not

- UNIT: spec 3.5, "Running at the same time as other runs", second and third bullets.
- REQUIREMENT: Report honestly ("timings … are measured"); CLAUDE.md Settings, Pull requests open ("as many as the CI capacity takes without queueing (measured, not guessed)"); audit 7 R4, EXPECTED ("says what p50 that gives … or says plainly that A8 may be missed under load").
- REASON: the spec counts running jobs against 20 and concludes that at six pieces "0 of 45 full runs [were] over 20 jobs …, which matches what happened", then that the p50 "is set by the ones that do not [wait] (7.0 to 7.3 min)". What happened is that most full runs waited for a runner even though this repository's running jobs stayed well under 20.
- EVIDENCE: jobs API, every CI, `commit-authors` and `pr-rules` run created 2026-11-21T20:00Z to 2026-11-22T13:45Z (772 runs), re-run copies counted once. For each full run's first attempt, the longest wait of any browser piece from job created to job started:
  - 93 full runs: p50 257 s, p75 383 s, p90 586 s, max 1,112 s. 77 of 93 waited over 60 s; 56 of 93 over 180 s. Only 16 of 93 had every piece start within a minute.
  - Busy hours wait most: 02:00 to 07:59 UTC, 66 runs, 52 of them over 200 s (for example 44992933874, created 06:15:48, pieces started 06:24:32 to 06:29:43). The six quiet runs the estimate uses waited 2 to 177 s (45001251809: 2, 45002767457: 177, 45006700371: 2, 45007516224: 2, 45010214545: 41, 45011227560: 94).
  - During those waits this repository had 1 to 18 jobs running (median about 8 across 351 piece waits over 2 minutes), never 20. So the waits are not this repository reaching its share of 20; they come from the rest of the account's use, or from GitHub's own runner start-up at busy times. The jobs API cannot tell which. Either way, a run's end is the latest piece's start plus its work, so twice the pieces is twice the chances of a late start.
  - `ci-times.js` already reports this as the "wait" column per job (line 72), so it can be checked the same way.
- EXPECTED: the paragraph states the measured runner waits at six pieces, says that the 7.0 to 7.3 min estimate is for a run whose pieces start at once (16 of 93 in the window), and says plainly that at busy times the wait, not the pieces, sets the time, so A8's p50 may be missed under load whatever the count. The call can stay twelve: the owner allowed more free runners, and A8 is measured and reported with numbers either way.
- FIX: in 3.5 only, replace the replay bullet's "which matches what happened" and the "If about 4 in 10…" bullet with the measured waits above (or the builder's own re-measure by the same method, with run ids and the window), and the plain statement. Spec only.

## Notes (recorded, not blocking)

- N1. The per-piece table's "Pieces 1 to 6" are not in piece order: by job name, 45001251809 is 393, 373, 428, 361, 399, 375 (the spec lists 399, 375, 393, 373, 361, 428). Sums and ratios are right; either sort by piece or call the column "Pieces".
- N2. The 1,935 s of packed work is from 45011227560 alone, while step sums run from 2,139 to 2,529 s. On the heaviest run (2,529 s) the same model at 12 gives about 7.6 min with the 1.22 ratio, still under 8, so the call does not change.
- N3. The replay bullet counts "45 full runs" while the bullet above counts "96 full-run attempts" over the same window; say which runs the 45 are.
- N4. "14 or more were running for 34 min and 18 or more for 3.6 min": I get about 61 and 11 min (CI only) with re-run copies counted once. It does not change any call; give the method if it stays.

## Checked and fine

- P-a alone is lane 3 by `.github/**` and its regex `shard \d+ of \d+` also matches today's names, so it can merge first.
- The matrix and `PIECES` expressions are valid: `false && 6 || 12` is 12 and `true && 6 || 12` is 6; `fromJSON` of the string gives the list.
- `test-times` runs only on a push to `main`, which always gets twelve, so twelve restore steps are right.
- The gate counts whatever `ran-*` artifacts it gets and needs no change.
- Budget and scope: free hosted runners only, no new action, tool or secret; the owner's 13:39 UTC words cover more runners.
