# Plan audit: the game's page and playing it (cycle 1)

Date: 2026-11-17 (written 06:20 UTC). Commit examined: `36e2014` on `claude/project-thread-ozoxv5` (PR #193). A fresh session, Opus 5.5, medium.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was read

- `docs/superpowers/specs/2026-11-17-game-page-and-play-shell-design.md` and `docs/superpowers/plans/2026-11-15-slice-2-rest.md` at `36e2014` (the header, Units, Global Constraints, Calls, Review Focus, File map, Unit F with Tasks 20 to 23, Unit P with Task 25).
- The Owner's words: section 0 of the spec, and the three messages the coordinator attached (05:41, 05:42 and 06:13 UTC on 2026-11-17). The sketches (artifact X6WbtpdYTp67wvAvwtMfGV) were not opened; the spec's own description of the picks (page A, the watch page; play A with a movable see-through tab) was checked against the Owner's 06:13 words instead.
- On the code at `36e2014` (the same tree as `main` at `78008fc` outside `docs/`): `prisma/schema/play.prisma`, `prisma/schema/games.prisma`, `prisma/migrations/`, `package.json`, `tests/wrangler.test.ts`, `tests/support/database.ts`, `src/features/play/{play,may-play,frame,time,sessions}.ts`, `src/features/games/{games,laid-out,service,services}.ts`, `src/features/pages/{service,photo}.ts`, `src/features/membership/services.ts`, `src/routes/make/[game]/+page.server.ts`, `src/routes/make/own-game.server.ts`, `src/routes/make/[game]/[question=question]/+page.svelte`, `src/routes/join/+page.svelte`, `src/routes/+error.svelte`, `src/lib/look.css`, `tests/lib/look.test.ts`, `tests/browser/support/{look,rate-limits}.ts`, the main design (5.2, 5.7, "One build, one Worker") and the redesign (5c, 15.2).
- Graphify was available but its index was not used for these reads: every question here was a literal name or a config value, answered with text search on the checkout.
- No test, lint or build ran: this audit reads a plan.

## Verdict

**Unit P is not ready to build: 4 red.** The worst: the plan and the spec say the migration reaches the test site's database only by the Owner's own command after merge, but the site's deploy command runs `prisma migrate deploy` on every merge to `main`, so the merge itself applies it. **Unit F: 11 red,** all bounded edits to the spec or the plan. Nothing here needs a new decision from the Owner except where marked; N5 is worth one line to them.

## Unit P (Task 25): the player count switch

Checked and sound:

- The Owner's words are kept: "Show player count should be an option set by the maker" is a per-game switch the maker sets on Live (spec 5, Task 25). Off by default is marked **Call** in spec 5 and 9.3, not presented as the Owner's.
- `ALTER TABLE "Game" ADD COLUMN "showsPlayerCount" BOOLEAN NOT NULL DEFAULT false` gives every existing game `false`, which is the acceptance criterion "off for every game until its maker turns it on". Additive with a default, so the old Worker keeps working between the migration and the new code's deploy.
- The newest migration is `20261115190000_agreement_per_version`; Task 25's `<timestamp>_shows_player_count` sorts after it.
- Who is counted is expressible: `PlayBasis` is `member | free_game | staff | own_game` (`prisma/schema/play.prisma:9`), and a signed-in person's free play keeps `userId` (only signed-out free play has `userId` null, `play.prisma:46`). So "members and signed-in free play, never staff or the maker" is `basis IN (member, free_game) AND userId IS NOT NULL`, distinct `userId`.
- `@@index([gameId, startedAt])` on `PlaySession` (`play.prisma:61`) covers the 7-day count each page load runs.
- Who can set it: every action on `/make/<game>` already starts with `ownGame(event)` (`src/routes/make/own-game.server.ts:10`), which answers 404 unless the caller is the game's maker; the service's own check in `setShowsPlayerCount` is a second guard.
- Order: P waits on F on `main` and on this audit; G does not wait on P. Lane 3 needs the Owner's approval; `history.md` has no standing permission for migrations (only the setup check), so the approval is asked for, as Step 3 says.

### P1. red: the merge applies the migration; there is no "Owner's own command after merge"

- UNIT: spec section 8 (second bullet); plan, Unit P's opening paragraph and Task 25 Steps 2 and 3.
- REQUIREMENT: Report honestly (`CLAUDE.md`); lane 3: the Owner approves the exact action.
- REASON: both say the migration reaches the test site's database "only by the Owner's own command, which the pull request gives as one line" after merge. It does not: the merge does it.
- EVIDENCE: `package.json:16` `"deploy": "pnpm exec prisma migrate deploy && pnpm exec wrangler deploy cloudflare/worker.js"`; main design, "One build, one Worker": Workers Builds runs that on every merge to `main` (Owner, 2026-11-14); `tests/wrangler.test.ts:126` asserts the order; `this-repo`: "Its database matches `main`." The texts plan already says it right (`plans/2026-11-15-texts-not-email.md:537`: "this migration reaches the test site's database when branch B merges").
- EXPECTED: the Owner approves knowing that merging applies the migration to the test site's database; the pull request says so, and that undoing it is a second migration (`DROP COLUMN`), not a revert.
- FIX: in spec 8 and the plan's Unit P paragraph and Steps 2 and 3, replace the "Owner's own command after merge" with: "Merging applies the migration to the test site's database (the deploy command runs `prisma migrate deploy` first). The pull request names the migration, says that, and says undoing it is a second migration." Remove "gives the Owner's one command to apply it". Files: the spec and the plan only.

### P2. red: the On/Off switch the task builds on does not exist

- UNIT: Task 25, Files and Step 2.
- REQUIREMENT: Global Constraints: "A name this plan says is on `main` that is not there as written is a finding"; every class in `CLASSES` (`tests/lib/look.test.ts`).
- REASON: the spec calls it "redesign 15.2's switch". 15.2 says only "Switches show On or Off as a chip". No switch is on `main`: no `On`/`Off` chip in `src/routes/` and no switch rule in `src/lib/look.css`. Task 25 must build it, but its file list has neither `src/lib/look.css` nor `tests/lib/look.test.ts`.
- EVIDENCE: `grep '>On<\|"On"\|>Off<'` over `src/routes` and `look.css` finds nothing.
- EXPECTED: the task says it makes the switch: a plain `<form method="post" action="?/playerCount">` with one `<button>` whose name reads the state, and the On/Off chip (8px corners, at least 44 by 44), with its class named in `CLASSES` and a rule test.
- FIX: add `src/lib/look.css` and `tests/lib/look.test.ts` to Task 25's Modify list (lane 2 files inside a lane 3 unit; the unit stays lane 3), and one Step 1 case: the switch's class has rules and is at least 44 tall. Files: the plan only.

### P3. red: "a counted play" is not defined, so the player count can count people who never played

- UNIT: spec 5 (the player line); Task 25 Interfaces and Step 1.
- REQUIREMENT: spec 1: "The play facts are measured ... so they cannot be inflated."
- REASON: `playersThisWeek` counts accounts "with a counted ... play". A `PlaySession` row is written when Play is pressed, before any beat, and a session whose beats all say "looked away" counts 0 ms (`countedMs`, `src/features/play/time.ts:20`). Neither the spec nor the test says whether those count.
- EVIDENCE: Task 25 Step 1's `sessions.pg.test.ts` cases are: two plays by one member, 8 days old, staff, the maker, free play by nobody. None has no beat or only inattentive beats.
- EXPECTED: one definition shared with the sitting line (F4): a play counts when its counted time is above 0 (at least one attentive beat).
- FIX: spec 5 says so in both bullets; Task 25 Interfaces says so; Step 1 adds "a member whose only play has no beat, and one whose beats all say looked away, are not counted". Files: the spec and the plan.

### P4. red: "anyone else's post is refused" is only tested on the service

- UNIT: Task 25, acceptance criteria and Step 1.
- REQUIREMENT: Unit P's acceptance: "Only the game's own maker can change it; anyone else's post is refused and changes nothing."
- REASON: the criterion is about a post to the page, but the only test is `setShowsPlayerCount` called with another account in `service.pg.test.ts`. The action is not named, and nothing says it goes through `ownGame`.
- EVIDENCE: Task 25 Step 1; `src/routes/make/[game]/+page.server.ts:172` (every action starts with `ownGame(event)`).
- EXPECTED: the action is `playerCount`, starts with `ownGame(event)` and a `state === "live"` check like `sendAgain`, and a journey proves that another signed-in account's post to `/make/<slug>?/playerCount` answers 404 and leaves the column as it was.
- FIX: name the action and its first line in Task 25; add that case to `player-count.test.ts` in Step 1. Files: the plan only.

### P notes (recorded, not fixed here)

- P5. Nothing in CI compares `prisma/schema/` with `prisma/migrations/` (the suites run `migrate deploy`, `tests/support/database.ts:54`). Step 2 should have the session paste the output of `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --shadow-database-url "$TEST_DATABASE_URL" --script` (empty) into the pull request, and the migration should open with a comment line, as every other one does.
- P6. Off by default is the coordinator's call, not the Owner's. The Owner's words fit either default. Keep it as a Call, and name it in the next owner update so they can overrule it before the build.

## Unit F (Tasks 20 to 23)

Checked and sound:

- The picks match the Owner's 06:13 words: the page is "the watch page" (spec 3.3); the play screen is a small see-through tab, moved up and down and to either side, which opens sketch A's menu (spec 4.1 to 4.3). The feed notes are kept word for word for slice 3 (spec 6) and nothing of them is built here. The paywall on Play ("Non-members should be paywalled when they press play") is kept: Play goes to `/join?next=…` (Call 7, spec 3.4).
- Every name Tasks 20 to 23 say is on `main` is there: `liveGameBySlug`, `media(key)`, `ratingWords`, `pageOf`, `arrival.remember(cookies, { makerUserId, path })`, `isMember`, `isPhone`, `backFromPaywall`, `GAME_FRAME_SANDBOX` (`"allow-scripts allow-same-origin allow-pointer-lock"`, as the journey asserts), `GAME_FRAME_ALLOW`, `startPlay`, `recordBeat`, `BEAT_EVERY_MS` (15,000), `countedMs`, `PREMIUM_PRICES_CENTS`, `quietVideo`, `pages.browser.ts`, `pipRed`, `showTheOwner`, `forgetRateLimits`, `gameWhere`, `putGameWhereStaffLeaveIt`, `payAsNewMember`, `membershipStartsOf`, `arrivalCookie`, `userIdOf`. `GAME_STAFF_ROLES` and the browser `addGame` come from Task 30, which F waits on. One is missing (F9).
- The age lines in spec 3.1 are the question's words exactly (`[question=question]/+page.svelte:47`).
- The tab's contrast: `felt-deep` (`#111314`) at 72% over white is `#545556`; chalk on it is 7.47:1, as the spec says.
- The 31-opens case: `PLAY_STARTS_PER_ADDRESS` is 30 a minute, and each worker has its own client address (`tests/browser/support/rate-limits.ts`), so the case cannot starve other journeys.

### F1. red: the spec says two different things about the page's ground

- UNIT: spec 1 (last bullet of "What Ruken does"), 3.1 ("The ground"), 3.5; plan Task 20 Interfaces ("the look's `backdrop`").
- REQUIREMENT: the brief must be one thing (the plan says "where this plan and that spec differ ... the spec wins", which only works if the spec agrees with itself); redesign 5c: "Only on the Live screen ... Every other screen keeps the plain felt."
- REASON: spec 1 says "the game's own video, blurred and dimmed, is the ground of both" the page and Live; 3.1 says "The ground is the plain felt"; 3.5 says "the backdrop's circles drift as on Live".
- EVIDENCE: the three lines quoted, and redesign 5c.
- EXPECTED: one answer. Recommended: the plain felt (3.1, the sketch, and 5c as it stands); the clip at the top carries the game's colours.
- FIX: strike the "one design" bullet in spec 1 (or reword it to "the same clip"), strike "the backdrop's circles drift as on Live" from 3.5, and take `backdrop` out of Task 20's Consumes. Files: the spec and the plan.

### F2. red: Task 20 still builds a bottom bar the spec says comes in slice 3

- UNIT: Task 20, the classes paragraph.
- REQUIREMENT: spec 3.3: "The bar comes with the feed in slice 3. Until then the page has no bar"; "Play is in the content, not pinned".
- EVIDENCE: Task 20: "The phone, sideways-phone and upright-tablet bar reuses the maker screens' bottom bar where its rule fits."
- EXPECTED: no bar; the page leaves the bar's room at its foot.
- FIX: replace that sentence with "No bar: the page leaves room at its foot for slice 3's (spec 3.3)." Files: the plan only.

### F3. red: a real iPad would read "Plays on this tablet" for a computer-only game

- UNIT: spec 1 item 2 and 3.4; Task 20 `load` and the device line.
- REQUIREMENT: spec 1: the device line "speaks to the device in hand"; Report honestly.
- REASON: `needsComputer` is `computer_only && isPhone(userAgent)`. An iPad's Safari sends a Mac's `User-Agent`, so `isPhone` is false, Play is shown, and the page's script turns "computer" into "tablet" from the coarse pointer: "Plays on this tablet. Nothing to install." for a game its maker said plays on computers only (`playsOnWords`: "Plays on computers only"). Review Focus 8 covers only a tablet that says it is a phone.
- EVIDENCE: `isPhone` (`src/features/play/may-play.ts:36`); Task 20 `load`; the Global Constraint that Playwright's iPad sends a phone's agent (so no journey sees the real iPad case).
- EXPECTED: a computer-only game never says it plays on the device in hand unless that device is a computer.
- FIX: spec 3.4 adds the row: where the script finds a coarse pointer and the game is computer-only, the page shows "This one needs a computer." and Share in Play's place, as on a phone (without script the server's answer stands); Task 20 says the same and adds a journey that emulates `pointer: coarse` with a desktop agent. Files: the spec and the plan. If the planner prefers to let tablets try, the line must not claim it plays there; either way it is the spec's call, not the Owner's.

