# Journey phone numbers, round 1: implementation audit

Pull request #314, branch `claude/project-thread-8e4lco`. Reviewed commit: `a0bbf9f`. Lane 2 (`tests/browser/support/`). Fresh reviewer, Opus 5.5, medium. Written 2026-11-22 09:09 UTC (from `date`).

**Verdict: PASS.** No red findings. Two notes, not fixed here.

## What the change claims

1. The "no code waiting" flakes at `make-second-look.test.ts:807` and `make-design-pass.test.ts:239` (both computer) came from two worker processes of one run drawing the same phone number, because `freshNumber()` split numbers by `TEST_PARALLEL_INDEX` and remembered them only inside one process.
2. Splitting by `TEST_WORKER_INDEX` (10 area codes per process, 80 slots) stops that, and the helper throws instead of looping when a process uses up its 78,000 numbers.
3. `progress.md` Flaky tests records these two, the three 15-second form-post stalls and `feed-controls.test.ts:71`.

## What I checked

| Check | Result | Evidence |
|---|---|---|
| New unit test passes on the change | PASS | `pnpm exec vitest run tests/journey-numbers.test.ts` at `a0bbf9f`: 4 passed. |
| New unit test fails without the fix | PASS | Same test with `account.ts` from `origin/main`: "never hands out a number another worker process of the run had" fails, `expected 196 to be +0`; "says so when one worker has used up its numbers" fails, `expected [Function] to throw`. The check fails by itself. |
| Lint and types | PASS | `eslint` on both files clean; `pnpm typecheck` 0 errors, 0 warnings. |
| Cause: same parallel index, new process, empty memory | Confirmed by reading | Playwright gives each worker process its own `TEST_WORKER_INDEX` and reuses `TEST_PARALLEL_INDEX` slots for replacement processes. Workers are keyed by project, so phone, tablet and computer each start fresh processes. The CI job log for shard 1 of run 44997563759 (job 137131792005) shows "Running 232 tests using 2 workers" and the failure "no code waiting for +12905555965" at 07:29, late in the shard. `codeTo` (`support/texts.ts:56`) waits only for a *pending* code, so a number already signed up by an earlier process never gets one. |
| Cause: confirmed by a log of the first use of the number | Not possible | The journeys never log a number on success, so the log cannot show the earlier sign-up with +12905555965. The cause rests on the mechanism above plus the unit test reproducing the repeats, not on a direct sighting. Stated honestly in the progress entry ("Cause:" by mechanism). |
| No collision across shards | PASS | `.github/workflows/ci.yml:259-272`: each `browser-shard` matrix job has its own `postgres:16` service, so shards never share accounts. Worker indexes repeating across shards does not matter. |
| No collision across workers in a shard | PASS | Area code = `200 + (TEST_WORKER_INDEX % 80) × 10 + 0..9`: 80 disjoint blocks of 10 covering 200–999, same overall range as before. A shard runs 2 workers × 3 profiles = 6 processes plus one per failure (`retries: 0`), far below 80. Each process de-duplicates within itself. |
| No hand-written number in the ranges | PASS | The only hard-coded US number under `tests/browser` is `+17735550100` (`attach-phone.test.ts:41`), a 01·· line that `freshNumber` never draws. |
| Other users of `TEST_PARALLEL_INDEX` | Unchanged, correct | `support/rate-limits.ts:20` keys client addresses by parallel index; two processes with the same parallel index never run at the same time, so that use is right and stays. |
| Failure lines named in progress.md exist | PASS | All seven `file:line` references point at the named tests and the predicate at `feed-controls.test.ts:96`. |
| Other flake entries | Recorded only | They state "cause not found" and change no code. Not verified beyond the line references. |
| CRUD | Not applicable | The change adds nothing a user can make. |

## Notes (not blocking)

- **UNIT:** `tests/browser/support/account.ts`. **VERDICT:** note. **REASON:** the 81st process in one shard shares the first process's area codes, with the first's numbers forgotten. **EVIDENCE:** `% (800 / AREA_CODES_PER_WORKER)`. **EXPECTED:** unreachable today (about 6 processes per shard). **FIX:** none now; if a run ever needs more processes, throw at index 80 instead of wrapping.
- **UNIT:** `tests/journey-numbers.test.ts`. **VERDICT:** note. **REASON:** the loop variable `process` shadows Node's global `process` inside the loop body. **EVIDENCE:** `for (let process = 0; …)`. Harmless here (the body uses `vi.stubEnv`), but a later edit that reads `process.env` inside the loop would break quietly. **FIX:** rename to `worker` if the file is touched again.

## Not run

- The browser journeys themselves (CI's quick draft run was in progress on `a0bbf9f` at review time). Whether the flake is gone shows only over later runs.
