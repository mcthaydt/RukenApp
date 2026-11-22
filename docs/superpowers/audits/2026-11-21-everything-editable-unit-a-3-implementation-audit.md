# Everything editable, unit A: implementation audit 3 (re-check)

**5abd08d PASS**

- Examined: `mcthaydt/RukenApp` branch `claude/project-thread-85j3yr` at 5abd08d (two commits after audit 2's PASS at 38cf1e0: af42b33 and 5abd08d), against `main` at 6dcd1e0. No pull request yet.
- Scope: everything 38cf1e0..5abd08d, checked against audit 1's R1 and R2, audit 2's N8 (the deadlock), and whether the test changes are honest.
- Lane 3. Auditor: Opus 5.5, medium. Read only: nothing committed; one file was swapped to its 38cf1e0 copy to run the new test against the old code, then restored (`git status` clean).
- Written 2026-11-21 18:18 UTC (from `date`).

## What I ran

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings |
| `pnpm test` | 117 files, 1706 tests passed |
| `pnpm test:pg` (local Postgres 16) | 43 files, 686 tests passed |
| New purge test against the old order | `deletion.ts` from 38cf1e0: the new test fails ("Transaction failed due to a write conflict or a deadlock"); at 5abd08d it passes. `purge.pg` + `live-held.pg` 38/38, three runs in a row |
| `pnpm test:browser` for `make-live-changes`, `make-after`, `make-design-pass`, tablet and computer profiles | 108 passed, 20 skipped (the files' own skips), 0 failed |
| Same, phone profile (WebKit) | **not run**: WebKit is not installed in this container. CI must run it. |
| Rest of the browser suite | not run here; CI on the PR head. |

## Nothing reopened

- **R1 (held file deleted under a yes):** `saveHeldClip`, `takeOff` and `keepTheOldOne` are unchanged except `takeOff`'s local `now` renamed to `current` (audit 2's small note). The three race tests in `live-held.pg.test.ts` still pass.
- **R2 (files outside row A):** the new commits touch only paths already named in section 6 row A or its added list (`look.css`, `look.test.ts`, `laid-out*.ts`, `GameLaidOut.svelte`, `QuestionScreen.svelte`, `VideoQuestion.svelte`, `LiveScreen.svelte`, the question route, `src/routes/make/[game]/`, `service.ts`, `deletion.ts`, browser and pg tests, `tests/browser/support/database.ts`). Nothing new outside.
- **N8 (deadlock):** fixed. `takeGamesOff` now updates the games (clearing the held columns) and then deletes their held rows, so every path takes `Game` before `GameHeldClip`. The new test holds the game's row as a yes does, waits until Postgres shows the purge stuck on it, then deletes the held row and commits: the purge finishes (1), the game is off and no held row is left. On the old order it fails with a deadlock (table above), so it is a real check. Its readiness loop counts any lock wait in the test's own database, which is per file, so it cannot be fooled by another file.

## Test changes: honest

- `make-design-pass` P11: the note "It replaces the version that is waiting." now shows only when a new copy of the files waits (`newCopyWaits`: pending copy differs from the live copy), not whenever anything waits. The old seed (`updateWaiting`) leaves the live copy itself as the pending one, which no longer means "a new version waits", so the test adds `leaveNewCopyWaiting` to make that state for real (a new `GamePull` and `pendingPullId` pointing at it). The test still asserts the headline, the button and the sentence. Not weakened: it now sets up the condition the words describe. Name it in the PR body (G5).
- `make-after` "offers Change on its videos": two exact link names became one regex per shape, `^Change the (upright video|video for phones)$` and `^Change the (wide video|video for computers)$`, each still `toHaveCount(1)`. The alternatives are per shape, so one link cannot satisfy both; it allows the drawn video's bare Change or the other video's worded link, which depends on the window. The two direct `GET`s for `/upright` and `/wide` stay. Name it in the PR body.
- `make-live-changes` (added in this branch): `changeVideo` uses the same per-shape regex; the GitHub-refused journey now expects "Not sent yet" instead of "Waiting for review" (the point of N3's fix); the sent-back journey adds a check that no `.waits` mark shows; two new journeys cover the not-sent mark and the question screens' notes, the "Change your … video" heading, and that Save comes before Keep the old one so Enter saves.
- `look.test.ts`: adds the two new class names, `other` and `keep`, to the lists of classes the screens may use. Name it in the PR body.
- `tests/browser/support/database.ts`: adds one helper; no existing helper changed.

## Notes (not blocking, recorded)

- **N9 (new). The question screens still say "Waiting for review" for a change that is not sent.** Live now marks it "Not sent yet" when nothing is pending (`laid-out.server.ts`), but the video question's note (`video.waiting: held !== null`, question route line 143) and the rating question's new note (`ratingPlayersSee`, `game.held !== null`) say "Waiting for review" whatever `hasPending` is. Example: rating 7+ held, wide video sent back; Live says the rating is "Not sent yet", `/age` says "Waiting for review. Players see 12+ until we say yes." Not red: no criterion names these words, and N3 was a note. FIX if cheap: use the same `hasPending` test as `laidOut` for both notes, with words for the not-sent case (for example "Not sent yet. Players see 12+ until we say yes."). Files: `src/routes/make/[game]/[question=question]/+page.server.ts`, `+page.svelte`, `VideoQuestion.svelte`, a journey.
- Audit 2's notes N1, N2, N5 second half and N6 stand. N3 is fixed on Live (see N9 for the question screens). N4 and N8 are fixed.

## Still owed before merge (open, not red)

- G1: the whole browser suite on CI, including the phone (WebKit) profile.
- G4: the design round's fresh reviewer on the new screens and words.
- G5: the PR body names every changed existing test: audit 1's list, plus `make-design-pass` P11, `make-after` (the link names), and `tests/lib/look.test.ts`.
