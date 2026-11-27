# Learned feed, unit A, public half 1: implementation audit 2

- Pull request: #436, branch `claude/project-thread-lvr5m0`
- Commit examined: `c0e4b2b3debdeada73dfe97bab2ba0c8812b6984` (`c0e4b2b`)
- Reviewer: a fresh lane 2 session, Opus 5.5, medium. Written 2026-11-27 23:43 UTC (from `date`).
- Previous: audit 1 at `5312177`, FAIL, 1 red (R1: the play read included under-18s, unknown age, learning off, and play before Start over).
- Verdict: **PASS**, 0 red, 3 notes.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran, at c0e4b2b

- `pnpm install --frozen-lockfile`, `pnpm lint` (exit 0), `pnpm typecheck` (exit 0).
- `pnpm test`: 169 files, 2,421 tests passed.
- `pnpm test:pg` on a local Postgres 16: 56 files, 835 tests passed.
- The launch-scale read printed: `play read: 20000 rows, warm median 190.2 ms (first 211.9 ms), sent 295 KB` (this container, run alone after the full suite).
- The branch merges with `main` (`3883891`) without conflicts (`git merge-tree`).
- Node here is 22.23.5, not 24; the CI run on the pull request is the Node 24 evidence.

## R1 fixed: who is read

`playDays` (`src/features/play/sessions.ts`) now joins `User` and keeps a beat only when `u."adultOn" <= (now AT TIME ZONE 'America/Chicago')::date`, `u."feedPersonal"` is true, and `u."feedResetAt"` is null or before the beat. A null `adultOn` makes the comparison null, so unknown age is left out; the account purge sets `adultOn` to null (`src/features/accounts/deletion.ts`), so a deleted person is left out too. This matches `isAdultOn` (`src/features/accounts/age.ts`): 18 or over on today's Chicago day. Staff and maker's own play stay out by `basis IN ('member', 'free_game')`, and play by nobody by the join.

Each filter was removed on purpose, and the playDays tests caught each one:

| Broken on purpose | playDays tests |
| --- | --- |
| the `adultOn` line removed | 1 failed |
| the `feedPersonal` line removed | 1 failed |
| the `feedResetAt` line removed | 1 failed |
| the age day worked out in UTC instead of Chicago | **all passed** (see note N1) |

For the last row a probe test was added and then removed: `now` at 2026-11-15 03:00 UTC (21:00 on the 14th in Chicago) and a person whose 18th birthday is the 15th. On the pull request's code the read leaves them out (passed); with UTC it lets them in (failed). So the code is right; only the test does not pin the zone.

## The feed side

Each of these was broken on purpose in `src/features/feed/service.ts`, and `tests/features/feed/` failed each time (1 test failed of 143 each run):

- the open order handed the rows when it stands in for a private ranker that did not answer;
- a failed read still asking the private ranker instead of giving the open order;
- the read made when no private ranker is bound;
- the five-minute keep removed;
- a failed read kept;
- the viewer not numbered 0.

The rows go as five numbers each (game index, person number, day age, beats, member flag), nobody named; the person numbers come from sorting ids within the request. The keep key is the five-minute bucket, the window length and the game list, so a change in live games reads again. A failed read logs one line that names no one.

## Criteria

1 to 10 in the pull request body: met. 1 to 3 and 8 by `sessions.pg.test.ts`; 4, 5 and 9 by `ranker.test.ts`; 6 by `tests/architecture.test.ts`; 7 by reading the diff (no test deleted; one test's people made adults, named in the body; no ranking rule, weight or setting value); 10 measured above. No screen changes, so no visual check and no CRUD journey applies: this read adds nothing a person makes.

## Notes (not blocking, not fixed here)

- **N1.** UNIT: `tests/features/play/sessions.pg.test.ts`. VERDICT: note. REQUIREMENT: criterion 8 ("18 or over today in Chicago"). REASON: no test tells Chicago's day from UTC's for the age line. EVIDENCE: with the zone swapped to UTC all playDays tests pass; the probe above fails. EXPECTED: one test with `now` in a Chicago evening after UTC midnight. FIX: add that case to the "leaves out anyone under 18" test; only that file.
- **N2.** UNIT: `src/features/feed/service.ts`. VERDICT: note. REASON: the play read has no time limit of its own; a slow database holds the page, while the private ranker gets `PRIVATE_WAIT_MS`. Only the first page in each five minutes per Worker waits for it. FIX (if wanted): put the read under the same wait, falling back to the open order.
- **N3.** UNIT: the play read and the keep. VERDICT: note. REASON: someone who turns Learn from what I do off or presses Start over can stay in the kept rows for up to five minutes; and other players' rows are not filtered by their cookie answer, which is kept only in the browser (carried from audit 1). Both are for unit D and PR 3 (consent and age wiring) to settle against spec section 10.
