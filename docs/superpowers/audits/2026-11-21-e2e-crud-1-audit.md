# Audit: do the journeys create, read, update and delete everything?

- Examined: `main` at 3db1ee6, the 43 Playwright journeys in `tests/browser/` (about 460 tests), against the screens in `src/routes/` and the tables in `prisma/schema/`.
- Asked by: the owner, 2026-11-21 14:22 UTC: "Audit our existing e2e tests to ensure we can CRUD everything". Standing rule since 14:20 UTC: journeys cover create, read, update and delete at a minimum.
- What ran: reading only. No test was run and none was written. "Covered" below means a journey drives that action through the screen (or the job address a person or staff uses) and checks what it leads to.
- Out of scope: the game update bug on Floor Fifty's Live screen is being fixed, with game CRUD journeys, in the "Fix Floor Fifty resubmit" thread. Slice 3 (the feed, maker page editing) is parked by the owner, so its rows say PARKED, not MISSING.

## The answer

Most things are covered end to end. The weak spot is the same kind of gap as Floor Fifty: an **update** is checked on the maker's or member's own screen, but not followed through to what the player sees, or to the moment it finishes. Four gaps are worth filling; one needs the owner's choice first.

## Gap table

C = create, R = read, U = update, D = delete. "n/a" means the app offers no such action on purpose.

| Thing | C | R | U | D |
|---|---|---|---|---|
| Account | `sign-up` "a stranger makes an account and lands signed in"; `mailed-links` confirms the email | `me` "the page shows the person's email" | Password: `mailed-links` reset then sign in with the new one. Email: n/a (no screen to change it) | `delete-account` (ask, undo by signing in, keep), `purged-account` (gone after 14 days, address free again) |
| Signed-in session | `sign-in` "signs in with their password" | `me` "signed-out person is sent to sign in" | n/a | `me` "signs them out" |
| Game (maker side) | `make-questions` (every Next saves a draft), `make-send` "a first game: six questions ... Waiting for review" | `make-questions` "Your games shows each game", `make-accepted` Live | Draft/sent back: `make-send` "Change opens that one question" (line, websites), `make-after` rename, fix and send again. Waiting: `make-after` "a waiting game can still be changed". Live: `make-after` "Send a new version", rename, mended update. **Live with GitHub's list lost: MISSING, being added by "Fix Floor Fifty resubmit"** | Draft and sent back: `make-after` throw away. Live: `take-off` and `make-walk` take off, `take-off` put back |
| Game (player side) | `game-page` "not at its address until it is accepted" (404 then 200) | `game-page` (clip, name, line, rating, Play), `play` loads it | **MISSING: a live game's new name, or an accepted new version, is never checked on `/g/<game>` or in Play** | `play` "a game taken off Ruken is gone on the next load" (404) |
| Game videos | `make-questions` "a video is added the moment it is chosen" | `game-page` "the clip's address answers anyone, as video" | Upright, when sent back: `make-after` "fixing the one thing". **Wide, or any video on a draft ("Choose a different video"): MISSING.** Live: n/a, refused on purpose (`make-after`) | With the game (throw away) |
| Game websites | `make-questions` "each website is its own line: add ..." | same test, two kept | `make-send` websites chip | same test, "remove" |
| Player count switch | off by default | `player-count` "the page says how many played" | `player-count` turns it on. **Turning it back off: MISSING** | n/a |
| GitHub connection | `connect-github` "comes back with the maker's repositories remembered" | `make-questions` "picks a repository from Ruken's own rows" | `connect-github` "choosing repositories on GitHub's own page", failed reconnect | n/a in Ruken (done on GitHub). Lost list: the Floor Fifty thread |
| Maker agreement | `make-send` "I agree is the agreeing" | `make-send` "shown whole, with its version and date" | n/a | n/a |
| Membership | `pay` "a stranger signs up, pays", `rejoin` | `membership` "a member sees what they pay and when it renews" | Card failed: `membership` reaches Stripe's page from "Update card" and stops there. **Card fixed, membership back, plays again: MISSING.** Plan change: not offered by Ruken's stand-in, see note | `membership` "cancels on Stripe and is told when it ends", "deletes their account" |
| Staff review of a game | `review-job` "accepts it", "sends a game back" | `make-after` maker reads the Owner's words | n/a (a later decision replaces it) | n/a |
| Play time | `play-time` "a member's play time is recorded" | money job reads it (`money-job`) | n/a | n/a |
| Maker page | PARKED (slice 3, page editing: no screen yet) | `maker-page` "shows who they are, their games and their links" | PARKED | PARKED (purge removes it, unit-tested in `purge.pg`) |
| Maker page links | PARKED | `maker-page` "a tap on a link is counted and sent on" | PARKED | PARKED |
| Feed | PARKED (slice 3) | PARKED | PARKED | PARKED |
| Saved games, follows | not built yet (later slices) | | | |
| Comments | do not exist in Ruken | | | |

