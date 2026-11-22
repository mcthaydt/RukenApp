# Everything editable, unit A: implementation audit 1

**aadb165 FAIL: 2 red**

- Examined: `mcthaydt/RukenApp` branch `claude/project-thread-85j3yr` at aadb165, against `main` at 6dcd1e0 (the branch already contains it). No pull request yet.
- Brief: `docs/superpowers/specs/2026-11-21-everything-editable-design.md`, section 5.1, section 6 row A, criteria G1 to G6 and A1 to A11.
- Lane 3 (a migration). Auditor: Opus 5.5, medium. Read only: nothing in the repo was changed.
- Written 2026-11-21 17:18 UTC (from `date`).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What I ran

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ok |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors |
| `pnpm test` | 117 files, 1704 tests passed |
| `pnpm test:pg` | **not run**: no Postgres or `TEST_DATABASE_URL` in this container. Read the tests instead. CI must run it. |
| `pnpm test:browser` | **not run** here. Read the journeys instead. CI must run them (the builder did not run WebKit phone either). |

## Red findings

### R1. A held video save that overlaps staff's yes deletes the video players now see

- UNIT: `src/features/games/service.ts`, `saveHeldClip` (diff lines around 320 to 345 of the file at aadb165); the same pattern in `takeOff`.
- VERDICT: red.
- REQUIREMENT: spec 5.1 "Yes": "A failure after the transaction leaves a file nobody points at, never a game without its clip"; and A10's flow, where the maker saves another video after staff looked.
- REASON: `saveHeldClip` reads the held row it will replace (`replaced`) before uploading the file and before its transaction. If staff's `accept` commits in between, that held key becomes the game's live `GameClip`, and `saveHeldClip` then deletes it.
- EVIDENCE: order in `saveHeldClip`: `findUnique` of `GameHeldClip` (key H), `files.put` (seconds for a 30 MB video), then the transaction (whose `updateMany` on the game waits on `accept`'s `FOR UPDATE` and then succeeds, since the game is still live), then `files.delete(H)`. `accept` in between does `gameHeldClip.delete` and `gameClip.update({ key: H })`. Result: the live `GameClip` points at a deleted file, and players get a broken video. `takeOff` has the same shape: it reads held keys with `findMany` before its transaction and deletes those files after it, so a yes that lands between them deletes the clip a taken-off game keeps for "Put it back".
- EXPECTED: a held file is deleted only if, at the moment its row is replaced or removed, it is still a held file and not a live one.
- FIX: in `saveHeldClip`, read the held row being replaced inside the transaction, after the game row's update (which takes the row lock), and delete only that key after the commit. In `takeOff`, take the game row's lock (or read the held keys) inside the transaction before deleting the rows, and delete only those keys. Add a pg test that runs `accept` between the read and the write (for example by holding `files.put` open with a stand-in bucket) and shows the live clip's file is still there. Files: `src/features/games/service.ts`, `tests/features/games/live-held.pg.test.ts`.

### R2. Files changed outside unit A's row (G6)

- UNIT: the diff as a whole.
- VERDICT: red (a gap against a written criterion). The fix is a document change only.
- REQUIREMENT: G6, "No file outside the unit's row in section 6 changes".
- REASON: the row lists `src/features/games/` (service, clips, laid-out, review words), `src/routes/make/[game]/`, `src/routes/make/parts/LiveScreen.svelte`, `src/routes/jobs/review/+server.ts`, the purge, and tests under `tests/features/games/`, `tests/features/accounts/` and `tests/browser/`. The diff also changes `src/lib/look.css` (a lane 2 path), `src/routes/make/laid-out.ts`, `src/routes/make/laid-out.server.ts`, `src/routes/make/parts/GameLaidOut.svelte`, `QuestionScreen.svelte`, `VideoQuestion.svelte`, `src/features/games/games.ts`, `review.ts`, `review-order.ts`, and `tests/lib/look.test.ts`.
- EVIDENCE: `git diff --stat origin/main...aadb165`. I read each change: every one is needed for A1, A4, A5, A9 or A10 (Live is drawn by `GameLaidOut` through `laid-out`, not by `LiveScreen.svelte`, which the diff does not touch; `review-order.ts` carries `seen`; `review.ts` holds the plain-live-again rule; `look.css` and its test add the `.waits` label). None is out of scope in substance.
- EXPECTED: the files a unit changes are the ones its brief names.
- FIX: amend section 6's row A in the spec to name these files, each with its one-line reason, and list them in the pull request body as G6 asks. No code change. Files: `docs/superpowers/specs/2026-11-21-everything-editable-design.md` and the PR body.

## Criteria, one line each

| Criterion | Verdict | Evidence |
|---|---|---|
| G1 | Open | lint, typecheck, unit green here; pg and browser not run here; needs CI on the PR head. |
| G2 | Pass (read) | Journeys focus and press Enter on "Change the … video" and "Keep the old one", and on the fix card. |
| G3 | Pass (read) | Journey "another maker cannot keep the old one…" (404 on `keepOld` and `age?/answer`); `MAKER_ADDRESSES` gains the three `keepOld` addresses; pg "another person's game". |
| G4 | Open | Design round's fresh reviewer has not run. |
| G5 | Open | No PR body yet. It must name: `make-after` (two tests: the Live rating Change, and "offers Change on its videos and its rating"), `review-job` (send-back refusal words), `review.pg` (it.each words, live clips test, live rating test), `service.pg` (live saveAnswer test), `tests/lib/look.test.ts` (`waits` class), and the two support files (added helpers only). |
| G6 | **Red** | R2. |
| A1 | Pass (read) | Journey per shape: Live line, `.waits` label, `/g/` unchanged, gate 200 on the old file, look `changes`, accept with `seen`, gate 404 on the old file. |
| A2 | Pass (read) | Wide via the same loop; rating 12+ to 7+ (the spec says 7+ to 12+; same property). |
| A3 | Pass with note N1 | Marks asked first, leaving keeps nothing, marks-only journey. The under-18 part is checked as "leaves the maker's page". |
| A4 | Pass (read), R1 applies | Three journeys plus the refusal journey and pg tests. |
| A5 | Pass (read) | Journey drops both, gate 404 on the held file, `list` does not name it, second press harmless. |
| A6 | Pass (read) | `schema.pg.test.ts` "a live game's held changes" covers each listed case, including `.mov`. Migration only adds. |
| A7 | Pass (read) | pg test deletes the live `GameClip` so the swap fails after the game row changed; state, held row and file unchanged. |
| A8 | Pass (read), R1 applies | pg "taking a live game off leaves no held clip, no held column and no held file". |
| A9 | Pass with note N2 | Unit test on `heldChanges`; the handler's both branches are proven by journeys. |
| A10 | Pass (read), R1 applies | pg and journey: look, maker saves again, 409 with and without `seen`, second look accepts the last video; nothing held accepts without `seen`; `pullProblem` keeps the save unsent. |
| A11 | Pass (read) | Purge (#268) is on `main`. `takeGamesOff` deletes the maker's `GameHeldClip` rows and clears both held columns inside the purge transaction; pg test "finishes for a maker whose live game holds a new video and rating" checks rows, columns and the held file. |

## The builder's five calls

1. **A3 under-18 refusal.** Correct that no such mechanism exists: `/g/[game]` and Play read no age, and 18+ games are only filtered out of the feed and maker pages for everyone (`src/features/feed/service.ts:41`, `src/routes/[handle=handle]/+page.server.ts:25`). "Refused as any 18+ game refuses it" therefore means "drops off the feed and the maker's page", which the journey checks for the maker's page. Accepted, note N1.
2. **A9 on the helper.** Accepted: the journeys assert the handler's real answer with and without held values, which is harder to fool than a handler unit test. Note N2.
3. **The other video's Change as a line under the game.** Accepted; the spec asks for a Change on the video and Live draws one. The label is built with a string replace on the caption words ("On phones" to "for phones"); the design round should look at it.
4. **"Send a new version" still showing while an update waits.** Not a breach of "no new button": it is the button `main` already shows on every Live screen, it is the GitHub path the spec keeps (the `pullProblem` line points at it), and the held change rides along with a new version. Its note "It takes the place of the one that is waiting" is now only half true when a video or rating waits, since those stay. Note N4.
5. **A11.** Verified, see the table.

## Notes (not blocking, recorded)

- N1. Pre-existing, outside this unit: anyone, including a signed-in under-18 account, can open an 18+ game by its address. The spec's A3 assumed a gate that is not there. For the coordinator to raise, not to fix here.
- N2. A9 is proven by journeys plus a helper unit test rather than a handler unit test.
- N3. Live marks a held change "Waiting for review" even when it has not been sent: when the newest GitHub copy was refused, or while another sent-back part is still to fix. The spec's wording allows it, but the words say something that is not yet true. For the design round.
- N4. "Send a new version"'s note, see call 4.
- N5. Smaller races, no data lost: `keepTheOldOne` against `accept` ends in a 500 (Prisma's not-found on the held row's delete), and `saveAnswer` decides "same as live" from a read taken before a concurrent yes. Could be folded into R1's fix if it is cheap.
- N6. `saveHeldClip` uploads before its transaction, so a game taken off mid-upload leaves one file nobody points at. Accepted by the spec's own rule.
- N7. Design round and screens for unit A are still owed (spec step 7, G4).
