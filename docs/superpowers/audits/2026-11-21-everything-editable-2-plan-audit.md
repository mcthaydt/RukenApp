# Plan audit 2: everything is editable

Examined: `docs/superpowers/specs/2026-11-21-everything-editable-design.md` at **073359c** (branch `claude/project-thread-kjfg1t`, draft PR #269), read against `main` at ef720a9 and against the two unmerged branches the spec waits on: `claude/project-thread-u1uamt` at 3981563 (live files and websites) and `claude/project-thread-vhfmo8` at 30975cc (the account purge takes games off). Lane 3 plan audit, round 2, Opus 5.5 medium. Graphify was not used: grep over these exact commits answered every question.

`main` moved from 583661f (the spec's base) to ef720a9; the only `src/` change is `src/routes/g/[game]/` (layout), which no unit owns or reads. Nothing in the spec is stale because of it.

**Verdict: 073359c FAIL: 3 red, 6 notes.**

All six reds of round 1 are fixed in the text (table below). The three new reds come from the two sibling branches, which now exist, and from one criterion the round 1 fixes made untrue.

## Round 1 reds, checked again

| Round 1 | Fixed? | Evidence |
|---|---|---|
| R1 held clip keys not served | Yes | 5.1 uses `clipKeyFor(publicId, shape, random16Hex, contentType)` (`src/features/games/clips.ts:27`), which makes exactly what `CLIP_KEY` in `src/features/play/gate.ts` serves, `.mov` included. The written-out CHECK matches the gate's pattern character for character. |
| R2 marks-only change | Yes | 5.1 holds the pair, drops it only when both equal the live pair, and the marks question reads the held rating. The CHECK allows a held 18+ equal to the live one. A3 and A6 have the cases. |
| R3 change after the send | Yes, as written (but see R1 below) | 5.1 "A change after the send takes the send back" clears `pendingPullId` and `pendingSince`; A10 tests it. `waitingOf` (`service.ts`) then answers "Nothing is waiting for review.", as A10 says. |
| R4 purge and the owner's 14:26 decision | Yes (but see R2 below) | Unit E names the thread that builds the purge and keeps one check here. |
| R5 unit C reopened a decision | Yes | Struck, with the owner's 14:41 UTC card quoted in section 0; no C criterion, file or duration is left. |
| R6 Stripe receipts | Yes | Section 7, section 9, the words on `/me/email`, and D7's member case. |

Round 1 notes N1 (CHECK written out), N2 (D1 stops on any difference), N3 (D7), N4 (D audited as lane 3), N5 ("the gate answers 404") and N6 (the wait listed under risks) are all taken in.

## Red findings

### R1. Unit A's "Not sent yet, then Send for review" is not how the Live screen's other held changes will send, and the round 1 R3 fix depends on it

- UNIT: 5.1 "What the maker sees", "Sending" and "A change after the send takes the send back"; criteria A1, A10.
- VERDICT: red.
- REQUIREMENT: 5.1 and step A1 ("The exact button wiring follows what `claude/project-thread-u1uamt` merged"); owner 14:28 "staff check the change before players see it"; the drunk-grandma rule (one way to do one thing).
- REASON: the sibling branch sends a live game's new files and websites for review in the same save, with no "Send for review" press. If unit A follows it, as step A1 says it must, a held video saved while an update waits is sent again at once, `pendingPullId` is set back to the same live pull, and staff's later yes copies a video they never looked at: the round 1 R3 hole comes back. If unit A does not follow it, one Live screen sends files on save but videos and rating only on a press, and a held save quietly withdraws a files update the maker already sent.
- EVIDENCE: `claude/project-thread-u1uamt` at 3981563, `src/features/games/service.ts`: `saveAnswer` now calls `sendLiveUpdate(gameId, makerUserId, game.state)` after `pullLatest` for `files` and `websites`, which calls `sendForReview` whenever nothing is left to fix ("A live game's new copy goes for review in the same save … a copy left unsent would change nothing for players and would have to be sent again by hand"). `sendForReview` on a live game with no new copy sets `pendingPullId` to the newest pull, which is the live one, so before and after a re-send the waiting pull id is the same and `accept` cannot tell them apart. Section 9 already foresaw this ("a difference that changes section 5.1 comes back as a spec amendment before code"); the difference now exists.
- EXPECTED: 5.1 says, now, how a held video or rating is sent, and the "what goes live is what staff looked at" guarantee holds under that choice.
- FIX: in 5.1 (and A1, A10), pick one and say why. (a) Held videos and rating also send in the save, as files do: drop "Not sent yet" and the "Send for review" button, and replace the withdraw rule with a version check, where `look` answers the game's `changedAt` and `accept` takes it back and refuses with CONFLICT ("It changed since you looked. Look again.") when it has moved; add that to A7 or A10. (b) Keep the press for held videos and rating, and say in 5.1 that saving files or websites while a held change is unsent sends them alone, and that a held save after a files send withdraws both (Live then says what to press). Recommendation: (a), because then one Live screen behaves one way, and a save never undoes an earlier send. Spec text only.

### R2. Unit A's CHECK stops the account purge for everyone if the purge lands first

- UNIT: 5.1 "Leaving", 5.5, section 6 rows A and E.
- VERDICT: red.
- REQUIREMENT: owner 2026-11-21 14:26 UTC "Games come off with the account"; the 14-day purge promise on `/me`; G1 (green on `main`).
- REASON: the purge on `claude/project-thread-vhfmo8` takes a maker's live games off with one `updateMany` to `taken_off` that does not clear held columns. Once unit A's `Game_held_check` exists, that write throws for any maker with a held rating, inside the purge transaction, and `purgeDueAccounts` has no per-account catch, so the whole day's run stops at that account, every day, until unit E lands. The spec orders E after both A and the purge, so whichever of A and the purge merges second ships this window, and neither branch's own tests would see it (neither has the other's code).
- EVIDENCE: `claude/project-thread-vhfmo8` at 30975cc, `src/features/accounts/deletion.ts`: `takeGamesOff` does `tx.game.updateMany({ where: { makerUserId: userId, state: { in: ["live", "waiting"] } }, data: { state: "taken_off", … } })` with no held columns; the loop `for (const { id, userId } of due)` has no try/catch around its `$transaction`. Spec 5.1: CHECK "`heldAgeRating` is null and `heldContentMarks` is empty unless `state` is `live`". The purge deletes `clips/<publicId>/` from the bucket first, so held files go; held `GameHeldClip` rows stay unless cleared.
- EXPECTED: the pull request that merges second makes the purge clear held values and carries E1 in the same pull request, so `main` never holds the CHECK and the purge without the clearing.
- FIX: in section 6, fold E into whichever of A and the purge merges second. If the purge is on `main` when A is built, A's row adds `src/features/accounts/deletion.ts` (the game step only), clears `heldAgeRating`, `heldContentMarks` and `GameHeldClip` rows there, and E1 becomes one of A's criteria (lane 3 already). If A merges first, the coordinator tells the purge thread before its merge, and E1 goes in that pull request. Strike E as a separate unit. Spec text only.

### R3. G5 forbids test changes unit A must make

- UNIT: section 8, G5.
- VERDICT: red.
- REQUIREMENT: G5 ("… and nothing else"); 5.1 "No." (`LIVE_MAY_BE_SENT_BACK` gains `upright_video`, `wide_video`, `age_rating`).
- REASON: three existing tests assert the refusals that unit A removes or rewords, and G5's list leaves them out, so the builder either breaks G5 or reports a change G5 says should not happen.
- EVIDENCE: `tests/browser/review-job.test.ts:109-117` sends a live update back for `wide_video` and expects 400 "A live game can only be sent back for its name, its line or its files."; `tests/features/games/review.pg.test.ts:595-615` (`it.each` over `upright_video`, `wide_video`, `age_rating` …) expects the same refusal; `tests/features/games/review.pg.test.ts:677` expects "A live game's videos can't be changed yet.". G5 names only `make-after`, the question 404, and `throwAway`'s refusals.
- EXPECTED: G5 lists every existing test the units change.
- FIX: add those three places to G5 (the send-back refusal still holds for a part with no held value, so the cases change rather than go; say so). Spec text only.

## Notes (recorded, not blocking)

- **N1.** `Game_held_check` does not carry `Game_marks_check`'s second rule ("None of these" stands alone, `prisma/migrations/20261115100000_questions/migration.sql`). The service writes `["none"]` alone today, but a held pair the accept cannot copy would fail the accept transaction. Mirror the rule in the held check and add an A6 case.
- **N2.** A race inside one moment: `accept` reads the game (`waitingOf`), then the held rows. A held save that commits between those two reads goes live unseen, even with R3's withdraw. If option (b) of R1 is kept, have `accept` lock the game row first (`SELECT … FOR UPDATE`) and the held save write the `Game` row first in its own transaction; option (a)'s version check closes it without a lock.
- **N3.** `sendForReview` refuses "Your game's files need fixing first." whenever the newest copy was refused (`pullProblem`). A maker with a broken new copy on GitHub then cannot send a held video alone. Worth one line in 5.1 on what Live says then.
- **N4.** Answering "18+" again on a live 18+ game with held marks: 5.1 does not say whether the held marks stay or the live ones come back. The question screens should show the held value when there is one; say so in 5.1 so the builder does not guess.
- **N5.** better-auth 1.7.7 was read this time (the published package, `dist/api/routes/update-user.mjs` and `email-verification.mjs`), and 5.4 holds: with no `sendChangeEmailConfirmation` the link goes to the new address; a taken address answers the same `{ status: true }` and mails nothing; `changePassword` takes `revokeOtherSessions`; `/verify-password` exists for `/me/email`'s current-password check. Not built in: the notice to the old address (the app sends it, in D's mails). The change-email link is a signed token, not a `verification` row, and `verify-email` answers `USER_NOT_FOUND` once the purge has renamed the address, so D7 holds without touching the purge.
- **N6.** Neither branch the spec waits on has a pull request (u1uamt at 3981563, vhfmo8 at 30975cc), and the open pull request limit is full. Unit A's start date is still unknown (section 9 says so).

## What was checked and how

- Each round 1 fix against the code: `src/features/play/gate.ts` (`CLIP_KEY`), `src/features/games/clips.ts` (`clipKeyFor`), `src/features/games/service.ts` (`saveClip`, `saveAnswer` cases `age` and `marks`, `sendForReview`, `waitingOf`, `accept`, `sendBack`, `LIVE_MAY_BE_SENT_BACK`, `takeOff`, `throwAway`, `lapsed`, `standingsOf`), and the CHECKs in `prisma/migrations/` (`Game_live_check`, `Game_marks_check`, `Game_answered_check`, the unique `pendingPullId` index, which `pendingPullId = livePullId` does not break).
- The sibling branches: `git diff origin/main...` of `claude/project-thread-u1uamt` and `claude/project-thread-vhfmo8` (found by searching every remote branch for a change to `deletion.ts`; `5pb367` and `qpmlv5` touch it only through the phone sign-in work).
- Existing tests that assert refusals the spec changes: grep over `tests/` for each refusal's words.
- better-auth 1.7.7: `npm pack better-auth@1.7.7` into a scratch folder, read, not installed in the repo.
- `docs/superpowers/history.md:19` for the standing merge permission section 6 quotes.
- Not run: no tests or builds (a plan audit changes no code).
