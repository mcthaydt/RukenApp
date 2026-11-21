# Everything is editable

Date: 2026-11-21. Status: **spec and plan, revised after plan audit 1 (f6d9167 FAIL, 6 red) and plan audit 2 (073359c FAIL, 3 red); unit C struck by the owner 14:41 UTC; waiting on plan audit 3.** Read against `main` at 583661f.

Lane 3 as a whole (unit A adds a migration). Each unit's own lane is in section 6.

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-21 14:20 UTC:** "At a minimum, our e2e tests should cover the CRUD operations; we didn't have a way to update".
- **Owner, 2026-11-21 14:28 UTC, on a card:** "Everything, reviewed first": on a live game the videos and the age rating can be changed too, and staff check the change before players see it.
- **Owner, 2026-11-21 14:29 UTC:** "Nothing should be permanent for this app, everything is editable - you know, like literally every other professional app?"
- **Owner, 2026-11-21 14:31 UTC, on a card:** "Keep them instant": a live game's new name or one line shows to players right away, as today. Videos, rating, files and websites wait for review.
- **Owner, 2026-11-21 14:31 UTC, on a card:** "Ask Ruken for help": a wrong birthday is fixed by staff, never by the person alone, so the 18+ check holds.
- **Owner, 2026-11-21 14:41 UTC, on a card:** "Keep the address": a live game keeps its address when it is renamed, as decided on 2026-11-14. Unit C is struck.
- **Owner, 2026-11-21 03:12 UTC:** slice 3 is parked. This spec lists the maker's page and builds none of it.

## 1. The outcome

Anything a person made in Ruken, that person can change or take away, from a screen, without asking anyone. The one exception to "without asking" is a change players would see on a live game other than its name and line: the maker makes it, staff say yes, then players see it. Every such change has a browser journey that creates, reads, updates and deletes it.

## 2. What is locked today

Read from the code at 583661f. "Locked" means the app has no screen or refuses the change.

