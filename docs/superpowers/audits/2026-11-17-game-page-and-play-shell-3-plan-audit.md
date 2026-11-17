# Plan audit: the game's page and playing it (cycle 3)

Date: 2026-11-17 (written 06:30 UTC). Commit examined: `c07ab1e` on `claude/project-thread-ozoxv5` (PR #193). It is two commits after cycle 2's `fdc36a9`: `455dd72` (every game plays on phones and computers, Unit R) and `c07ab1e` (the player count answer, and genre, tags and languages). The same session as cycles 1 and 2, Opus 5.5, medium.

Read: the diffs `39acaef..c07ab1e` of the spec and the plan, in full. Against them, the Owner's words: "All games must be playable on computer and mobile" (06:25 UTC); the card "Off until the maker turns it on" (06:28 UTC); and "We need to add in the bits to game submission that we don't have like languages and tags/genre, everything steam pages have, we have" (06:27 UTC). Each of the three is quoted in the spec and was checked against the setup thread's record. On the code, each name Unit R gives was looked for on the checkout (the same tree as `main` at `78008fc` outside `docs/`). No test ran: this audit reads a plan.

## Verdict

**The game page, the play screen and Unit P (spec and Tasks 20 to 25): nothing red.** The all-platforms rule is carried through. No computer-only path, line or journey is left in the spec or in Tasks 20 to 23 (searched: "computer-only", "needs a computer", `computer_only`, `needsComputer`). The iPad case is now a device-line check (Review Focus 8, and the journey "the device line names a tablet that says it is a computer"), and Share keeps a journey of its own. P6 is settled in the Owner's words (spec 5, decision 9.3). Genre, tags and languages are only placed in section 6 and are not built, drawn or stubbed, which keeps to the Owner's earlier card ("Now: what Ruken has").

**Unit R (Task 26), new in this commit: 5 red,** all bounded edits to the plan. They are names and files that do not match `main`. R is lane 2 and has no migration, which is right: the enum and the column stay, and `Game_answered_check` is met by writing `phone_and_computer`.

## Unit R reds

### R1. red: `createDraft` does not exist

- UNIT: Task 26, Files (`src/features/games/service.ts`); Step 1.
- REQUIREMENT: Global Constraints: a name said to be on `main` that is not there is a finding.
- EVIDENCE: no `createDraft` in `src/` or `tests/`. A game is started by `startGame` (`src/features/games/service.ts:446`), whose `db.game.create` writes only `publicId`, `slug`, `makerUserId` and `name`.
- FIX: say `startGame` writes `playsOn: "phone_and_computer"`, and call it that in Step 1. Files: the plan only.

### R2. red: the upright video question still reads `computer_only`, and is not in the file list

- UNIT: Task 26, Files.
- REQUIREMENT: Unit R's criterion "nothing reads `computer_only` any more"; "No other screen says where a game plays".
- EVIDENCE: `src/routes/make/parts/VideoQuestion.svelte:34` (`computersOnly: boolean`) and `:123–125` ("Phone players see this in the feed, even if your game is for computers."), fed by `[question=question]/+page.server.ts:133`. The plan removes `computersOnly` from the server file but does not list `VideoQuestion.svelte`, so typecheck fails or the line is left behind.
- FIX: add `src/routes/make/parts/VideoQuestion.svelte` to Modify (the prop and the note go), and to Step 3's visual check (the upright video question). Files: the plan only.

### R3. red: a journey that counts the questions is missing from the list

- UNIT: Task 26, "Modify, tests" ("the journeys that walk the questions").
- EVIDENCE: `tests/browser/connect-github.test.ts:93` expects "Question 3 of 7". After R it is "of 6". The file is not among the seven journeys named, and Step 2 runs only the files named.
- FIX: add `connect-github.test.ts` to the list (its counter line only). Before naming the list final, the session runs `grep -rn "of 7\"\|plays-on\|answerPlaysOn" tests` to catch any other. Files: the plan only.

### R4. red: "a first game of 10" cannot be checked on `main`

- UNIT: Unit R's first criterion; Task 26 Step 1 (`counterOf` "gives ... a first game 10").
- REASON: a first game's page questions (redesign 6) are slice 4 and are not built. `counterOf` (`src/features/games/questions.ts:58`) counts only `questionsFor(answers)`, the game's own questions, and has no first-game path. Today every game reads "of 7" (`make-questions.test.ts:106`). After R it reads "of 6", or "of 7" for an 18+ game.
- FIX: the criterion and Step 1 say "every game: of 6, and of 7 for an 18+ game". Drop "a first game of 10". If the planner wants slice 4 to know, add one line to the plan's "What moves to slice 4" list: "redesign 6's counts lose one: 9 for a first game". Files: the plan only.

### R5. red: R removes `playsOnWords`, which Task 30's review job reads

- UNIT: Task 26 Files (`laid-out.ts` and `games.ts`, "`playsOnWords` goes"); Task 30, the `look` answer (plan, the review job table) and its journey.
- REASON: S is built before R. S's `look` answer holds `playsOn` in `playsOnWords`, and its journey expects `playsOn: "Plays on phones and computers"`. R then deletes `playsOnWords` and lists only Task 30's refusal words as changing, so the `look` field, its code and its test break, or the function is quietly kept.
- EVIDENCE: the plan's review job table, `{"do":"look",...}` row (`playsOn`, "in `playsOnWords`"); Task 30's journey `toMatchObject({ ..., playsOn: "Plays on phones and computers", ... })`; Task 26's Files.
- FIX (simplest, since S is not built yet): take `playsOn` out of Task 30's `look` answer and journey, and `plays_on` out of Task 30's refusal list and the Owner's command list ("Send it back: ... The parts are ..."). Then R has nothing in S to undo, and its line "Unit G's command list drops `plays_on`" goes. Otherwise, list the `look` field and its journey in Task 26's Files. Files: the plan only.

## Notes

- The main design's 5.2 Call ("a game marked "computer only" shows "This one needs a computer" on a phone") and its submit sketch ("Plays on (•) phone and computer ( ) computer only") still stand in the main design. The spec's section 0 records the Owner's rule. The opening line of the spec ("This amends ... sections 5.2 ... and 5.7") could add that the computer-only Call and the question are gone, so a later reader of the main design is not misled.
- Existing rows marked `computer_only` stay (test data). After R, nothing tells them apart, which is what the Owner's rule wants.

## Re-check at `4db28f1`

Commit examined: `4db28f1` (one commit after this file's `fc32968`). Read: the diff `fc32968..4db28f1` of the spec and the plan, in full, and a search of the plan for `createDraft`, `playsOn`, `plays_on`, `playsOnWords`, `computer_only` and "of 10".

| Finding | Result | Evidence at `4db28f1` |
|---|---|---|
| R1 `createDraft` | PASS | Task 26 names `startGame` (`service.ts:446`), writing `playsOn: "phone_and_computer"` in its `db.game.create`; `createDraft` appears nowhere in the plan |
| R2 `VideoQuestion.svelte` | PASS | In Modify (the `computersOnly` prop and its note go) and in Step 3's visual check (the upright video question) |
| R3 the missing journey | PASS | `connect-github` (its counter line only) is in the list, with the `grep` to run before the list is called final |
| R4 "a first game of 10" | PASS | The criterion and Step 1 read "every game ... of 6, and of 7 for an 18+ game"; "9 for a first game" is under what moves to slice 4 |
| R5 `playsOnWords` and Task 30 | PASS | Task 30's `look` answer and its journey have no `playsOn`; the refusal words and the Owner's command list have no `plays_on`; `changeGame` takes only `freeToPlay`; Task 26 says R's only change to S's code is that `review-order.ts` refuses a `plays_on` part. The Names line lists `playsOnWords`, `playsOnProblem` and `answerPlaysOn` as removed once, in Task 26 |

The first note was taken (the spec's opening now says the main design's computer-only Call and its "Plays on" question are ended).

**Nothing is red at `4db28f1`.** One note, new: between S merging and R merging, the review job accepts a `plays_on` part (it is still a `GamePart`) while its refusal words no longer name it. Nothing in that window sends one, and R closes it; recorded, not to fix.
