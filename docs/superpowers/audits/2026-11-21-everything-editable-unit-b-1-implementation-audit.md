742a96a PASS

# Implementation audit 1: everything-editable Unit B (lane 2)

Examined: mcthaydt/RukenApp, branch claude/project-thread-85j3yr at 742a96a (main fe5f5ee merged in; the diff against main is 13 files). Spec: docs/superpowers/specs/2026-11-21-everything-editable-design.md section 5.2, criteria B1 to B5 and G1 to G6. Read only: nothing in the repo was changed.

## What ran here (measured)
- `pnpm lint`: clean. `pnpm typecheck`: 0 errors, 0 warnings. `pnpm test`: 119 files, 1769 tests passed.
- `pnpm test:pg` on `service.pg.test.ts` and `decision-day.pg.test.ts`, against a local Postgres 16: the project ran 44 files, 713 tests, all passed.
- Journeys `make-waiting-and-off.test.ts` and `make-after.test.ts` on the computer profile: 27 of 27 passed.
- NOT run: the phone profile (WebKit is not installed in this container; the five failures there are "browser missing", not the code), the tablet profile, and the full journey suite. CI's own run on the pull request is the evidence for those.

## Criteria
- B1 PASS. Journey: waiting game thrown away from its Waiting screen; "Throw it away" is below "Change something"; keyboard Enter reaches the question; the game leaves Your games and staff's `list`; its name makes a new game with the plain address. A second journey shows "Keep it" changes nothing.
- B2 PASS. pg test in decision-day: throwing away a waiting game that holds a yes frees its seat at once, and on the day the outcome is `lapsed`, the game stays thrown away. A second test holds the game's row from another connection and shows a yes that lands first makes the throw-away refuse and the game stay live. `throwAway` takes the decision lock then the row lock, the same order `accept` uses (service.ts lines 658, 757, 1219).
- B3 PASS. Journey: take off, change the line and the upright video from the Taken off screen, Put it back, staff accept, a signed-out window sees the new line and a different video address. It also shows nothing waits for staff and `/g/<game>` is 404 while the game is off.
- B4 PASS. Journey: "Delete it for good" by keyboard, the confirm screen, then the game is gone from Your games, `/g/<game>`, the old clip address and `/make/<game>` all 404.
- B5 PASS. pg tests: live and taken_down still refused; a game already thrown away is NOT_FOUND; another maker's game is NOT_FOUND in draft, waiting, sent_back, live, taken_off and taken_down (and nothing changes).
- G1 not mine to judge here: CI on the pull request. G2 PASS (the new links are focused and pressed with Enter). G3 PASS (above, plus the journey with a second account that posts the throw-away by hand). G4: for the design round's reviewer. G6 PASS with the note below.
- CRUD: Unit B's things are a waiting game and a taken-off game. Create is earlier units. Read, change (line, video) and delete each have a journey. Nothing missing.

## Are the existing-test changes honest? Yes
- `service.pg.test.ts` "refuses a game that is taken off or down" became two allowed cases (taken off takes every answer and holds nothing; keeps files and websites and copies nothing) plus "refuses a game that staff took down", which now also asserts `saveClip` is refused and writes no clip. The taken-down refusal is kept and made stronger, not removed.
- `throwAway` "refuses a waiting game and a live game": waiting moved to the allowed cases per spec 5.2; live is still refused, taken_down added; they also assert the clips stay. "Another maker's game" grew from one draft to all six states.
- `make-after.test.ts` "a game that is waiting or live has no way to be thrown away" became "a live game has no way...": the waiting half was the old rule the spec reverses, and waiting is covered by the new journey. The live half is unchanged and gained an assertion that "Throw it away" is absent.
- No assertion was loosened to pass. The reversed ones match spec 5.2 line for line.

## Notes (not blocking)
1. The pull request body must name each changed test and why (G5), using the list above, and name two files the spec's row for B does not spell out (G6): `src/routes/make/parts/FilesQuestion.svelte` (the "Save keeps your choice" line, needed for taken-off games) and `src/routes/make/[game]/[question=question]/` (needed to let the question screens work for taken-off games).
2. `make-after.test.ts` keeps `for (const { slug } of [live])` after the waiting entry was dropped: a one-item loop. Harmless; tidy it if the file is touched again.
3. `saveClip` now also refuses `taken_down` and `thrown_away` (a small hardening beyond the spec text, within the unit's file and covered by a test). Mention it in the body.
4. Phone (WebKit) was not run by the builder or here; it must be green in CI before merge.
