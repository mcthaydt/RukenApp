# Plan audit 4: everything is editable

Examined: `docs/superpowers/specs/2026-11-21-everything-editable-design.md` at **1adfb03** (branch `claude/project-thread-kjfg1t`, draft PR #269), read against `main` at ef720a9 and the two unmerged branches the spec waits on: `claude/project-thread-u1uamt` at 3981563 (live files and websites, no pull request) and `claude/project-thread-vhfmo8` at 30975cc (the purge takes a maker's games off, PR #268, open draft). All three are at the same commits round 3 read. Lane 3 plan audit, round 4, Opus 5.5 medium. Graphify: RukenApp is indexed, but at 44a82cb, older than `main` and without either branch, so grep over these exact commits answered every question.

**Verdict: 1adfb03 FAIL: 1 red, 3 notes.**

Round 3's R1 is fixed. R2 is fixed for the case its criterion tests (another held part still waits), but not for the plainer case where the refused part was the only thing held: Live then asks the maker to send an update that changes nothing (R1 below). The fix is a few lines of spec text.

## Round 3 reds, checked again

| Round 3 | Fixed? | Evidence |
|---|---|---|
| R1 purge clearing keyed to when A is built | Yes | 5.5 now says the pull request that merges second carries the clearing and A11, decided at merge. Unit A takes `main` before its implementation audit and again before its merge, and clears if the purge is there; a clearing added after the audit is read by the auditor. The other order (A first) still goes through the coordinator to PR #268. Section 6 row A, step A6 and A11 match. The release queue (`release` line 94: integrate with current `main` one pull request at a time before marking ready) is what makes "before its merge" hold, since branch protection does not require up to date (`strict: false`, checked with `gh api .../branches/main/protection`). |
| R2 "Keep the old one" after a send back | Partly | See R1 below. |

Round 3 notes taken in: N1 (`changedAt` in the held write's transaction, 5.1), N2 (`tests/features/accounts/` in row A), N3 (a name or line fix asks for a second look; `says` tells the Owner), N4 (`seen` that is not a time is CONFLICT), N5 (A10's test moves the clock, step A5).

## Red findings

### R1. "Keep the old one" on the only held part that staff sent back leaves Live asking to "Send it again" with nothing to send

- UNIT: 5.1 "Sending" ("Keep the old one … when nothing is left waiting … it clears `pendingPullId` and `pendingSince`"), criteria A4 and A5.
- VERDICT: red.
- REQUIREMENT: 5.1's own aim "so staff are not asked to check nothing"; A5's expected line "Players can find it on Ruken." once nothing waits; the drunk-grandma rule (one main action per screen, and it must be the right one).
- REASON: after staff send back a held video, the game's newest review is `sent_back`. When the maker then presses "Keep the old one" and nothing else is held and no new copy waits, 5.1 takes the part off `toFix` and clears `pendingPullId` (already null after a send back). Nothing clears the "sent back last" state, so Live and Your games read it as a mended update waiting to be sent again: the blue button becomes "Send it again", and pressing it sends the live copy to staff with nothing changed.
- EVIDENCE: on u1uamt, `src/routes/make/[game]/+page.server.ts:79-82` `liveSend` returns `"again"` when `!hasPending && sentBackLast && pullProblem === null && toFix.length === 0`; `liveLine` (`:91`) then says "Fixed. Send it again when you're ready."; `LiveScreen.svelte:67-79` makes that the `?/sendAgain` button; `listWords` (`src/features/games/review.ts:72`) says "Live. Your update is fixed. Send it again." `sentBackLast` is `row.reviews[0]?.decision === "sent_back"` (`service.ts:1220`, `:1295`), which no write in 5.1 changes. A4's second journey has a held rating still waiting, so it sends and never shows this; A5 drops held parts that were never sent back, so `sentBackLast` is false there. No criterion covers the single-part case, which is the most natural one (staff refuse the new video, the maker keeps the old).
- EXPECTED: after "Keep the old one" leaves nothing held and no new copy waiting, Live reads as plain live: line "Players can find it on Ruken.", no send button, list words "Live"; nothing goes to staff.
- FIX: spec text only. In 5.1 "Sending", say how Live knows nothing is left after a send back (for example: `liveSend` and `listWords` treat a live game with nothing held, nothing to fix and its newest pull equal to `livePullId` as plain live, whatever the last review was; or another rule the builder names). Add to A4 a third journey: "staff send back a held video and nothing else is held; the maker presses Keep the old one; Live says Players can find it on Ruken. with no send button, Your games says Live, and `/jobs/review` `list` does not name the game." If the rule touches `src/features/games/review.ts`, it is already inside row A (`src/features/games/`).

## Notes (recorded, not blocking)

- **N1. "In the same write" in 5.5.** The purge's game step is one `updateMany` (vhfmo8 `deletion.ts:175-188`); the held columns fit in its `data`, but `GameHeldClip` rows are another table and need their own `deleteMany`. Say "in the same transaction" (the purge already runs one). The held files need nothing new: the purge already deletes `clips/<publicId>/` before its transaction (`deletion.ts:121-124`), and held keys share that prefix (5.1).
- **N2. Status line says "Read against `main` at 583661f".** `main` is ef720a9; rounds 3 and 4 read against it and nothing the spec cites moved. Update the line when the spec is next touched.
- **N3. The A-first order rests on the coordinator.** If unit A merges first, the clearing goes in PR #268 only if the coordinator tells that thread. PR #268 is open now; a line in its pull request body or the coordinator's `progress.md` row ("if unit A merged first, clear held values and carry A11") would keep it from being lost across a session refresh.

## What was checked and how

- The diff since round 3: `git diff cd2228b 1adfb03` (spec only: 5.1 "Sending" and "What goes live", 5.5, section 6 row A, steps A5 and A6, criteria A4 and A11, status line).
- Branch heads: `git log origin/<branch>` for `main`, u1uamt and vhfmo8 (unchanged since round 3). Open pull requests: `gh api 'repos/mcthaydt/RukenApp/pulls?state=open'` (#268 and #269 open drafts; no pull request for u1uamt). Branch protection: `gh api repos/mcthaydt/RukenApp/branches/main/protection` (`strict` false).
- The send-back and send paths on u1uamt: `service.ts` (`sendForReview`, `sentBackNow`, `saveAnswer` and its `toFix` write, `sendLiveUpdate`, `takeOff`, `throwAway`, the maker game's `toFix` and `sentBackLast`, `partsToFix`, `gamesOf`), `review.ts` (`listWords`), `make/[game]/+page.server.ts` (`liveSend`, `liveLine`), `LiveScreen.svelte` (the send button).
- The purge on vhfmo8: `deletion.ts` (`purgeDueAccounts`, `takeGamesOff`).
- The merge queue: `release` lines 16, 17, 41 and 94.
- Graphify `list_repositories` and `graphify_callers` (`liveSend`): index at 44a82cb, no edge for the symbol, so grep was used.
- Units B and D and sections 2, 3, 7 did not change since round 3 and were not read again beyond the diff.
- Not run: no tests or builds (a plan audit changes no code).
