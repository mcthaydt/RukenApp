# Plan audit: the rest of slice 2 (branches T, S, F and G)

Plan: `docs/superpowers/plans/2026-11-15-slice-2-rest.md`, pull request #124, branch `claude/project-thread-6qfd5m` at `b543fbf`.
Read against: `main` at `47000b7` and `slice-2/submit` (branch M, #63) at `52f1609`, the spec (`2026-11-13-ruken-reels-linktree-design.md`), the maker screens redesign (`2026-11-14-maker-screens-redesign-design.md`, sections 11, 13 and 15), the slice 2 plan's Tasks 20 to 24, the approved board's `check`, `takeoff` and `takenoff` (`/mnt/project-files/maker-screens/maker-screens-round-7.html`), `CLAUDE.md` and the tracker.

What ran: no test, lint or typecheck (CLAUDE.md). Read: the code named above, with `git grep` and `git show` on both refs; CI runs 43702379831 (M, every job green) and 43661647648 (`main`, the last push run) through the GitHub API, for job times and per-journey times; the public suffix list (`publicsuffix.org/list/public_suffix_list.dat`, 2026-11-15). Every fix below is made in the plan, in place.

## Verdict

**Branch T (Task 32) is ready to build now.** Its four files and their tests are untouched by M (`git diff --name-only origin/main...origin/slice-2/submit`: none of `gate.ts`, `addresses.ts`, `cloudflare/`, `playwright.config.ts`, `game-gate.test.ts`, `sign-up.test.ts`, `gate.test.ts`, `games-worker.test.ts`, `addresses.test.ts`). Every name it consumes is on `main` as written (`handleGameRequest`, `GateDeps`, `checkAddressPattern`, `gameAddress`, `normalizePath`, `MemoryFileStore.reads`). Its red step's expected failures were not exact; they are now listed case by case.

S, F and G stand, with the fixes below. None blocks T.

Counts: 0 block, 9 should fix (all fixed in the plan), 7 notes.

## The planner's four questions

### 1. Names "from M", read on `slice-2/submit` at `52f1609`

Every name Task 30 and 31 consume was looked up on M. Present as written: `sendBack` (by parts), `accept`, `waitingGames`, `gameForReview`, `reasonsFor`, `isReasonFor`, `partTitle`, `ageProblem`, `marksProblem`, `ratingWords`, `playsOnWords`, `websitesWords`, `deleteAll`, `ownGame`, `pullLatest`, `sendForReview`, `gameForMaker`, `liveGameBySlug` (with `ageRating`, `contentMarks`), `MakerGame`, `ReviewGame`, `GamePreview.svelte`, `LiveScreen.svelte` ("Send a new version", "Copying your game…", "Back to your games"), `MAKER_ADDRESSES`, `answerEveryQuestion`, `agreeToTheAgreement`, `putGameWhereStaffLeaveIt` (with `updateWaiting`), `fillAnswers`, `freshName`, `pageHasSettled`, `expectOneCard(page, { red })`, `showTheOwner`, the look's `halves`, `picks`, `pick`, `acts`, `sheet`, `fix`, `chip`, `foot`, `row`, and `CLASSES` (in `tests/lib/look.test.ts`). On `main` already: `startPlay`, `passFor`, `playSummary`, `isPhone`, `staffRoles`, the `staff` play basis, `reject_append_only_change`.

Not as the plan assumed (fixed in the plan):

- **S-1** `LIVE_MAY_BE_SENT_BACK` is a `const` inside `createGamesService` (`service.ts:380`), so it cannot be exported as it is. Task 30 now moves it to `send-back.ts` at the top level and exports it through `games.ts`.
- **S-2** `reasonsFor`, `isReasonFor` and `partTitle` live in `send-back.ts` and are not exported from `games.ts`. The plan's "if M did not" is now "M did not; this task exports them".
- **S-3** `gameForReview` returns neither the maker's email nor when the files were sent, which the left half's first line ("Game · maker@example.com · waited 2 hours") needs. Task 30 now adds `makerEmail` and `sentAt`.
- **S-4** `FileStore` has no way to ask whether a folder still holds a file (`head`, `get`, `put`, `delete`, `deleteAll` only). Task 31's conditional is settled: it adds `hasAny(prefix)`, to the R2 store and the memory store, and the files list names them.
- `signInAs`, `grantStaffRole`, `GAME_STAFF_ROLES`, `makeFree`, `stateOf` (in `database.ts`) and `makerOf` (in `database.ts`) are not on M. The plan already makes each of them; the two it made "if M did not" are now stated as new.

### 2. The same-site finding

Confirmed: `workers.dev` is on the public suffix list (Cloudflare's block, beside `pages.dev` and `r2.dev`), so `ruken.ACCOUNT.workers.dev` and `ruken-games.ACCOUNT.workers.dev` are one site. The plan's list of what still protects the site holds: the session cookie is `__Host-rk_session` on https (`cookies.ts`), as are `__Host-rk_session_data`, `__Host-rk_dont_remember` and `__Host-rk_account_data` (`auth.ts:60`, `:190` to `:192`); the gate's `connect-src`; the frame's sandbox (`allow-scripts allow-same-origin allow-pointer-lock`: no forms, no pop-ups, no top navigation, and a frame nested inside it inherits that); SvelteKit's origin check; and no `GET` that changes anything.

- **S-5** One thing the plan missed: a game can **set** a cookie for `ACCOUNT.workers.dev`, which the site then receives. The frame has `allow-same-origin`, and a same-site frame's cookies are first-party. `__Host-` cookies cannot be set that way, so sign-in is safe; but `rk_arrival` (the maker's link a new member came through, design 6) and `rk_welcome_back` have plain names. A game could put a sealed arrival it got from its own link in front of the person's own (a cookie with a longer `Path` is sent first), or fill the cookie header until the site refuses that browser. On the test site, with Stripe's test mode and only games the Owner trusts, this changes nothing; the games domain at launch removes it. Written into the plan's finding 1 and its launch list. Not fixed in code: it is a second problem, and renaming `rk_arrival` is not slice 2's.
- Note N-1: the site sends no `frame-ancestors` or `X-Frame-Options` (no hit in `src/` outside the gate). Any page can frame it. Inside a game's frame the inherited sandbox blocks its forms, so nothing here depends on it; reported for the slice 2 implementation audit to weigh, not fixed.

### 3. `addGame`'s cost across nine projects

Measured, not guessed: the real first send (`make-send.test.ts:25`, the same screens `submitGame` walks) took 8.2 s on `tablet-landscape` and 12.6 to 13.4 s on the WebKit phones in run 43702379831. M's three browser shards took 6 min 45 s, 10 min 37 s and 8 min 8 s of their 45. `main`'s single browser job took 9 min 31 s of 15 (run 43661647648).

- **S-6** The plan gave every journey that plays a game an `addGame`, and Task 30's journeys a `submitGame` each. Counting the journeys of S and F that change a game (so cannot share one), that is about 17 real sends a project, about 3 minutes a project, about 5 more minutes on each shard. It fits, but most of those journeys never look inside the frame. Fixed: a journey uses `submitGame` or `addGame` only when it looks inside the frame, needs the files in the bucket, or pulls again (Put it back); every other journey makes its game from rows (`startDraft`, then `putGameWhereStaffLeaveIt`), as M's journeys do. A `beforeAll` that makes a real game gives itself 60 s.
- **S-7** `putGameWhereStaffLeaveIt` calls `fillAnswers` first. Read on M: it keeps the real pull (it adds one only when there is none) and the real clips (upserts that change nothing), so finding 3 holds. But it overwrites the line ("A tiny game about tapping."), where it plays and the rating (12+). Written into `addGame`'s description, and F's journeys are told so. The slice 2 plan's Task 20 called `addGame(browser, { name: "Tiny game" })` and read "Tiny game" back; `addGame` has no `name` and slugs need `freshName()`, so F now reads `game.name`.

### 4. `halves` and `:has()` in Task 30

- `halves` is written on the class (`.halves > *`, `.halves > :first-child`, `.screen:has(.halves)`, the grid in `@media (orientation: landscape) and (min-width: 700px)`), never on `main`. A `<form class="halves">` inside `<main>` lays out as Check and send's `<main class="halves">` does. Written into Task 30, with the button placed in an `acts` so that upright it is the bar fixed to the bottom (the board's note and spec 11: "the Blue button fixed in view").
- `:has()` appears on 18 lines of M's `look.css` (`.pick:has(input:checked)`, `.choice:has(input:checked)`, `.screen main > form:has(…)`) and M's journeys pass on the four WebKit projects in run 43702379831. Task 30's rules (`.part:not(:has(input[name="wrong"]:checked)) > .picks`, `form:has(input[name="wrong"]:checked)`) are the same kind. The hidden wording is `display: none`, so it leaves the button's accessible name, and `getByRole("button", { name: "Accept" })` finds it only while it shows.

