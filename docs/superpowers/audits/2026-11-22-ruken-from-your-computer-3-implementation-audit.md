# Implementation audit 3: Ruken from your computer, pull request 1 (keys, press-Yes sign-in, video upload)

- Reviewed: branch `claude/project-thread-ps17ej` at `bfe4ce7` (the fix round for audit 2's R7 and R8), against audit 2 (`docs/superpowers/audits/2026-11-22-ruken-from-your-computer-2-implementation-audit.md`, FAIL at `acda271`) and spec 4.2 and 4.3. No pull request yet.
- Lane: 3. Reviewer: fresh session, Opus 5.5, medium. Started 2026-11-22 15:48 UTC, written 15:59 UTC (from `date`).
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.
- R9 (the spec's deploy line) is not re-raised: the coordinator rejected it, since `main` deploys through Cloudflare Workers Builds, outside the repo.

**Verdict: FAIL, 1 red, 1 new note.** The lock fixes R7 and R8 in the code: my own probe, run on separate connections as separate Worker requests are, breaks every time without the lock and never with it, and a mix of all four locked calls at once ran with no deadlock and no error. But the committed test for R7 passes with the lock taken out, so it does not guard the fix it was written for (R10). The commit message says all three new tests fail without the lock; two do.

## What ran

| Check | Result | Commit |
|---|---|---|
| `pnpm install --frozen-lockfile` | exit 0 | `bfe4ce7` |
| `pnpm lint` | exit 0 | `bfe4ce7` |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings (2085 files) | `bfe4ce7` |
| `pnpm test` | 131 files, 1905 tests passed | `bfe4ce7` |
| `pnpm test:pg` (local Postgres 16) | 50 files, 761 tests passed | `bfe4ce7` |
| `pnpm test:browser tests/browser/computers.test.ts --project computer --trace off` | 7 of 7 passed (43.7 s) | `bfe4ce7` |
| The three "at the same moment" tests with `lockComputers` made a no-op | 2 fail (password change, Delete my account), **1 passes (the 20-computer cap)** | `bfe4ce7` |
| Concurrency probe, 5 cases (below), with the lock | 5 of 5 pass | `bfe4ce7` |
| The same probe with `lockComputers` made a no-op | 4 of 5 fail (the mix case is a deadlock and error check, not a race check) | `bfe4ce7` |
| Phone and tablet profiles, the other journeys, `pnpm build` alone | not run here; left to CI on the pull request | |

## Audit 2's reds

| Red | Verdict | Evidence |
|---|---|---|
| R7 cap broken by Yes answers at the same moment | **fixed in code; its test does not guard it, see R10** | `answerSignIn` counts and writes inside one transaction after `lockComputers`; `finishSignIn` takes the row, counts and makes the key inside one. Probe "cap": 15 rounds of 19 keys and 8 Yes answers sent at once from 8 separate connections, then 8 finishes at once: 0 rounds over 20, exactly 1 Yes per round. Without the lock: 15 of 15 rounds over, 48 Yes accepted. Probe "slow cap" (key count waits 100 ms): 1 Yes of 8; without the lock 8 of 8 |
| R8 key survives a password change mid-finish | fixed | `removeAllComputers` and `requestDeletion` take the same lock first. Probe "revoke window": 10 rounds, the finish waits 80 ms before making the key on one connection while `removeAllComputers` runs on another at 10 to 82 ms: 0 keys left; without the lock 10 of 10 kept a key. Probe "delete window", the same with `requestDeletion`: 0 left; without the lock 9 of 10 kept one. The two committed tests fail without the lock (`expected 1 to be +0`) |

## Locks and deadlocks

- The `computers:<userId>` lock is the first statement in each of its four transactions (`answerSignIn`, `finishSignIn`, `removeAllComputers`, `requestDeletion`), so none of them holds a row lock while it waits for it. No other lock is taken inside them: the other advisory locks in the code (`ledger` in `money/journal.ts`, `premium:<id>` in `membership/sync.ts`, `first-owner` in `staff.ts`, the decision lock in `games/service.ts`) are never taken by these four or by their callers, so there is no order between locks to get wrong.
- Callers: `changePassword` calls `removeAllComputers` after better-auth has answered, outside any transaction. better-auth 1.7.7 calls `onPasswordReset` after `updatePassword` with no transaction around it (checked in `better-auth/dist/plugins/phone-number/routes.mjs`, `api/routes/password.mjs`), so the new transaction never waits on a connection its own request already holds. `requestDeletion` has one caller, `routes/me/delete/+page.server.ts`, with no transaction around it.
- `requestDeletion` takes the lock and then updates the `User` row; `finishSignIn` makes a `ComputerKey`, whose foreign key takes only a key-share lock on that row, after its own lock. Both take the advisory lock first, so they queue and never cross.
- Probe "mix": 20 rounds of 15 keys, 6 codes (3 already answered Yes), then all at once on 10 separate connections: 6 Yes answers, 6 finishes, two `removeAllComputers` and one `requestDeletion`. 0 errors, 0 deadlocks, 0 keys left.
- Each transaction holds the lock for a handful of short statements, well inside Prisma's 5 s interactive transaction limit, and only one maker's own requests ever wait on it.

## Red findings

### R10. The test written for R7 passes with the lock taken out

- UNIT: `tests/features/accounts/computer-keys.pg.test.ts`, "at the same moment" > "never ends with more than 20 computers when several Yes answers and finishes come at once".
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "A check is a test that fails by itself"; review skill "A confirmed failure gets a regression test first"; the fix commit's own claim "tests that fail without it".
- REASON: the test slows `computerSignIn.count`, the second of the two counts. Under Postgres's read committed, that slowed count starts after the other answers have written their Yes and sees them, so each answer refuses on its own and the race is never opened.
- EVIDENCE: with `lockComputers` replaced by a no-op at `bfe4ce7`, the test passes, answers `["yes","too_many_computers","too_many_computers","too_many_computers","too_many_computers"]`. Changing only `slowKeys("computerSignIn", "count")` to `slowKeys("computerKey", "count")`: without the lock it fails (`expected [ 'yes', 'yes' ] to have a length of 1 but got 2`); with the lock it passes.
- EXPECTED: the test fails when the lock is gone and passes when it is there.
- FIX: in that test, slow `computerKey` `count` instead of `computerSignIn` `count` (and fix the comment above it to match). Check it by running the test once with `lockComputers` made a no-op (must fail) and once as committed (must pass). Files: `tests/features/accounts/computer-keys.pg.test.ts` only.

## Notes (not blocking, recorded)

- N9. A Yes from a session that a password change is signing out at that moment can still land. `/me/link`'s `answer` checks the session in the hook, then `answerSignIn` writes in its own transaction later. If the change of password revokes that session and finishes `removeAllComputers` in between, the Yes is written afterwards and the terminal collects a working key. The window is the few milliseconds between the hook's session check and the answer's transaction, and the person pressing Yes cannot choose when the owner changes the password, unlike R8's terminal that polls every few seconds. Not probed end to end. A bounded fix if wanted later: inside the locked transaction in `answerSignIn`, check that the caller's session row still exists. Follow-up, not this round.
- N7 and N8 from audit 2 (form posts to `/me/password` and `/me/delete` checked by `GET` only; audit 1's N1, N2, N4, N5) are unchanged at `bfe4ce7` and stay follow-ups.

## Probe used

A file under `tests/features/accounts/` run with `npx vitest run --project postgres <file>` at `bfe4ce7`, then removed; not committed here. A copy is in the project files at `audits/2026-11-22-ruken-from-your-computer-3-probe.pg.test.ts.txt`. It opens 10 extra Prisma clients on the test database, each with a pool of 1, so concurrent calls run on separate connections as separate Worker requests do. Cases: "cap", "slow cap", "revoke window", "delete window" and "mix", as described above. Each was run with the lock and again with `lockComputers` made a no-op.
