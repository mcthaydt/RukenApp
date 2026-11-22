# Implementation audit 1: Ruken from your computer, pull request 1 (keys, press-Yes sign-in, video upload)

- Reviewed: branch `claude/project-thread-ps17ej` at `feb6665` (contains `main` at `5bbea3e`), against spec `docs/superpowers/specs/2026-11-22-ruken-from-your-computer-design.md` sections 4, 5.1, 5.2, the PR 1 rows of 5.3, 7 (A2, A3, A4, A5 games read, A9, A11, A16) and 8 (Pull request 1). No pull request yet (6 open).
- Lane: 3 (migration, a new way to sign in). Reviewer: fresh session, Opus 5.5, medium. Started 2026-11-22 15:04 UTC, written 15:13 UTC (from `date`).
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 6 red, 6 notes.** The design holds: keys are hashed, read only under `/api/v1`, the cookie is ignored there, every other route ignores the header, ownership is a 404 through one helper, uploads are refused before reading, and plain HTTP gets a 400. Two reds are real security gaps, each shown by a failing test (R1, R2). The other four are acceptance checks the spec names that are not written.

## What ran

| Check | Result | Commit |
|---|---|---|
| `pnpm install --frozen-lockfile` | exit 0 | `feb6665` |
| `pnpm lint` | exit 0 | `feb6665` |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings | `feb6665` |
| `pnpm test` | 130 files, 1901 tests passed | `feb6665` |
| `pnpm test:pg` (local Postgres 16) | 50 files, 753 tests passed | `feb6665` |
| Probe test (not committed, text below R2) | 2 of 2 fail: R1 and R2 confirmed | `feb6665` |
| `pnpm test:browser`, `pnpm build` | not run here; left to CI on the pull request | |
| The `request.cf` proof on `wrangler dev` (4.5 first step) | not re-run; the builder's checklist says done | |

## Red findings

### R1. The 20-computer cap is checked at Yes, but the key is made at finish

- UNIT: `src/features/accounts/computer-keys.ts` `answerSignIn` and `finishSignIn`.
- VERDICT: red.
- REQUIREMENT: spec 4.2 "at most 20 computers per maker"; A11 "the 21st computer is refused".
- REASON: `answerSignIn` counts only `ComputerKey` rows; codes already answered Yes but not yet finished are not counted, and `finishSignIn` never checks the cap. A maker at 19 who presses Yes on 5 codes before any finishes ends with 24 keys.
- EVIDENCE: probe "PROBE cap" at `feb6665`: 19 keys, an hour passes, 5 Yes all answer `yes`, 5 finishes: `expected 24 to be less than or equal to 20`.
- EXPECTED: the maker never holds more than 20 keys.
- FIX: in `answerSignIn`, count keys plus this maker's unexpired `ComputerSignIn` rows with `answer = "yes"`; and in `finishSignIn`, refuse (and delete the row) when the maker already has 20 keys, with `WORDS.tooManyComputers`. Add the probe's case to `tests/features/accounts/computer-keys.pg.test.ts`. Files: those two.

### R2. A Yes pressed before a password change, reset or Delete my account still collects a working key after it

- UNIT: `src/features/accounts/computer-keys.ts` `removeAllComputers` (called by `changePassword`, the reset in `auth.ts`, and `requestDeletion` in `deletion.ts`, which deletes `computerKey` directly).
- VERDICT: red.
- REQUIREMENT: spec 4.3 "a key stops working when the maker ... changes their password ..., resets it by text ..., asks to delete their account". The maker who pressed Yes by mistake and changes the password is the case this rule exists for.
- REASON: revocation deletes `ComputerKey` rows only. A `ComputerSignIn` row answered `yes` for that maker survives, and its terminal's next `finish` (within the 10 minutes) mints a fresh key.
- EVIDENCE: probe "PROBE revoke" at `feb6665`: Yes, `removeAllComputers`, then `finishSignIn` answers `yes` and `readKey` accepts the new key (`PROBE key works: true`). For Delete my account the new key is refused by `readKey`'s `active` test, but the row is still made; for the password change and the reset it works.
- EXPECTED: after any of the three, no key can be collected from a Yes given before it.
- FIX: `removeAllComputers` also deletes `computerSignIn` rows `where: { userId }`; `requestDeletion` does the same inside its transaction (`tx.computerSignIn.deleteMany({ where: { userId } })`). Tests: in `computer-keys.pg.test.ts`, Yes then `removeAllComputers` then `finishSignIn` is not `yes`; extend the deletion test the same way. Files: `computer-keys.ts`, `deletion.ts`, `tests/features/accounts/computer-keys.pg.test.ts`.