## Should fix (all fixed in the plan)

S-1 to S-7 above, and:

- **S-8** Task 30: staff-only pages were guarded in `load`. SvelteKit runs a form action without its layout's `load`, so each action now calls `staffOnly` first (Review Focus 7's "posted by hand" journey proves it). The unit test's "signed out" case was `null`; a signed-out `Caller` is `{ kind: "none" }` (`caller.ts:8`).
- **S-9** Task 32's red step said the new address cases, gate cases and "the two new gate journeys" fail. Worked out from `main`'s code: the six "refuses" address cases and "fills in the path form" already pass; four of the gate cases already pass (404 or host mode); and only one of the two journeys fails (`/media/nothing` is 404 before and after). The plan now lists each case and the reason it fails (a 404 from the first label where path mode should answer), so the red can be checked for the right reason. The traversal case now also puts a file in game `bbbbbbbbbb`'s folder, so a climb that got through would find something, and adds a climb with plain dots, which the URL folds into a request for the other game (403).

## Notes (kept as written, or changed only in words)

- **N-1** No `frame-ancestors` on the site (above).
- **N-2** Task 30's "Played so far" named sessions. Every open of the checking page starts a `staff` session, so the count would mostly count staff. It now names only the counted time; this page sends no beats, so staff add none. Task 24 step 3 reads counted time, so it is unchanged.
- **N-3** The rating chooser's heading was "Who is it for?"; the approved board's `check` says "Age rating". Changed to the board's. The parts' titles stay `partTitle`'s ("Where it plays", where the board drew "Plays on"), so the maker and staff read one word for one thing. The board shows the maker's handle; until slice 3 there are none, and the plan already says staff see the email.
- **N-4** "Full size" is drawn only where `document.fullscreenEnabled` and the frame has `requestFullscreen`: an iPhone has no fullscreen for a frame; an iPad does, unchecked on a real one (real-device tests are the Owner's).
- **N-5** Task 31: Prisma needs back-relations on `User` (`accounts.prisma`) and `Game`; `accounts.prisma` was missing from the files. `onDelete: Restrict` as `MakerAgreement`'s. A member who had the game open keeps a pass for up to a day (`PASS_LIFE_MS`), so files left by a delete that stopped halfway stay loadable for them until "Delete them": written in, as the reason the button is offered.
- **N-6** The journeys keep the host form of the game address (`http://{name}.localhost:8788`), the one launch uses. Path mode is proven by Task 32's unit cases and two journeys, and in a real frame only on the test site in Task 24. That is the right order; written here so nobody expects a journey to play a game in path mode.
- **N-7** Task 24 step 3's "Play again the same day starts without copying its files again" is not something a person can see. It now reads "Play again opens the game again straight away". The Owner's steps stay Mac lines (zsh), as the project instructions say ("and a Windows PowerShell line … when asked"); `CLAUDE.md` asks for PowerShell lines, and the two disagree. Not changed here; the coordinator may ask the Owner.

## Checked and true as written

- Order and parallel work: S needs M (every name above), F needs S (`GAME_STAFF_ROLES`, `look.css`), G needs F and O-A, O-B. Matches the Owner's "One slice at a time is more what I meant by that".
- O-A's GitHub address: the query names (`name`, `url`, `public`, `webhook_active`, `contents=read`, `request_oauth_on_install`, `callback_urls[]`) are GitHub's for a new app; the five secrets match M's settings (`GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, in `playwright.config.ts`). Settings are written as secrets because the repository is public and `wrangler deploy` would drop plain variables set by hand.
- Frame and clip addresses fill in either form unchanged: `sessions.ts:83` (`${address("g-<id>")}/${pass}/`) and M's `media(key)` (`${gameAddress(pattern, "media")}/${key}`).
- `normalizePath` refuses `%2f` and `%5c` before decoding, so Review Focus 2's case is a 400 and reads nothing.
- The take-off route sits beside `[question=question]`; SvelteKit prefers the plain folder.
- `admin` is already last in `FEATURE_ORDER` (`tests/architecture.test.ts`), so it may import `accounts`, `games` and `play`.
- The take-off card is checked by `expectOneCard`, which counts `safe` and `danger` as not the main button, so a green link and a red button pass.
- The spec's 11.1 puts Accept "under the list"; 15.2 (later, so it wins) puts the heading and the blue button in the left half. The plan follows 15.2 and the board.
- The PR count: T beside M, then one branch at a time, inside five.
