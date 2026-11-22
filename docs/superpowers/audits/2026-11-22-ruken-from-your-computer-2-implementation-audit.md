# Implementation audit 2: Ruken from your computer, pull request 1 (keys, press-Yes sign-in, video upload)

- Reviewed: branch `claude/project-thread-ps17ej` at `acda271` (the fix round `f935127` plus one spec line), against audit 1 (`docs/superpowers/audits/2026-11-22-ruken-from-your-computer-1-implementation-audit.md`, FAIL at `feb6665`) and the same spec sections. No pull request yet (6 open).
- Lane: 3. Reviewer: fresh session, Opus 5.5, medium. Started 2026-11-22 15:28 UTC, written 15:37 UTC (from `date`).
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 3 red, 2 notes.** All six reds of audit 1 are fixed for one request at a time, each with a test that passes here. The coordinator asked for the R1 and R2 fixes to be checked under concurrency: both break. Requests sent at the same moment still take a maker past 20 computers (R7), and a terminal finishing while the password changes keeps a working key (R8). The spec line added at `acda271` says something that is not true yet (R9).

## What ran

| Check | Result | Commit |
|---|---|---|
| `pnpm install --frozen-lockfile` | exit 0 | `f935127` |
| `pnpm lint` | exit 0 | `f935127` |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings | `f935127` |
| `pnpm test` | 131 files, 1905 tests passed | `f935127` |
| `pnpm test:pg` (local Postgres 16) | 50 files, 758 tests passed | `f935127` |
| `pnpm test:browser tests/browser/computers.test.ts --project computer` | 7 of 7 passed (45 s) | `f935127` |
| Concurrency probe (not committed, described below R8) | 2 of 3 fail: R7 and R8 confirmed | `f935127` |
| Phone and tablet profiles, the rest of the journeys, `pnpm build` alone | not run here; left to CI on the pull request | |

`acda271` changes one line of the spec and no code, so the code results stand for it.

## Audit 1's reds

| Red | Verdict | Evidence |
|---|---|---|
| R1 cap counts Yes not yet collected; finish refuses at 20 | fixed for one request at a time; **fails under concurrency, see R7** | `computersCounted` in `computer-keys.ts`; tests "never lets a maker hold more than 20 keys ..." and "refuses at finish when the maker is already at 20" pass; finish answers 403 with `WORDS.tooManyComputers` through `sign-in/finish/+server.ts` |
| R2 pending codes dropped on password change, reset, deletion | fixed for one request at a time; **fails under concurrency, see R8** | `removeAllComputers` deletes `computerSignIn` too; `deletion.ts` does the same in its transaction; both new tests pass |
| R3 header ignored everywhere else; no key in a log; pause leaves key working | fixed | journey loop covers `/me/password`, `/me/delete`, `/join`, `POST /webhooks/stripe` and all six `/jobs/*` (checked against `src/routes/jobs/`: attach-phone, decision-day, first-owner, money, purge-accounts, review), comparing status and `location` with no header; `api.server.test.ts` "a failure" spies every `console` method and finds no key; pg test with a paused `signInGuard` row still reads the key |
| R4 120/min and 30/hour shared across a maker's keys | fixed | `maker` and `countUpload` take a limiter; unit tests: 60 + 60 calls over two keys then the 121st is 429 "Wait a minute and try again.", one limiter key used; 31st upload is 429; another maker's count is apart |
| R5 sign-out checks whoami and Your computers | fixed | journey runs `whoami` (exit 1, "npx ruken sign-in") and opens `/me/computers` ("No computers can use your Ruken.") |
| R6 refusal words and nothing stored | fixed | journey asserts the fake video's words "That file doesn't look like a video. ..." and ends with `game <slug>` showing "Upright video: not added yet" |

## Red findings

### R7. Yes answers pressed at the same moment still take a maker past 20 computers

- UNIT: `src/features/accounts/computer-keys.ts` `answerSignIn` and `finishSignIn`.
- VERDICT: red.
- REQUIREMENT: spec 4.2 "at most 20 computers per maker"; A11 "the 21st computer is refused"; the coordinator's ask to check the R1 fix under concurrency.
- REASON: both checks count, then write, with nothing in between that stops a second request doing the same. Five Yes answers sent together all see 19 and all pass; five finishes sent together all see 19 keys and all make one.
- EVIDENCE: probe "PROBE cap" at `f935127`: 19 keys, 5 codes, `Promise.all` of 5 `answerSignIn` Yes, then `Promise.all` of 5 `finishSignIn`. Ten rounds out of ten went over: 4 or 5 Yes accepted each round, ending with 23 or 24 keys (`expected 24 to be less than or equal to 20`). This with the test database's pool of only 2 connections; the site has more.
- EXPECTED: however the requests arrive, the maker never holds more than 20 keys, and no more than 20 keys plus collectable Yes answers.
- FIX: take a per-maker lock the way `src/features/membership/sync.ts` does (`pg_advisory_xact_lock(hashtextextended(${`computers:${userId}`}, 0))`) inside a `$transaction`, and run in it: in `answerSignIn`, the count and the `updateMany`; in `finishSignIn`, the count, the `deleteMany` that takes the row and the `computerKey.create`. Add the probe's case (concurrent answers, then concurrent finishes, assert at most 20 keys) to `tests/features/accounts/computer-keys.pg.test.ts`. Files: those two.

