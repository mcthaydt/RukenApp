# Implementation audit 4: Ruken from your computer, pull request 1 (keys, press-Yes sign-in, video upload)

- Reviewed: branch `claude/project-thread-ps17ej` at `5526008` (the fix round for audit 3's R10), against audit 3 (`docs/superpowers/audits/2026-11-22-ruken-from-your-computer-3-implementation-audit.md`, FAIL at `bfe4ce7`). No pull request yet.
- Lane: 3. Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-22 16:06 UTC (from `date`).
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.
- R9 (the spec's deploy line) is not re-raised: the coordinator rejected it. N9 stays a known follow-up.

**Verdict: PASS, 0 red, 1 new note.** R10 is fixed: with `lockComputers` made a no-op, all three "at the same moment" tests fail; with the lock as committed, all three pass. Nothing but that one test changed since `bfe4ce7`.

## What changed since the last audit

- `git diff --stat 8eac19e 5526008`: one file, `tests/features/accounts/computer-keys.pg.test.ts`, 2 insertions, 2 deletions. `8eac19e` is audit 3's commit on top of `bfe4ce7`, so no source, schema, migration, config or other test changed.
- The change: the cap test slows `computerKey` `count` instead of `computerSignIn` `count`, and its comment says so. That is exactly audit 3's bounded fix.
- `docs/superpowers/live/` has no file at `5526008`. Commit `5526008` is authored by McThayDT with the noreply address.
- The commit message corrects the earlier claim ("the lock-removed run was shown for all three tests only after this change"). There is no pull request yet, so the PR body's correction could not be checked here; the handoff draft in project files (`handoff/ruken-pr1/pr-body.md`) holds no body text.

## What ran

| Check | Result | Commit |
|---|---|---|
| `pnpm install --frozen-lockfile` | exit 0 | `5526008` |
| `pnpm lint` | exit 0 | `5526008` |
| `pnpm typecheck` | exit 0 | `5526008` |
| `computer-keys.pg.test.ts` on local Postgres 16, as committed, 3 runs | 34 of 34 passed each run | `5526008` |
| The same file with `lockComputers` made a no-op (`return;` before its statement), 2 runs | 3 failed, 31 passed each run: the cap test (`expected [ 'yes', 'yes' ] to have a length of 1 but got 2`), the password change test and the Delete my account test (`expected 1 to be +0`) | `5526008` |
| The same file after `git checkout` of the source (lock put back), `git status` clean | 34 of 34 passed | `5526008` |
| Full `pnpm test`, `pnpm test:pg`, browser journeys, `pnpm build` | not run here: only a test file changed since audit 3 ran them all green at `bfe4ce7`; left to CI on the pull request | |

## Audit 3's red

| Red | Verdict | Evidence |
|---|---|---|
| R10 cap test passes without the lock | fixed | See the table above: the cap test fails without the lock and passes with it, in every run. Why it now holds: `computersCounted` runs its two counts with `Promise.all`; the unslowed `computerSignIn` count reads before any answer has written its Yes, and the slowed `computerKey` count reads 19, so without the lock each answer sees room. |

## New reds

None.

## Notes (not blocking, recorded)

- N10. In `slowKeys`, the `"computerSignIn"` choice of its `model` parameter is now used by no caller, and the wait it passes is still labelled `"create"` whatever step is slowed. Harmless; tidy whenever the file is next touched. File: `tests/features/accounts/computer-keys.pg.test.ts` only.
- N7, N8 and N9 from audits 2 and 3 are unchanged and stay follow-ups.