| # | Thing | Today | Where it is refused | This spec |
|---|---|---|---|---|
| 1 | Live game: upright and wide video | Locked | `saveClip` throws "A live game's videos can't be changed yet." (`src/features/games/service.ts`); the question is a 404 for a live game (`LIVE_MAY_ANSWER` in `src/routes/make/[game]/[question=question]/+page.server.ts`) | Unit A |
| 2 | Live game: age rating and 18+ marks | Locked | `LIVE_MAY_CHANGE` in `saveAnswer`; same 404 | Unit A |
| 3 | Live game: GitHub repo, branch, folder; websites | Locked on `main` | same | Being built by the thread "Make Floor Fifty submission editable" (branch `claude/project-thread-u1uamt`). Unit A waits on it |
| 4 | Waiting game: throw it away | Locked | `throwAway` takes only `draft` and `sent_back` | Unit B |
| 5 | Game taken off Ruken: change any answer | Locked | `saveAnswer` refuses `taken_off`; the screen offers only "Put it back" | Unit B |
| 6 | Game taken off Ruken: delete it for good | Locked | `throwAway` refuses `taken_off` | Unit B |
| 7 | Game address after the first yes | Frozen, even when the game is renamed | `saveAnswer`, case `name`: the slug moves only while `game.reviews.length === 0` | Stays frozen: the owner's decision, 2026-11-14 and again 2026-11-21 14:41 UTC |
| 8 | Account email | No screen | `/me` shows it and offers no change | Unit D |
| 9 | Account password while signed in | Only by the "forgot password" mail | no screen | Unit D |
| 10 | Birthday | Worked out once at sign-up (`User.adultOn`) | no screen | Waits (section 7) |
| 11 | Membership: monthly to yearly and back | Not offered. Card, cancel and undo-cancel work on Stripe's page | `/me` has one button to Stripe's page | Waits (section 7) |
| 12 | Maker's page, its links, photo, colours and address | The service can do all of it (`src/features/pages/service.ts`); there is no screen | no route | Parked with slice 3 (unit I of `2026-11-21-feed-and-makers-page-design.md`) |
| 13 | Phone number | Not on `main` (#209 is open) | | Goes with #209 (section 7) |

Already changeable and left alone: every answer of a draft, a waiting or a sent-back game; a live game's name and line; the player count switch; the GitHub connection; the wishlist; deleting an account and undoing it within 14 days; cancelling a membership and joining again.

Corrected since the first list given to the owner: "phone or computer only" is not a locked answer. Roadmap, slice 2, item 6: "every game plays on phones and computers (unit R)". It is a decision, so it is not reopened here.

## 3. What stays a record, on purpose

These are facts about what happened, not settings, and nobody edits them. Each is added and never changed by a database trigger today.

- Money: payments, the ledger, statements (`money.prisma`, `MembershipPayment`, `MembershipStart`). Product rule: "Ledger facts are only ever added."
- Play time: `PlayPass`, `PlaySession`, `PlayBeat`. The money slice reads them.
- "I agree" to the maker agreement (`MakerAgreement`): the record of what a maker agreed to and when.
- Staff decisions (`GameReview`, `GameReviewPart`, `DecisionDay`, `DecisionOutcome`). A later decision replaces an earlier one; none is rewritten. Staff screens are slice 4.
- A game's `publicId`: it names where the game's files and saves live, so a renamed game keeps its saves. Nobody sees it.

**Call:** these stay. The owner was told so in the thread on 2026-11-21 14:30 UTC and can overrule.

## 4. Boundaries

- No new dependency, tool, environment or spend.
- Nothing runs on the owner's computer. No owner step is needed for any unit. Deploying is the owner's as always (`pnpm run deploy`), after unit A's migration is applied.
- Not touched: the feed, the maker's page, `src/features/money/`, `src/features/membership/`, `cloudflare/`, `.github/`, CLAUDE.md and the skills.
- Browsers and devices: the three profiles in Settings (small phone, tablet, computer). Emulation evidence.
- Expected duration, as session time (estimates): A 4 hours, B 2 hours, D 3 hours.
- Slice: A and B finish slice 2's game screens ("confirm slice 2 is perfect"); D adds to slice 1's account page. Each goes through a design review round with its screens before the owner's look (`visual-check`).

## 5. The changes

### 5.1 Unit A: a live game's videos and rating, checked before players see them

**What the maker sees.** On Live, the video and the rating chip each get a "Change", like the name and line have. It opens the same question screen a draft uses, showing the waiting value when there is one. Saving there does not change what players see: the save sends the change for review in the same press, the way a live game's new files and websites are sent (`sendLiveUpdate` on `claude/project-thread-u1uamt`; plan audit 2, R1). Live shows the new video or rating marked "Waiting for review" and the line "Your update is waiting for review." There is no second button to press. When staff say yes, players see the change. When staff send it back, the fix card shows their words and leads to the same question.

On the question screen of a live game with a change waiting, a quiet button "Keep the old one" drops the change.

Making a live game 18+ asks the marks before anything is kept, as a waiting game is asked today.

**Held values.** A change waiting on a live game is kept apart from what players see:

- A new table `GameHeldClip` (`gameId`, `shape`, `key`, `contentType`, `bytes`, times; unique on `gameId` and `shape`; `onDelete: Restrict`). **Call:** a table of its own, not a flag on `GameClip`. Every read of `GameClip` on `main` is a read of what players see, and stays so with no change; a flag would make every read that forgets the filter show an unchecked video.
- `Game.heldAgeRating AgeRating?` and `Game.heldContentMarks ContentMark[] @default([])`.
- The rating and the marks are held as a pair (plan audit 1, R2): either `heldAgeRating` is set, with the marks that go with it, or nothing is held. Changing only the marks of a live 18+ game holds `heldAgeRating = age_18` with the new marks, though the rating equals the live one.
- CHECK `Game_held_check`: `heldAgeRating` is null and `heldContentMarks` is empty unless `state` is `live`; `heldContentMarks` is empty unless `heldAgeRating` is `age_18`; when `heldAgeRating` is `age_18`, `heldContentMarks` is not empty; and `none` stands alone in `heldContentMarks`, as `Game_marks_check` holds it in `contentMarks`, so a held pair is always one the yes can copy (plan audit 2, N1).
- A held clip's key is made by the same `clipKeyFor(publicId, shape, random 16 hex, contentType)` every clip uses (`src/features/games/clips.ts`), so it is `clips/<publicId>/<shape>-<16 hex>.<mp4|webm|mov>`: the media gate (`src/features/play/gate.ts`) already serves it, it is unguessable as a waiting game's clips are today, and the random part keeps it apart from the live one. The yes moves no file. (plan audit 1, R1)
- CHECK `GameHeldClip_key_check`, written out in the migration: `key ~ '^clips/[a-z2-7]{10}/(upright|wide)-[0-9a-f]{16}\.(mp4|webm|mov)$'`. `GameClip` has no such check today and gets none here. (N1)
- The migration only adds: two columns, one table, the checks. Undone by dropping them.

**Saving.** For a live game, `saveClip` writes the file and upserts `GameHeldClip` (deleting the held file it replaces, after the row points at the new one). `saveAnswer` for `age` and `marks` writes `heldAgeRating` and `heldContentMarks` together. The marks question of a live game reads the held rating when there is one, and the live rating otherwise, so a held move to 18+ reaches it. The held pair is dropped only when both the rating and the marks equal the live pair; a held clip is never equal to the live one (a new upload is a new file). Each takes its part off `toFix`. For every other state both behave as today. Answering "18+" again on a live 18+ game keeps the marks that wait (plan audit 2, N4).

**Sending.** A held save on a live game ends in the same `sendLiveUpdate` the files and websites use: when nothing is left to fix it calls `sendForReview`, which with no new copy sends the copy the game is live on (`pendingPullId` = `livePullId`), the way "Send it again" does today. While something staff sent back is still to fix, the change is kept and goes with the send that follows the last fix. When the newest copy from GitHub was refused (`pullProblem`), `sendForReview` refuses as today; the change is kept, Live keeps its line "Your last copy from GitHub didn't work. Fix it there, then send a new version.", and the new version carries the held change with it (plan audit 2, N3). "Keep the old one" drops a held part; when that leaves nothing waiting (no held value, and the waiting copy is the live one) it clears `pendingPullId` and `pendingSince`, so staff are not asked to check nothing.

**What goes live is what staff looked at** (plan audit 1, R3; plan audit 2, R1 and N2). Every held save and every "Keep the old one" sets `changedAt`, as every answer does today. `/jobs/review` `look` answers the game's `changedAt` as `seen`. To accept an update that holds a video or a rating, the order must carry that `seen` back (`{"do":"accept","game":…,"seen":…}`); `accept` compares it with `changedAt` inside its transaction, on the row it locks (`SELECT … FOR UPDATE` before the held rows are read), and refuses with CONFLICT, "It changed since you looked. Look again.", when it is missing or has moved. An update with nothing held is accepted as today, with or without `seen`. The `look` answer's `says` tells the Owner to pass `seen` when something is held. (The same gap for new files sent twice and for a waiting game's answers is slice 4's, not changed here.)

**What staff see.** `/jobs/review` `look` on an update adds `seen` and `changes`: for each held part, the value players see now and the value waiting (video addresses, rating words). `list` is unchanged.

**Yes.** Accepting an update, in the transaction that moves `livePullId`: copy `heldAgeRating` and `heldContentMarks` to `ageRating` and `contentMarks` and clear them; for each `GameHeldClip`, point the game's `GameClip` of that shape at the held key and delete the held row. After the transaction, delete the replaced clip files from the bucket. A failure after the transaction leaves a file nobody points at, never a game without its clip (the order `saveClip` already keeps).

**No.** `LIVE_MAY_BE_SENT_BACK` gains `upright_video`, `wide_video` and `age_rating`, each allowed only when that part has a held value: staff send back a change, never what is already live (taking a live game down is slice 4). The held value stays so the fix card can show the refused video; the maker's next save replaces it.

**Leaving.** `takeOff` and "Keep the old one" delete held clip files and clear the held columns and rows. So does the account purge's game step, in the same pull request that first puts `Game_held_check` and that step on `main` together (section 6; plan audit 2, R2). `throwAway` never meets one (the check holds held values to live games).

**Players.** `/g/<game>`, Play, the feed's reads and the 18+ gate read only `GameClip`, `ageRating` and `contentMarks`, as today.

### 5.2 Unit B: throw away a waiting game; change or delete a game that is off Ruken

- `throwAway` also takes `waiting` and `taken_off`. For a waiting game it clears what waits and sets `changedAt`, so a decision held for decision day lapses on its day (the rule decision days already have for a changed game), and its seat is free as for any lapsed yes. Plan step B1 reads the release code and pins this with a test before changing it.
- Waiting screen: a quiet "Throw it away" under "Change something", leading to the existing throw-away screen (red only there).
- `saveAnswer` and `saveClip` take `taken_off`. The Taken off screen lays the game out as Sent back does, with a "Change" on every part, above "Put it back on Ruken", and a quiet "Delete it for good" leading to the throw-away screen. Putting it back sends it for review as today, so nothing changed here reaches players unchecked.
- A game staff took down (`taken_down`) is not changed here: no staff screen exists to take one down or let it back (slice 4).

### 5.3 Unit C: struck

A renamed game's address moving with its name was planned here. The owner chose "Keep the address" (2026-11-21 14:41 UTC), so nothing is built and the letter C is not reused.

### 5.4 Unit D: change your email and your password on the account page

- `/me` gains two quiet links under the email: "Change email" and "Change password". Each is a screen of its own with one field group and one blue button.
- `/me/email`: the new address and the current password. On save: "We sent a link to <new address>. Open it to finish." The account's address changes only when that link is opened; until then sign-in and mail use the old one. The old address gets a short mail saying a change was asked for. A new address that is taken gets the same screen and words as one that is free, so nobody learns who has an account.
- `/me/password`: the current password and a new one. On save, every other signed-in session of the account is signed out, and the screen says "Done. Your password is changed."
- Both use better-auth's own change-email and change-password calls (plan step D1 reads the installed package's documentation and types, not memory, and stops and brings back a spec amendment if either is missing, needs a table, or works differently from this section, for example by asking the old address to approve first). The existing limits per address and per IP apply.
- An account waiting to be deleted is signed out as today and reaches neither screen. A change-email link still open when its account is purged no longer works (N3; criterion D7).
- A member's Stripe customer keeps the address it was made with (`stripe.customers.create({ email })` in `src/features/membership/`), so Stripe's receipts keep going to the old address after a change. That is not fixed here (section 7); the change-email screen says so to a member: "Your payment receipts still go to <old address> for now."

