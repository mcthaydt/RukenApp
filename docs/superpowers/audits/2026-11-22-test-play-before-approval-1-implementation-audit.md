# Test play before approval: implementation audit 1

Lane 2 implementation audit of `claude/project-thread-m8mlbc` at **ad63721** (base 74bd185). Reviewer: Opus 5.5, medium, fresh session. Audit only; nothing outside this file was changed.

Brief (owner, 2026-11-22 16:04 UTC: "yes test-play before approval", as the coordinator's brief states it): `/make/<game>/play` lets only the game's maker play the newest draft copy, the copy waiting for review, or a live game's waiting copy, never the live one. Everyone else gets 404. No play session or beats are recorded. The strip and menu say "Test play. Only you can see this." Test play buttons on Your games, Check and send, and Waiting. The play screen moves to `src/features/play/PlayScreen.svelte`, shared by Play and test play.

## Verdict

**ad63721 FAIL: 1 red, 5 notes.**

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors |
| `pnpm test` (unit) | 129 files, 1,892 tests passed |
| `pnpm test:pg` (local Postgres 16) | **1 failed**, 726 passed (failed the same way on two runs) |
| `pnpm test:browser` `test-play`, `play`, `play-time`, projects tablet and computer | 56 passed (1.8 min) |
| Phone (WebKit) | not run here: CI only. No pull request exists for the branch yet, so no CI run to read. |
| Other browser journeys (`/make` screens that gained a button) | not run here; left to CI |

## Red

**R1. The database tests fail.**
UNIT: `tests/features/games/review.pg.test.ts:705` ("gives a maker's list, with each game's state in words").
VERDICT: red.
REQUIREMENT: the suite exits 0 (CLAUDE.md, "A check is a test that fails by itself"; `release` merges on green).
REASON: `gamesOf` rows gained `testPlay`, and this test compares the row with `toEqual`, so the new field fails it.
EVIDENCE: `AssertionError: expected [ { slug: 'review-game-48', …(4) } ] to deeply equal [ { slug: 'review-game-48', …(3) } ]`. The test file is not in the diff; the base's `MakerGameRow` has no `testPlay`.
EXPECTED: `pnpm test:pg` exits 0.
FIX: add `testPlay: true` to the expected row (a waiting game with files has something to try, which also checks the new field). Only `tests/features/games/review.pg.test.ts`.

## Checked and sound

- **Who gets in.** `testPlayOf` reads `game.findFirst({ where: { slug, makerUserId } })`, so another maker, a staff account that is not the maker, and a guessed slug all get the same null and the same `404 Not found`, from one query of the same shape (no extra query for an existing game that is someone else's, so no timing gap that tells a stranger it exists). Signed out, `signedInOnly` sends every address to sign-in alike. The 18+ refusal runs only after ownership, so it leaks nothing. The journey "nobody but the maker can test-play a draft" checks a stranger (404 on `/make/x/play`, `/g/x/play`, `/g/x`) and signed out (sign-in).
- **Which copy.** `testPlayPullId`: waiting copy when it differs from live; none when the waiting change is only a video or rating; newest for a draft or sent back; none for taken off, taken down, thrown away. Send-back clears `pendingPullId` (`sentBackNow`), so a sent-back game falls to its newest copy as intended. Unit tests cover every branch; `testPlayOf` pg tests and the journeys check the frame's pass names the pending pull, never the live one.
- **Files served safely.** The frame URL is made by `passFor`, the same as Play and staff's review look, and the game gate (`src/features/play/gate.ts`) serves `files/<game>/<pull>/` under the same CSP, `permissions-policy`, CORP and referrer rules whatever the pull. The page uses the same `GAME_FRAME_SANDBOX` and `GAME_FRAME_ALLOW`.
- **Nothing recorded.** `testPlay` makes no `playSession`; `PlayScreen` starts with `stopped = beats === null`, so no beat fetch and no `sendBeacon` on leave. A pg test checks zero sessions. The only row written is a `playPass` for the maker (reused for a day); nothing in `src` counts pass rows. No analytics code exists in `src`.
- **Play unchanged.** `diff` of the old `src/routes/g/[game]/play/+page.svelte` against `PlayScreen.svelte` shows only props in place of `data`, the beat address passed in, the test strip and menu line behind `testPlay`, and Leave's address and note passed in with Play's old values. `play.test.ts` and `play-time.test.ts` pass on tablet and computer.
- **Copy.** "Test play" and "Test play. Only you can see this." pass the drunk-grandma test. Your games' button carries the game's name for screen readers.
- **CRUD.** Test play makes nothing a user can create, change or delete; no journey is owed.
- Live-state file is gone at ad63721.

## Notes (not blocking, not fixed here)

- **N1. A live game's new copy before it is sent has no test play.** After a live game pulls new files and before Send, `pendingPullId` is null (`pullLatest` only moves it when something already waits), so `testPlayPullId` returns null and Check and send shows no Test play, while a draft's does. Inside the brief's wording ("a live game's waiting copy"), but the owner's ask was "before approval". Worth one line to the owner if they want it.
- **N2. `testPlay` repeats `reviewLook` line for line** (`src/features/play/sessions.ts`). One function with a neutral name would do; a simplification only.
- **N3. Hover preload runs the load.** `app.html` preloads on hover, so hovering Test play writes a `playPass` row before a press. Harmless (one row a day, reused) and the same as Play on `main`, but the memory rule is that a link whose load writes should not preload; `data-sveltekit-preload-data="off"` on the three buttons would stop it.
- **N4. No journey checks a staff account or a second maker by name.** The 404 for both follows from the `makerUserId` filter and the pg test covers "another user"; a staff journey would make it a check.
- **N5. Phone (WebKit) is CI only**, and no pull request exists yet, so it has not run at ad63721.