### R3. A4's checks that the key reaches nothing else, and leaves no trace in a log, are not all written

- UNIT: `tests/browser/computers.test.ts` ("the key reaches only the maker's API") and the tests near it.
- VERDICT: red.
- REQUIREMENT: A4, and spec 4.3 "a test sends a key that fails and searches the captured log for it (audit 1, N6)".
- REASON: three parts of A4 have no test.
  1. With a valid key in `Authorization`, the journey checks `/me`, `/me/computers`, `/me/link`, `/make` only. A4 names `/me/password`, `/me/delete`, `/join`, the Stripe webhook and every `/jobs/*`, each to answer exactly as with no header.
  2. "A key that fails is not in the captured log": the builder's note says this was checked by reading only. The spec asks for a test.
  3. "A sign-in pause on the maker's number leaves their key working": no test (grep for `pause` in `computer-keys.pg.test.ts` and `computers.test.ts` finds only the wrong-code screen).
- EVIDENCE: `tests/browser/computers.test.ts:96-123`; no test captures `console` output with a key.
- EXPECTED: each part is a test that fails when it breaks.
- FIX: (1) extend the journey's path loop to the A4 list, comparing status and `location` with the same request sent with no header (a POST for the webhook and `/jobs/*`); (2) a test that sends a failing `rk_` key to `/api/v1/me` and to an endpoint made to throw, captures `console.error`/`console.log`, and asserts the key is in none of it (a unit test of `api()` in `src/routes/api/v1/api.server.ts` with a spied `console` is enough); (3) a pg test: pause the maker's number the way `sign-in-pause-plugin` does, then `readKey` still answers the maker. Files: `tests/browser/computers.test.ts`, a new test beside the others under `tests/`, `tests/features/accounts/computer-keys.pg.test.ts`.

### R4. A11's per-maker limits have no test

- UNIT: `src/routes/api/v1/api.server.ts` `maker` (120 a minute) and `countUpload` (30 an hour); the video `PUT`'s 411.
- VERDICT: red.
- REQUIREMENT: A11 "the 121st request in a minute and the 31st upload in an hour get 429 with the plain words, also when spread over two keys of one maker ... a video PUT with no Content-Length gets 411 and nothing is stored".
- REASON: no test reaches either limit, so a wrong key name (say, keyed by `keyId` instead of `userId`) would pass. The 411 is checked (`computers.test.ts:171-185`) but not that nothing was stored.
- EVIDENCE: grep for `api:v1`, `121`, `31` and `Wait a minute` in `tests/` finds no such test.
- EXPECTED: tests that fail if the limit is per key, missing, or at the wrong number.
- FIX: a test of `maker` and `countUpload` with a test limiter and two `computer` callers of one maker: the 121st call and the 31st upload throw `Answered` with 429 and "Wait a minute and try again."; and after the 411 in the journey, `game <slug>` still says "Upright video: not added yet". Files: a new unit or pg test under `tests/` for `api.server.ts`, `tests/browser/computers.test.ts`.

### R5. A3's sign-out step does not check Your computers

- UNIT: `tests/browser/computers.test.ts` "a computer signs out, and the key stops at once".
- VERDICT: red.
- REQUIREMENT: A3 "A second computer signs in, runs sign-out, and then whoami answers 'Sign in again' and that computer is gone from Your computers".
- REASON: the test checks the 401 by a raw request, not `whoami`, and never opens `/me/computers`.
- EVIDENCE: `tests/browser/computers.test.ts:85-94`.
- EXPECTED: after `sign-out`, `whoami` prints "Sign in again" (or the not-signed-in words) and `/me/computers` shows "No computers can use your Ruken." (or no longer lists that name).
- FIX: add those two reads to that test. Files: `tests/browser/computers.test.ts`.

### R6. A9 does not check that nothing is stored, nor the words for the fake video