### 5.5 Unit E: struck, folded into unit A

**Owner, 2026-11-21 14:26 UTC, on a card:** "Games come off with the account". The thread "Fill e2e CRUD test gaps" is building it (`claude/project-thread-vhfmo8`): its purge sets a maker's live games to `taken_off` in one write that knows nothing of held values. With `Game_held_check` on `main` that write would be refused for any maker with a held rating, and the day's purge would stop there. So `main` must never hold the check and the purge without the clearing (plan audit 2, R2):

- If the purge is on `main` when unit A is built, unit A makes the purge's game step clear `heldAgeRating`, `heldContentMarks` and the game's `GameHeldClip` rows in the same write, and carries criterion A11.
- If unit A reaches `main` first, the coordinator tells the purge thread before it merges, and the clearing and A11 go in that pull request.

## 6. The plan

| Unit | Lane | Waits on | Files it owns | Output | Check |
|---|---|---|---|---|---|
| A. Live videos and rating | 3 (migration) | this spec merged; the pull request of `claude/project-thread-u1uamt` merged (it reads that Live flow and edits the same files) | `prisma/schema/games.prisma`, one new folder in `prisma/migrations/`, `src/features/games/` (service, clips, laid-out, review words), `src/routes/make/[game]/` and `src/routes/make/parts/LiveScreen.svelte`, `src/routes/jobs/review/+server.ts`, the game step of the purge in `src/features/accounts/deletion.ts` (only if the purge is on `main`, 5.5), tests under `tests/features/games/`, `tests/browser/` | 5.1 | criteria A1 to A11 |
| B. Waiting and taken-off games | 2 | A merged (same service file and make screens) | `src/features/games/service.ts`, `src/routes/make/[game]/`, `src/routes/make/parts/` (Waiting, Taken off), tests | 5.2 | criteria B1 to B5 |
| D. Email and password | 2 (sign-in) | this spec merged; nothing else: it shares no file with A or B | `src/features/accounts/` (auth, forms, mails), `src/routes/me/`, tests | 5.4 | criteria D1 to D7 |

