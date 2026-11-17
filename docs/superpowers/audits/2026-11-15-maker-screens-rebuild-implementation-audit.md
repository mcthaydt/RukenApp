# Implementation audit: the maker screens rebuild (slice 2, branch M)

Date: 2026-11-15. Branch `slice-2/submit` (pull request #63, a draft) at `72d3e3d`. Read against: the spec (`docs/superpowers/specs/2026-11-14-maker-screens-redesign-design.md`, sections 1, 3 to 5c, 12, 15), the plan (`docs/superpowers/plans/2026-11-15-maker-screens-rebuild.md`), its plan audit, `progress.md` (the M row, its rulings and deviations, Task 11) and the roadmap on `main`. The code read is the whole diff of the branch against `main` (116 files outside `docs/`), with the service, the migrations, every route under `src/routes/make/` and `src/routes/help/github/`, and the journeys' names and helpers read line by line.

No test, lint or typecheck ran in this session. CI was read with `gh`.

## The result

The build does what the plan says, nearly everywhere. Every Review Focus item has its test, the words match the plan's tables, the colours follow the button rule, nothing under `src/routes/` carries its own style, no new dependency came in, and the last code commit is green. Two things are wrong in a way a maker would hit, and one of them leaves a live game stuck for good once branch S lets staff send an update back. Neither is reachable on this branch alone, because no staff screen exists yet.

- **Blocker: 1** (before branch S builds Task 30).
- **Should fix: 6.**
- **Notes: 12**, of which 6 are the flags the brief asked to check.

## CI

- Last code commit: `3cdc704`, run 43702379831, green on every job (verify, postgres, browser shards 1 to 3, the aggregate). Read from the run.
- Head `72d3e3d` changes only `progress.md`. Its run, 43703619865, was still going when this audit was written: verify and postgres passed, the three browser shards were running. Not read to the end.
- The branch is 32 commits behind `main`. They change only `docs/` and `.github/workflows/auto-merge.yml` (the clean-up job), no code. `progress.md` changed on both sides, so the merge of `main`, needed before #63 can merge, may meet a conflict there.

## Blocker

**B1. A live game whose update is sent back for anything but its name, its line or where it plays can never send a new version again.**

- How: `sendBack` (`src/features/games/service.ts:372`) takes any of the eight parts for a live game and puts them in `toFix`. `sendForReview` refuses while `toFix` is not empty ("Fix what was sent back first.", line 320). A live game can only answer its name, line and where it plays (`LIVE_MAY_CHANGE`, line 455; the question route's `LIVE_MAY_ANSWER`, `src/routes/make/[game]/[question=question]/+page.server.ts:54`). The "Fix this" card for the files or a video links to that question (`src/routes/make/[game]/+page.server.ts:38`), which is a 404 for a live game. "Send a new version" (`newVersion`, line 137) copies the newest files, but a passing copy does not take `files` out of `toFix`; only `saveAnswer("files")` does.
- What a maker meets: staff send back her update with "It doesn't start." (the likely reason, since an update is new files). The Live screen says "Fix it, then send a new version." The card leads to a page that is not there. "Send a new version" says "Fix what was sent back first." every time. Nothing she can do clears it.
- Why it is not yet live: no staff screen exists until Task 30 (branch S). The journey for this screen (`tests/browser/make-after.test.ts:242`) uses the one line, which a live game can change, so it passes.
- Progress already flags "a Live game's sent-back update can only be about the name, the line and where it plays" (ruling 3) as for later. That is right about the videos, but nothing enforces it, and the files are the update itself.
- Smallest fix, for stage 6 to choose: a copy that passes takes `files` out of `toFix` in `pullLatest` (as the files answer already does), and `sendBack` on a live game refuses the parts a live game cannot change (the two videos, the rating, the websites) until slice 4 builds those. A pg test of each, red first.

## Should fix

**S1. "Send it again" on a sent-back game can send older files than the game now points at.** `sendForReview` counts the files as answered whenever a pull exists (`hasFiles: true`, `service.ts:313`) and never reads `pullProblem`. A refused copy writes no pull row and sets `pullProblem`, so the older passing pull is still the newest. On a sent-back game the maker changes the folder, the copy is refused (the files question shows "Needs fixing"), and the Sent back screen still shows "Send it again" because nothing is in `toFix`. Pressing it sends the old pull to staff. Check and send is safe (it asks `firstUnanswered(answersOf(game))`, which reads `pullProblem`); the Sent back screen's `send` action and the service are not. Fix: `sendForReview` builds its answers with `answersOf`, or refuses while `pullProblem` is set.

**S2. Staff's own line shows twice on a "Something else" card.** For `something_else`, `makerWords` answers the note (`send-back.ts`), and `partsToFix` also passes the same note as `note` (`service.ts:736`). `FixCard.svelte:17` prints the words, then the note under them. The journey for staff's line (`make-after.test.ts:70`) uses `too_dark` with a note, so it never sees the double. Fix: `note` is null when the reason is `something_else`.

**S3. Live lays out both videos and all four chips; the spec and the plan draw one video and fewer chips.** Spec 5c: "beside the headline and the two buttons sit the video … (the upright one on upright screens, the wide one on wide), the name and the line …, and where it plays as a chip". The plan (Task 8) adds the rating chip. The build reuses `GameLaidOut` (`LiveScreen.svelte:110`), so Live shows both videos side by side, the repository chip and the websites chip too. Not recorded as a deviation in `progress.md`. Either build it as drawn, or record it and put it to the Owner at the screen review.

**S4. A failed reconnect from the files question says nothing when she is already connected.** The callback sends a refused code to `/make/<game>/files?github=failed`, but `FilesQuestion.svelte:180` shows "GitHub didn't connect. Try again." only on the not-connected screen. A connected maker who pressed "Don't see your game? Choose it on GitHub" and came back with a refused code sees her old rows and no word that it failed. Fix: show the line on the choose and pick screens too, with a journey.

**S5. The stranger test does not cover every address a later task added.** The plan says each task adds its addresses to `MAKER_ADDRESSES` (`tests/browser/support/game.ts:122`). Missing: the two `?/clip` posts, `marks`, `throw-away`, `?/newVersion`, and `/make?/throwAway` with another maker's address. The code is right (every one goes through `ownGame`, and `throwAway` re-reads with `gameForMaker`), but nothing would catch a later break. Add them; they should pass at once, so this is a test gap, not a red.

**S6. The service takes the websites list as given.** Every other answer is checked again in `saveAnswer`; the websites are checked only in the route (`connectHostsFrom`), and `saveAnswer` keeps whatever list it is handed (`service.ts:551`). A later caller (staff, the apps) would skip the check. Fix: check the list in the service, as the other answers are.

## Notes

The brief's flags, each checked:

1. **Task 10's red never showed its cases failing for the right reason.** Confirmed: run 43698869949 (head `02b2537`) stopped at `pnpm lint` in verify, and the browser shards were cancelled. The same is true of other reds' browser parts: Task 1 (cancelled at the old 15-minute limit), Task 2 (cancelled by the green push), Task 4 (cancelled by the green push), Task 5 (lint, a wrong-reason red). Progress says each plainly. No test can be re-reddened now without changing code, so this stays a note: the cases were read passing, not failing.
2. **Missing look pictures.** Re-counted from the three `playwright-report` artifacts of run 43702379831 (the report's own attachment list, not by eye): 44 named screens, all on nine projects except "question 1 with the card of what players will see" (three, as intended). Missing, as progress says: question 6 (the wide video) on every project; the files question's "connected, nothing chosen on GitHub" and its "Copying your game…" wait; the websites question with nothing refused. Also missing, not in the plan's Task 11 list but on screens that exist: Live with an update waiting, Live with a sent-back update, Sent back with staff's own line, and a question being changed ("Save", no counter). The screen review needs all of them before it starts.
3. **A live game's sent-back update is limited to name, line and where it plays.** See B1: the limit is not enforced, and the files are the update.
4. **`isClipKey` is used only by its test.** True, but it is on `main` already (`src/features/games/clips.ts:36`); this branch did not add it. Out of this branch's scope; report it to whoever owns the gate.
5. **Commit `e39a1a1`'s message says the circles are not built.** Confirmed; `0873fa2` builds them. History is not rewritten.
6. **Owner rulings.** Circles: only `.drift` behind Live, `border-radius: 50%` appears once in `look.css`, and the look test names it as the only exception. Sideways-phone Check and send videos may be under 180: the exact-height check skips the sideways phone and tablet, the three-quarters floor stays. Both hold.

Found in this audit:

7. **Off-Ruken games can still change their videos.** `saveClip` refuses only `live` (`service.ts:188`); a `taken_off` or `taken_down` game's question pages open and its clip post is kept. `saveAnswer` refuses those states. Not reachable in slice 2 (nothing makes either state yet); for Task 31 and slice 4.
8. **Your games paints only "Sent back…" blue.** `+page.svelte:37` tests `words.startsWith("Sent back")`, so "Live. Your update was sent back. See what to fix." is plain. Spec 15.1: "Sent back in a list is blue text." Small; for the screen review.
9. **Check and send on a waiting game.** "Change something" leads there; its top bar says "Finish later" and its button "Send for review" for a game already sent. A change on a waiting game is kept straight away, so the button only sends the same game again. Words for the screen review.
10. **Throw away puts the red button before the green one** in the page's order (`throw-away/+page.svelte`); focus starts on "Keep it", so Enter is safe. For the screen review.
11. **Live's "Send a new version" outline is blue on the dark background** (`look.css`, `.live button.outline`), where Task 1 says an outline on the felt is chalk. The journey checks blue. For the Owner's look.
12. **Thirty-three commits on this branch carry the author name `mcthaydt`, not `McThayDT`.** All are from 2026-11-14, before the identity rule; the email is right, and `main` already holds 201 such commits. Nothing to do: history is not rewritten.

## What holds, checked

- Tasks 0 to 11: each task's files exist, the old form, `ClipPicker.svelte` and `make.test.ts` are gone, and the old journeys' table is carried in progress.
- The tables: both migrations as the plan writes them; `Game_marks_check`, `Game_answered_check` (with the old state names), `GameReviewPart_note_check` and the add-only trigger are there. The drift check passes in CI.
- `questions.ts` and `send-back.ts` match the plan's interfaces; the fifteen reasons match the plan's table word for word.
- The service: `startGame`, `saveAnswer` by state, the address that follows a draft's name and stays once accepted, marks cleared below 18+, `sendBack` with its four refusals in one transaction, `accept` emptying `toFix`, `throwAway` database-first with `deleteAll` on both folders, and `deleteAll` refusing a prefix without a slash.
- Every maker page and action finds the game through `ownGame` (a 404 for anyone else's); the GitHub state seals the game and the callback only redirects.
- The words on every question, the how-to page, the agreement ("Version 1 · Last updated 14 November 2026"), Check and send, Waiting, Sent back and Throw away are the plan's.
- No `<style>`, `style=` or colour under `src/routes/`; no `Date.now()` in the new code; "Change", never "Edit"; no "Tap".
- `ci.yml` changed twice on this branch, each commit quoting the Owner ("Raise browser limit to 25mins"; "Do A and B").
- Nothing private is in the diff.

## Not checked

- The pictures were counted, not looked at: that is the screen review.
- Nothing was seen on a real phone, a real Safari or a slow device.
- The branch's 32 commits behind `main` were not trial-merged.
- The head's own CI run was not read to the end (above).
