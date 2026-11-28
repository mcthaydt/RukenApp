# Playtesting, implementation audit 3 (main merge)

Examined: `3b33ea405350b22de126b283b31c44fbe20aad62` (PR #460, branch `claude/project-thread-dndr0a`), the merge of main `f2849af` into `84fe4a0`, which audit 2 passed (`aee14e9` on `claude/project-thread-d5stck`). Lane 3. Opus 5.5, medium. Read only: nothing on the PR branch changed. Written 2026-11-28 13:50 UTC.

Scope: a narrow review, because the merge needed a conflict resolved by hand in `tests/browser/real-buttons.test.ts`, which makes audit 2's PASS stale (`release`, merge queue).

## Verdict

**PASS: 0 red, 1 note.** The hand resolution keeps both tests whole and changes nothing else; every line the PR changed carries over unchanged; main's `look.css` change does not reach any playtesting screen; the playtesting journeys pass on the merge. CI's quick run at this commit is red from a known flake in a file neither side touched (note N1), so the merge still needs a green full run.

## The conflict

- `git show --remerge-diff 3b33ea4`: the only file that differs from git's own merge is `real-buttons.test.ts`, and the only change there is dropping the three conflict markers and adding the `});` and blank line that close the PR's test before main's.
- Program check: the merged file equals the PR's file (`84fe4a0`) with main's block ("a waiting game's screen settles even when its clips never load") added once, byte for byte. The PR's test ("Playtesters, its invite sheet, and a playtester's and an asker's game page: every action is a real button") is in the merged file byte for byte.
- `git diff c82fc88 84fe4a0` (the PR's own change) and `git diff f2849af 3b33ea4` name the same files, and their changed lines under `src`, `tests` and `prisma` are identical.

## What main brought in, and the playtesting screens

- `src/lib/look.css`: only `aspect-ratio` on `.tiles .tile[data-shape="upright"|"wide"]`. `.tiles` is used only by `src/routes/make/parts/GameLaidOut.svelte`; no playtesting class or screen (`.playtestbadge`, `.playtestplay`, `.playtestask`, `button.go`, `.live a.go`, Playtesters, the invite sheet) uses it. No focus or outline rule changed.
- `tests/browser/support/look.ts`: `layoutHasSettled` no longer waits for a video that has an `aspect-ratio`. The playtesting overlap and fit cases do not call it; `real-buttons` does and passes.
- `tests/browser/join-and-help-look.test.ts`: the paywall keyboard case waits for the page to come alive first (#464). Passes.

## What ran (in this cloud container, at 3b33ea4)

- `pnpm lint`: exit 0. `pnpm typecheck`: 2416 files, 0 errors, 0 warnings.
- Browser, tablet and computer (Chromium; no WebKit here, so the config's WebKit warm-up was dropped and phone did not run), no retries: `playtest.test.ts`, `playtest-refusals.test.ts`, `controls-overlap.test.ts:304` (320×568, 375×667, 667×375), `fits-the-screen.test.ts:329`, `gamepad.test.ts:515`, `glass.test.ts:103`, all of `real-buttons.test.ts` (both tests from the conflict included) and `join-and-help-look.test.ts:101`: 73 passed, 1 skipped (the overlap case on computer, phone sizes only by design), 0 failed.
- CI run 46150196046 (quick, draft) at 3b33ea4: `verify` and `postgres` green; browser shard 2 of 6 failed one test and the other shards were cancelled, so the gate is red.

## Notes (not blocking)

- **N1. CI red from a known flake.** `tests/browser/make-walk.test.ts:59` [phone], "the files question says it in words when GitHub answers \"busy-branch\"", job in run 46150196046: at line 66 the Branch select stayed hidden for 5 s after the click on "Change the branch or folder" (`element is not visible`). The same line failed the same way on #463 (run 46135701897) and #464 (run 46138641175); both are under "Flaky tests" in `progress.md`. Neither side of this merge touches `FilesQuestion.svelte`, `make-walk.test.ts` or `tests/browser/support/game.ts`, and no changed `look.css` rule reaches that screen. Expected: this run is recorded as a third sighting under "Flaky tests", and the flake's cause is found in its own thread. The merge needs the full run green; this review does not stand in for it.