- A and D run side by side. B follows A: they edit the same functions.
- Unit D changes how a sign-in is changed. The lane lists name "credentials" under lane 3; D's paths are lane 2. **Call:** D is audited as lane 3 (a fresh implementation audit on Opus 5.5 medium), since a mistake here locks a person out or lets one in (plan audit 1, N4).
- Each unit is one branch and one pull request: build, then the audit its lane calls for (lane 2: one fresh review; lane 3: a fresh implementation audit), fixes on the same branch, then merge. Lane 3 units merge under the owner's standing permission in `history.md` ("Merge PRs yourself once CI, reviews and audits pass"); if the coordinator finds that permission does not cover a migration, it asks the owner by name before the merge.
- Builders: Sonnet 5.5, medium (Settings: execution against a spec). Unit A is marked hard, so high, because it changes what an accept does inside the money-adjacent review transaction. Audits: lane 3 on Opus 5.5 medium; lane 2 on the builder's model, medium.
- Each builder writes its failing journey first (`build`), loads `verify` before each commit that changes behaviour, and uses Graphify to find callers before changing `saveAnswer`, `saveClip`, `sendForReview`, `throwAway` and the accept.

### Unit A steps

1. Read what `claude/project-thread-u1uamt` merged for files and websites on Live; write down in the pull request body how its send works and follow it.
2. Journey first (failing): criterion A1.
3. Schema, migration and `tests/features/games/schema.pg.test.ts` cases for the checks (A6).
4. `saveClip`, `saveAnswer` and "Keep the old one" for a live game, with unit and pg tests (A3, A5).
5. Send in the save, `seen` on look and accept, send back, with pg tests of the accept transaction (A2, A4, A7, A10).
6. Taking off clears held values (A8); the purge's game step clears them if it is on `main` (A11).
7. Live screen, question screens, review `look` (A1, A9). Screens shot for the design round.

