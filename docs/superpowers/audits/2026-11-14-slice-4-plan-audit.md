# Slice 4 plan audit: submitting and the admin portal

**Audited:** `docs/superpowers/plans/2026-11-14-slice-4-submitting-admin.md` on `plan/slice-4` at `18619d3` (pull request #58, not merged), against `main` at `bedb45a`.

**Read:** `CLAUDE.md`, `AGENTS.md`, the design (`docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`, sections 5.1 to 5.8, 7, 8, 9, 10), the plans of slices 2, 3 and 5 where slice 4 touches them, the slice 5 plan audit, `docs/superpowers/progress.md`, and the code on `main` (`src/features/accounts/` in full, `src/lib/server/mail.ts`, `src/lib/safe-next.ts`, `src/lib/server/rate-limit.ts`, `src/hooks.server.ts`, `cloudflare/worker.js`, `playwright.config.ts`, `tests/browser/support/`).

**Checked outside the repository:** `better-auth/crypto` 1.7.7 in `node_modules` (`symmetricEncrypt` and `symmetricDecrypt` exist with `{ key, data }`, XChaCha20-Poly1305); `uqr` 0.1.3 from the registry (`npm view`: MIT, no dependencies, integrity `sha512-0rjE8iEJe4YmT9TOhwsZtqCMRLc5DXZUI2UEYUUg63ikBkqqE5EYWaI0etFe/5KUcmcYwLih2RND1kq+hrUJXA==`, the plan's value), and its packed `dist/index.mjs` (`renderSVG(data, options)` draws a white `rect` and one black `path`, with a border of 1 module by default). The RFC 6238 test values in Task 1 were worked by hand: the four six-digit codes are the last six digits of Appendix B's SHA-1 codes, the steps are right, and the ±30 s and ±60 s cases come out as the plan says.

**Not done:** no test ran and no code was written (docs only). Slice 2's `admin` and `make` features and all of slice 3 are not on `main`, so what the plan says of them was read from their plans, not their code.

**Counts:** 1 blocks launch, 13 should fix, 17 notes. One question for the Owner (Q1).

## What holds

- **Slice 5's needs are met by name and shape, in branches A and B.** `freshCodeOnly(event: { locals; url }): Promise<void>` in `src/features/admin/admin.ts` (Task 4), with `CODE_FRESH_MS = 10 * 60_000` and the session rule (Task 3, Review Focus 2); `staffOnly(caller, roles = GAME_STAFF_ROLES)` (Task 4), which slice 5's Task 32 says it will use as found; `finance` offered as "Money" on `/admin/staff` (Task 7); a second staff account through `/admin/staff` and the Owner's steps in Task 7, step 3. Slice 5's `MONEY_STAFF_ROLES` is `owner` and `finance`, so the two owners are two accounts that can check and approve. A and B come first and need nothing of slice 3.
- **Nothing slice 2 built is rebuilt.** `/admin/games`, Accept and Send back, `GameReview`, `takeOff`, `putBack`, `deleteAll`, `MakerAction` and `/jobs/first-owner` are extended, not replaced. `GAME_STAFF_ROLES` is not on `main` yet (`src/features/accounts/staff.ts` holds `staffRolesOf` and `grantFirstOwner` only), as the plan says.
- **The TOTP check against RFC 6238:** 30-second steps, HMAC-SHA-1 keyed with the key's own 20 bytes, six digits, the step either side accepted, every candidate compared in constant time, a code taken once by one conditional `UPDATE` on `lastStep`, the key kept encrypted with `BETTER_AUTH_SECRET`. The one gap is how the wrong-code count is kept (B1, S11).
- **The two-owners rule holds** against what is on `main`: a staff account cannot ask to be deleted (`requestDeletion` answers `"staff"`), a staff account cannot be suspended (Task 18), and `removeRole` counts under `grantFirstOwner`'s lock.
- **Staff pages answer 404** to anyone who may not open them; `next` goes through `safeNextPath` (`src/lib/safe-next.ts` refuses `//` and anything not starting `/`).
- **The QR picture's address:** staff only, only while the set-up is `started`, `no-store`, served as an `<img>`; `renderSVG` writes no script and escapes its colours.
- **Suspension and take-downs against design 5.5:** a person decides every one, each has a reason that is recorded (`StaffAction`, add-only), and the maker is told. "Hide them, keep sign-in" is built as the Owner chose.
- **The layer rule:** every import named goes down (`moderation` above `pages` and `games`; `admin` above `moderation`; suspension read by `games` and `pages` from `accounts`, the lowest). Tests are all under `tests/`, mirroring `src/`.
- **No strategy in the public repository:** none found in the plan.
- **Each screen has its drunk-grandma account and its look,** with no new class and no colour; two wordings are better changed (N5, S13).

## Blocks launch

### B1. Many codes sent at once get past the ten-code lock

- **Evidence.** Task 3's `enterCode` reads `lockedUntil` first, compares the code, and only then adds one to `failures`. Two requests in the same moment both read "not locked" and both get their guess. `/admin/code`'s `enter` action has a limit of ten a minute, but `/admin/authenticator`'s `finish` action has none, and nothing says `finish` is refused once the set-up is done: a forged post to `/admin/authenticator?/finish` reaches `enterCode` for a `ready` authenticator, and an `ok` writes a fresh code for the session. So someone holding a staff member's session cookie can send thousands of guesses in parallel before the count reaches ten. With three codes accepted out of a million, a few hundred thousand guesses in one burst are very likely to hit. The fresh code is the only thing between a stolen session and changing who is staff (this slice) or approving a payout (slice 5).
- **Fix.**
  1. Take the attempt before checking the code, in one statement: `UPDATE "StaffAuthenticator" SET "failures" = CASE WHEN "lockedUntil" <= <now> THEN 1 ELSE "failures" + 1 END, "lockedUntil" = NULL WHERE "userId" = <id> AND (("lockedUntil" IS NULL AND "failures" < 10) OR "lockedUntil" <= <now>) RETURNING "failures"` (a lock that has run out starts the count again at this attempt). No row: `locked`. Then compare. A right code claims the step and sets `failures = 0` (as now). A wrong one whose claimed count is 10 sets `lockedUntil` to now plus `CODE_LOCK_MS`; until it is set, the tenth claim already shuts the door (`failures < 10` fails). Every guess is counted before it is checked, so at most ten are ever checked in a lock period, however many arrive at once.
  2. `finish` answers 404 (or a 303 to `/admin/authenticator`) when the authenticator is `ready`, and both actions share `hit("api:staff-code:<userId>", …)`.
  3. Test: `Promise.all` of 30 wrong codes leaves `failures` at 10, `lockedUntil` set, and 20 answers `locked`; a right code right after is `locked`. A post to `?/finish` for a `ready` authenticator changes nothing. Add as Review Focus 22.

## Should fix

### S1. A and B can mostly start now; and slice 5 waits for all of slice 4

- **Evidence.** Branch A needs slice 2's branch S. Slice 2's tracker has E, M, P and S still to come (`progress.md`, slice 2: "Left after D: E …, M …, P …, S …"). Yet Tasks 1 to 3 (the arithmetic, the tables, the service) and Task 5 (the record and the role rules) touch only `src/lib/`, `prisma/` and `src/features/accounts/`; only Tasks 4, 6 and 7 need `src/features/admin/`. Separately, slice 5's plan on `main` says Task 33 "does not start until slice 4 is on `main`", while this plan says branches A and B are enough.
- **Fix.** Split A: A1 `slice-4/authenticator` (Tasks 1 to 3, needs slice 1 only) can start now; A2 (Task 4) after slice 2's S. Move Task 5 into A1 or a B1 that needs only A1; Tasks 6 and 7 after A2. With S on `main` by about 25 November, the three screen tasks and their "fine" fit before 1 December; without the split, all seven do. Ask the coordinator to change slice 5's line to "waits for slice 4's branches A and B".

### S2. `freshCodeOnly` sends the person back to the form's action address

- **Evidence.** `<here>` is `url.pathname + url.search`. A form action is posted to `?/add` (SvelteKit's named actions), so pressing Add on `/admin/staff` gives `next=%2Fadmin%2Fstaff%3F%2Fadd`, and after the code the person lands on `/admin/staff?/add`. Task 7's journey expects `/admin/code?next=%2Fadmin%2Fstaff` and will fail; slice 5's Approve has the same address shape.
- **Fix.** `<here>` is the path and the query with any key that starts with `/` taken out. `fresh-code.pg.test.ts` gains a case with `url = /admin/staff?/add` that expects `next=%2Fadmin%2Fstaff`.

### S3. A waiting clip can reach the feed through any reader that does not filter it

- **Evidence.** Task 24 changes `GameClip`'s unique key to (`gameId`, `shape`, `pending`) and says `liveGameBySlug`, `gameForMaker` and `gameForReview` read the right clip. Slice 3's `liveGames` (its Task 9), the feed service (Task 12) and the maker's page read clips too, as does `sendForReview`'s "both clips exist". Any of them that reads by `gameId` alone shows a clip no person has said yes to (design 5.5: "A person always decides"). Review Focus 19 promises "the feed shows the old clip the whole time", but the journey checks only `clipAddressOnPage`.
- **Fix.** Task 24 lists every reader of `GameClip` on `main` when it starts (a search for `gameClip` in `src/`) and gives each `pending: false` unless it wants the waiting one; `pending-clips.pg.test.ts` adds: `liveGames` and the feed service answer the old keys while a new clip waits; `sendForReview` on a draft counts only shown clips. Name the journey helper `clipAddressOnPage` in the file map, with which page it reads.

### S4. The journeys cannot read a sent mail

- **Evidence.** Tasks 9, 12 and 20 assert `lastMailTo(email)` and say it reads mail "as slice 1's sign-up journeys read theirs". Nothing on `main` does: `playwright.config.ts` sets `MAIL_ALLOWLIST: "nobody@ruken.test"`, so the journeys send no mail at all, and `createResendMailer` posts to a fixed `https://api.resend.com/emails`. No journey on `main` reads a mail.
- **Fix.** Task 8 builds what reads it, the way slice 2 did for GitHub: an optional `RESEND_API_BASE`, accepted only when it starts with `http://127.0.0.1:` (anything else throws at start, so a real site cannot be pointed at it); a stand-in mail server in `tests/browser/support/` beside `fake-stripe-server.ts` that keeps what it is sent; `playwright.config.ts` points the app at it and drops the allowlist for it; `lastMailTo` reads it. One unit case for the setting's check. No new package.

### S5. A report can be closed with nothing done

- **Evidence.** Task 19's `decideReport` runs `decide` first, which closes every open report about the thing, and then `takeDown`, `takePageDown` or `suspend`, each in its own transaction. Only the empty reason is checked before. If the maker took the game off in between (`NOT_READY`, "This game isn't live."), or the page's maker is staff (`suspend` refuses), or the bucket delete throws, the reports are closed and nothing happened. The plan says "a report is never closed with nothing done".
- **Fix.** One transaction: the open reports are claimed with the conditional update, and the action runs with the same `tx` (the three services take an optional `tx`); the files are deleted after it commits. Test: the maker takes the game off between the report and the decision; Take it down shows "This game isn't live." and the report is still open.

### S6. Several branches need more than their row says

- **Evidence and fix**, by branch (the "Needs on `main`" column):
  - L: its journey compares the clip address a visitor is given, which is `/g/<game>` (slice 2's branch F); add slice 2's F.
  - D: `payAsNewMember` then `/g/<slug>/play` (slice 2's F); add it.
  - G: Task 17 changes `src/routes/make/page/` (slice 3's branch I); add slice 3's I.
  - H: its journey sends the report through `/report` (branch F) and `makePage` (slice 3's H); add F.
  - I: its journey asserts "We'll email you when it's live." (Task 9, branch C); add C.
  - J: `addGame` (slice 2's S) and `/g/<slug>` showing the new name (slice 2's F); add both.

### S7. A new maker's photo keeps where it was taken

- **Evidence.** Slice 3's `/make/page/photo` redraws a chosen photo on a canvas before it is sent, and says why: a camera writes details into the file (where it was taken among them). Task 21's step 2 has a plain file field and no such script, so a phone photo chosen there goes on a public page with its location. Copying the script would also build the screen twice.
- **Fix.** The field and its script become one component in `pages` (`PhotoField.svelte`, through `pages.browser.ts`), used by slice 3's photo screen and by step 2. Slice 3 is not built yet: the coordinator tells slice 3's execution session (Task 25) to build it as a component, or Task 21 moves it there. Step 2's journey checks the field is that component (its `data-` mark).

### S8. "Free" while typing and "taken" on Save disagree for some addresses

- **Evidence.** `/make/start/free` answers from `handleProblem` and "whether a page has that address", which the plan reads with `pageByHandle`. After branch G, `pageByHandle` answers `null` for a taken-down page and a suspended maker's page, so the line says "is free." and Save then says "That one is taken." (Review Focus 17 promises the same words).
- **Fix.** The pages service gains `handleTaken(handle): Promise<boolean>`, reading the table as `savePage` does; the free address uses it. One case: a taken-down page's address is "taken" both ways.

### S9. One failing daily job hides the other

- **Evidence.** `cloudflare/worker.js` throws as soon as `/jobs/purge-accounts` does not answer 200. Task 25 adds a second call "the way it calls" the first, so a failed purge means the sweep never runs that night, with nothing saying so (CLAUDE.md: "no step may hide behind a failing one").
- **Fix.** Both calls run every time; after both, throw one error naming each that failed. The Worker's test: the first answers 500, the second is still called, and the run fails naming the first.

### S10. The report limit keeps the reporter's address

- **Evidence.** Task 14 keys the limit `api:report:<address>` and says "the address is used for the limit and is not stored". The limit is a row in `RateLimit` whose key is that text, and nothing deletes old rows (`RATE_LIMIT_ROWS_KEPT_MS` names a clean-up that does not exist yet).
- **Fix.** Key it by a keyed hash of the address, as slice 1's sign-in guards key theirs (`sign-in-guard.ts`, with `BETTER_AUTH_SECRET`), and say so; the privacy note in "Notes for the plans that follow" then holds.

### S11. Ten guesses every fifteen minutes adds up

- **Evidence.** Even with B1 fixed, the lock allows 40 guesses an hour for as long as a session lasts (30 days, rolling). Three codes in a million are accepted, so a stolen session guesses right about once a year on average, nearly one chance in ten a month, and nobody is told. The numbers were carried from the old admin, which also asked for a code at every sign-in and kept sessions to 12 hours; this plan keeps neither (its Calls).
- **Fix (recommended).** After a third lock within a day, the codes stay locked until another owner presses "Reset authenticator", and each lock mails the person "Someone typed wrong codes for your Ruken account. If it wasn't you, change your password." (a sixth mail: Q1 covers it). Test with the `TestClock`.

### S12. Two mails the design does not list

- **Evidence.** Design 7.1 lists the mails ("confirming an address, and telling a maker their game was accepted, sent back or taken down") and 5.7 says onboarding "never sends more than the mails in 7.1". This plan adds "your page was taken down" and "your account is suspended", reading design 5.5's "a reason that is recorded and sent to the maker". Slice 5's plan on `main` reads 7.1's list as needing the Owner's words for a new mail. The two plans now disagree.
- **Fix.** Q1 below. Until the answer, Tasks 17 and 18 keep their mails and the reason on `/make/page` and `/suspended`.

### S13. Step 2's "Skip" and "Back"

- **Evidence.** "Skip for now" is "a link to `/make/new?step=3` through an action that only sets the cookie": a link cannot post to an action. "Back" on step 2 goes to `/make/page`, which leaves the steps (no "Step 1 of 3", no way on), because step 1 sends anyone with a page onward. Design 5.7 asks for "a way back on each".
- **Fix.** "Skip for now" is a `quiet` button in its own small form (`?/skip`). Step 1 shows for someone who has a page, with their address filled in, and its Save changes it; step 2's "Back" goes there.

## Notes

- **N1. Where the role lists live.** `GAME_STAFF_ROLES` and slice 5's `MONEY_STAFF_ROLES` are in `accounts/staff.ts`; `MODERATION_STAFF_ROLES` is planned in `admin/roles.ts`. Put it beside the others.
- **N2. `StaffError("NOT_YOURS", "Remove their staff roles first.")`** reuses a code that means something else; give it its own, `IS_STAFF`.
- **N3. `Caller` gains `suspendedReason`** (Task 18). It is built in `handle.ts` and in `tests/features/accounts/handle.test.ts` and `pages.test.ts` (5 places on `main`), plus slice 2's `staff-only.test.ts`; list them in Task 18's files. `HandleDeps.staffRolesOf` becomes one read that answers both.
- **N4. The picture's address needs a read-only key.** `startAuthenticator` makes a row when there is none; the picture must not. Name a function that answers the key of a `started` row, or `null`.
- **N5. The front page's "Set up"** beside "Your authenticator" reads as an instruction. "Ready" and "Not set up yet".
- **N6. The QR picture's border.** `renderSVG` draws a quiet zone of 1 module; QR codes are made to have 4. Pass `{ border: 4 }`; the card is white, so this is margin, not readability, but it is free.
- **N7. "Found while planning" 9 is settled:** `authServices()` already hands out `mailer` (`src/features/accounts/services.ts`), so Task 8's fallback is not needed. `mailFailureCode` is in `src/lib/server/mail.ts`; slice 1's `mailLater` is private to `auth.ts`, so `tellMaker` is a second copy of six lines (fine, with the comment the plan asks for).
- **N8. The `enter` action's limit says "Try again in 15 minutes"** when the limit is a minute. Say "Too many tries. Wait a minute and try again."
- **N9. A deleted maker and the other mails.** Task 9 sends nothing to a maker whose account is not `active`; Tasks 12 and 19 should say the same for the taken-down, page and suspension mails.
- **N10. `askToLookAgain` is tested in `tests/features/pages/taken-down.pg.test.ts`;** it is the moderation service's, so its case goes in `tests/features/moderation/service.pg.test.ts`.
- **N11. The sweep trusts the `PlayPass` row.** The gate checks a pass by its signature alone (`checkPass`), so the files are safe to delete only if every pass handed out has a row with the same end. Say so beside the query, and add a case where a member's pass is handed out and its row's `expiresAt` equals the pass's `exp`. A pull that stopped half way through storing files leaves files with no `GamePull` row, which the sweep never finds; one line under "Worth the Owner's eye".
- **N12. A taken-down page in the feed.** `handlesOf` still gives the maker's `@handle` under their games, linking to a missing page. Either `handlesOf` leaves taken-down pages out, or it is listed as known.
- **N13. A suspended maker cannot take their own game off** (every `/make` address goes to `/suspended`). Their games are hidden already; list it under "Worth the Owner's eye".
- **N14. Granting a role to a suspended account** is not refused; `suspend` refuses staff, so `grantRole` should refuse the suspended.
- **N15. Task 23's journey has no red,** as slice 2's and slice 3's last journeys; it says so.
- **N16. Two smaller gaps in the games service:** `sendBack` with only clips waiting should clear `pendingSince`; "Delete the rest of its files" for a taken-down game needs the last live pull after `livePullId` is cleared: name where it is read (the game's newest accepted `GameReview`).
- **N17. `BETTER_AUTH_SECRET` now also locks the authenticator keys.** Changing it signs everyone out and makes every authenticator unreadable; both owners set up again. One line in "Notes for the plans that follow".

## For the coordinator (outside this plan)

- Slice 5's Task 32 journey expects a signed-out person on `/admin/money` to be sent to sign in; `staffOnly` answers 404 (slice 2's rule, kept here). One of the two plans should change.
- Pull request #58 cannot merge as it stands: `main` (with #59) and `plan/slice-4` both changed `docs/superpowers/progress.md` (a conflict, measured with `git merge-tree`).

## Questions for the Owner

**Q1. Should Ruken email a maker when their page is taken down or their account is suspended?** Design 7.1 lists only the mails about a game; 5.5 says the reason is "sent to the maker".

- **A. Yes, mail them (recommended).** A maker whose page is gone or whose account is suspended may not open Ruken for days, and the reason is theirs to read. Two short plain mails, like the game ones. (If S11's lock mail is wanted too, it is a third.)
- **B. No mail.** They read the reason when they next open `/make/page` or sign in (`/suspended`).

## By 1 December

A and B are seven tasks, all waiting today for slice 2's branch S, which has three slice 2 branches before it. As planned, they can be on `main` by 1 December only if S lands a few days before launch and the screens get "fine" at once. With S1's split, four of the seven tasks can be on `main` this week, and only Tasks 4, 6 and 7 wait for S. B1 must be fixed in the plan before Task 3 starts.