- UNIT: `tests/browser/computers.test.ts` "a video that is too big, not a video, or sent with no length is refused".
- VERDICT: red.
- REQUIREMENT: A9 "each get the browser's own refusal words, and nothing is stored (the bucket's key count is unchanged)".
- REASON: the `.txt` renamed `.mp4` reaches the server and is refused there, but the test asserts only the exit code, not the words; no step reads the bucket or the game back.
- EVIDENCE: `tests/browser/computers.test.ts:158-161` (no words asserted); no bucket or `game` read after the refusals.
- EXPECTED: the fake's refusal is `clipProblem`'s words, as the browser shows them; the game still has no upright video after all four refusals (or the bucket's key count is unchanged, as A9 says).
- FIX: assert the last line equals the browser's words for that file, and run `game <slug>` at the end expecting "Upright video: not added yet" (or count the bucket's keys the way other journeys do, if a helper exists). Files: `tests/browser/computers.test.ts`.

## Notes (not blocking, recorded)

- N1. `readJson` (`api.server.ts`) treats a missing `Content-Length` as 0 and then reads the whole body, so a chunked JSON body is not bounded by `JSON_MAX_BYTES`. The Worker's own request limit still applies. Follow-up: refuse a JSON body with no length, as uploads do.
- N2. `keep-old` always prints "Kept the old one" (`commands/games.js` `keepOld`); `words.keepNothing` ("Nothing was waiting for ...") is defined and never used, so a maker is told something was dropped when nothing waited. A PR 2 or fix-round wording item.
- N3. A2's "a code older than 10 minutes" is checked in `computer-keys.pg.test.ts` ("runs out after ten minutes"), not in the journey; the journey cannot move the site's clock. Accepted as the place for it. The wrong-secret case is checked by a raw request, not through the CLI; acceptable.
- N4. Neither `/me/link` nor any screen sends `frame-ancestors` or `X-Frame-Options`. A framed Yes is not reachable today because the session cookie is `SameSite=Lax` (`auth.ts:249`) and is not sent inside a cross-site frame. Worth a site-wide `frame-ancestors 'self'` later; out of this pull request's scope.
- N5. `finishSignIn` is limited per code before the secret is checked, so someone who has seen a code can make the real terminal wait. The CLI treats 429 as "keep waiting", so the cost is a delay inside the 10 minutes. No change asked.
- N6. Checked and holding: keys are 32 random bytes as `rk_` + 52 base32 characters, stored only as SHA-256 (unique index), shown once; the CLI keeps them in a 0600 file in a 0700 folder, `RUKEN_KEY` wins, and the CLI refuses any address that is not `https://` except `http://localhost`. `createHandle` reads the key only under `/api/v1/` and never the cookie there; every other route resolves the session only, and every `caller.kind` check in `src/` tests for `"user"`, so a `computer` caller opens no screen. `readKey` needs an `active` account and never calls `restoreOnSignIn`; 90 days unused stops a key; `lastUsedAt` written at most hourly. Password change, reset (in its own try, with a test that sessions still end when it throws) and Delete my account remove keys. `ownGameOr404` gives the same 404 for someone else's game, a thrown-away one and none, shared by the screens and the API, and every games endpoint finds the game before reading a body. The video `PUT` answers 411 with no length and 413 over 30 MB before reading, counts the upload, then `saveClip` runs `clipProblem` and holds a live game's video for review; staff's takedown and thrown-away games are refused. `keepTheOldOne` refuses a game that is not live, and the endpoint maps only `upright`, `wide`, `age`. `httpsOnly` answers `/api/v1` over plain HTTP with 400 and no `Location`, and still redirects everything else, under the https-site condition. The migration adds two tables with cascades and touches no existing table. The 18+ rules do not apply to anything PR 1 adds (no rating or marks endpoint yet).

## Probe used for R1 and R2

Run with `npx vitest run --project postgres <file>` at `feb6665`, then removed; not committed. It calls `startSignIn`, `answerSignIn`, `finishSignIn`, `removeAllComputers` and `readKey` from `computer-keys.ts` with a `TestClock` and `createRateLimiter`, exactly as `computer-keys.pg.test.ts` does. R1: 20 Yes, 19 finishes, 61 minutes on, 5 more Yes and finishes, count keys. R2: Yes, `removeAllComputers`, finish, `readKey` the new key.
