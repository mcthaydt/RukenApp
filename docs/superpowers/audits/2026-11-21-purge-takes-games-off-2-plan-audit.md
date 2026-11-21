# Plan audit 2: a deleted maker's games come off Ruken

- Examined: `docs/superpowers/specs/2026-11-21-purge-takes-games-off-design.md` at **152e877** (branch `claude/project-thread-vhfmo8`, PR #268), with the code and test it describes: `src/features/accounts/deletion.ts`, `tests/features/accounts/purge.pg.test.ts`, `src/routes/jobs/purge-accounts/+server.ts`, `cloudflare/worker.js`. Round 1: `2026-11-21-purge-takes-games-off-1-plan-audit.md` at 2ffdcd1, FAIL with one red (R1).
- Lane 3. Reviewer: Opus 5.5, medium.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**152e877 PASS**

R1 is fixed in the plan and in the code, and the new test pins it. No new red.

## What ran, at 152e877

- `vitest run --project postgres tests/features/accounts/` on a local Postgres 16: 6 files, 93 tests, all passed.
- The new test ("finishes the other accounts when one fails, ...") with `deletion.ts` put back to ea087eb: fails, "expected [Function] to throw error including '1 account(s) could not be deleted; 1 …' but got 'the bucket is down'". So criterion 3 fails on the code before the change, as it says.
- `pnpm typecheck`: 0 errors, 0 warnings. `eslint` and `prettier --check` on the two changed code files and the spec: clean.
- Not run: the browser journeys (`purge-job`, `purged-account`); criterion 2 and the journey half of criterion 4 are left to CI.

## R1, round 1: fixed

- Plan: "How" step 3 now says each account is finished on its own (`purgeOne`), a failed one stays open, the run goes on, and the run throws naming the counts; criterion 3 states the two-account test. Status line names R1.
- Code: `purgeDueAccounts` (`deletion.ts:104-129`) wraps each `purgeOne` in `try`/`catch`, collects failures, and after the loop throws `AggregateError(failures, "N account(s) could not be deleted; M were.")`. `purgeOne` (`deletion.ts:132-185`) is the old loop body unchanged: bucket first, then the claimed transaction with `takeGamesOff`.
- The job's route (`+server.ts:13`) does not catch, so SvelteKit answers 500, and `cloudflare/worker.js:25-27` records a non-200 purge as a failure and throws after the other jobs run. So the run shows as failed in Cloudflare, as the plan says.
- Test (`purge.pg.test.ts:445-471`): two due accounts, a bucket that fails only on the first one's `files/<publicId>/`; checks the message, the second account deleted with its game taken off, the first still `pending_deletion`, its game live and its request open; then a second run with a working bucket answers 1, deletes the first and its files. This also pins the repeat-safety claim round 1 said no criterion checked. The test passes whichever account `findMany` returns first.

## Rest of the plan, rechecked against 152e877

- Everything round 1 listed under "What was checked and holds" is unchanged by this commit (the diff from ea087eb touches only `deletion.ts`'s loop, the test, the spec's How 3, status line and criterion 3, and the live-state file), so it still holds.
- The spec agrees with itself: "What changes", "How" 1 to 3 and criteria 1 to 4 describe the code as it is. Owner decisions (games off, 14:26 UTC; videos deleted, 14:58 UTC) are recorded. The #269 handoff (held values, A11) is unchanged and still matches project memory.

## Notes (not blocking)

- N1 (from round 1, still open). A `taken_down` game's video rows and files are deleted too; a later staff "put back" would meet a game with no videos.
- N2 (from round 1, still open). No pg test for a waiting game with a held yes purged before its decision day.
- N3 (from round 1, still open). All due accounts run in one Worker request; four or more R2 calls per game.
- N4. Which account failed, and why, may not reach the logs. The thrown message carries only the counts; the per-account errors are inside `AggregateError.errors`, and the site has no `handleError` hook, so SvelteKit's default logging prints the outer error. Whoever reads the failed run in Cloudflare may not see which person or what went wrong. Bounded fix if wanted: `console.error` each failure with its request id in the `catch` at `deletion.ts:118-119`.
- N5. Nothing pins the 500. Criterion 3 checks that `purgeDueAccounts` throws; that the job's address then answers 500 follows from the route having no `catch`. A route test would pin it, but it is not a requirement of this plan.
- N6. If the bucket half-succeeds (an account's `files/` deleted, then `clips/` or the transaction fails), that account's games stay live with their files gone until a later run succeeds, so players can meet a broken game for a day or more. This is the bucket-first order round 1 accepted (the alternative leaves files nobody can find), and the open request means the next run finishes it; recorded so it is a known trade-off, not a surprise.