## Findings

**1. A game's update never reaches the player in any journey.** UNIT: `tests/browser/make-after.test.ts`, `tests/browser/game-page.test.ts`. VERDICT: red against the owner's CRUD rule. REQUIREMENT: owner, 2026-11-21 14:20 UTC, journeys cover update. REASON: the rename and new-version journeys stop at the maker's own Live screen. EVIDENCE: `make-after` "a live game's name changes and its address stays" checks `.laid .title` on `/make/<slug>` only; no journey opens `/g/<slug>` or Play after an update is accepted. EXPECTED: after a live rename, and after a new version is accepted, a stranger sees the new name on `/g/<slug>` and Play loads the new files. FIX: two journeys in `make-after.test.ts` (or `review-job.test.ts` for the accepted version), using the existing `putGameWhereStaffLeaveIt` and `addGame` helpers; no app change expected. Not duplicated by the Floor Fifty thread, whose fix is the maker side.

**2. A paused member who fixes their card is never seen playing again.** UNIT: `tests/browser/membership.test.ts`, `tests/browser/support/fake-stripe-server.ts`. VERDICT: red (update of the one paid thing). REASON: the journey presses "Update card" and stops on the stand-in's page, which offers only "Cancel membership". EVIDENCE: `membership.test.ts` line 127-128. EXPECTED: the stand-in's page can update the card; the member is back on `/me` as a member and the paywall is gone. FIX: an "Update card" path in the stand-in plus one journey. Lane 2 (`tests/browser/support/`).

**3. A maker who deletes their account: what happens to their live games is untested, and undecided.** UNIT: `src/features/accounts/deletion.ts`, `tests/browser/purged-account.test.ts`. VERDICT: needs the owner's choice before a test can be written. EVIDENCE: `purgeDueAccounts` clears sessions, GitHub, wishlist and the maker page, but no `game` row; nothing outside `src/features/accounts/` reads `pending_deletion` or `deleted`, so a deleted maker's live games stay on Ruken and playable. The spec (section on accounts) does not say. EXPECTED: whatever the owner picks, a journey shows it. FIX: after the choice, one journey in `purged-account.test.ts`, and an app change only if the games should come off.

**4. Replacing a video on a draft, and the wide video at all.** UNIT: `tests/browser/make-questions.test.ts`. VERDICT: red, small. EVIDENCE: "Choose a different video" is only checked to be visible (`make-questions` line 551, `make-design-pass` line 360); the only replacement journey is the upright video on a sent-back game (`make-after` "fixing the one thing"). EXPECTED: choosing a different wide video on a draft shows the new one and keeps it after a reload. FIX: one journey in `make-questions.test.ts`.

**5. The player count can be turned on but is never turned off.** UNIT: `tests/browser/player-count.test.ts`. VERDICT: red, small. FIX: extend the first journey to turn it off and see the line gone from `/g/<slug>`.

## Notes (not gaps)

- Plan change (monthly to yearly) would happen on Stripe's own page. Ruken's stand-in has no plan switch, so nothing checks that `/me` shows the new plan. Worth one journey only if the real Stripe portal is set to allow switching plans; not checked here.
- A live game's videos and files cannot be changed except by sending a new version; `make-after` checks the refusal. That is by design, so not a gap.
- Changing an account's email has no screen. Phone sign-in is its own thread ("Finish phone sign-in").

## What to fill first

1. Finding 1 (update reaches the player): the same kind of miss as Floor Fifty, cheap, no app change.
2. Finding 2 (card fixed, membership back): it is the money path.
3. Finding 3, once the owner says what happens to a deleted maker's games.
4. Findings 4 and 5: small, can go in one pull request with 1.

All of 1, 4 and 5 touch only test files outside `tests/browser/support/`, so they are lane 1; 2 is lane 2.
