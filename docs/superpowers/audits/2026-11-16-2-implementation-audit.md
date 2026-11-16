# CI gate changes: implementation audit, round 2

Pull request #162, commit `8ad3814` on `claude/project-thread-9ru62m`. Scope: `.github/workflows/ci.yml` and
`.github/workflows/auto-merge.yml` only. Lane 3 (CI workflow files), owner's words in the commit: "yes to 1–3, keep
12". A fresh session wrote this and changed nothing else. Written 2026-11-16 18:19 UTC (from `date`).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was checked

- **Scope against the owner's words.** `git diff origin/main...8ad3814 -- .github/workflows/` holds exactly: a `gate`
  job (1), a `workflow_dispatch` trigger plus a `test-main` job in `auto-merge.yml` (2), `--passWithNoTests` removed
  from both draft test steps with a full-suite fallback (3), and comments. The browser matrix is still 12 pieces. The
  postgres step now calls `pnpm generate` then `pnpm exec vitest run --project postgres`, which is what
  `test:pg` already ran (`package.json` line 22), so no behaviour beyond (3) changed. Nothing else in either file moved.
- **Gate logic.** `gate` needs `verify`, `postgres` and `browser`, runs with `always()`, and fails unless all three
  report `success`. A failure, cancel or skip in any of them makes it red. Docs-only is decided by `changes`: `verify`
  and `postgres` succeed with nothing to do, `browser` accepts skipped pieces only when `docs_only` is `true`. If
  `changes` fails, its output is empty and every job runs everything, so the gate can never pass on a doubt. On a
  draft it is named `gate (quick, draft)`, so a quick run cannot satisfy a required `gate`. Correct.
- **ready_for_review.** `ci.yml` `pull_request.types` includes `ready_for_review` (unchanged), so marking ready starts
  the full run under the required names. The concurrency group `ci-${{ github.ref }}` cancels the draft run it
  replaces. `auto-merge.yml` also listens to `ready_for_review`. Correct.
- **No empty pass on drafts.** Ran locally at `8ad3814` (Node 22, `pnpm install --frozen-lockfile`, `pnpm generate`):
  `vitest list --project unit --changed=origin/main --filesOnly` and the same for `postgres` print nothing and exit 0
  for this diff (only `.md` and `.yml`), so the step falls back to the full suite. With one line added to a
  `src/lib/*.ts` file, the unit listing prints 36 files, so the targeted run is used. Any error in `vitest list` goes
  to stderr, leaves stdout empty and also falls back to the full suite. In CI, `postgres (quick, draft)` on `8ad3814`
  (run 43926996967) took the fallback and ran `Test Files 39 passed (39)`; `verify (quick, draft)` ran the full unit suite, `Test Files 108
  passed (108)`, then the two text-reading tests (2 passed). `gate (quick, draft)` passed after all three. No `--passWithNoTests` is left in either
  file.
- **test-main can't loop.** `ci.yml` does not trigger `auto-merge.yml`, and `auto-merge.yml` has no `workflow_run`
  trigger, so a dispatched CI run starts nothing further. `test-main` dispatches only when main's newest commit has no
  CI run, so repeat events for the same commit dispatch at most once (two events in the same second could each
  dispatch; the `ci-refs/heads/main` concurrency group then cancels the older run). Job permissions are `actions: write,
  contents: read`, the least `gh workflow run` needs.

## Findings

No red findings: nothing here violates the owner's words, the kit's gate rules or the no-empty-pass rule.

UNIT: `auto-merge.yml`, `test-main` (and `ci.yml`, `workflow_dispatch`).
VERDICT: note.
REQUIREMENT: Report honestly (CLAUDE.md): a red check on the pull request is explained, not left unexplained.
REASON: `test main after a merge` is red on #162 itself, and will stay red on every event until #162 merges.
EVIDENCE: Run 43926997112, job 133508988863: "main at 8dca316 has no CI run yet: starting one", then "HTTP 422:
Workflow does not have 'workflow_dispatch' trigger". A `pull_request` event runs the PR's `auto-merge.yml`, but
`gh workflow run --ref main` needs the trigger in main's `ci.yml`, which only arrives with this merge.
EXPECTED: The PR body says this check is expected to fail until merge; it is not a required check and blocks nothing.
FIX: One sentence in #162's body. No workflow change.

UNIT: `auto-merge.yml`, `test-main`.
VERDICT: note.
REQUIREMENT: Owner's item 2, "let main run CI after a merge"; `release`: the merging session watches main after the
merge.
REASON: Main gets its run up to about an hour after an auto-merge, not right after it.
EVIDENCE: The `auto-merge` job only runs `gh pr merge --auto`, which turns on GitHub's auto-merge; GitHub merges later,
after this workflow's run has ended, so the `test-main` run on that same event sees main before the merge. The next
trigger is another pull request's event or the hourly `cron: "17 * * * *"` (GitHub may start scheduled runs late).
A merge made by the workflow's token fires no `closed` or `push` event to hook instead.
EXPECTED: The owner knows the delay, and a merging session waits for the scheduled run rather than assuming an
immediate one.
FIX: None in this pull request. Making it immediate needs a non-`GITHUB_TOKEN` credential for the merge (lane 3,
owner's call) or a tighter schedule; follow-up only if the owner wants it.

UNIT: `auto-merge.yml`, `test-main`, the `total_count` check.
VERDICT: note.
REQUIREMENT: Owner's item 2.
REASON: Any CI run on main's commit counts as tested, including a cancelled one.
EVIDENCE: `runs?head_sha=$sha&per_page=1 --jq .total_count` does not look at `conclusion`. A dispatched run cancelled
by hand is never redispatched. A run cancelled by the concurrency group is always replaced by a newer commit's run, so
that case is fine.
EXPECTED: Acceptable as is; a person cancelling main's run is choosing not to test it.
FIX: None.

UNIT: `auto-merge.yml` lines 1-2 (header) and `ci.yml` gate comment.
VERDICT: note.
REQUIREMENT: Comments say why, accurately (CLAUDE.md, How code is written).
REASON: Two comments state things that are not true at `8ad3814`.
EVIDENCE: `auto-merge.yml` line 2 says the required checks are "verify and browser" (main requires `verify`, `browser`,
`postgres`, and `gate` is to be added; this line predates the commit, which edited the same header). `ci.yml` says
"Branch protection requires it beside the three", but `gate` is required only once the owner runs the branch
protection command after merge.
EXPECTED: The header names the required checks as they will be after merge, and the gate comment says protection is
to require it.
FIX: Comment-only edits in those two lines of `auto-merge.yml` and `ci.yml`.

UNIT: `ci.yml`, `browser-shard`, "Pick the journeys".
VERDICT: note (follow-up, outside the owner's words).
REQUIREMENT: CLAUDE.md Tests: no flag or similar that lets an empty suite pass in CI.
REASON: A draft whose change reaches no browser journey skips every piece, and `browser (quick, draft)` passes on an
empty run. The same skip also applies in a full run to any piece Playwright deals no file to.
EVIDENCE: The step writes `run=false` when `playwright test --list` says "No tests found"; this is unchanged by
`8ad3814`. Only drafts are affected for changed-only selection, and draft checks are not required.
EXPECTED: Owner decides whether item 3 should extend to the browser draft run.
FIX: Not in this pull request; ask the owner.

## Verdict

`8ad3814`: the gate, `ready_for_review`, the main test and the draft fallback do what the owner approved, with no red
findings. #162 stays a draft; marking it ready, merging, and requiring `gate` in branch protection are the owner's.
