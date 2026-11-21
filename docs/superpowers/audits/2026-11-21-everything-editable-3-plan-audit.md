# Plan audit 3: everything is editable

Examined: `docs/superpowers/specs/2026-11-21-everything-editable-design.md` at **fe1c7cd** (branch `claude/project-thread-kjfg1t`, draft PR #269), read against `main` at ef720a9 and the two unmerged branches the spec waits on: `claude/project-thread-u1uamt` at 3981563 (live files and websites, no pull request) and `claude/project-thread-vhfmo8` at 30975cc (the purge takes a maker's games off, PR #268, open). Both branches are at the same commits round 2 read. Lane 3 plan audit, round 3, Opus 5.5 medium. Graphify was not used: grep over these exact commits answered every question.

**Verdict: fe1c7cd FAIL: 2 red, 5 notes.**

Round 2's R1 and R3 are fixed. R2 is fixed for two of the three orders the purge and unit A can land in, and the third is the likely one (R1 below). One new red comes from the send-in-the-save choice meeting "Keep the old one" after a send back (R2 below).

## Round 2 reds, checked again

| Round 2 | Fixed? | Evidence |
|---|---|---|
| R1 how a held change is sent | Yes | 5.1 now sends in the save through `sendLiveUpdate` (u1uamt `service.ts`: returns without sending while `stillToFix` is not empty, else `sendForReview`). `look` answers `seen` (the game's `changedAt`), `accept` must carry it back when something is held, and compares on a locked row. On `main`, `sendForReview` does not touch `changedAt` (`service.ts:437-447`), and updates are decided at once (`holdOrNot` returns `atOnce` for kind `update`, `service.ts:547`), so the yes that copies held values is the accept itself, never a later decision day. A10 tests a save after the look, a missing `seen`, and the `pullProblem` case. But see note N1 on the order of the clip save's writes. |
| R2 purge and `Game_held_check` | Partly | See R1 below. |
| R3 G5 tests | Yes | G5 names `tests/browser/review-job.test.ts` (the `wide_video` send back, lines 105 to 117 on `main`) and `tests/features/games/review.pg.test.ts` (the `it.each` at 593 to 615, and line 677), and says they change rather than go. No other existing test asserts these refusals: grep over `tests/` for "videos can't be changed", "can only be sent back for its name" and `"look"`. The look test (`review-job.test.ts:51`) uses `toMatchObject`, so the new `seen` and `changes` keys do not break it. |

Round 2 notes N1 (`none` alone in the held check, A6 case), N3 (Live line when the newest copy was refused, A10), and N4 (answering 18+ again keeps the held marks) are taken in. N2 is answered by the `seen` check; N1 below is what is left of it.

## Red findings

### R1. The purge clearing is keyed to when unit A is built, not to which pull request merges second

- UNIT: 5.5, section 6 row A ("only if the purge is on `main`"), criterion A11.
- VERDICT: red.
- REQUIREMENT: round 2 R2's expected result: "`main` never holds the CHECK and the purge without the clearing"; 5.5's own line "So `main` must never hold the check and the purge without the clearing"; owner 2026-11-21 14:26 UTC "Games come off with the account".
- REASON: 5.5 covers "the purge is on `main` when unit A is built" and "unit A reaches `main` first". It does not cover the third order: unit A starts while the purge is not on `main`, and the purge merges while A is being built or audited. Then the purge's pull request had no unit A to clear for, and A's branch skipped the clearing and A11 because the condition was false when it was built. A merges second, and `main` holds both without the clearing, which is exactly round 2's R2.
- EVIDENCE: PR #268 (`claude/project-thread-vhfmo8`, the purge) is open now, and its `takeGamesOff` (`src/features/accounts/deletion.ts:175-188` on that branch) is one `updateMany` to `taken_off` with no held columns, inside the purge transaction. Unit A cannot start until u1uamt has a pull request and merges (section 6), then runs about 4 hours plus a lane 3 audit and fixes (section 4). So #268 merging while A is in flight is the likeliest order. Merging `main` into A's branch before its merge would not catch it either: no purge test holds a held rating, so CI stays green.
- EXPECTED: the clearing and A11 are carried by whichever of the two pull requests merges second, decided when it merges, not when it is built.
- FIX: in 5.5, section 6 row A and A11, key the rule to A's merge: "Before unit A's implementation audit, and again before its merge, A's branch takes `main`; if the purge is on `main` then, A clears held values in the purge's game step and carries A11." Keep the second bullet for A merging first. Spec text only.

### R2. "Keep the old one" after staff send a held change back leaves the game stuck

- UNIT: 5.1 "Sending" ("Keep the old one" drops a held part), "No.", criteria A4 and A5.
- VERDICT: red.
- REQUIREMENT: section 1 ("that person can change or take away, from a screen, without asking anyone"); 5.1's own rule that a save waits only "while something staff sent back is still to fix"; the drunk-grandma rule (a fix card that cannot be cleared by the button it offers).
- REASON: when staff send back a held video, `toFix` holds `upright_video` and the held value stays (5.1 "No."). The question screen then offers "Keep the old one". 5.1 says it drops the held part and may clear `pendingPullId`, but not that it takes the part off `toFix`. So after the maker chooses the old video, the fix card still asks for a new video, and every later save on Live is kept and not sent: a new copy of the files, new websites, a held rating. The only way out is to upload a video the maker just chose not to change. And when the part does come off the list, nothing sends what is still held (for example a held rating that was not sent back), since 5.1 sends only from a save.
- EVIDENCE: `main` `service.ts:435` `sendForReview` throws "Fix what was sent back first." while `stillToFix(game.toFix)` is not empty; u1uamt `sendLiveUpdate` returns without sending in the same case; `sentBackNow` (`service.ts:668-680`) sets `toFix` to the sent-back parts and clears `pendingPullId`. Spec 5.1 "Saving": "Each takes its part off `toFix`" (saves only). No criterion covers "Keep the old one" on a part staff sent back.
- EXPECTED: "Keep the old one" on a part staff sent back takes that part off `toFix` (the live value is one staff already said yes to), and then ends in `sendLiveUpdate` when anything is still held, as a save does.
- FIX: add both to 5.1's "Keep the old one" sentence, and to A4: "staff send a held video back; the maker presses Keep the old one; the fix card is gone, and a held rating saved earlier is now waiting for review". Spec text only.

## Notes (recorded, not blocking)

- **N1. The clip save must move `changedAt` after its held row, not before.** `saveClip` on `main` calls `markChanged` before it upserts the clip row (`service.ts:296-302`). If the held save keeps that order, a `look` that runs between the two writes answers the new `changedAt` with the old held video, and an accept with that `seen` passes and makes the new video live unseen. `SELECT … FOR UPDATE` in `accept` does not close this, since the held row is not written under the game row's lock. Say in 5.1 that a held save writes `changedAt` in the same transaction as the held row, or after it. The window is milliseconds and needs the Owner's look to land in it, so this is a note; it costs one sentence.
- **N2. A11's test file.** The purge's pg tests live in `tests/features/accounts/purge.pg.test.ts` on vhfmo8, which is outside unit A's files in section 6 (`tests/features/games/`, `tests/browser/`). Add `tests/features/accounts/` (A11 only) to A's row, or G6 refuses the natural place for the test.
- **N3. A live name or line edit moves `changedAt` too** (`service.ts:846`). Staff who look, then see the maker fix a typo in the line, get CONFLICT on accept and must look again. That is safe; the look's `says` could say so, so the Owner is not surprised.
- **N4. A `seen` that is not a time.** 5.1 does not say what `accept` answers when `seen` is there but is not a time `look` gave (a typo). Treat it as missing (CONFLICT, "Look again.") or refuse the order in `readReviewOrder` (`src/features/games/review-order.ts`) with a 400; say which.
- **N5. A10's pg test must move the test clock between the look and the save.** `review.pg.test.ts` runs on a `TestClock` that moves only when told (`clock.advance`); without it both `changedAt`s are equal and the CONFLICT case cannot be shown. Worth one line in step A5.

## What was checked and how

- Each round 2 fix against the code: on `main` at ef720a9, `src/features/games/service.ts` (`saveClip`, `markChanged`, `saveAnswer` and its `changedAt`, `sendForReview`, `waitingOf`, `holdOrNot`, `standingsOf`, `accept`, `sendBack`, `sentBackNow`, `LIVE_MAY_BE_SENT_BACK`, `takeOff`), `src/routes/jobs/review/+server.ts`, `src/features/games/review-order.ts`; on u1uamt, `git diff origin/main...` of `service.ts` (`sendLiveUpdate`, `LIVE_MAY_CHANGE`); on vhfmo8, `deletion.ts` (`purgeDueAccounts`, `takeGamesOff`).
- Every write that moves a game out of `live` on `main`: grep for `state: "` writes in `src/` (only `takeOff`; the purge adds one on vhfmo8).
- Existing tests that the spec's changes touch: grep over `tests/` on `main` and u1uamt for each refusal's words and for `"look"`.
- Open pull requests: `gh api repos/mcthaydt/RukenApp/pulls?state=all` (#268 open for vhfmo8; no pull request for u1uamt).
- The diff from round 2's commit: `git diff 073359c fe1c7cd`.
- Unit B, unit D and sections 2, 3, 7 did not change since round 2 and were not read again beyond that diff.
- Not run: no tests or builds (a plan audit changes no code).
