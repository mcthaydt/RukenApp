# Everything editable, unit A: implementation audit 2

**38cf1e0 PASS**

- Examined: `mcthaydt/RukenApp` branch `claude/project-thread-85j3yr` at 38cf1e0, against `main` at 6dcd1e0 (the branch already contains it). No pull request yet.
- Brief: `docs/superpowers/specs/2026-11-21-everything-editable-design.md`, section 5.1, section 6 row A, criteria G1 to G6 and A1 to A11. Round 1: `2026-11-21-everything-editable-unit-a-1-implementation-audit.md` (aadb165, FAIL: 2 red).
- Lane 3 (a migration). Auditor: Opus 5.5, medium. Read only: nothing in the repo was committed or left changed (one file was swapped to its aadb165 copy to run the new tests against the old code, then restored; `git status` clean).
- Written 2026-11-21 17:39 UTC (from `date`).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

No red findings at 38cf1e0. Both round 1 reds are fixed and proven. Still owed before merge, as round 1 said (these are open, not red): G1 on CI (browser journeys), G4 (the design round's fresh reviewer), G5 (the pull request body). One new note on lock order (N8) is cheap and worth folding in before the PR opens.

## What I ran

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ok |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings |
| `pnpm test` | 117 files, 1704 tests passed |
| `pnpm test:pg` | **ran this round** on a local Postgres 16: 43 files, 685 tests passed |
| New race tests against the old code | `service.ts` from aadb165 with the 38cf1e0 tests: the 3 new tests fail (`3 failed, 21 passed`); restored to 38cf1e0: `24 passed`, three runs in a row |
| Lock-order deadlock (N8) | reproduced with two `psql` sessions, see N8 |
| `pnpm test:browser` | **not run** here. CI must run it on the PR head (G1). |

## Round 1 findings

### R1, held file deleted under a yes: fixed

- `saveHeldClip` (`src/features/games/service.ts` around line 321): uploads, then in one transaction `updateMany` on the live game (takes the row lock, so a yes in progress finishes first), then reads the held row it replaces, upserts, and deletes only that key after commit. If the yes landed first, the held row is gone and nothing is deleted; if the save landed first, it bumps `changedAt`, so the yes's `seen` check refuses a stale look (409).
- `takeOff` (around line 1128): `SELECT ... FOR UPDATE` on the game, re-checks it is still live, reads held keys, deletes the rows and takes the game off in one transaction, then deletes only those keys.
- `keepTheOldOne` (around line 1076): now locks the game first too, which also fixes round 1's N5 first half (the 500 against a concurrent yes): the third new test proves it returns normally.
- Evidence: the three tests in `tests/features/games/live-held.pg.test.ts` ("a yes that lands while the maker is changing the game") hold the game row on their own connection, wait until Postgres shows the racer stuck on the lock (not a sleep), apply what `accept` does, and check the live file survives. They fail on aadb165's service and pass on 38cf1e0 (table above). They mimic `accept`'s writes in SQL rather than calling `accept`; that is fine, since the property is about the maker's side and `accept`'s order is unchanged.

### R2, files outside row A: fixed

- Section 6 now lists every extra file with its reason. I checked the list against `git diff --stat origin/main...38cf1e0`: every changed path outside the original row is named. No other path appears.

## Lock order (the coordinator's ask)

| Path | Takes first | Then |
|---|---|---|
| `accept` | advisory decision lock (when a schedule is set) | `Game` row `FOR UPDATE`, then `GameClip` / `GameHeldClip` rows |
| `sendBack`, `sendOutDecisionDays` | advisory decision lock | `Game` row by update |
| `saveHeldClip` | `Game` row (update) | `GameHeldClip` row |
| `keepTheOldOne`, `takeOff` | `Game` row `FOR UPDATE` | `GameHeldClip` rows |
| `saveAnswer` | `Game` row (one update) | nothing |
| purge `takeGamesOff` | **`GameHeldClip` rows** (deleteMany) | `Game` rows (updateMany) |

Maker paths never take the advisory lock, so advisory then `Game` cannot invert. Every service path takes `Game` before `GameHeldClip`. The purge is the one path in the other order: N8.

## Notes (not blocking, recorded)

- **N8 (new). The purge takes held rows before the game; a yes takes the game before held rows. They can deadlock.**
  - UNIT: `src/features/accounts/deletion.ts`, `takeGamesOff` (added by this branch for A11).
  - REASON: `gameHeldClip.deleteMany` runs before `game.updateMany`; `accept` locks the game and then deletes the held row. If staff say yes to a held video on a maker's game at the moment that maker's purge runs, each waits on the other.
  - EVIDENCE: two `psql` sessions on Postgres 16 with a game row and a child held row, one in `accept`'s order and one in the purge's order: `ERROR: deadlock detected ... while updating tuple (0,1) in relation "g"`. Postgres aborts one: if the purge loses, the claim rolls back and the next daily run retries; if the yes loses, staff see an error and the game is gone on retry. No wrong data is kept, which is why this is a note. (Separately, and already true on `main` since #268: the purge deletes the bucket's `clips/` folder before its transaction, so a purge that aborts leaves a live game without video files until the next run.)
  - EXPECTED: one lock order everywhere: the game first.
  - FIX: in `takeGamesOff`, update the games before deleting their held rows (the held columns are cleared in the same `updateMany`, so `Game_held_check` still holds), or lock the maker's games `FOR UPDATE` first. Files: `src/features/accounts/deletion.ts`; the existing purge pg test must still pass.
- **N5 second half (round 1), judged: note, not red.** `saveAnswer` reads the game, then writes in a separate step. If a yes lands between them: a maker who answered with the live rating (to drop the held one) ends with the yes's rating live and nothing held, or a maker who answered with the held rating leaves a held value equal to what is now live, which goes for a review of nothing. No constraint is broken, no file is lost, and Live then shows the maker the true state, so they can change it again. The window is the time between one read and one write. Fix if cheap: `SELECT ... FOR UPDATE` on the game in a transaction, then re-read `ageRating`, `contentMarks` and the held pair before deciding `sameAsLive`.
- **N3 (round 1), judged: note, not red.** "Waiting for review" shows on a held change that has not been sent while something else is still to fix or a GitHub copy was refused. The spec's wording allows it; it is a words question for the design round (G4), not a broken criterion.
- **N7 (round 1), still open as G4.** The design round's fresh reviewer has not run. It is a criterion, so the unit is not done until it runs, but it is the next step the spec sets (step 7), not a defect in this code.
- **N4 (round 1): fixed.** The note under "Send a new version" now says the files it copies replace the waiting files and a waiting video or rating stays (`LiveScreen.svelte`). Its test change in `tests/browser/make-design-pass.test.ts` (P11) is a G5 change and must be named in the PR body.
- Small: `takeOff` names a local `now`, which hides the service's `now()` clock inside that transaction. Nothing there calls `now()`, so it works; a future edit that does would break. Rename it (for example `current`) if touched again.
- Round 1's N1, N2 and N6 stand unchanged.

## Criteria, one line each

| Criterion | Verdict | Evidence |
|---|---|---|
| G1 | Open | lint, typecheck, unit and pg green here; browser journeys need CI on the PR head. |
| G2 | Pass (read) | Unchanged since round 1. |
| G3 | Pass (read) | Unchanged since round 1. |
| G4 | Open | Design round not run (N7). |
| G5 | Open | No PR body yet. It must name round 1's list plus `tests/browser/make-design-pass.test.ts` (P11, the reworded note). |
| G6 | Pass | R2 fixed: the spec's row A names every changed file. |
| A1 to A3, A5, A6, A9 | Pass | As round 1; pg tests now ran green here. |
| A4, A8, A10 | Pass | R1 fixed; new race tests fail on the old code and pass now. |
| A7 | Pass | pg test ran green here. |
| A11 | Pass, note N8 | pg purge test ran green here; lock order note N8. |