### F4. red: the sitting line counts plays with no time in them

- UNIT: spec 5 (first bullet); Task 20 `sittingOf`.
- REQUIREMENT: spec 1: measured, "never claimed".
- REASON: "only plays with at least one beat" lets in sessions whose beats all said "looked away", which `countedMs` counts as 0. Task 22's own journey makes one ("no time counts while the person has not touched the game: one beat, attentive false"). Many such plays pull the median down to "a minute or two".
- EXPECTED: a play counts when its counted time is above 0.
- FIX: spec 5 and Task 20 say "at least one attentive beat" (the same definition as P3); Step 1's `sessions.pg.test.ts` adds "a play whose only beat says looked away does not count". Files: the spec and the plan.

### F5. red: `addPlays` as written cannot give the line the journey expects

- UNIT: Task 20 Step 3, "the sitting line waits for 20 plays" and the `addPlays` paragraph.
- REQUIREMENT: a check must fail only for the reason it names.
- REASON: `addPlays` writes "one attentive beat each". One beat counts at most `LONGEST_COUNTED_GAP_MS`, 45,000 ms (`src/features/play/time.ts:9`), so every play counts 45 seconds or less, the median is under 2 minutes, and the page says "Most people play a minute or two at a time." The journey expects "Most people play about … at a time.", which that line does not match.
- EXPECTED: the helper makes plays of a chosen length, and the journey expects the exact words for it.
- FIX: `addPlays(slug, count, minutes)` writes attentive beats every 15 seconds for `minutes`; the journey uses 12 and expects "Most people play about 12 minutes at a time." Files: the plan only.

