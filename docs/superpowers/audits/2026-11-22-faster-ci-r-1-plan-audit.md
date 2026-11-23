# Plan audit 1: faster CI unit R, back to six pieces (spec 3.6)

Examined: `b166e8c` on `claude/project-thread-g0gcfn` (spec `docs/superpowers/specs/2026-11-22-faster-ci-design.md`, section 3.6 and the unit table). Auditor: Opus 5.5, medium. Lane 3.

**Verdict: FAIL, 1 red, 4 notes.** The revert plan itself is right and complete; the recorded reason overstates what the numbers show.

## What was checked, and how

| Check | Result | Evidence |
| --- | --- | --- |
| Restoring `ci.yml` exactly as at `5bbea3e` loses nothing | holds | `git log --first-parent 5bbea3e..origin/main -- .github/workflows/ci.yml` lists only `41d5610` (#326, P-b). `git log --no-merges 5bbea3e..origin/main -- .github/` lists P-b plus two deploy commits that touch only `.github/scripts/deploy-target.sh` and `live-check.sh`. `git diff 5bbea3e 744b093^ -- ci.yml` is empty, so `5bbea3e` is exactly the pre-P-b file. |
| `git diff 5bbea3e -- ci.yml` printing nothing is a sound check | holds | Same as above: no later change to `ci.yml` would be lost by it. |
| The `5bbea3e` file gives what R1 and R2 expect | holds | It names `browser shard <n> of 6` (plus " (quick, draft)" on a draft), `--shard=<n>/6`, `RUKEN_SHARD=<n>/6`, six restores, and prints "joined 6 of 6 pieces". |
| `CLAUDE.md` Settings "6" | holds | `git show 5bbea3e:CLAUDE.md` line 82 reads "Browser test pieces in CI: 6."; the plan's text matches. |
| `this-repo` line 33 | holds | The plan changes only the piece names, not back to `5bbea3e`'s line 33, which was already stale ("summed up by `browser`", gone since W). Right call. |
| `ci-times.js` stays | holds | It groups `browser shard n of m` for any m (lines 65, 87). |
| Anything else P-b touched | none left | #326's merge diff: `ci.yml`, `CLAUDE.md`, `this-repo`, the spec, its audit. `git grep` for twelve / "of 12" / `PIECES` / "/12" in `tests/`, `.claude/hooks/`, `.github/scripts/`, `progress.md`: no CI dependency on 12. Required checks on `main` are `gate` and `commit-authors` only (`gh api .../required_status_checks`), so no protected check names a piece 7 to 12. |
| P1 to P4 ticked with runs | holds | P1 run 45037272045, P2 run 45036197399, P3 `41d5610`, P4 grouping, as the P-b audit and this re-measure show. |
| R row in the unit table, audits, duration | holds | Row R, "R about 1 hour", "R, a plan audit of section 3.6 and an implementation audit". |
| CRUD | not reached | CI config only; nothing a user makes. |
| Numbers in the 3.6 table | reproduced | Fetched 116 finished runs (07:00 to 18:30 UTC) and their jobs (plus attempt-1 jobs of re-runs) with `gh api`, ran `node .github/scripts/ci-times.js <dir> 10 2026-11-22T16:41:19Z` and `... 10 2026-11-22T08:05:00Z`: full p50/p95 17.5/26.8 vs 10.6/24.5 min, piece wait 271/786 vs 2/104 s, piece work 246/311 vs 394/480 s, drafts 7.2/9.9 min, and the same ten run:wait pairs. |

## Findings

### R1 (red): the reason credits the slowdown to twelve pieces, but the same-window numbers show the account was far busier

- UNIT: spec section 3.6, "Why", the paragraph after the run list.
- VERDICT: red.
- REQUIREMENT: the brief for this audit ("records numbers and reasons"); CLAUDE.md "Report honestly … Never round up"; A8's "the gap is reported with numbers".
- REASON: "Six pieces held a p50 wait of 2 s over the same day" compares 08:06–14:05 UTC runs with 16:41–17:52 UTC runs. In the twelve-piece window, jobs whose count did not change also waited far longer, so most of the wait is load, not the piece count.
- EVIDENCE: `ci-times.js` output for the two windows (same data as the table):
  - `verify` wait p50: 1 s before, 90 s after. `postgres`: 1 s before, 100 s after. Neither changed with P-b.
  - Draft runs kept six pieces after P-b, yet their piece wait p50 went from 2 s to 87 s (p95 194 s to 293 s), and draft runs went from p50 3.9 to 7.2 min.
  - In the same window, twelve full pieces waited p50 271 s against 87 s for six draft pieces, so more pieces does add wait, but only part of it.
- EXPECTED: 3.6 says both: the account was much busier in the twelve-piece window (the three numbers above), and twelve pieces still waited about three times longer than six draft pieces in that window. Going back to six is expected to cut the wait, not to restore 10.6 min while the account stays this busy. Drop or qualify "over the same day".
- FIX: text only, in `docs/superpowers/specs/2026-11-22-faster-ci-design.md` section 3.6 "Why" (one row or two sentences). No other file.

## Notes (not blocking, not fixed here)

- N1. A7 recount: the slowest piece's "Run the journeys" step over the mean, from the jobs API, is 1.17 to 1.31, median 1.22, over 9 runs (45045644992 is docs-only and ran no journeys). The spec says 1.16 to 1.30, median 1.21, without saying how many runs. Either is "not met"; state the run count and the method.
- N2. The six-piece "before" column includes two docs-only full runs (45030951625 at 4.7 min, 45028707908 at 1.2 min) and four re-runs. "The four plain first-attempt full runs took 8.8, 9.5, 10.6 and 10.9 min" is right (measured the same) but silently leaves the docs-only two out; say so. The twelve-piece column has one docs-only run too (45045644992, its listed wait of 377 s is real).
- N3. Measure the choice: R1/R2 only prove six pieces run. Consider listing the first 10 full runs after R by `ci-times.js` since R's merge commit, as P-b did, so the A8 gap stays reported with numbers and the back-to-six decision is checked against the same kind of evidence.
- N4. 3.5's follow-up ("`shard-plan.ts` line 1 says six") becomes moot once R merges; 3.6 could say so. Graphify's index of RukenApp is at `532a3aa` (before W), so this audit used `git grep` instead.
