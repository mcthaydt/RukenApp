# Journey recording (#315), implementation audit 2

Reviewed commit: `5ee6fde` (branch `claude/project-thread-8e4lco`). The code is unchanged since round 1 at `ebb549c`: `5ee6fde` only adds round 1's audit file. The fixes for round 1's two reds are in the pull request body, read at 09:58 UTC on 2026-11-22. Base: `main` at `6410353`.
Lane 2 (`playwright.config.ts`). Reviewer: Opus 5.5, medium, a fresh session.

**Verdict: PASS.** Both reds from round 1 are fixed, and the cost of recording is measured and acceptable.

## Round 1's reds

| Red | Result | Evidence |
|---|---|---|
| 1. Body names the `loading.test.ts` change and why; criterion 5 lists every file | FIXED | The body's "What changes" names `tests/browser/loading.test.ts:64`, the change (`expect.poll(() => held.requestsSoFar()).toBe(1)`) and why: the page's console words and the held route's count reach the journey as separate messages, in either order, and the first CI run (`51f8bab`) failed `loading.test.ts:27` [phone] with the count still 0. Criterion 5 lists the four files plus the audit file. `git diff --stat origin/main...5ee6fde` lists exactly those five. |
| 2. Cost of recording every journey measured in CI | FIXED | Every number in the body's cost table was checked against the GitHub API and the job logs (below). |

## Cost check

Both runs ran every journey: `playwright.config.ts` matches `RUN_EVERYTHING_WHEN` (`.github/workflows/ci.yml:63`), so the draft run at `ebb549c` did not narrow to changed journeys. The draft run's gate skips "The pieces ran every journey exactly once", so the counts were summed from the pieces' logs instead.

| | #314, run 45006700371 at `f9c88d7` (trace off) | #315, run 45009125642 at `ebb549c` (recording on) |
|---|---|---|
| Journeys run (sum of "Running N tests") | 1,818 | 1,818 |
| Passed / skipped | 1,674 / 144 | 1,674 / 144 |
| Playwright minutes, summed | 35.1 | 38.0 |
| Browser job time, summed (`started_at` to `completed_at`) | 42:33 | 46:02 (+3:29, +8.2%) |
| Slowest piece | 8:19 (piece 5) | 8:58 (piece 4) (+0:39) |

Each piece's job time and "N passed (Xm)" line matches the body's table row for row. One sample each, as the body says; the run at `5ee6fde` (45009925040) was still running at review time and is a second sample, not needed for this verdict.

Judgement: about 8% more runner time and 39 seconds more wall clock for a recording that answers the open "press with no answer" flake is acceptable. The change is one config line, easy to undo once the flake is found.

## Checks carried over from round 1

The code at `5ee6fde` is byte-identical to `ebb549c` outside the audit file (`git diff ebb549c 5ee6fde --stat`: one file, the round 1 audit), so round 1's passes stand: criterion 1 (the config test fails on `6410353`, passes on the branch), criterion 2 (network is recorded only with snapshots; a `beforeAll` context is recorded), CI uploads `playwright-report/`, lint and typecheck exit 0. CI run 45009125642 at `ebb549c` passed every job.

## Notes (not blocking)

- The body's "Commits" section still says "to come" for reviewed and integration; the merging session fills these in.
- Round 1's note on `loading.test.ts:64` stands: `toBe(1)` would not catch a late second post, but the line before it already shows the second press was stopped.
