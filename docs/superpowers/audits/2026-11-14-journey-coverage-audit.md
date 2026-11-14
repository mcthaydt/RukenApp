# Journey coverage: every major thing a person does on Ruken, and the browser journey that walks it

Date: 2026-11-14. Audit of `main` at `659757e` and of `slice-2/submit` at `0387975` (draft pull request #63, held until the maker screens redesign is built).

The Owner, 2026-11-14: "We have e2e tests for ruken right? We need that for every major expected user experience".

## The answer first

Partly. Of 77 major experiences the design promises, **17 have a journey that walks the whole of it, 10 have one that stops part way, and 50 have none.** Four of the 17 and two of the 10 are only on draft #63, not on `main`.

Most of the 50 are not built yet. Their journeys are already written into the plans, task by task. Four experiences have no journey and no plan that will add one. Four more stop part way and no plan finishes them. Five of those eight are already built on `main`. They are listed under "The gaps".

Every journey runs on both a phone (Pixel 7) and a computer (Desktop Chrome): `playwright.config.ts` has those two projects and no journey leaves one out. The one exception is the Worker memory check, which runs on the computer only, on purpose. It measures the Worker, not an experience.

Read as code: every file in `tests/browser/` on both branches, `playwright.config.ts`, the design and its two add-on designs (wishlist, beta builds), the maker screens redesign on `spec/maker-screens-redesign-2`, all seven plans, the slice 4 plan audit and `progress.md`. Nothing was run: no test, no app, no CI. Whether each journey is green was not checked here. Where this file says a journey "walks" something, it is read from the test's code.

## How to read the tables

- **Built**: `main`; `#63` (on the draft only); or `not built`.
- **Journey**: the file and the test's name on that branch. "—" is none.
- **Covers**: **whole** (the person's steps, start to finish, through the real screens), **part** (the journey exists but stops halfway, or sets a step up in the database instead of walking it), **none**.
- **Planned**: the plan and task whose journey will walk it. "S2 T21" is slice 2's plan, Task 21. W is the wishlist plan, B the beta builds plan. **Not planned** means no plan has a journey for it.

## 1. A visitor (no account)

| # | Experience | Built | Journey | Covers | Planned |
|---|---|---|---|---|---|
| V1 | Opens Ruken and a game's clip plays at once, upright on a phone and wide on a computer | not built | — | none | S3 T13 (`feed.test.ts`), S3 T27 (`feed-and-page.test.ts`) |
| V2 | Swipes, or uses the arrow keys or the wheel, to reach the next game | not built | — | none | S3 T13 (arrow keys), S3 T17 (first swipe) |
| V3 | Taps for sound, and sound stays on for the next game | not built | — | none | S3 T16 (`feed-controls.test.ts`) |
| V4 | Sees the two first-open hints, which go after the first swipe or tap and never come back | not built | — | none | S3 T17 |
| V5 | Shares a game, and the shared link opens the feed at that clip | not built | — | none | S3 T14, T15 (`game-page.test.ts`) |
| V6 | On a phone, a computer-only game says so and offers its link | not built | — | none | S2 T20, S3 T14 |
| V7 | Opens a maker's page: their games, their links, their colours; taps a link | not built | — | none | S3 T22, T23 (`maker-page.test.ts`), S3 T27 |
| V8 | Presses Play and sees the price card over the dimmed clip; "Not now" goes back | `main` (the card at `/join`, on the felt) | `join.test.ts`: "the card says the price, that it renews, and what happens next" and six more | part: the card alone, reached by its address, never from Play | S3 T18, T19 (over the clip, the pip); S2 T21 ("Not now") |
| V9 | Plays a free game (FloorFifty) with no account | not built | — | none | S2 T21 ("anyone can play a free game without an account"), S4 T12 (staff make it free) |
| V10 | Cannot load a game's files without paying | `main` (the gate) | `game-gate.test.ts`: "a game's address gives nothing without a pass" | part: a made-up game address with no pass, not a real game a visitor tried to play | S2 T21 ("someone who has not paid gets the price card, and the files do not load") |
| V11 | Reports a game or a maker's page | not built | — | none | S4 T15, T16 (`report.test.ts`) |
| V12 | Before launch: sees "Opens 30 November", presses Wishlist, signs up, is back on the game, wishlisted | not built | — | none | W T12 to T14 (`wishlist.test.ts`), W T15 (`before-launch.test.ts`) |
| V13 | Reads how makers are paid (`/split`) | not built | — | none | S5 T34 (`split.test.ts`) |
| V14 | Opens an address nobody serves, and is offered the way back | `main` | `error-page.test.ts`: "an address nobody serves says so and offers the way back" | whole | — |
| V15 | Reads the maker agreement | `#63` | `make.test.ts`: "the maker agreement is a page anyone can read…", and two more | whole | — |

## 2. A new member: sign up, confirm, pay, play, cancel, come back, delete

| # | Experience | Built | Journey | Covers | Planned |
|---|---|---|---|---|---|
| N1 | Signs up (email, password, birth date); under 13 is told to come back | `main` | `sign-up.test.ts`: "a stranger makes an account and lands signed in", and four more | whole | — |
| N2 | From Play: signs up from the card with the plan kept, pays, and is in the game they tapped | `main` up to paying | `pay.test.ts`: "a stranger signs up, pays, and lands where they were going as a member" | part: it starts at `/join?next=/me` and ends on `/me`. No game exists yet | S2 T21 ("a stranger signs up, pays, and is in the game they tapped") |
| N3 | Confirms their email from the link in the mail | `main` | `me.test.ts`: "an unconfirmed address can ask for the link again" | part: asks for the link again; no journey opens the link | **not planned** |
| N4 | Pays, and Stripe's news is late: "Finishing up…", then on by itself | `main` | `pay.test.ts`: "when Stripe's news is late, the page says so and goes on by itself" | whole | — |
| N5 | First time in a game: full screen, "Tap ← to go back to the feed" once, ← goes back | not built | — | none | S2 T21 ("the way back is one link, and its line shows once") |
| N6 | Their play time is recorded against that game | not built | — | none | S2 T22 (`play-time.test.ts`) |
| N7 | Cancels on Stripe's page and is told when it ends | `main` | `membership.test.ts`: "a member cancels on Stripe and is told when it ends" | whole | — |
| N8 | After the membership has ended, Play shows the price card again | not built | — | none | S2 T21 ("a member whose membership has ended gets the price card on reload") |
| N9 | Comes back: joins again after their membership ended, and plays | `main` (`/join`, the checkout) | — | none | **not planned** |
| N10 | Their card fails: told the membership is paused, sent to fix the card | `main` | `membership.test.ts`: "a member whose card failed more than a week ago is told, and sent to fix it" | part: the failure is written into the database, and the journey stops on Stripe's page, not back in a game | not planned to go further |
| N11 | Deletes their account: signed out, told the date | `main` | `delete-account.test.ts`: "a person asks to be deleted, is signed out, and is told the date", and four more | whole | — |
| N12 | Changes their mind: signs in within 14 days and the account is back | `main` | `delete-account.test.ts`: "signing in again within the 14 days undoes it, and says so once" | whole | — |
| N13 | A paying member who deletes is told the membership ends now, with no refund, and offered cancelling instead | `main` | `membership.test.ts`: "a member who deletes their account is told the membership ends now"; "a paying member's delete screen says the no-refund line first…" | whole | — |
| N14 | Their sign-up records the maker's link they came through | `main` | `pay.test.ts`: "a member's sign-up records the maker's link they came through" | part: the test writes the arrival cookie itself; no link is followed | S2 T23 (from a game's address), S3 T22 (from a maker's page) |

## 3. A returning member

| # | Experience | Built | Journey | Covers | Planned |
|---|---|---|---|---|---|
| R1 | Signs in with their password; a wrong one says so and offers the reset | `main` | `sign-in.test.ts`: "a person signs in with their password", "a wrong password says so and offers the reset" | whole | — |
| R2 | Forgot their password: gets the link, sets a new one, signs in with it | `main` | `sign-in.test.ts`: "asking for a reset answers the same for any address", "a made-up reset link offers a new one", "after a new password is saved, sign-in says so" | part: asking, a made-up link and the closing message are each checked alone; no journey opens a real link and saves a password | **not planned** |
| R3 | Opens their page (`/me`): their email and membership; signs out | `main` | `me.test.ts`: "the page shows the person's email and signs them out"; `membership.test.ts`: "a member sees what they pay and when it renews" | whole | — |
| R4 | Opens the price card as a member and is told they are one | `main` | `membership.test.ts`: "a member who opens the card is told they are one" | whole | — |
| R5 | Presses Play as a member and the game loads, in its own frame, knowing nothing of them | not built | — | none | S2 T21 ("a member presses Play and the game loads…", "the game sees nothing about the player") |
| R6 | Wishlisted before launch; at 11:00 the game shows Play; one email says it is out | not built | — | none | W T13, T15; the email itself is proved in a database test only (W T10), as no journey can read a mail |
| R7 | A picked tester sees "Play the beta" and plays it | not built | — | none | B T8, T9 (`beta-play.test.ts`) |

## 4. A maker

| # | Experience | Built | Journey | Covers | Planned |
|---|---|---|---|---|---|
| M1 | Finds the maker's area from their account ("Make games? Add yours to Ruken.") | not built | — | none | **not planned**: the redesign spec, section 3, has it; no plan does |
| M2 | First steps: picks a short address, sees at once if it is free; photo, one line, colours | not built | — | none | S4 T21 (`first-steps.test.ts`), written for three steps; the redesign makes them questions 1 to 4 of 10, and no plan carries that yet |
| M3 | Connects GitHub and picks repositories | `main` | `connect-github.test.ts`: "connecting GitHub comes back with the maker's repositories remembered", and five more | whole (through the stand-in GitHub) | — |
| M4 | Submits a game: name, line, repository, the copy, two videos, the agreement, Send, "Waiting for review" | `#63` | `make.test.ts`: "a maker submits a game and sees it waiting for review" (with `startGame`: sign up, connect, the form) | whole on `#63`; it opens `/make` by address, as there is no door (M1) | the redesign rewrites these screens; the spec leaves the new journeys "to the plan", and there is no plan yet |
| M5 | Is told what to fix: a short name, no index.html, a wrong video, no tick | `#63` | `make.test.ts`: about twenty refusal journeys, e.g. "a repository with no index.html says what to fix…" | whole on `#63` | as M4 |
| M6 | A game sent back: reads why, fixes it, sends it again | `#63` (the maker's side) | `make.test.ts`: "a game that was sent back shows what to fix apart from the state, and its button says again" | part: staff's decision is written into the database, and "Send it again" is seen but not pressed | S2 T30 (`accept.test.ts`: "staff send a game back, and the maker reads why") |
| M7 | A game goes live: "See it on Ruken"; sends their newest version for review, and players keep the old one until staff say yes | `#63` (the maker's side) | `make.test.ts`: "a live game says players can find it, and its newest version goes for review on one press" | part: "live" is written into the database; "See it on Ruken" is not followed; the update's review is not walked | S2 T30 ("staff accept a waiting game, and it is live at its address") |
| M8 | Changes a game's name, line or where it plays | not built | — | none | S4 T22 (`edit-game.test.ts`); the redesign moves it onto the Live screen |
| M9 | Changes a live game's clips, shown only after staff say yes | not built | — | none | S4 T24 (`game-updates.test.ts`) |
| M10 | Throws a draft away ("Throw Floor Fifty away?") | not built | — | none | **not planned** (Owner, 2026-11-14: "B", before launch; redesign spec section 5 only) |
| M11 | Takes their own game off Ruken, and puts it back | not built | — | none | S2 T31 (`take-off.test.ts`) |
| M12 | A game taken down by staff: reads why, sends it again | not built | — | none | S4 T11, T12 (`take-down.test.ts`) |
| M13 | Makes and edits their page: address, colours, photo, links; sees views and taps | not built (the rules and the photo are on `main`; no screen) | — | none | S3 T24 to T26 (`edit-page.test.ts`), S3 T22 (counts) |
| M14 | Is mailed when a game goes live, is sent back or is taken down | not built | — | none | S4 T9, T12, T20 call `lastMailTo`, which does not exist (see gap G6) |
| M15 | Sees their numbers: wishlisted by, plays, minutes | not built | — | none | W T8 (`make.test.ts`) |
| M16 | Plays their own game, free, before and after launch | not built | — | none | W T5 (`play-gate.test.ts`), W T8 |
| M17 | Runs a beta: names a branch, pulls it, adds and removes testers, sees the beta's own numbers | not built | — | none | B T6, T10 (`beta-maker.test.ts`) |
| M18 | Connects their bank | not built | — | none | S5 T25 (`bank.test.ts`) |
| M19 | Sees what they are owed and reads a statement | not built | — | none | S5 T27 (`maker-money.test.ts`) |
| M20 | Is paid on the 15th and sees it on their statement | not built | — | none | **not planned** as a journey: S5 T30 is tested against the database; S5 T37 is a person on the real site |
| M21 | Asks about a line on a statement | not built | — | none | S5 T35 (`statement-questions.test.ts`) |
| M22 | Their page is taken down or their account suspended: told why, asks for another look | not built | — | none | S4 T17, T18 (`standing.test.ts`), S4 T20 |
| M23 | Another maker cannot open their game's page | `#63` | `make.test.ts`: "another maker cannot open this game's page" | whole on `#63` | — |

## 5. Staff

| # | Experience | Built | Journey | Covers | Planned |
|---|---|---|---|---|---|
| S1 | The first owner is made by one command | `main` | `first-owner.test.ts`: "makes the first staff account the owner, and says plainly when there is one already", and three more | whole (a command, so the journey is requests, not screens) | — |
| S2 | Sets up an authenticator and enters a code when asked | not built | — | none | S4 T4 (`authenticator.test.ts`) |
| S3 | An owner adds staff with a role, and a second owner | not built | — | none | S4 T6, T7 (`staff.test.ts`) |
| S4 | Watches both clips, plays a waiting game, accepts it; it is in the feed and on the maker's page | not built | — | none | S2 T30 (`accept.test.ts`), S4 T23 (`submit-and-moderate.test.ts`) |
| S5 | Sends a game back with a reason | not built | — | none | S2 T30 |
| S6 | Takes a live game down with a reason; a member's game stops loading | not built | — | none | S4 T12 |
| S7 | Marks a game free with a reason (FloorFifty) | not built | — | none | S4 T12 ("staff make a game free with a reason, and anyone can then play it") |
| S8 | Works the reports queue: takes a game or a page down, closes a report, suspends a maker and lifts it | not built | — | none | S4 T20 (`reports-queue.test.ts`), S4 T23 |
| S9 | Reviews a beta | not built | — | none | B T7 (`beta-review.test.ts`) |
| S10 | Checks a month and approves a payout run as the second person, with a fresh code | not built | — | none | S5 T32, T33 (`admin-money.test.ts`) |
| S11 | Answers a maker's question about a statement | not built | — | none | S5 T36 |

## 6. Money and the daily jobs, as a person meets them

| # | Experience | Built | Journey | Covers | Planned |
|---|---|---|---|---|---|
| J1 | Each night, a payment is posted and Stripe's fees are read | `main` | `money-job.test.ts`: "a member who paid is posted, and Stripe's fees are asked for and then read" | whole (a job, so requests and rows, not screens) | — |
| J2 | Fourteen days after asking, the account is really gone | `main` | `purge-job.test.ts`: "the job runs for the secret and says how many accounts it finished", "the daily trigger runs the job" | part: the job answers a count; no journey shows an account that is gone (sign-in refused, the address free again) | **not planned** |
| J3 | On the 10th the month's statements become final | not built | — | none | S5 T27 shows a statement from stored rows; no journey has the job make one |
| J4 | The launch switch: before 11:00 CT on 30 November nobody but the maker and staff plays; from 11:00 every game shows Play | not built (the switch is on `main`; no screen asks it) | — | none | W T5, T13, T15 |
| J5 | At launch, one email per person lists their wishlisted games, never twice | not built | — | none | W T11 (`launch-mail-job.test.ts`: the job's answer only; the mail is proved in a database test) |
| J6 | Before launch, `/join` shows the price and "Membership opens 30 November." with no pay button | not built | — | none | W T6 (`join.test.ts`) |
| J7 | Each night, the files of old versions leave the bucket | not built | — | none | S4 T25 (`sweep-job.test.ts`) |

Left out on purpose, as the design puts them after launch or nowhere: like, save, follow and the two tabs; sign in with Google; free-play codes; a refund or a chargeback (no Ruken screen; Stripe's own). The look journeys (`look.test.ts`, `look-layout.test.ts`) check how screens look, not what a person does, and are not counted.

## 7. Design section 8: what "launched" means, line by line

Design 8 says each line "is checked by a browser test in CI".

| Line | Today | Planned |
|---|---|---|
| The site opens straight into the feed, on a phone and on a computer, with the right clip for the screen | none | S3 T13, T27 |
| A stranger signs up, pays with a real card, and is in the game they tapped | part (N2: ends on `/me`) | S2 T21 |
| That member's play time is recorded against that game | none | S2 T22 |
| A member can cancel | whole (N7) | — |
| Someone who has not paid cannot load a game's files | part (V10: a made-up address) | S2 T21 |
| A maker signs up, connects GitHub, submits a game, and sees it "Waiting for review" | whole on `#63` only (M4) | S4 T23, through the first steps |
| Staff accept it, and it appears in the feed and on the maker's page. Staff can send one back and take one down | none | S2 T30, S4 T12, S4 T23 |
| A maker's page shows their games, their links and their chosen colours, at its own short address | none | S3 T22, T27 |
| A report reaches the admin portal | none | S4 T20, T23 |
| Anyone can play FloorFifty without an account | none | S2 T21, S4 T12 |
| A member's sign-up records the maker's link they came through | part (N14: the test writes the cookie) | S2 T23, S3 T22 |

One of eleven is whole on `main` today; a second is whole on #63.

## 8. The gaps

### For what is already built (on `main` or #63)

- **G1. A mailed link is never opened (N3, R2).** Confirming an email and setting a new password are built on `main`. No journey opens the link from the mail, because no journey can read a mail: `playwright.config.ts` sets `MAIL_ALLOWLIST: "nobody@ruken.test"`, so nothing is sent. No plan adds these two journeys. The slice 4 plan audit's fix for S4 (a stand-in mail server that `lastMailTo` reads) would make both possible. It is not yet written into the slice 4 plan.
- **G2. Deleted means deleted is not walked (J2).** The purge job's journeys check that it answers and that the daily trigger runs it. None shows a person who asked to be deleted, 14 days later, unable to sign in, with their address free for a new account. Not planned.
- **G3. Coming back after the membership ended (N9).** `/join` and the checkout are built. No journey has a member whose membership ran out pay again. Not planned. S2 T21 stops at "gets the price card on reload".
- **G4. The submit journey's last steps are set by hand (M6, M7), and its first step has no door (M1).** On #63, "sent back" and "live" are written into the database (`putGameWhereStaffLeaveIt`). "Send it again" is seen but not pressed, and "See it on Ruken" is not followed. That is fair until staff can accept (S2 T30). Once they can, S2 T30's `accept.test.ts` should walk the maker's side too. Every maker journey opens `/make` by its address.
- **G5. The redesign has no journeys yet (M1, M2, M4, M5, M8, M10).** The Owner held #63 until the redesign is built. The redesign spec leaves the journeys "to the plan", and there is no plan. Two of its experiences are new and the Owner wants them before launch: the door from Your account (M1), and throwing a draft away (M10, Owner: "B", before launch). Neither has a journey in any plan.
- **G6. Paying ends on `/me` (N2), and the arrival is written by the test (N14).** Both are what slice 1 could do before games existed. S2 T21 and T23 replace them, so they are planned, not missing.

### Planned journeys that cannot pass as written

- **G7. Mail journeys read mail that nothing keeps (M14).** `maker-mails.test.ts` (S4 T9), `take-down.test.ts` (S4 T12) and S4 T20 call `lastMailTo`. It does not exist, and no journey can read a mail (G1). The slice 4 plan audit found this as S4; the plan is not changed yet.
- **G8. The first steps are planned for the old three-step design (M2).** S4 T21's `first-steps.test.ts` walks "Step 1 of 3". The Owner's "13. A" makes those steps questions 1 to 4 of one run, and that change is not in the slice 4 plan yet.

### Experiences with no journey in any plan

- No journey at all: N9 (G3), M1 and M10 (G5), and M20. M20 is a maker being paid on the 15th and seeing it on their statement. S5 T30 is tested against the database only, and S5 T37 is a person on the real site.
- A journey that stops part way, and no plan finishes it: N3 and R2 (G1), J2 (G2), and N10. In N10 the card failure is written into the database, and the journey stops on Stripe's page. The stand-in has no card that fails, so this may be as far as a journey can go. Either the test says so, or the stand-in gets a failing card.

## 9. Waiting, skipping and retries

- **No journey sleeps.** No `waitForTimeout`, and no timer in a test file. The one timer in the stand-in Stripe (`?events=later`, three seconds) makes Stripe's news late on purpose. The journey that uses it waits on the page's own address.
- **`waitForLoadState("networkidle")` is used 11 times**: once on `main` (`join.test.ts:88`) and ten times on #63 (`make.test.ts`, e.g. lines 237, 291, 384, 481, 507, 605, 626, 662, 725, 791). It waits until the browser has made no request for half a second. That is a timer, not a sign from the page that it is ready, and CLAUDE.md says "Browser tests wait on readiness, never on a sleep". Commit `9e3fb28` on #63 says these wait "for the page's script". A mark the page sets once its script is running, waited on with `expect`, would say that directly.
- **Skipped on purpose:** only `worker-memory.test.ts`, on the phone ("the Worker's memory is the same for both devices; measure it once") and where `/proc` is missing. Neither is an experience. No `test.fixme` or `test.only` (`forbidOnly` is on).
- **Failed once, passed on a retry.** `progress.md` records `pay.test.ts:29` and `connect-github.test.ts:56` failing and then passing on attempt 2 (run 43586931641, slice 3 branch B). It also records "the known connect-github hang" doing the same (run 43589619181, wishlist branch A). `progress.md` puts the hang down to Prisma batching, fixed by #75. This audit did not check whether those two runs already had #75. CLAUDE.md says a second sighting is fixed before other work. Whether these runs count as one is the coordinator's call.

## 10. What was not done

- No test, app or CI run was read for pass or fail. "Built" means merged to `main`, or on #63's branch. It does not mean green.
- The beta builds plan's journeys (B T6 to T10) and the wishlist plan's (W T5 to T15) are counted as planned. Both plans are on `main`, with their plan audit's fixes.
- The slice 4 plan on `main` was read as it is. The fixes its plan audit asks for are not written in yet (`progress.md`).