### R8. A terminal that finishes while the password changes keeps a working key

- UNIT: `src/features/accounts/computer-keys.ts` `finishSignIn` and `removeAllComputers`.
- VERDICT: red.
- REQUIREMENT: spec 4.3 "a key stops working when the maker ... changes their password ..., resets it by text ..."; audit 1 R2's expected result "no key can be collected from a Yes given before it"; the coordinator's ask to check the R2 fix under concurrency.
- REASON: `finishSignIn` takes the row and makes the key in two separate steps. When `removeAllComputers` runs between them, it deletes the keys (the new one does not exist yet) and the sign-ins (the row is already gone), and then the key is made. The terminal of someone the maker let in by mistake polls finish every few seconds, so the change of password can land in that gap.
- EVIDENCE: probe "PROBE revoke window" at `f935127`: Yes, then `finishSignIn` run with a client that waits 100 ms before `computerKey.create`; 40 ms in, `removeAllComputers` runs to the end; finish answers `yes` and 1 key is left for the maker (`expected 1 to be +0`). Without the delay, 40 rounds of the two at once left no key, so the gap is narrow, but it is there by construction. For Delete my account the new key is still refused by `readKey`'s `active` test; for the password change and the reset it works.
- EXPECTED: after the password change or reset ends, no key of the maker works, whatever finish was doing.
- FIX: with R7's lock: `finishSignIn` takes the row and makes the key inside the locked transaction; `removeAllComputers` takes the same lock in a transaction and then deletes sign-ins and keys (it then waits for a finish in progress and deletes the key it made); `requestDeletion` takes the lock in its transaction before its two deletes. The `removeAllComputers` callers in `credentials.ts` and `auth.ts` keep calling it as now. Test: a finish held between taking the row and making the key (for example a client that delays `computerKey.create`, as the probe did) with `removeAllComputers` run meanwhile leaves 0 keys. Files: `computer-keys.ts`, `deletion.ts`, `tests/features/accounts/computer-keys.pg.test.ts`.

### R9. The spec now says the site deploys itself from `main`; it does not yet

- UNIT: `docs/superpowers/specs/2026-11-22-ruken-from-your-computer-design.md`, "After pull request 1 merges" (changed at `acda271`).
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "Report honestly" and "a tool or asset is checked to exist before anything is built on it".
- REASON: the line reads "The site deploys itself from `main`, and its deploy runs the migration; the owner runs nothing." `main` at `5bbea3e` has three workflows, `ci.yml`, `commit-authors.yml` and `pr-rules.yml`, none of which deploys, and none of the six open pull requests (#319, #320, #321, #323, #325, #326) adds one. Followed as written, nobody deploys, the migration never runs, and the feature never reaches ruken.io.
- EVIDENCE: `git ls-tree -r --name-only origin/main .github/workflows`; `git grep -n -i "deploy" origin/main -- .github/workflows` finds nothing; `gh api 'repos/mcthaydt/RukenApp/pulls?state=open'`.
- EXPECTED: the step says what is true when PR 1 merges: the owner runs `pnpm run deploy` (which runs the migration), until automatic deploys from `main` have merged, after which it happens by itself.
- FIX: reword that one line to say so. Files: the spec.

## Notes (not blocking, recorded)

- N7. The journey's A4 loop checks `/me/password` and `/me/delete` by `GET` only, not their form posts. `createHandle` reads the key only under `/api/v1/` (audit 1, N6, unchanged by the fix), so a post there ignores the header the same way. No change asked.
- N8. Audit 1's notes N1 (a chunked JSON body is not bounded by `JSON_MAX_BYTES`), N2 (`keep-old` always says "Kept the old one"), N4 (no `frame-ancestors`) and N5 (finish limited before the secret) are unchanged at `acda271`; they stay follow-ups.

## Probe used for R7 and R8

A file under `tests/features/accounts/` run with `npx vitest run --project postgres <file>` at `f935127`, then removed; not committed. It uses `startTestDatabase`, `createUser`, `TestClock` and `createRateLimiter` as `computer-keys.pg.test.ts` does. "PROBE cap": ten rounds of 19 keys made directly, 5 codes, the 5 Yes answers in one `Promise.all`, then the 5 finishes in one `Promise.all`, count keys. "PROBE finish racing removeAllComputers": 40 rounds of Yes, then `removeAllComputers` and `finishSignIn` in one `Promise.all` (0 of 40 kept a key). "PROBE revoke window": the finish's client is a `Proxy` over the test client whose `computerKey.create` waits 100 ms; `removeAllComputers` on the real client 40 ms after the finish starts; count keys.