### Unit B steps

1. Read the decision-day release; pin with a failing test what a thrown-away waiting game with a held yes must do (B2).
2. Journeys first (failing): B1, B3, B4.
3. `throwAway`, `saveAnswer`, `saveClip` state rules; Waiting and Taken off screens.

### Unit D steps

1. Read the installed better-auth's change-email and change-password documentation and types; report and stop if they need a schema change.
2. Journeys first (failing): D1, D2.
3. Auth settings and the two mails; the two screens and the links on `/me`.

## 7. What waits, and on what

- **A member's receipts after an email change (plan audit 1, R6).** Stripe keeps the address the customer was made with. Updating it is a change to `src/features/membership/` (lane 3) and belongs with slice 5, which decides what Stripe is told and when. Until then receipts go to the old address, and the change-email screen says so (5.4).

- **Birthday (row 10).** The owner chose "Ask Ruken for help". Ruken has no way to be written to today (no address, no form; the help chat is roadmap "before launch" and needs slice 4's admin). It waits for those two: then the account page says how to ask, and a staff screen changes `adultOn`. Until then a wrong birthday cannot be fixed. Nothing is built here.
- **Monthly to yearly (row 11).** A switch in the middle of a paid period makes part-payments and credits. `MembershipPayment_amounts_check` holds every payment above zero, and slice 5 (money) has not said how a credit is posted. It belongs in slice 5's spec. Until then a member cancels and joins again on the other plan, which works and has a journey (`rejoin`).
- **Maker's page (row 12).** Parked with slice 3 by the owner. Its unit I already plans create, change and remove for the page, links, photo and colours.
- **Phone number (row 13).** #209 adds phone sign-in; changing the number is added to that work when it is brought to `main`, not here.
- **Staff's side.** Changing a held decision before its day, taking a live game down and letting it back are slice 4.

## 8. Acceptance criteria

A gap against any of these blocks the unit. All journeys are Playwright tests in `tests/browser/`, run on the three device profiles, and wait on readiness, never on a sleep.

**For every unit**

- G1. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:pg` and the unit's journeys pass in CI on the pull request's head; `gate` and `commit-authors` are green.
- G2. Every new screen and button works with the keyboard alone, with focus visible; a journey tabs to and presses each new button.
- G3. Every action finds the game or account among the signed-in person's own: a journey or pg test shows another person's game, held change or account is a 404 or a refusal for each new action.
- G4. Each new screen has one blue button, words a person says out loud, and its refusal shown beside what caused it with what was typed kept. Checked by the design round's fresh reviewer.
- G5. The pull request body names every existing test it changes and why. Expected: the tests that assert a live game's videos and rating are refused (`make-after`), the 404 for a live game's questions, `throwAway`'s refusals for waiting and taken-off games; and three that unit A changes rather than removes, since staff still cannot send back a part with no held value (plan audit 2, R3): `tests/browser/review-job.test.ts` (a live update sent back for `wide_video`, about lines 109 to 117), `tests/features/games/review.pg.test.ts` (the `it.each` over `upright_video`, `wide_video`, `age_rating`, about lines 595 to 615, and "A live game's videos can't be changed yet.", about line 677). A test not on this list that must change is named in the pull request body with its reason, as `build` asks.
- G6. No file outside the unit's row in section 6 changes, but for the live-state file (deleted before the audit) and this spec's ticked steps.

**Unit A**

- A1. Journey, upright video: on a live game the maker opens Change on the video, picks a new one, and Live says "Your update is waiting for review." with the new video marked "Waiting for review"; `/g/<game>` still serves the old video; staff look and accept through `/jobs/review`, passing `seen`; `/g/<game>` serves the new video and the media gate answers 404 for the old file's address (a browser may still hold its own copy; the journey asks the gate).
- A2. The same journey for the wide video, and for the rating (7+ to 12+: the chip on `/g/<game>` changes only after the yes).
- A3. Journey: a live game made 18+ is asked its marks before anything is kept; leaving the marks screen keeps nothing. After the yes, a signed-in under-18 account is refused the game as any 18+ game refuses it. A second journey changes only the marks of a live 18+ game: players see the old marks until the yes, then the new ones.
- A4. Journey: staff send a held video back with a reason; Live shows the fix card with the words and the refused video; the maker picks another (which sends it), staff look and accept, players see it. A pg test shows staff cannot send back `upright_video`, `wide_video` or `age_rating` on a live game with no held value for that part.
- A5. Journey: "Keep the old one" drops a held video and a held rating; Live shows nothing marked "Waiting for review" and its line is "Players can find it on Ruken."; `/jobs/review` `list` does not name the game; the gate answers 404 for the held file's address.
- A6. pg tests: `Game_held_check` refuses a held rating on a game not live, marks without a held 18+, and a held 18+ without marks; `none` beside another mark in `heldContentMarks`; a held 18+ with marks on a live game that is already 18+ is kept (the marks-only change); `GameHeldClip` refuses a second row for one game and shape and a key outside `GameHeldClip_key_check`, and takes a `.mov` key.
- A7. pg test: an accept that fails inside its transaction leaves the live video, rating, held values and `livePullId` exactly as they were.
- A8. pg test: taking a live game off leaves no `GameHeldClip` row, no held column set and no held file in the stand-in bucket. (The purge: A11.)
- A9. `/jobs/review` `look` on an update with a held video and rating answers `changes` with the current and the waiting value of each; with none held it answers as today. Unit-tested on the handler.

- A10. pg tests and a journey step: staff look at an update holding a video; the maker saves another video; `accept` with the `seen` of that look answers CONFLICT, "It changed since you looked. Look again.", and nothing goes live; `accept` with no `seen` answers the same; a second look and an accept with its `seen` make the last video live. An update with nothing held is accepted without `seen`, as today. With a refused newest copy (`pullProblem`), a held save is kept and not sent, and Live shows the GitHub line.
- A11. Only if the purge of a maker's games is on `main` when unit A is built: a pg test where a maker with a live game holding a video and a rating is purged; the purge finishes, and the game has no `GameHeldClip` row, no held column set and no held file in the stand-in bucket. Otherwise this criterion is passed to the purge's pull request by the coordinator (5.5).

**Unit B**

- B1. Journey: a waiting game is thrown away from its Waiting screen; it leaves Your games; its name can be used for a new game; `/jobs/review` `list` no longer names it.
- B2. pg test: a waiting game with a held yes for a coming decision day, thrown away, is not made live when that day goes out, and the day's outcome for it is `lapsed`.
- B3. Journey: a taken-off game's line and upright video are changed from the Taken off screen; "Put it back on Ruken" sends it; staff accept; `/g/<game>` shows the new line and video.
- B4. Journey: a taken-off game is deleted for good; it leaves Your games; its address is a 404; its clip addresses answer 404.
- B5. pg test: `throwAway` still refuses `live`, `taken_down` and a game already thrown away; another maker's game is "not found" in every state.

**Unit D**

- D1. Journey: a signed-in person changes their email; before the link is opened `/me` shows the old address and sign-in works only with the old one; after the mailed link (read from the stand-in mailbox) `/me` shows the new address, sign-in works with the new one and is refused with the old; the old address received the notice.
- D2. Journey: a signed-in person changes their password with the current one; a second browser signed in to the same account is signed out; sign-in works with the new password and is refused with the old.
- D3. Journey: a wrong current password is refused on both screens with the words beside the field, and nothing changes or is mailed.
- D4. Journey or handler test: asking to change to an address another account has answers the same screen and words as a free one, sends no link that can take that address, and changes nothing.
- D5. The new password meets the same rules as at sign-up (same refusal words); unit-tested.
- D6. The limits per address and per IP that guard sign-in also guard both actions; tested the way `auth-limits-plugin` is tested today.

- D7. pg test: an account with a change-email link still open is purged; opening the link afterwards changes nothing and the purged row keeps its tombstone address. A member (an account with a `BillingCustomer`) sees the receipts line on `/me/email`; an account without one does not.

## 9. Risks, and what is not checked

- **Receipts go to the old address** after a member changes their email, until slice 5 (section 7).
- **Unit A has no start date.** At plan audit 1 no pull request existed for `claude/project-thread-u1uamt`; A waits on its merge.
- **The other thread's Live flow is not merged yet.** Unit A's send is written against `sendLiveUpdate` as it stood on `claude/project-thread-u1uamt` at 3981563; if it merges in another shape, step A1 follows it, and a difference that changes section 5.1 comes back as a spec amendment before code.
- **The Owner's accept command gains `seen`** for an update that holds a video or rating. The review command the Owner runs today keeps working for everything else.
- **Old clip files.** A failure after an accept can leave a replaced file in the bucket. Nothing points at it and its address is unguessable; no sweep is built.
- **Real phones are not measured.** Device results are emulation.
- **Not fixed here, reported before:** games named "New" or "Github" are shadowed by `/make` routes; the launch switch is checked only in `src/features/launch`.