### F6. red: Task 20 makes a `.svelte` file import the games feature, which Task 22's new rule forbids

- UNIT: Task 20 Files (the age question's `+page.svelte` "reads the lines from there"); Task 22's two architecture rules.
- REQUIREMENT: Task 22: "a `.svelte` file ... reach[es] a feature only through its `.browser.ts` entry" and "no file reachable from a `.browser.ts` entry imports `src/lib/server/`".
- REASON: the lines move to `src/features/games/laid-out.ts`, which starts `import type { AgeRating, ContentMark, GamePlaysOn } from "../../lib/server/db.ts"`. Games has no `games.browser.ts`. No `.svelte` under `src/routes/` imports a feature today, so Task 22's rule would fail on Task 20's own change.
- EXPECTED: the `.svelte` imports no feature.
- FIX: the question's `+page.server.ts` (which already imports `ratingWords` from `games.ts`) passes the five lines in its data, and the `.svelte` reads them from `data`. Files: the plan only.

### F7. red: the plan names no way to style the tab's moves and states, and the look test forbids the obvious ones

- UNIT: Task 21 (the Menu tab, the menu's side, open and dimmed states); Task 20 (the picked clip tile).
- REQUIREMENT: Global Constraints ("No `style=` attribute, `style:` directive"); `tests/lib/look.test.ts:362` (no `style=` in any route's `.svelte`) and `:368` (no `class={` or `class:`).
- REASON: the tab's height and side, the menu's side, see-through or solid, and which tile is showing all change at run time. With no class or style binding allowed in markup, an implementer will either hit the test or be tempted to loosen it.
- EXPECTED: the plan says how: states as attributes (`data-side="left|right"`, `aria-pressed` on the tiles, `[open]` on the `<details>`) styled by attribute selectors in `look.css`; the height as a custom property the page's script sets with `element.style.setProperty("--tab-at", …)` (script, not markup); and a click that ends a drag calls `preventDefault()`, so the `<summary>` does not toggle.
- FIX: add those three sentences to Task 21 and the tile's to Task 20. Files: the plan only.

### F8. red: the 12px "Menu" label is a new type size

- UNIT: spec 4.1 ("the word "Menu" under it at 12px").
- REQUIREMENT: plan, "For all four tasks": "No new dependency, colour, typeface or size: every value is in `look.css`'s tokens and 5.8's scale."
- EVIDENCE: the smallest size in `look.css` is `--text-small`, 14px ("notes only").
- EXPECTED: the label uses the scale.
- FIX: spec 4.1 says `--text-small` (14px); the tab stays 48 wide (the word "Menu" at 14px fits). Files: the spec only.

### F9. red: `expectNoSidewaysScroll` does not exist

- UNIT: Task 20 Step 3, the first journey.
- REQUIREMENT: Global Constraints: a name said to exist that does not is a finding.
- EVIDENCE: no match in `src/` or `tests/`; journeys check it inline (`tests/browser/look.test.ts:212`, `make-look.test.ts:159`).
- FIX: Task 20 adds `expectNoSidewaysScroll(page)` to `tests/browser/support/look.ts` (and the file map), or the journey checks `scrollWidth <= clientWidth` inline as the others do. Files: the plan only.

### F10. red: Share has two names

- UNIT: spec 3.1 and 3.4 ("Share"); Task 20 Step 3 (the computer-only journey presses "Share the link"; the keyboard journey's Tab order says "Share").
- REQUIREMENT: "The words in this file are the words shipped."
- FIX: one name. Recommended: "Share" everywhere, and the journey presses `{ name: "Share" }`. Files: the plan only.

### F11. red: the tab's contrast test measures the wrong thing

- UNIT: Task 21 Step 1, `look.test.ts`: "chalk on `felt-deep` at 4.5:1 or better (measured from the tokens)".
- REQUIREMENT: spec 4.1: the tab is `felt-deep` at 72% over the game, worked out over a pure white game (7.47:1).
- REASON: chalk on opaque `felt-deep` is about 18:1 and passes whatever the tab's opacity is.
- FIX: the test blends `felt-deep` at the tab's rest opacity over `#ffffff` and checks chalk on the result at 4.5:1 or better. Files: the plan only.

### F notes (recorded, not fixed here)

- N1. Task 20 writes the cost order (own, staff, free, member, join) again by hand. `playBasis` in `src/features/play/may-play.ts:24` already decides it in that order, for the play that is recorded. Exporting it from `play.ts` and using it for `cost` keeps the line under Play and the recorded basis from ever disagreeing.
- N2. `pageOf` answers `photoKey`, not a photo. Its address is `gamesServices().media(photoKey)` (the gate serves photo keys from the media address, `src/features/play/gate.ts:41`); Task 20 should say so.
- N3. Keep playing calls `frame.focus()`, so attentive time can start before the person has touched the game. Spec 4.2 counts the press as the person's own; Task 22's "It never focuses the frame itself" should name this one exception so the two tasks do not read as contradicting each other.
- N4. Global Constraints still allow "the one line design 5.7 fixes ("Tap ← to go back to the feed")"; spec 4.1 replaces that line, so the exception can go.
- N5. The Owner wrote "either they pay on the landing page or they get hit with it when they try to play". The spec reads it as the price line on the game's page plus the paywall on Play, with no way to pay on the page itself. If "landing page" meant the game's page, a Join button there is missing. One line to the Owner settles it.
- N6. The sitting words at exactly 60 minutes are not given ("about 60 minutes" or "about 1 hour"); pin them in spec 5 and the Step 1 edge case.
- Tasks 22 and 23: no other gaps found. Task 23 is a test change with no red, as it says.

## Hand-back

The planner fixes P1 to P4 and F1 to F11 in the spec and the plan on this branch. P1, P3 and F1 to F8 are wording in the two files; none changes what the Owner picked. Unit P is built only after this audit's fixes are checked by a second read.
