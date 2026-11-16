# Slice 2, Games and play: implementation audit, round 1

Commit examined: `main` at `5f831a2` (merge of #162). The slice 2 source is unchanged since `b706f58` (#157): #159 to
#162 touched only rules, docs, CI and one journey (`tests/browser/play.test.ts`). A fresh session wrote this and
changed nothing else. Written 2026-11-16 20:03 UTC (from `date`). Cycle 3 of the day's audits (1 and 2 were the rules
setup); round 1 of this one.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Scope

The early audit (`2026-11-15-slice-2-early-implementation-audit.md`, removed from `main` by #159, readable at
`c8e8726`) covered branches A to E, P, S0, Task 19, T and M, and left this audit branches S, F and G plus a check that
its findings S-1, S-2, S-4 and S-6 were taken where it said. So this audit covers:

- #138 branch S, Task 30 (Accept and Send back, `/admin/games`), with its staff screen reviews.
- #154 branch S, Task 31 (take a game off Ruken, put it back).
- #152 branch F, Task 20 (a game's page). #156 branch F, Tasks 21 to 23 (playing, play time, sign-up from a game's
  link, 2048 as the test game). #157 the staff screen design fixes. #150, #151 test fixes.
- Every early-audit finding, whether it was taken.

Out of scope: G (the Owner's real-GitHub walk), the forms restyle and phone sign-up, and the design review loop on the
play screen and the game page (`visual-check`, its own step).

Against: the design (`specs/2026-11-13-ruken-reels-linktree-design.md` 5.2, 5.5, 5.7, 7.3, 8), the maker screens
design (`specs/2026-11-14-maker-screens-redesign-design.md`), the slice 2 plan, the slice 2 rest plan
(`plans/2026-11-15-slice-2-rest.md`, Tasks 20 to 24, 30 to 32, Review Focus 1 to 11), CLAUDE.md, and the early audit.

What ran: no test, lint, typecheck or build (tests run on GitHub's runners only). Graphify (index at `8dca316`, same
source as `5f831a2`) to find callers and definitions. Read in full: `src/features/admin/`, `src/features/play/sessions.ts`,
`attention.ts`, `play.ts`, `src/features/games/seen.ts`, the diff of `service.ts`, `send-back.ts`, `review.ts`,
`games.ts`, `services.ts` over #138 to #157, `pull.ts` (the copy and its clean-up), the routes `admin/games/**`,
`g/[game]/**`, `make/[game]/+page.server.ts`, `make/[game]/take-off/**`, `make/parts/TakenOffScreen.svelte`,
`join/+page.server.ts`, the `MakerAction` migration and schema, `src/lib/long-date.ts`. Test files were read for their
case names against Review Focus 1 to 11, not line by line. CI on `main`: the first run of `main`'s own
(run 43945063395, `workflow_dispatch` on `5f831a2`) was queued when this was written; no result is claimed.

## Verdict

**Not ready to close the slice: 5 red, 7 notes.** The bulk holds: staff accept and send back from one form whose ticks
decide, guarded on every load and action; a stale page is refused (S-1) and a game whose new files were refused cannot
be accepted (S-6); take off deletes the files after the database, records who did it, and put back goes through review
again (S-2 taken whole); the game's page and play screen show only a live game, under a pass, with play time recorded
by the server's clock. Red: one early finding (S-4) was not taken, S-1's lock misses video changes, the slice's own
person-check of play time lost its screen, one small early finding (L-3) was not taken, and one comment still says
take off cannot be undone.

## What was checked, and holds

1. **Staff only (Review Focus 7).** `staffOnly` throws 404 for signed-out callers and for roles outside
   `GAME_STAFF_ROLES`; every `load` and the `decide` action call it first; `played/+server.ts` too. `isStaff` is the one
   rule behind the pages and the links to them.
2. **One form, the ticks decide.** No tick is `accept` with staff's rating; any tick is `sendBack`; the button's words
   never decide. A part twice, a part not in `GAME_PARTS`, or a reason of another part is refused by the service, and
   `tickProblem` names the part (Review Focus 4). An update offers boxes only on `LIVE_MAY_BE_SENT_BACK`, read from the
   one list in `send-back.ts`, and the service refuses the rest (Review Focus 6). 18+ needs a mark and "None of these"
   stands alone, in both `acceptProblem` and `ratingMarks`; marks on any other age are dropped (Review Focus 5).
3. **S-1 and S-6 taken.** `seenOf` hashes name, line, where it plays, rating, marks, websites, pending pull and both
   clip keys; `accept` and `sendBack` lock the `Game` row, then `checkSeen`; a stale page is told to look again and
   reloads. `accept` refuses while `pullProblem` is set; the page offers only Send back then. (See R-2 for the one gap.)
4. **S-2 taken (Task 31).** `takeOff` is one transaction (state `taken_off`, `livePullId`, `pendingPullId`,
   `pendingSince`, `stateReason` null, `toFix` empty, one `MakerAction`) and only then `deleteAll("files/<id>/")`; a
   second press changes nothing. `deleteLeftFiles` and `filesLeft` (`FileStore.hasAny`) cover a delete that stopped
   halfway (Review Focus 9). An update waiting is dropped and leaves the queue (Review Focus 8). `putBack` makes a draft
   with a files problem, copies again, and sends for review; it is never live without a yes (Review Focus 10). A copy
   still running when the game is taken off does not put it back in the queue (`pullLatest`'s `updateMany` guard,
   `sendForReview`'s state check). `MakerAction` is add-only by trigger, `Restrict` on both relations. The maker's
   screens drop "You can't undo this" for take off (one comment left: R-5).
5. **A game's page and play (Tasks 20, 21).** Both answer only `liveGameBySlug` (live, a live pull, both clips, every
   answer), else 404. A computer-only game on a browser that says phone (Playwright's iPads included) gets the line, not
   Play (Review Focus 11), and the play address sends it back to the page. Who may play is `playBasis`; staff by
   `GAME_STAFF_ROLES`; someone who may not is sent to `/join?next=…`, whose "Not now" goes back to the game's page; too
   many starts is a 429 in plain words. The frame is sandboxed, on the gate's address, with no referrer.
6. **Play time (Task 22).** The page looks once a second, sends a beat every `BEAT_EVERY_MS` and one `sendBeacon` on
   leaving; attentive means tab showing, frame on screen and frame focused for the whole stretch; the page never focuses
   the game itself. The beat route takes no cookie, caps the body at 1,000 bytes, and maps results to 204/429/410/404.
7. **Journeys for every Review Focus item of S and F** exist by name in `accept.test.ts`, `take-off.test.ts`,
   `game-page.test.ts`, `play.test.ts`, `play-time.test.ts` (including "a game taken off Ruken is not at its address,
   and a member's game stops loading", moved from S to F as the rest plan says).
8. **Early audit S-3, S-5, L-1, L-2, L-4 taken.** `commitOf` checks `^[0-9a-f]{40}$`; `pullGame` deletes its folder on
   any failure; the gate answers 503 with no pass secret; `gate.test.ts` asks the gate for every `clipKeyFor` shape;
   a clip request is checked by `clipRequestTooBig`. S-5's tracker was replaced whole by the new `progress.md`.
9. **Look rules under `src/routes/`.** No `<style>`, `style=`, `style:` or colour literal; no "Tap" (grep). The play
   screen's tab is 48 by 56.

## Findings

### R-1

UNIT: `src/features/play/sessions.ts`, `recordBeat` (line 129).
VERDICT: red.
REQUIREMENT: early audit S-4, assigned to branch F's Task 22; design 6 and 5.2 (play time is what the pool is split by,
and only a game that is on Ruken is played).
REASON: beats keep counting for a game that is no longer live.
EVIDENCE: `recordBeat` reads only `tokenHash` and `startedAt`; it returns `over` only after `PLAY_SESSION_LIFE_MS`
(line 145) and never looks at the game. Nothing else in `src/` checks it (grep for `S-4`: no hit; the beat route calls
`recordBeat` straight). A member's tab left open on a game its maker took off keeps the game running from memory and
keeps recording attentive `member` beats for up to a day.
EXPECTED: a beat for a session whose game is not `live` answers `over` (410), and the page stops beating. A `staff`
session keeps counting while its pull is still the game's pending or live pull, since staff check games that are not
live yet.
FIX: in `recordBeat`, select the session's `basis`, `pullId` and its game's `state`, `livePullId`, `pendingPullId`;
answer `over` when the game is not live (any basis but `staff`), or, for `staff`, when the pull is neither pending nor
live. Tests first: a case in `tests/features/play/sessions.pg.test.ts` (member session, game taken off, beat is
`over`; staff session on the pending pull of a waiting game, beat is `recorded`), and a beat step in the existing
journey "a game taken off Ruken is not at its address, and a member's game stops loading" in
`tests/browser/play.test.ts` (POST to `/g/<slug>/play/beat` with the session answers 410). Files: those three only.

### R-2

UNIT: `src/features/games/service.ts`, `saveClip` (line 242) against `lockGame` (line 421).
VERDICT: red.
REQUIREMENT: early audit S-1 (a game is never accepted, or sent back, as something staff did not see), as `lockGame`'s
own comment states it (line 417).
REASON: a video change does not take the `Game` row lock, so it can land between `checkSeen` and the commit.
EVIDENCE: `lockGame` says a maker's save "that lands between those reads and the write would slip past `checkSeen`.
Taking the row first makes the second one wait". That holds for saves that update `Game`. `saveClip` writes only
`GameClip` (`gameClip.upsert`, line 264) and touches `Game` only when the part was to fix; `GameClip` rows take no lock
on `Game`. So: `accept` locks the row and reads the clips, the maker's new clip commits, `accept` commits, and the game
goes live with a video nobody saw; `saveClip` then deletes the old file. `saveClip`'s own "not live" check is also read
outside any lock, so the same window lets a clip change on a game that has just gone live. The window is milliseconds;
the guarantee the comment gives is not met.
EXPECTED: a clip change waits for a decision in progress, and is refused if the game went live meanwhile.
FIX: in `saveClip`, after `files.put`, run the upsert in a transaction that first takes `lockGame` and re-reads the
state (refuse `live` with the same words). Test first in `tests/features/games/review.pg.test.ts`: hold the row lock in
one transaction, start `saveClip`, show its upsert has not landed until the first transaction ends (two Prisma clients,
as the file's lock cases do if any; else a raw `pg` connection). Files: `service.ts`, `review.pg.test.ts`.

### R-3

UNIT: `src/routes/admin/games/[game]/+page.server.ts` (lines 117, 182) and the person-check of play time.
VERDICT: red (needs a choice; recommendation below).
REQUIREMENT: design 8, "That member's play time is recorded against that game", "checked by a browser test in CI and
once by a person on the real site"; rest plan Task 30 (`playSummary` gives "Played so far", "how a person checks on the
test site that play time was recorded, until slice 5 gives it a home") and Task 24 Step 3 ("the update's page reads
'Played so far' with counted time above zero for the member's play").
REASON: no screen shows a member's play time any more, so the person-check the plan relies on cannot be done.
EVIDENCE: the staff screen reviews (commits `b1a6434`, `2945ab7`, `a64a3e1`) narrowed the line to this staff member's
own play of the waiting files: both calls pass `{ pullId: game.pending.id, userId }`, and the words are "You've played
it for …". That change is sound for its own purpose (staff were confused by a count of their own opens). But nothing
else calls `playSummary` without `only`, so the walk's Step 3 now reads staff's time, not the member's. The browser
test half (`play-time.test.ts`, "a member's play time is recorded against that game") still holds.
EXPECTED: the Owner can see, on the test site or by one command, that a member's play counted against the game.
FIX, two options:
- a. (recommended) No code. The G walk's Step 3 replaces the "Played so far" line with one read-only command the Owner
  runs against the test database, giving counted seconds for the game's `member` sessions. It builds nothing ahead of
  its user (slice 5 gives play time its real home) and keeps the staff line as reviewed. Files: the walk only
  (`/mnt/project-files/owner-steps/…`, outside the repo) and the rest plan's Task 24 Step 3 line.
- b. On an update's check page only, a second line "Players have played it for N minutes." from
  `playSummary(game.id)` filtered to `member` sessions. Files: `played.ts`, the check page, `accept.test.ts`.

### R-4

UNIT: `src/features/games/service.ts`, `startGame` (line 570) and the rename in `saveAnswer` (line 635).
VERDICT: red (small).
REQUIREMENT: early audit L-3, assigned "waits for S, which edits `service.ts`"; S has merged.
REASON: two games given the same name at the same moment fail with "Something went wrong".
EVIDENCE: unchanged since the early audit: `freeSlug` reads which addresses are taken, then `game.create` (or
`update`) writes one; nothing catches Prisma's unique failure on `slug` (grep `P2002` in `service.ts`: none).
EXPECTED: the second maker gets the next free address.
FIX: catch Prisma's unique failure on `slug` in `startGame` and in the rename, call `freeSlug` once more and retry once.
Test first in `tests/features/games/` (a pg case that holds the first address's insert and makes the second). Files:
`service.ts` and that test file.

### R-5

UNIT: `src/routes/make/[game]/+page.server.ts`, line 142.
VERDICT: red (small).
REQUIREMENT: early audit S-2 ("check that the old words and comments go too"); rest plan Task 31 (a game taken off can
be put back).
REASON: the comment beside `takeOffAddress` says take off "cannot be undone".
EVIDENCE: `// Asked on a screen of its own, because it cannot be undone.` The take-off page itself says the files go
for good but the game can be put back, and the Taken off screen's button puts it back.
EXPECTED: the comment says why it is asked first: the files are deleted.
FIX: reword that one comment, for example "Asked on a screen of its own, because its files are deleted." Files: that
line only. A comment change: no test.

## Notes (recorded, not fixed here)

- **N-1. O-1 is still the Owner's.** A game waiting for its first yes still cannot be withdrawn (only a draft or a
  sent-back game can be thrown away; only a live one taken off). No answer is recorded. The early audit recommended
  "leave it until slice 4".
- **N-2. Take off's words differ from the plan's.** The heading is `Take {name} off Ruken?` without the plan's quote
  marks, and the card has three lines where the plan had two (the files line was added). Both came through the staff
  and maker screen reviews and the journeys pin them; recorded as deviations, not defects.
- **N-3. A staff member can accept their own game.** Nothing in the spec forbids it today; the old admin's authority
  rules (design 5.5) arrive with slice 4. Named here so slice 4's plan decides it.
- **N-4. The play screen is the Owner's v1 screen** (2026-11-16, "copy ruken v1s play screen almost identical"): the
  edge tab and its menu replace the rest plan's `back` button and Task 21's 48 by 48 ←. Design 5.7's first-time line
  "Tap ← to go back to the feed" (slice 3) no longer matches a screen with no ←; slice 3's plan should restate it.
- **N-5. A copy that runs while its game is taken off** writes its files after the delete (`pullGame` is not stopped
  by the state), so they are left behind. `filesLeft` sees them and "Delete them" removes them; the game is never put
  back in the queue. Holds; said so nobody is surprised by the card after a take off during a copy.
- **N-6. Slice 2 is not done.** `main`'s first CI run of its own (43945063395) was queued at writing; G (the Owner's
  walk), the design review loop and this audit's fixes are open.
- **N-7. A flaky test outside this audit's code:** `tests/browser/make-second-look.test.ts:501` (phone) was seen a
  second time on 2026-11-16 (`progress.md`). It belongs to the maker screens, not S or F: it gets its own thread.

## Fix round

R-1, R-2, R-4 and R-5 go to the implementer as written, each in its own files. R-3 needs a choice between a and b
before its fix; a is recommended. Each fix is checked by its test on CI (R-5 by reading the line), never by the
implementer's say-so.
