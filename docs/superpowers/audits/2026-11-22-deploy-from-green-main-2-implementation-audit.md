# Implementation audit 2: deploy from a green main, PR 1 of 3 (the two scripts), re-check

**6f96172 PASS**

- Examined: branch `claude/project-thread-b4dhof` at `6f96172` (the fixes for audit 1, on top of audit commit `c4b3633`).
- Brief: spec `docs/superpowers/specs/2026-11-22-deploy-from-green-main-design.md` 3.1, 3.2, criteria 3 and 4; audit 1 (`2026-11-22-deploy-from-green-main-1-implementation-audit.md`) R1 to R3 and N1 to N3.
- Lane 3. Reviewer: Opus 5.5, medium. Checked at 2026-11-22 17:02 UTC. No pull request is open for the branch yet, so no verdict comment was posted.

## What ran

- `pnpm exec vitest run tests/deploy-target.test.ts tests/live-check.test.ts`, three times in a row: 18 of 18 pass each time (was 14; four tests added).
- The audit 1 breaks again, plus two new ones, each applied alone and the script restored after (`git status` clean): 16 of 16 killed.

| Break | Result | Killed by |
|---|---|---|
| live-check: no `100%` filter (audit 1: survived) | killed | "fails when our version is only at 50%" |
| live-check: no wait, one try per check (audit 1: survived) | killed | "waits for a new version to arrive: wrong at first, right a moment later" |
| live-check: no empty-id guard (new) | killed | "fails at once when the deploy gave no version id" |
| live-check: `deployments list` instead of `deployments status` (new) | killed | every case (the stub now answers only to `deployments status`) |
| live-check: version check, title, 200 for http, location, exit 0 on miss, home step dropped | 6 killed | |
| deploy-target: fast path, conclusion, status, name filter, oldest attempt, no-run check | 6 killed | |

- Probe against the real ruken.io (GET requests only) with a stub wrangler: an empty `VERSION_ID` now ends at once with `::error::Live check failed: no version id from the deploy`, exit 1 (audit 1 R1 passed here); a matching id at 100% passes all three checks, exit 0.

## Audit 1 findings

- **R1 fixed.** `live-check.sh` lines 16 to 19 fail with `::error::` when `VERSION_ID` is empty or unset, before anything else runs. Test added; the guard's removal is caught.
- **R2 fixed.** New case with our version at 50% fails with a `100%` reason; dropping the filter is caught by exactly that case.
- **R3 fixed.** New case: the home page answers 500 and http sign-in 200 for the first 0.8 s, then the right answers; the check passes. Trying once is caught by exactly that case.
- **N1 done.** `set -euo pipefail`. Every call that may fail sits in an `if`, `||` or `&&` list, so `-e` stops nothing that should go on; all tests and the live probe pass with it.
- **N2 done.** The skip reason names the conclusion (`ended failure`, `ended cancelled`), with a new cancelled case.
- **N3 done.** The wrangler stub exits 1 unless called with exactly `deployments status`.
- **N4** (commit message of `1b118f4`) needs no code; the PR body should not claim a docs fix.

## Notes (not blocking)

- **N5: the 50% stub prints one line, not two.** The test passes `(50%) <VERSION>\n(50%) 99999999-old` to `printf '%s\n'`, which does not expand `\n`, so wrangler's stand-in prints one line holding both. The case still proves the point (our version is on a line without `100%`, and dropping the filter is caught), so this is only the comment's intent. `printf '%b\n'` in the stub would make it two lines. `tests/live-check.test.ts` only.

## The PR 2 conditions still stand

From audit 1: check out `github.sha` for the scripts, put the sparse checkout in its own `path` with `persist-credentials: false`, pass `head_sha` through `env`, keep `GH_TOKEN` on the target step only, and amend spec 3.1 and criterion 2 for the extra step.
