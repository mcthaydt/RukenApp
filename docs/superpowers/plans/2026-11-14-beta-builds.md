# Beta Builds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A maker pulls a beta branch of a live game, staff accept it like a release, and only the members the maker picked can play it, before and after launch, without that play ever counting toward pay.

**Architecture:** No new feature folder. `games` gains a second pair of pulls on a game (the accepted beta and the beta waiting for review, the same pattern as slice 2's live and pending pulls), a `channel` on each pull, and the `BetaTester` table, all behind one small service in `src/features/games/beta.ts`. `play` gains a fifth play basis, `beta`, and `startBetaPlay`, the one place a beta's pass is handed out; it asks the tester list first, every time. The screens are additions to screens other plans build: a "Beta" section on `/make/<game>`, a "Beta" row and one review page under `/admin/games`, a `?beta=1` branch in `/g/<game>/play`, and one link, "Play the beta", under the game's own button.

**Tech Stack:** as slices 1 to 3 (Node 24.22.1, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0, Postgres 16, Vitest 5.0.3, Playwright 1.63.0, Cloudflare Workers, R2 through slice 2's `FileStore`). **No new package, no new setting, no new secret.**

**Spec:** `docs/superpowers/specs/2026-11-14-beta-builds-design.md` (approved by the Owner, 2026-11-14). Read it with `CLAUDE.md`, `AGENTS.md`, the wishlist design beside it (`2026-11-14-wishlist-before-launch-design.md`) and its plan (`docs/superpowers/plans/2026-11-14-wishlist-before-launch.md`: the Calls, Tasks 1, 2, 5, 7, 8, 13, 14), the main design (`2026-11-13-ruken-reels-linktree-design.md`, sections 5.2, 5.4, 5.5, 5.8 and 6), slice 1's plan ("How a task runs", "The look") and slice 2's plan (`docs/superpowers/plans/2026-11-13-slice-2-games-play.md`: Tasks 10, 11, 17, 18, 21, 26, 28, 30, 31).

**Planned against:** `main` at `d497163`. On `main` as code: slice 1, and slice 2's branches A to E, P and S0. **Not on `main`, so read only as plans:** slice 2's branches M, S and F; all of slice 3 but its plan; slice 4; slice 5; and the wishlist work, whose plan was read on `spec/wishlist` at `2b5030b` (not yet merged, so it may still change in its audit). "What this plan relies on", below, names each piece with its slice and task; if one is not on `main` as named when its task starts, stop and report.

## Global Constraints

- No session runs tests, lint or typecheck itself. Push, then read CI on the pull request (CLAUDE.md, Owner 2026-11-13).
- Every task is test-first, in two pushes, exactly as slice 1's "How a task runs" says: red (the test and stubs that throw `not built yet`), then green. A pull request is opened as a draft at the first push and marked ready only when its branch's last task is green.
- No new dependency. `.github/workflows/ci.yml` does not change.
- This repository is public. No secret, real address or key goes in, and no strategy or reason behind a business decision.
- **"Nothing goes on the site without approval"** (Owner, 2026-11-14). A beta's files are playable by a tester only after staff accepted that exact pull. No code path sets `betaPullId` except `accept` in `beta.ts`.
- **"you have to be a subscriber to play the beta"** (Owner, 2026-11-14). Only a picked member whose membership is active sees "Play the beta" or is given a pass for it. The list and the membership are read at every Play, not kept from an earlier one.
- **Beta play never changes anyone's pay.** It is recorded with the basis `beta`. Nothing that works out pay, or the feed's order, reads a `beta` session.
- A beta never touches the release: not `livePullId`, not `pendingPullId`, not `state`, not the game's clips, and the release never takes a beta pull's files.
- Games are untrusted, and a pass names no person (slice 2). The beta's pass is slice 2's pass, made by `passFor`, for the beta's pull.
- Nobody types a fact. A beta's size, file count and commit are measured by the pull; plays and minutes are counted from rows. The only things a maker types are a branch name and a person's email or handle.
- Time comes from an injected `Clock`. Browser tests move time with `page.clock`, never with a sleep.
- Layers, lowest first, once the wishlist plan's Task 1 is on `main`: `accounts`, `membership`, `games`, `launch`, `play`, `money`, `pages`, `feed`, `make`, `moderation`, `admin`. Nothing in `games` reads `launch`: a beta does not ask whether Ruken is open. Tests live only in `tests/`, mirroring `src/`.
- Comments say why, never which plan asked.
- Every screen and message passes the drunk grandma test. The words in this plan are the words to ship; a change to them is a deviation to report.
- Ruken's own screens wear the Card Table look from `src/lib/look.css` and only its classes; this plan adds no class. No file under `src/routes/` gets a `<style>` block, a `style=` attribute or a colour of its own. Nothing here is pip red, and nothing here is the Blue `pay` button: no money is spent.
- Every journey file starts with `test.beforeEach(forgetRateLimits)`, and every new or changed screen is attached with `showTheOwner(page, testInfo, "<screen>")`.

## What this plan relies on

| Piece | From | Used for |
|---|---|---|
| `prisma()`, `Clock`, `TestClock`, `startTestDatabase()`, `RateLimiter`, `createRateLimiter`, `RateLimitRule` | slice 1 (on `main`) | every table, time and limit |
| `Caller`, `locals.caller`, `signedInOnly` | slice 1 (on `main`) | who is asking |
| `membershipServices().service.isMember(userId)` | slice 1, Task 26 (on `main`) | "while their membership is active" |
| `purgeDueAccounts` in `src/features/accounts/deletion.ts` | slice 1, Task 20 (on `main`) | a deleted account's tester rows go with it |
| `pullGame(deps, gameId)`, `Pull`, `GamePull`, `Game.pullProblem`, the words of each refusal | slice 2, Tasks 4, 10 (on `main`) | pulling the beta branch "through slice 2's pull exactly" |
| `createGamesService`, `checkReachable` (inside it), `pullLatest`, `liveGameBySlug`, `LiveGame`, `gamesServices()`, `GameError`, `checkBranch`, `NO_BRANCH` | slice 2, Tasks 8, 11, 15 (on `main`) | the beta service sits beside these |
| `Game.pendingPullId`, `pendingSince`, `GameReview` (`gameId`, `pullId`, `staffUserId`, `decision`, `reason`, `decidedAt`; add-only), `sendForReview` ("its newest pull"), `waitingGames()`, `accept`, `sendBack`, `gameForMaker`, `stateWords` in `review.ts` | slice 2, Task 26 | the pattern the beta copies; the queue the beta joins; the "newest pull" readers Task 2 changes |
| `/make/<game>` (its page, its `load` and actions), `uploadClip`, `startGame` | slice 2, Task 28 | the Beta section and Testers go on it |
| `staffOnly(caller)`, `GAME_STAFF_ROLES`, `/admin/games`, `/admin/games/<game>`, `startReviewPlay({ game, pullId, staffUserId })`, the look's `clip` and `frame`, `addGame`, `submitGame`, `signInAsStaff`, `grantStaffRole` | slice 2, Tasks 19, 29, 30 | staff play a beta before accepting it; the journeys' game |
| `takeOff`, `putBack`, `FileStore.deleteAll(prefix)`, `signInAs(page, email)` | slice 2, Task 31 | a game that leaves Ruken takes its beta with it |
| `playBasis`, `PlayBasis`, `passFor`, `createPlayService`, `PLAY_STARTS_PER_ADDRESS`, `StartedPlay` | slice 2, Tasks 17, 18 (on `main`) | the beta's pass and session |
| `/g/<game>/play` (its `load`: the game, a phone on a computer-only game, `startPlay`, the 429 line), the `stage`, `bar`, `back` classes, the beat route | slice 2, Tasks 21, 22 | the `?beta=1` branch; beats need no change (a beat is known by its session's token) |
| `pagesServices().service.pageByHandle(handle)` answering `{ makerUserId, … } \| null`, `handlesOf(userIds)` | slice 3, Task 7 | adding a tester by handle; showing a tester as `@name` |
| `Feed.svelte` (one `section[data-slug]` per clip, its band and its Play link), `clipOf(page, slug)`, the `load` of `/` and `/g/<game>` | slice 3, Tasks 13, 15 | "Play the beta" in the feed |
| `MakerPage.svelte` (one `<article>` per game with its Play link), the `load` of `/<handle>` | slice 3, Task 22 | "Play the beta" on a maker's page |
| `memberBeatsByGame(since)` (reads `member` sessions only) | slice 3, Task 10 | the feed's order ignores beta play; Task 5 pins it |
| `startPlay`'s `launchNowMs` and its `{ refused: "not_open" }`, checked inside `startPlay`; the play route's redirect to `/g/<slug>` for it | wishlist plan, Task 5 | the rule the beta is the exception to; `startBetaPlay` takes no launch time |
| `beforeLaunch(context)`, `atLaunch(context)` in `tests/browser/support/launch.ts`; the journeys' site is open unless the cookie says before | wishlist plan, Task 2 | a journey in which a tester plays before launch |
| `playNumbers(gameId, since)` (bases `member` and `free_game`, a play is a session with an attentive beat), `makerNumberLines`, `PLAYED_FOR_MS`, the numbers under the state line on `/make/<game>` for a live game | wishlist plan, Tasks 7, 8 | the beta's own two lines |
| `Feed.svelte`'s and `MakerPage.svelte`'s `launch` prop: before launch, "Opens 30 November" and a form with one button, "Wishlist" or "On your wishlist", in place of Play and of the computer-only line | wishlist plan, Tasks 13, 14 | "Play the beta" goes under that button before launch, under Play after |
| `sweepOldPulls` and its one query of four conditions; `PullCleanup` | slice 4, Task 25 | a replaced beta's files leave the bucket |
| `takeDown` | slice 4, Task 10 | a taken-down game loses its beta (Task 3) |
| slice 5's roll-up reads `member` sessions only ("Sessions of any other basis are never read") | slice 5, Task `rollUpPlayDays` | beta play is out of pay with no change to slice 5 |

## The wishlist plan

The wishlist plan (`docs/superpowers/plans/2026-11-14-wishlist-before-launch.md`) was read on its branch on 2026-11-14, after this plan's first draft, and the two are matched here. If its audit changes one of these four, the session that meets the difference stops and reports.

1. **The play gate is inside `startPlay`** (its Task 5): before launch it refuses everyone whose basis is not `own_game` or `staff`, with `not_open`. A beta never goes through `startPlay`. `startBetaPlay` (Task 5 here) takes no launch time and asks no switch, and the route's `?beta=1` branch (Task 8) comes before the route's call to `startPlay`. That is the design's exception: a picked member plays a beta before 30 November, alongside the maker and staff.
2. **The maker's numbers name the bases that count**: `playNumbers` reads `member` and `free_game` sessions only, so a `beta` session is never in "Played 340 times". Task 10 gives `playNumbers` a third, optional argument for the bases, and the beta's lines are the same counting with `["beta"]`.
3. **The button's place.** Before launch a clip holds "Opens 30 November" and the Wishlist form; after, Play. "Play the beta" goes directly under whichever is there (Task 9).
4. **`/make/<game>`.** The numbers sit under the game's state line, with "Play it yourself" before launch. The Beta section goes below them, and the beta's two numbers lines follow the game's own numbers.

## Found while planning

Read on 2026-11-14, on `main` at `d497163`. Where the code and this plan disagree when execution reads it, stop and report.

1. **"The newest pull" would hand the release a beta's files.** Slice 2's `sendForReview` sends "its newest pull", `putBack` pulls and sends, and `gameForMaker` shows "the newest pull's count". Once a beta is pulled, the newest `GamePull` row of a game can be a beta's. So every pull says which it is (`GamePull.channel`), and each "newest pull" reader takes the newest **release** pull (Task 2). This is Review Focus 1.
2. **`pullGame` writes its refusal to `Game.pullProblem`** (`src/features/games/pull.ts`), which `/make/<game>` shows on the release's files line. A refused beta pull would put its words there. The beta has its own, `betaPullProblem` (Tasks 1, 2).
3. **`checkReachable` is inside `createGamesService`'s closure.** The beta service needs it for "Pull for testing", so Task 2 moves it out to a named function in `service.ts` that takes `deps` first; nothing else about it changes.
4. **The gate cannot see the tester list.** The gate is a separate Worker that checks a pass by its signature alone and has no database (slice 2, Task 13). So "where the gate checks the tester list" (design, "Left to the plan") is where the pass is handed out: `startBetaPlay`, on every Play. A pass already handed out lasts until it runs out (a day at most), exactly as a member's pass outlives a membership that ended (slice 2's own note). It is listed under "Worth the Owner's eye".
5. **`PlaySession_basis_check` already fits**: `"userId" IS NOT NULL OR "basis" = 'free_game'` refuses a `beta` session with nobody signed in. No new check is needed there.
6. **Postgres will not use a new enum value in the transaction that adds it.** `ALTER TYPE "PlayBasis" ADD VALUE 'beta'` goes in a migration of its own that does nothing else (Task 5).
7. **The stand-in GitHub answers one commit per repository, whatever branch is asked** (`tests/browser/support/fake-github-server.ts`: `parts[3] === "commits"`). Task 6 gives `ruken-test/tiny-game` a branch named `beta` with its own commit and an `index.html` whose heading reads "Tiny game beta", made in memory from the fixture; any other branch name answers 404, as GitHub does.
8. **Adding a tester by email tells the maker whether that email is a paying member.** The design's refusal is "Only members can test games. Ask them to join first." This plan uses that one line for "no such account" and for "not a member", so nothing more than member-or-not is learnt, and limits one maker to 100 tries an hour, counted whether they work or not, so a maker adding real testers does not meet it (Task 4). Reported to the coordinator.
9. **Nothing sweeps a pull's files today.** Slice 4's Task 25 builds the sweep; branch E of this plan gives it the beta's two conditions. If the sweep is not on `main` when the rest of this plan is done, a replaced beta's files simply stay in the bucket, as a replaced release's do today.

## The Owner's decisions, the open questions, and the Calls in this plan

- **Owner, 2026-11-14** (the beta design): a beta comes from a branch; "Nothing goes on the site without approval"; "you have to be a subscriber to play the beta"; "game creator can select members to be a part of the beta"; "yes, they can play early". Not in this: betas from a commit or a GitHub release, testers who are not members, public beta links, feedback tools, a limit on testers.
- **Asked of the coordinator on 2026-11-14.** Answered the same day: Q1 is (a) and Q2 is (a), both the coordinator's Calls; Q3 is with the Owner, and the plan keeps (a) as its marked pick until the Owner answers:
  - **Q1. Which games can have a beta?** (a) Only a game that is live (accepted). The plan's pick: the design puts "Play the beta" under the game's own button, and a game that was never accepted has no button anywhere. (b) Also a game that was never accepted, which needs a new place for testers to find it.
  - **Q2. How does a maker end a beta?** (a) No new button: they remove the testers or pull a newer beta; taking the game off Ruken ends it too. The plan's pick. (b) A "Stop the beta" button on `/make/<game>`.
  - **Q3. Can a maker play their own beta without paying?** (a) No: only picked members, as the design says; a maker who is a member adds themselves. The plan's pick. (b) Yes: the maker gets "Play the beta" on their own game.
- **Calls** (the Owner can overrule), and the design's "Left to the plan":
  - **The words of each beta state** are a sibling of slice 2's `stateWords`, `betaWords`, in the same file (`review.ts`). Not `stateWords` itself: that takes a `GameState`, and a beta has none; it is known by which of its two pulls exist. The lines are in Task 3.
  - **The play basis is `beta`.** It never comes out of `playBasis` (which decides between the game, the paywall and free play for the release); only `startBetaPlay` records it.
  - **The tester list is checked in `startBetaPlay`**, through the games feature's `betaFor(slug, userId)`, before a pass is made (Found 4).
  - **A beta is played at `/g/<game>/play?beta=1`**, the same page as the release, so there is one play screen, one beat script and one way back. Its title reads `<name> (beta) · Ruken`.
  - **Anyone who may not play a beta and opens that address is sent to the game's own page** (`/g/<game>`), with no error: signed out, not picked, a membership that ended, or no accepted beta. The game's page is the plain way back, and it shows them the button they do have.
  - **"Pull for testing" replaces a beta that is still waiting**, as slice 2's "Pull the latest" replaces a pending pull. A beta that is sent back while an older one is accepted leaves the older one playable.
  - **Accepting a newer beta leaves the older one's files to the sweep** (branch E), which deletes them once no pass for them is still running, "as slice 4's old-file deletion does for releases" (design).
  - **A game that leaves Ruken has no beta.** Taking it off (maker) or down (staff) clears the accepted and the waiting beta in the same transaction; its files are already deleted with the game's. The testers stay listed, so a game that comes back needs only a new beta. A database rule (`Game_beta_check`) refuses a beta on a game that is not live, so a new way of leaving Ruken cannot forget it quietly.
  - **Testers are shown by their page's `@name` when they have one, else by email.** A maker who added someone by handle never sees that person's email.
  - **Adding someone twice adds nothing and says nothing.** Removing is one press, with no confirm step: adding them back is one line.
  - **No mail is sent to a tester.** Design: "Testers reach the maker however they already do", and the main design's list of mails (7.1) has none for this.
  - **The beta branch may be any branch**, the release's own included. Nothing compares the two.
  - **A staff member reviewing a beta plays it with basis `staff`**, through slice 2's `startReviewPlay`, unchanged.

## Where execution stops and waits for the Owner

There is no command for the Owner in this plan: no setting, secret, bucket or address.

- **Q1 to Q3**, above. Branch A does not wait: an answer of (b) to Q2 or Q3 adds one small task to branch B or C; an answer of (b) to Q1 changes Task 1's database rule and is a stop.
- **"Fine" on the screenshots**, once per branch with screens (B and C; each branch's last step).
- **The real site.** Until live payments open, members on the real site are Stripe test accounts (design, "Needs, and when"). Task 9's last step is the Owner's look with two test accounts, once games can be played there (slice 2's G3).

## How a task runs

As slice 1's plan, word for word: two pushes (red with stubs, then green), the tracker ticked with both CI run numbers, one report line to the coordinator after each task, a draft pull request per branch, never ready while red, `main` merged in (never rebased) when it has moved.

**Where a branch runs.** Branches A, D and E are logic and run in the cloud. Branches B and C are screens: the coordinator chooses whether each runs in the cloud, judged from the screenshots, or as a local session with the Owner steering. Either way every test runs in CI.

## Branches

Five branches, eleven tasks. Each starts from `main` only after what it needs is merged and green; at most three pull requests are open at once.

| # | Branch | Tasks | Needs on `main` | Ends with |
|---|---|---|---|---|
| A | `beta/rules` | 1 to 5 | slice 2's branches M, P and S | the beta's tables; pulling a beta branch; accepting one and sending one back; testers; the `beta` basis and `startBetaPlay` |
| B | `beta/maker` | 6, 7 | A; slice 3's branch B (handles); `makePage` from slice 3's Task 22 for one journey case | the Beta section and Testers on `/make/<game>`; the Beta row and its review page for staff |
| C | `beta/play` | 8, 9 | B; slice 2's branch F; slice 3's branches D and H; the wishlist plan's branches B (`wishlist/play-gate`), E (`wishlist/button`) and F (`wishlist/maker-page`) | a tester presses "Play the beta" in the feed, on the maker's page and at `/g/<game>`, and is in the beta |
| D | `beta/numbers` | 10 | A; the wishlist plan's branch C (`wishlist/numbers`) | "Beta: played 40 times in the last 7 days" on `/make/<game>` |
| E | `beta/old-files` | 11 | A; slice 4's branch L | the sweep keeps a beta's files while it is accepted or waiting, and deletes them after |

A needs nothing of slice 3, slice 4 or the wishlist work and can start as soon as slice 2's M, P and S are merged. D and E are one task each, use nothing of B or C, and can run beside them. If the date presses, E is the branch that can move after launch with no line of the design broken (Found 9), then D.

**The date.** The target is `main` by Friday 27 November, after the wishlist work (design). It is **at risk**: branch C can only start once slice 2's branch F, slice 3's branches D and H and the wishlist work are all merged, and the wishlist's own target is Wednesday 25 November, which leaves C two days, with the Owner's "fine" on its screenshots inside them. Slice 2's M, S and F had not started on 14 November. If C is not ready to merge by 27 November, the design's own rule applies: it ships after launch rather than slowing the launch. Branches A and B hide nothing from anyone until C merges (no tester has a button), so they can merge early without risk.

## File map

```
prisma/schema/games.prisma               Game gains the beta's six fields; GamePull gains channel; BetaTester   (branch A)
prisma/schema/play.prisma                PlayBasis gains beta                                                   (branch A)
prisma/migrations/<timestamp>_beta/              the fields, PullChannel, BetaTester, Game_beta_check           (Task 1)
prisma/migrations/<timestamp>_beta_play_basis/   one line: the new enum value                                   (Task 5)
src/features/games/
  beta.ts              createBetaService: setBranch, pullForTesting, accept, sendBack, forMaker, forReview,
                       addTester, removeTester, betaFor, slugsFor
  pull.ts              pullGame takes a channel: which branch, which problem field, which channel on the row
  review.ts            gains betaWords
  service.ts           checkReachable becomes a named function; "newest pull" means newest release pull;
                       waitingGames lists betas too; takeOff clears the beta
  services.ts          gamesServices() gains beta
  games.ts             re-exports type BetaGame
src/features/play/
  may-play.ts          PlayBasis gains "beta"
  sessions.ts          gains startBetaPlay; playNumbers takes the bases to count (branch D)
  services.ts          hands the play service the games feature's betaFor
src/features/make/
  testers.ts           testerFrom: an email or a handle, to an account's id
  numbers.ts           gains betaNumberLines (branch D)
  make.ts              re-exports both
src/features/accounts/deletion.ts        the purge removes a person's tester rows
src/routes/
  make/[game]/+page.server.ts, +page.svelte           the Beta section, Testers, the beta's numbers
  admin/games/+page.server.ts, +page.svelte           a waiting beta is marked "Beta"
  admin/games/[game]/beta/+page.server.ts, +page.svelte   staff play a waiting beta, Accept, Send back
  g/[game]/play/+page.server.ts, +page.svelte         the ?beta=1 branch; the title
  +page.server.ts, g/[game]/+page.server.ts, [handle=handle]/+page.server.ts   which games this person may test
src/features/feed/Feed.svelte, src/features/pages/MakerPage.svelte            "Play the beta"
src/features/play/sweep.ts               the sweep's query gains the beta's conditions                          (branch E)
docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md   section 6 gains "beta play"                 (Task 5)
tests/browser/support/fake-github-server.ts    tiny-game gains a branch named beta
tests/browser/support/game.ts                  addBeta(browser, game, options?)
tests/browser/support/database.ts              sessionsOf already answers basis; endMembershipOf (slice 2)
tests/features/games/beta-schema.pg.test.ts, beta.pg.test.ts, beta-testers.pg.test.ts, review.test.ts (cases)
tests/features/play/sessions.pg.test.ts (cases), may-play.test.ts (a case)
tests/features/make/testers.test.ts
tests/features/accounts/purge.pg.test.ts (a case)
tests/browser/beta-maker.test.ts, beta-review.test.ts, beta-play.test.ts
```

## Review Focus

Each line names an input the design implies and no ordinary test would meet. Each has its test in the task named.

1. A maker pulls a beta, then presses "Send for review" or "Put it back" for the release: the release is sent its own newest files, never the beta's (Task 2).
2. A tester who was removed, or whose membership ended, still has "Play the beta" open in a tab and presses it: the game's own page, no pass, no session row (Tasks 5, 8).
3. A game with an accepted beta is taken off Ruken, put back and accepted again: no beta and no button until a new beta is accepted; the testers are still listed (Task 3).
4. A newer beta is sent back while an older one is accepted: testers keep playing the older one, and the maker reads why the newer one came back (Task 3).
5. An email typed in capitals or with spaces around it, `@Kofi`, the handle of someone who is not a member, an address nobody has: the first two find the person; the others get the one refusal, and nothing is stored (Tasks 4, 6).
6. A picked member presses "Play the beta" before the launch moment: the beta loads. The same person opening the release's play address before launch is still sent back to the game (Tasks 5, 8).
7. Another maker posts "Pull for testing" or "Add a member" for a game that is not theirs: a missing page, and nothing changes (Tasks 2, 4, 6).
8. `?beta=1` on a game with no accepted beta, by someone who is not a tester, or signed out: the game's page, never an error and never the release under a beta's address (Task 8).
9. A phone opens a computer-only game's beta address: the game's page, which says so (Task 8).
10. A beta's sessions and beats beside a member's on the same game: the feed's order and the release's numbers do not move (Tasks 5, 10).
11. One maker tries a list of addresses to learn who is a member: after 100 in an hour, each try is refused with a line that says to wait, and the list is not read (Task 4).
12. A deleted account that was a tester: its rows are gone when the purge has run, and the maker's list is one shorter (Task 4).

---

# Branch A: `beta/rules`

Needs slice 2's branches M, P and S on `main`. Logic only; no screen changes.

### Task 1: The beta's tables

**Files:**
- Create: `prisma/migrations/<timestamp>_beta/migration.sql`, `tests/features/games/beta-schema.pg.test.ts`
- Modify: `prisma/schema/games.prisma`
- Test: `tests/features/games/beta-schema.pg.test.ts`

**The tables** (the migration is made with `prisma migrate diff` from `main`'s schema, as slice 2's Task 1 did, then the CHECK by hand):

- `enum PullChannel { release, beta }`.
- `GamePull` gains `channel PullChannel @default(release)`. Every pull so far is a release's. `GamePull` is add-only; adding a column with a default changes no row's meaning and fires no row trigger.
- `Game` gains:
  - `betaBranch String?`: the branch the maker named; null until they name one.
  - `betaPullId String? @unique`: the accepted beta (relation `"GameBetaPull"` to `GamePull`, `onDelete: Restrict`).
  - `betaPendingPullId String? @unique`: the beta waiting for review (relation `"GameBetaPendingPull"`).
  - `betaPendingSince DateTime? @db.Timestamptz`: when it was sent; the queue's order.
  - `betaReason String?`: why the last beta was sent back; null once one is sent or accepted.
  - `betaPullProblem String?`: the words of the last beta pull's refusal; null once a beta pull passes.
- `BetaTester`: `id` (cuid), `gameId` (a `Game`, `onDelete: Restrict`), `userId` (a `User`, `onDelete: Restrict`), `addedAt @db.Timestamptz`, `createdAt`; `@@unique([gameId, userId])`, `@@index([userId])`. Rows are deleted when a tester is removed, so it has no add-only trigger.
- CHECK `Game_beta_check`: `("betaPullId" IS NULL AND "betaPendingPullId" IS NULL) OR "state" = 'live'`. A comment in the schema beside the fields says what it is for: a game that is not on Ruken has no beta, and any new way of leaving `live` that forgets the beta fails loudly here instead of leaving a button that opens deleted files.

- [ ] **Step 1 (red):** `beta-schema.pg.test.ts`, in the style of `tests/features/games/schema.pg.test.ts`: an existing pull's `channel` reads `release`; a pull can be stored with `channel: "beta"`; a live game takes a `betaPullId` and a `betaPendingPullId`; **a draft game with a `betaPullId` is refused with `Game_beta_check`, and so is a live game with a beta that is then set to `taken_off` without clearing it**; two games cannot share one beta pull (the unique key); one person is a game's tester once (`BetaTester_gameId_userId_key`); a tester row can be deleted. Push with the schema unchanged. Expected: `postgres` fails in `beta-schema.pg.test.ts` only, with `column "channel" does not exist` or the like; if typecheck fails first on the unknown fields, the red is the typecheck error naming them, and the report line says so.
- [ ] **Step 2 (green):** the schema and the migration. Push. Expected: all pass, the migrations drift check included.

### Task 2: Pulling a beta branch

**Files:**
- Create: `src/features/games/beta.ts`, `tests/features/games/beta.pg.test.ts`
- Modify: `src/features/games/pull.ts`, `src/features/games/service.ts`, `src/features/games/services.ts`, `src/features/games/games.ts`
- Test: `tests/features/games/beta.pg.test.ts`, `tests/features/games/pull.pg.test.ts` (add cases), `tests/features/games/review.pg.test.ts` (add cases)

**Interfaces:**
- Changes:
  - `pullGame(deps: PullDeps, gameId: string, channel: PullChannel = "release"): Promise<Pull>` in `pull.ts`. For `"beta"`: the branch is the game's `betaBranch` (null: `GameError("NOT_READY", "Name the branch your beta is on.")`, and GitHub is not asked); a refusal is written to `betaPullProblem` and a pass clears `betaPullProblem`; the row's `channel` is `beta`. `pullProblem` is never touched by a beta pull, and `betaPullProblem` never by a release pull. Everything else (one commit resolved once, the check before anything is stored, the folder, the limits) is the same code path.
  - `checkReachable(deps: GamesServiceDeps, makerUserId: string, repoFullName: string): Promise<void>` becomes a named export of `service.ts` (Found 3); `createGame` and `pullLatest` call it with `deps`.
  - In `service.ts`, every reader of "the game's newest pull" (`sendForReview`, `gameForMaker`, and `putBack` through them: find them with a search for `gamePull.findFirst` and `pulledAt`) adds `channel: "release"` to its `where` (Found 1).
- Produces, in `beta.ts`: `createBetaService(deps: BetaDeps)` with `interface BetaDeps extends GamesServiceDeps { isMember(userId: string): Promise<boolean>; rateLimiter: RateLimiter }`. This task builds two of its methods; the rest are stubs until their tasks:
  - `setBranch(gameId: string, makerUserId: string, branch: string): Promise<void>`: the game is this maker's (else `GameError("NOT_FOUND", "We can't find that game.")`) and is `live` (else `GameError("NOT_READY", ONLY_LIVE)`); the branch, trimmed, passes `checkBranch` (empty: `GameError("INVALID", "Name the branch your beta is on.")`); then `betaBranch` is set. It asks GitHub nothing.
  - `pullForTesting(gameId: string, makerUserId: string): Promise<Pull>`: the game is this maker's and `live` (as above); `checkReachable`; `pullGame(deps, gameId, "beta")`; then, in one update, `betaPendingPullId` is the new pull, `betaPendingSince` the clock's time and `betaReason` null. A beta that was waiting is replaced. A refused pull changes none of the three.
  - `ONLY_LIVE = "Only a game that is live on Ruken can have a beta."`
- `GamesServices` (in `services.ts`) gains `beta: BetaService`; `createGamesServices(source, parts)` takes `parts.isMember`, and `gamesServices()` passes `(userId) => membershipServices().service.isMember(userId)` and builds the rate limiter with `createRateLimiter(parts.db, parts.clock)`.

- [ ] **Step 1 (red):** with `TestClock`, `MemoryFileStore` and a stand-in `GitHub` whose `commitOf(repo, "beta")` answers another commit than `commitOf(repo, null)`:

```ts
it("pulls the beta branch's commit, marks the pull as a beta, and sends it for review in one press", async () => {
  await beta.setBranch(game.id, maker.id, "beta");
  const pull = await beta.pullForTesting(game.id, maker.id);
  expect(await prisma.gamePull.findUniqueOrThrow({ where: { id: pull.id } })).toMatchObject({ channel: "beta", commitSha: BETA_COMMIT });
  expect(await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).toMatchObject({
    betaPendingPullId: pull.id, betaPendingSince: new Date(clock.epochMs()), betaPullId: null,
    livePullId: live.id, pendingPullId: null, state: "live",                       // the release is not touched
  });
});
it("replaces a beta that is still waiting", async () => { /* two pulls: betaPendingPullId is the second, betaPendingSince the later time */ });
it("keeps a refused beta's words apart from the release's", async () => {
  /* the beta branch has no index.html: FILES_REFUSED; betaPullProblem holds the words, pullProblem is null, nothing pending */ });
it("says so when the branch is not in the repository", async () => { /* commitOf throws GameError("INVALID", NO_BRANCH): it reaches the caller as is */ });
it("needs a branch name first", async () => { /* no setBranch: NOT_READY "Name the branch your beta is on."; the stand-in GitHub was never asked */ });
it.each(["draft", "waiting", "sent_back", "taken_off"] as const)("refuses a beta for a %s game", async (state) => { /* ONLY_LIVE, for setBranch and pullForTesting */ });
it("refuses another maker", async () => { /* NOT_FOUND for both; nothing changes */ });                       // Review Focus 7
it("refuses a repository the maker can no longer reach", async () => { /* the installation is gone: NOT_CONNECTED, and no pull row */ });
// review.pg.test.ts
it("sends the release its own newest files after a beta was pulled", async () => {                              // Review Focus 1
  /* live game; "Pull the latest" equivalent: a release pull R2; then a beta pull B (newer). sendForReview: pendingPullId is R2, not B.
     takeOff, then putBack: the pending pull's channel is release */ });
// pull.pg.test.ts
it("a release pull never reads or clears the beta's problem, and the other way round", async () => {});
```

  Stubs for `beta.ts` and the new argument. Push. Expected: `postgres` fails in the three files with "not built yet" (the Review Focus 1 case fails by sending B).
- [ ] **Step 2 (green):** the code. Push. Expected: all pass, slice 2's own pull and review cases included.

### Task 3: Accepting a beta, sending one back, and a game that leaves Ruken

**Files:**
- Modify: `src/features/games/beta.ts`, `src/features/games/review.ts`, `src/features/games/service.ts`
- Test: `tests/features/games/beta.pg.test.ts` (add cases), `tests/features/games/review.test.ts` (add cases), `tests/features/games/take-off.pg.test.ts` (add a case)

**Interfaces:**
- Produces, pure, in `review.ts`: `betaWords(beta: { hasAccepted: boolean; hasPending: boolean; reason: string | null }): string`:

  | Accepted | Waiting | Reason | Words |
  |---|---|---|---|
  | no | no | none | "Not sent yet" |
  | no | yes | any | "Waiting for review" |
  | no | no | a reason | "Sent back: `<reason>`" |
  | yes | no | none | "Ready for testers" |
  | yes | yes | any | "Ready for testers. Your newer beta is waiting for review" |
  | yes | no | a reason | "Ready for testers. Your newer beta was sent back: `<reason>`" |

- Added to the beta service:
  - `accept(gameId: string, staffUserId: string): Promise<void>`: in one transaction, `betaPullId` becomes the waiting pull, `betaPendingPullId`, `betaPendingSince` and `betaReason` null, and one `GameReview` row (`pullId` the beta's pull, `accepted`, the clock's time). Nothing waiting: `GameError("NOT_READY", "Nothing is waiting for review.")` (slice 2's words). It does not touch `livePullId`, `pendingPullId` or `state`, and deletes no file.
  - `sendBack(gameId: string, staffUserId: string, reason: string): Promise<void>`: the reason is 1 to 500 characters after trimming, else `GameError("INVALID", "Say what the maker should fix.")` (slice 2's words); then `betaPendingPullId` and `betaPendingSince` null, `betaReason` the reason, and one `GameReview` row (`sent_back`). `betaPullId` is not touched.
  - `forReview(slug: string): Promise<{ gameId: string; publicId: string; name: string; makerEmail: string; branch: string; pullId: string; fileCount: number; totalBytes: number; connectHosts: string[]; sentAt: Date } | null>`: the game's waiting beta, for staff; null when none waits.
- Changes, in `service.ts`:
  - `waitingGames()` answers each row with `beta: boolean`. A game with a waiting beta is one more row (`beta: true`, `sentAt` its `betaPendingSince`); a game with a release update and a beta both waiting is two rows. Oldest `sentAt` first across both.
  - `takeOff` (slice 2, Task 31) sets `betaPullId`, `betaPendingPullId`, `betaPendingSince` and `betaReason` null in its transaction. `betaBranch` and the testers stay. Its `deleteAll("files/<publicId>/")` already takes the beta's files.
  - `takeDown` (slice 4, Task 10): **if it is on `main` when this task starts**, it gets the same four fields in its transaction and the same test case. If it is not, say so in the report line; the coordinator adds the line to slice 4's Task 10, and `Game_beta_check` (Task 1) refuses a take-down that forgets.

- [ ] **Step 1 (red):** `review.test.ts`: one case per row of the table. `beta.pg.test.ts`:

```ts
it("accepting makes it the game's beta and leaves the release alone", async () => {
  /* pullForTesting, accept: betaPullId is that pull; pending, since and reason null; livePullId, state unchanged;
     one GameReview { pullId, staffUserId, decision: "accepted", decidedAt: clock }; every file of both pulls is in the bucket */ });
it("refuses when nothing is waiting", async () => { /* "Nothing is waiting for review." ; no review row */ });
it("keeps the older beta when a newer one is sent back, and stores why", async () => {                           // Review Focus 4
  /* accept B1; pullForTesting B2; sendBack(B2, "It crashes."): betaPullId is B1, betaReason "It crashes.", nothing pending */ });
it("sending back needs a reason", async () => { /* "" and "   ": "Say what the maker should fix." */ });
it("a new beta clears the old reason", async () => { /* after a send back, pullForTesting: betaReason null */ });
it("lists a waiting beta in the queue, marked, beside a waiting release", async () => {
  /* one game with both waiting: two rows, { beta: false } and { beta: true }, oldest sentAt first */ });
it("forReview answers the waiting beta's measured numbers and servers", async () => { /* fileCount, totalBytes, connectHosts from the pull's row; null with nothing waiting */ });
// take-off.pg.test.ts
it("a game taken off Ruken has no beta, and still none once it is back and accepted", async () => {            // Review Focus 3
  /* accepted beta B1, one tester. takeOff: betaPullId null, the bucket holds nothing under files/<publicId>/, the tester row is there.
     putBack, accept: live, betaPullId still null, betaBranch still "beta" */ });
```

  Stubs. Push. Expected: `verify` fails in `review.test.ts`, `postgres` in the two others ("not built yet"; the take-off case fails on `Game_beta_check`, which is the rule doing its job: say so).
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 4: Testers, and who may play a beta

**Files:**
- Create: `src/features/make/testers.ts`, `tests/features/games/beta-testers.pg.test.ts`, `tests/features/make/testers.test.ts`
- Modify: `src/features/games/beta.ts`, `src/features/games/games.ts`, `src/features/make/make.ts`, `src/features/accounts/deletion.ts`
- Test: the two new files, `tests/features/accounts/purge.pg.test.ts` (add a case)

**Interfaces:**
- Produces, in `beta.ts`:
  - `ONLY_MEMBERS = "Only members can test games. Ask them to join first."` (the design's words).
  - `ADD_TESTERS_PER_MAKER: RateLimitRule = { max: 100, windowMs: 60 * 60 * 1000 }`, key `api:add-tester:<makerUserId>`. Every try counts, found or not, so the limit itself says nothing about anyone.
  - `addTester(gameId: string, makerUserId: string, testerUserId: string | null): Promise<void>`: the game is this maker's (else `NOT_FOUND`) and `live` (else `ONLY_LIVE`); the limit is hit first, and over it: `GameError("INVALID", "You've added a lot of people just now. Try again in an hour.")`; `testerUserId` null (nobody was found), or `isMember` false: `GameError("INVALID", ONLY_MEMBERS)` and nothing is stored; otherwise one `BetaTester` row with the clock's time. A person who is already a tester: nothing is added and nothing is thrown.
  - `removeTester(gameId: string, makerUserId: string, testerUserId: string): Promise<void>`: the game is this maker's; the row is deleted; no row is not an error.
  - `forMaker(gameId: string): Promise<{ branch: string | null; words: string; sentAt: Date | null; problem: string | null; testers: { userId: string; email: string; addedAt: Date }[] }>`: `words` from `betaWords`; `sentAt` the waiting beta's `betaPendingSince` (null when none waits); `problem` is `betaPullProblem`; testers oldest first.
  - `interface BetaGame { id: string; publicId: string; slug: string; name: string; pullId: string; connectHosts: string[] }` (`connectHosts` are the beta pull's own), re-exported by `games.ts`.
  - `betaFor(slug: string, userId: string): Promise<BetaGame | null>`: the game at that address, only while it is `live`, has an accepted beta, this person has a `BetaTester` row for it, **and** `isMember(userId)` is true. Anything else: null. `isMember` is asked last, so someone who is not a tester costs one query.
  - `slugsFor(userId: string | null): Promise<string[]>`: the addresses of the live games with an accepted beta that this person is a tester of; `[]` for nobody, for no rows (without asking `isMember`), and for someone who is not a member.
- Produces, in `src/features/make/testers.ts`, re-exported by `make.ts`: `testerFrom(lookups: { byEmail(email: string): Promise<string | null>; byHandle(handle: string): Promise<string | null> }, typed: string): Promise<string | null>`. Trimmed and lower-cased. Empty: `GameError("INVALID", "Type their email or their @name.")`. An `@` anywhere after the first character: an email, asked of `byEmail`. Otherwise a handle, with one leading `@` removed, asked of `byHandle`. It stores nothing and decides nothing about membership; null means nobody was found. (It lives in `make` because a handle belongs to `pages`, which sits above `games`.)
- Changes: `purgeDueAccounts` deletes the person's `BetaTester` rows in its transaction, beside the GitHub installations, with a comment: being picked to test a game is the person's own data.

- [ ] **Step 1 (red):**

```ts
// tests/features/make/testers.test.ts
const lookups = { byEmail: async (e: string) => (e === "ana@example.com" ? "u-ana" : null), byHandle: async (h: string) => (h === "kofi" ? "u-kofi" : null) };
it.each([["ana@example.com", "u-ana"], ["  ANA@Example.com ", "u-ana"], ["@kofi", "u-kofi"], ["Kofi", "u-kofi"], ["@nobody", null], ["no@one.test", null]])(   // Review Focus 5
  "finds %s", async (typed, found) => { expect(await testerFrom(lookups, typed)).toBe(found); });
it("asks for something to be typed", async () => { await expect(testerFrom(lookups, "  ")).rejects.toThrow("Type their email or their @name."); });

// tests/features/games/beta-testers.pg.test.ts  (isMember is a plain function over a Set the test fills)
it("adds a member as a tester, once", async () => { /* addTester twice: one row, addedAt the clock's time */ });
it.each([["nobody was found", null], ["someone who is not a member", "u-not-member"]])("refuses %s with the same words and stores nothing", async (_, id) => {
  await expect(beta.addTester(game.id, maker.id, id)).rejects.toThrow("Only members can test games. Ask them to join first.");
  expect(await prisma.betaTester.count()).toBe(0);
});
it("slows down a maker who tries many people", async () => {                                                     // Review Focus 11
  /* 100 refused tries, then a real member: "You've added a lot of people just now. Try again in an hour.", no row, isMember not called for the 101st */ });
it("refuses another maker, for adding and for removing", async () => {});                                        // Review Focus 7
it("removes a tester", async () => { /* the row is gone; removing again is quiet */ });
it("answers the beta only to a picked, current member", async () => {
  /* accepted beta. betaFor(slug, tester) → { pullId: B1, connectHosts: B1's }.
     null for: a member who was not picked; the tester once isMember says false (Review Focus 2); the tester once removed;
     a waiting beta with none accepted; the game taken off */ });
it("lists the games a person may test, and asks about membership only when there is one", async () => { /* slugsFor: [slug]; [] for null, for no rows (isMember not called), for a lapsed member */ });
it("shows the maker their beta in words, with its testers oldest first", async () => { /* forMaker */ });
// purge.pg.test.ts
it("removes a deleted person's tester rows", async () => {});                                                    // Review Focus 12
```

  Stubs. Push. Expected: `verify` fails in `testers.test.ts`, `postgres` in the two others, with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass, the layer test included (`make` reaches `games` through `games.ts`; `games` reaches `membership` through `membership.ts`).

### Task 5: Beta play: its basis, and the one place its pass is handed out

**Files:**
- Create: `prisma/migrations/<timestamp>_beta_play_basis/migration.sql`
- Modify: `prisma/schema/play.prisma`, `src/features/play/may-play.ts`, `src/features/play/sessions.ts`, `src/features/play/services.ts`, `docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`
- Test: `tests/features/play/sessions.pg.test.ts` (add cases), `tests/features/play/may-play.test.ts` (add a case), `tests/features/play/schema.pg.test.ts` (add a case)

**Interfaces:**
- `PlayBasis` gains `beta`, in `play.prisma` (the migration is the one line of Found 6) and in `may-play.ts`'s type. `playBasis()` does not change and never answers `beta`; a comment beside the type says why: a beta is not something a person may play by who they are, but by being picked, and `startBetaPlay` records it.
- `PlayServiceDeps` gains `betaFor(slug: string, userId: string): Promise<BetaGame | null>`; `createPlayServices`' `parts` gains the same, and `playServices()` passes `(slug, userId) => gamesServices().beta.betaFor(slug, userId)`.
- Added to `createPlayService`: `startBetaPlay(input: { slug: string; userId: string; clientAddress: string }): Promise<StartedPlay | { refused: "not_tester" }>` (`StartedPlay` already holds `{ refused: "busy" }`). `deps.betaFor(slug, userId)` null: `{ refused: "not_tester" }`, and nothing is stored and no pass is made. Then the address's limit, slice 2's own key and rule (`api:play-start:<clientAddress>`, `PLAY_STARTS_PER_ADDRESS`): `{ refused: "busy" }`. Then `passFor` for the beta's pull and this person, and one `PlaySession` row with `pullId` the beta's pull and basis `beta`; `frameUrl` as `startPlay` builds it. It asks no launch switch: a picked member plays a beta before launch (design; "The wishlist plan", 2).
- The main design, section 6, "What never counts toward pay": the line gains "beta play", with "(beta builds design, 2026-11-14)". One sentence; nothing else in that file changes.

- [ ] **Step 1 (red):**

```ts
// sessions.pg.test.ts  (betaFor is a plain function the test sets)
it("gives a picked member the beta's files, and records the play as beta", async () => {
  const started = await service.startBetaPlay({ slug: game.slug, userId: tester.userId, clientAddress: "203.0.113.1" });
  const claims = checkPass(new URL(frameUrlOf(started)).pathname.split("/")[1] ?? "", "s", clock.epochMs());
  expect(claims).toMatchObject({ game: game.publicId, pull: betaPull.id, connect: betaPull.connectHosts });
  expect(await prisma.playSession.findMany()).toMatchObject([{ userId: tester.userId, pullId: betaPull.id, basis: "beta" }]);
  expect(await prisma.playPass.findUniqueOrThrow({ where: { id: claims?.id ?? "" } })).toMatchObject({ userId: tester.userId, pullId: betaPull.id });
});
it("hands nothing to someone the tester list does not answer for", async () => {                                 // Review Focus 2
  /* betaFor answers null: { refused: "not_tester" }; no PlayPass row, no PlaySession row */ });
it("asks the list at every Play, however recent the last pass", async () => { /* a first Play works; betaFor then answers null; the second is refused and adds no row */ });
it("plays before the launch moment", async () => { /* TestClock at 2026-11-20T12:00:00Z: started, not refused */ }); // Review Focus 6
it("keeps the beta's pass apart from the release's for the same member", async () => { /* startPlay and startBetaPlay: two frame addresses, two pulls */ });
it("slows down an address that opens betas too fast", async () => { /* the 31st start in a minute: { refused: "busy" } */ });
it("leaves beta beats out of what members played", async () => {                                                 // Review Focus 10
  /* three attentive beats on a beta session, three on a member's: memberBeatsByGame (slice 3, Task 10) answers 3.
     If memberBeatsByGame is not on main yet, the case asserts the rows' basis only, and the report line says so. */ });
// may-play.test.ts
it("never answers beta by itself", () => { /* over every combination of maker, staff, free and member: the answer is never "beta" */ });
// schema.pg.test.ts
it("a beta session needs a person", async () => { /* basis beta with userId null: PlaySession_basis_check */ });
```

  The red push carries the enum value (schema, migration and the type) and a stub for `startBetaPlay`, as slice 2's Task 16 carried its tables beside Task 17's stubs: they are declarations, and the tests cannot be typed without them. Push. Expected: `postgres` fails in `sessions.pg.test.ts` with "not built yet"; the `may-play.test.ts` and `schema.pg.test.ts` cases pass already, and the report line says so.
- [ ] **Step 2 (green):** the code, the migration, the design's line. Push. Expected: all pass. Branch A is ready to merge.

---

# Branch B: `beta/maker`

Needs branch A, and slice 3's branch B (`pageByHandle`, `handlesOf`) on `main`. One journey case uses `makePage` (slice 3, Task 22, branch H); if that helper is not on `main` yet, that case's `@name` half waits and is added on branch C, Task 4's `testerFrom` cases stand for it meanwhile, and the report line says so.

### Task 6: The Beta section and Testers on `/make/<game>`

**Files:**
- Create: `tests/browser/beta-maker.test.ts`
- Modify: `src/routes/make/[game]/+page.server.ts`, `src/routes/make/[game]/+page.svelte`, `tests/browser/support/fake-github-server.ts`
- Test: `tests/browser/beta-maker.test.ts`

**The screen.** For a game that is `live`, below everything slice 2 put on the page (and below the wishlist's numbers, once they are there) and above "Take it off Ruken":

```
Beta
Let a few members try a new version before everyone gets it.

Branch: beta            ▸ Change
Waiting for review · pulled 2 hours ago
[ Pull for testing ]
Copying your game can take a minute. Keep this page open.

Testers (3)
ana@example.com          [ Remove ]
@kofi                    [ Remove ]
Member's email or @name  [                 ]  [ Add a member ]
```

- The section's heading is an `h2`, "Beta"; one line of ordinary text under it says what it is.
- **Branch.** Until a branch is saved: a field labelled "Branch" with the `note` "The branch your new version is on, like beta." and a "Save" button; the state line and "Pull for testing" are not shown. Once saved: the line "Branch: `<name>`" and, beside it, a `<details>` whose `<summary>` is "Change", holding the same field and "Save" (it opens with no script, as slice 2's "Change the branch or folder" does). Action `betaBranch`: `beta.setBranch`.
- **The state line** is `forMaker().words` as a `statement`; while a beta waits, " · pulled `<when>`" follows it (the design's word; pulling and sending are one press), with `<when>` in the words slice 2's `/admin/games` uses for "sent 2 hours ago" (Task 30; if that wording is written inside its route, this task moves it to `src/lib/ago.ts` with a unit test and both use it). When `problem` is not null, the refusal's own words follow as a `problem`.
- **"Pull for testing"**, action `betaPull`: `beta.pullForTesting`. One press pulls and sends for review (design). The same `note` as "Pull the latest": "Copying your game can take a minute. Keep this page open."
- **Testers.** The heading is "Testers (`<n>`)"; with none: "Testers" and the line "Nobody yet. Add a member to let them play your beta." Each tester is their page's `@name` when `handlesOf` has one, else their email, with a `quiet` "Remove" (action `removeTester`, the tester's account id in a hidden field, checked against the game by the service).
- **"Add a member"**, action `addTester`: `testerFrom({ byEmail, byHandle }, typed)`, then `beta.addTester(gameId, makerUserId, found)`. `byEmail` reads the `User` row by its lower-cased email; `byHandle` is `pageByHandle(handle)?.makerUserId`. A refusal shows its words as a `problem` beside the field and keeps what was typed.
- Each action checks the game is the caller's the way the page's other actions do (slice 2, Task 28: someone else's game is a 404), and answers a 303 back to `/make/<game>`.
- A game that is not live has no Beta section at all.

Grandma: one button sends a beta, one adds a tester, and the state is one line of words. Every refusal says what to do next.

Look: no new class. The section sits in the page's card; "Pull for testing", "Save", "Add a member" and "Remove" are `class="quiet"` (the page's one plain `<button>` stays "Send for review" or "Pull the latest", as slice 2 has it); hints are `note`; refusals `problem`. No red.

**The stand-in GitHub** (Found 7): `Repository` gains `branches?: Record<string, { commit: string; files: … }>`; `tiny-game` gets `beta`: commit `"b".repeat(40)`, the fixture's files with `<h1>Tiny game</h1>` replaced by `<h1>Tiny game beta</h1>` in `index.html`. `GET /repos/<repo>/commits/<ref>`: `HEAD` and `main` answer the repository's commit, a named branch its own, any other name 404. The tarball route answers the files of the commit it is asked for.

- [ ] **Step 1 (red):**

```ts
test.beforeEach(forgetRateLimits);
test("a maker names a beta branch, pulls it for testing, and sees it waiting", async ({ page, browser }, testInfo) => {
  const game = await addGame(browser);
  await signInAs(page, game.makerEmail);
  await page.goto(`/make/${game.slug}`);
  await expect(page.getByRole("heading", { level: 2, name: "Beta" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pull for testing" })).toHaveCount(0);        // no branch yet
  await page.getByLabel("Branch").fill("beta");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Not sent yet")).toBeVisible();
  await page.getByRole("button", { name: "Pull for testing" }).click();
  await expect(page.getByText(/^Waiting for review · pulled /)).toBeVisible();
  await expect(page.getByText("Branch: beta")).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();                        // the release's own line did not move
  await expectOneCard(page); await showTheOwner(page, testInfo, "a game's beta, waiting for review");
});
test("a branch that is not in the repository says so", async ({ page, browser }) => { /* "nope" → "We couldn't find that branch in your repository." */ });
test("a maker adds a member by email and by @name, and removes one", async ({ page, browser }, testInfo) => {
  /* two members made with payAsNewMember in their own contexts; one has a page (makePage, slice 3's helper) with the handle "kofi-<random>".
     Add the first by email typed in capitals, the second as "@kofi-<random>": "Testers (2)", the second listed as its @name and its email nowhere on the page.
     Remove the first: "Testers (1)". showTheOwner "a beta's testers". */ });                  // Review Focus 5
test("someone who is not a member is refused in plain words, and so is nobody at all", async ({ page, browser }) => {
  /* a signed-up account that never paid, then "no@one.test": both "Only members can test games. Ask them to join first."; what was typed stays; "Testers" still reads "Nobody yet." */ });
test("another maker's posts change nothing", async ({ page, browser, request }) => { /* POST ?/betaPull and ?/addTester to someone else's game: 404 */ });   // Review Focus 7
test("a game that is not live has no Beta section", async ({ page, browser }) => { /* submitGame: no heading "Beta" */ });
```

  Push. Expected: `browser` fails in `beta-maker.test.ts` (no heading "Beta"); the last case passes already, and the report line says so.
- [ ] **Step 2 (green):** the route and the stand-in. Push. Expected: all pass.

### Task 7: A beta in the staff queue, and its review page

**Files:**
- Create: `src/routes/admin/games/[game]/beta/+page.server.ts`, `+page.svelte`, `tests/browser/beta-review.test.ts`
- Modify: `src/routes/admin/games/+page.server.ts`, `+page.svelte`, `tests/browser/support/game.ts`
- Test: `tests/browser/beta-review.test.ts`

**`/admin/games`:** a waiting beta is a row like any other, with "Beta" after the game's name, and it links to `/admin/games/<game>/beta`:

```
Games waiting for review

Tiny game            maker@example.com     sent 2 hours ago
Tiny game · Beta     maker@example.com     sent 1 hour ago
```

**`/admin/games/<game>/beta`:**

```
Tiny game
Beta, from the branch beta. The game's own files and clips do not change.
By maker@example.com · 3 files, 1 MB
Talks to: api.example.com          (or: Talks to no server.)

[ the beta, playing in its frame ]

[ Accept ]

Send back, and say what to fix   [                          ]   [ Send back ]
```

- `load`: `staffOnly(locals.caller)` (slice 2, Task 30; 404 for anyone else), then `beta.forReview(params.game)`; null is a 404. The frame is `startReviewPlay({ game, pullId, staffUserId })` with the waiting beta's pull, so staff play it with basis `staff` before it is accepted, exactly as they play a waiting release.
- "Accept" calls `beta.accept`; "Send back" calls `beta.sendBack` with the reason; both return to `/admin/games`. An empty reason: "Say what the maker should fix."
- If slice 4's portal is on `main`, the page takes whatever guard slice 4 gave `/admin/games/<game>` (its Task 4 leaves `staffOnly(caller)` meaning what it meant, and none of that page's actions asks for a code).

Grandma: the row says "Beta"; the page says in one line what a beta is and that the release does not change; then the game, and the same two choices as for a release.

Look: as slice 2's review page: `<main>` with no card, the game in `frame`, "Accept" the one plain `<button>`, "Send back" `class="quiet"`, the second line a `note`. No red.

**The journeys' helper**, in `tests/browser/support/game.ts`: `addBeta(browser, game: { slug: string; makerEmail: string }, options?: { testers?: string[] }): Promise<void>`: in a context of its own the maker signs in, saves the branch `beta` and presses "Pull for testing"; a staff account (`signInAsStaff`) opens `/admin/games/<slug>/beta` and accepts; the maker adds each of `testers` by email. Every journey of branch C gets its beta this way, through the real screens.

- [ ] **Step 1 (red):**

```ts
test.beforeEach(forgetRateLimits);
test("staff play a waiting beta and accept it, and the maker reads that it is ready", async ({ page, browser }, testInfo) => {
  const game = await addGame(browser);
  /* the maker's steps of Task 6's first test, in their own context */
  await signInAsStaff(page);
  await page.goto("/admin/games");
  await page.getByRole("link", { name: `${game.name} · Beta` }).click();
  await expect(page).toHaveURL(`/admin/games/${game.slug}/beta`);
  await expect(page.frameLocator("iframe.frame").getByRole("heading", { name: "Tiny game beta" })).toBeVisible();   // the beta branch's files, not the release's
  await showTheOwner(page, testInfo, "a beta being reviewed");
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page).toHaveURL("/admin/games");
  /* the maker's /make/<slug> reads "Ready for testers"; /g/<slug> still answers 200 and its release is unchanged */
});
test("staff send a beta back, and the maker reads why", async ({ page, browser }) => { /* "It crashes." → "Sent back: It crashes." in the Beta section; the game's own line still reads "Live" */ });
test("sending a beta back needs a reason", async ({ page, browser }) => { /* "Say what the maker should fix." */ });
test("the beta's review page is not there for anyone else, or when nothing waits", async ({ page, browser }) => { /* signed out, a plain member: 404; staff, after Accept: 404 */ });
```

  Push. Expected: `browser` fails in `beta-review.test.ts` (no link named "… · Beta").
- [ ] **Step 2 (green):** the route, the row, `addBeta`. Push. Expected: all pass.
- [ ] **Step 3:** send the coordinator the green run and one line each for "a game's beta, waiting for review", "a beta's testers" and "a beta being reviewed". Mark the branch ready after the Owner's "fine". After two rounds without "fine", stop.

---

# Branch C: `beta/play`

Needs branch B; slice 2's branch F (`/g/<game>/play`); slice 3's branches D and H (`Feed.svelte`, `MakerPage.svelte`); and the wishlist plan's branches B, E and F (the play gate, and Wishlist where Play goes in the feed and on a maker's page). Read "The wishlist plan", above, against that plan as merged before the first push. If the wishlist's branch F has slipped (its own plan says it may), Task 9 puts the link under Play on a maker's page, and the report line says so.

### Task 8: Playing a beta (`/g/<game>/play?beta=1`)

**Files:**
- Create: `tests/browser/beta-play.test.ts`
- Modify: `src/routes/g/[game]/play/+page.server.ts`, `src/routes/g/[game]/play/+page.svelte`
- Test: `tests/browser/beta-play.test.ts`

- `load`, in this order. The first two steps are slice 2's, unchanged: `liveGameBySlug` (null: 404); a computer-only game on a phone: redirect (303) to `/g/<slug>`. Then, **before the route's call to `startPlay`** (which holds the wishlist plan's launch check): when `url.searchParams.get("beta") === "1"`:
  - signed out: redirect (303) to `/g/<slug>`;
  - `startBetaPlay({ slug, userId, clientAddress: getClientAddress() })`: `not_tester` redirects (303) to `/g/<slug>`; `busy` is slice 2's `error(429)`; otherwise it answers what the ordinary path answers (`{ name, slug, frameUrl, session }`) and `beta: true`.
  - Any other value of `beta`, or none, is the ordinary path, untouched.
- The page: with `beta`, the title is `<name> (beta) · Ruken` and the frame's `title` is `<name> (beta)`. Nothing else differs: the same `stage`, the same bar and ←, the same beat script (the beat route knows a session by its token and needs no change).

Grandma: the tester is in the game, with the same one way back. Someone who should not be there lands on the game's own page, with the button they do have.

Look: nothing new.

- [ ] **Step 1 (red):**

```ts
test.beforeEach(forgetRateLimits);
test("a picked member plays the beta, and it is recorded as beta play", async ({ page, browser }) => {
  const game = await addGame(browser);
  const member = await payAsNewMember(page);
  await addBeta(browser, game, { testers: [member.email] });
  await page.goto(`/g/${game.slug}/play?beta=1`);
  await expect(page).toHaveTitle(`${game.name} (beta) · Ruken`);
  await expect(page.frameLocator("iframe.frame").getByRole("heading", { name: "Tiny game beta" })).toBeVisible();
  expect(await sessionsOf(game.slug)).toMatchObject([{ basis: "beta" }]);                    // and no member session: the release was never opened
});
test("the beta opens before launch for a picked member", async ({ page, browser }) => {                          // Review Focus 6
  /* the first case's steps, then beforeLaunch(page.context()) (wishlist plan, Task 2): /g/<slug>/play?beta=1 loads "Tiny game beta";
     /g/<slug>/play, the release, sends the same member back to /g/<slug> (that plan's not_open) and stores no member session */ });
test("a member who was not picked is sent to the game's page", async ({ page, browser }) => {                    // Review Focus 8
  /* payAsNewMember; addBeta with no testers; /g/<slug>/play?beta=1 → toHaveURL(`/g/${game.slug}`); sessionsOf is [] */ });
test("signed out, the beta's address goes to the game's page", async ({ page, browser }) => {});
test("a game with no accepted beta sends its tester to the game's page", async ({ page, browser }) => { /* a waiting beta only */ });
test("a tester who is removed, or whose membership ends, is sent away on the next Play", async ({ page, browser }) => {   // Review Focus 2
  /* play once; the maker presses Remove; reload → /g/<slug>. A second tester: endMembershipOf(email) (slice 2, Task 21); reload → /g/<slug> */ });
test("a phone that opens a computer-only game's beta address is sent to its page", async ({ page, browser }, testInfo) => {   // Review Focus 9
  /* phone project only */ });
test("beta play sends beats like any play", async ({ page, browser }) => {
  /* page.clock.install; open the beta; click "Tap" in the frame; page.clock.runFor(16_000); poll: one beat on a session whose basis is beta */ });
```

  Push. Expected: `browser` fails in `beta-play.test.ts`: `?beta=1` is ignored, so the first case shows the release ("Tiny game", a `member` session) and the redirect cases stay on the play page.
- [ ] **Step 2 (green):** the route. Push. Expected: all pass, slice 2's `play.test.ts` and the wishlist's play cases included.

### Task 9: "Play the beta", under the game's own button

**Files:**
- Modify: `src/routes/+page.server.ts`, `src/routes/g/[game]/+page.server.ts`, `src/routes/[handle=handle]/+page.server.ts`, their `+page.svelte` files (one more prop each), `src/features/feed/Feed.svelte`, `src/features/pages/MakerPage.svelte`
- Test: `tests/browser/beta-play.test.ts` (add cases)

- Each of the three `load`s adds `betaSlugs: await gamesServices().beta.slugsFor(<the caller's user id, or null>)` to what it answers. Signed out, or a person who tests nothing, costs no membership query (Task 4).
- `Feed.svelte` and `MakerPage.svelte` take `betaSlugs: string[]` (default `[]`). For a game whose slug is in it, directly under that game's own button (the Wishlist form before launch, the Play link after), one link, and none at all for a clip whose `needsComputer` is true (a phone cannot play that beta either, before launch or after): `<a href="/g/<slug>/play?beta=1">Play the beta</a>`.
- Its styles live in the two components, as their other styles do: smaller than the game's own button and clearly second to it. In the feed: chalk text at 14px, weight 600, underlined, on the band, with a 48px tall target. On a maker's page: the page's own text colour, the same size and target. No new colour is written; both use the custom properties the component already has.
- Slice 3's feed case "Play is the only thing with words to press" checks buttons; this is a link, so it stands. The wishlist's button is a `<button>` in a form and the beta's is a link beside it; no case of theirs counts links.

Grandma: one extra link, with the word "beta" on it, only on games the person was picked for. It sits under the button they already know and is plainly the smaller of the two.

- [ ] **Step 1 (red):**

```ts
test("a tester sees Play the beta under the game's button, in the feed, at the game's address and on the maker's page", async ({ page, browser }, testInfo) => {
  const game = await addGame(browser);
  const { handle } = await makePage(game.makerEmail, { handle: freshHandle(), name: "Night Owl", themeId: THEMES[0]!.id });   // slice 3's helper, as its own journeys call it
  const member = await payAsNewMember(page);
  await addBeta(browser, game, { testers: [member.email] });
  await page.goto(`/g/${game.slug}`);
  const clip = clipOf(page, game.slug);
  const link = clip.getByRole("link", { name: "Play the beta" });
  await expect(link).toHaveAttribute("href", `/g/${game.slug}/play?beta=1`);
  expect((await boxOf(link)).height).toBeGreaterThanOrEqual(48);
  /* the link's top is at or below the bottom of the Play link in the same clip; then beforeLaunch(page.context()) and a reload:
     it is at or below the bottom of the button named Wishlist, and "Opens 30 November" is still there */
  await showTheOwner(page, testInfo, "Play the beta, in the feed");
  await page.goto(`/${handle}`);
  await expect(page.getByRole("article").filter({ hasText: game.name }).getByRole("link", { name: "Play the beta" })).toBeVisible();
  await showTheOwner(page, testInfo, "Play the beta, on a maker's page");
  await link.click();   /* from the feed again */
  await expect(page.frameLocator("iframe.frame").getByRole("heading", { name: "Tiny game beta" })).toBeVisible();
});
test("nobody else sees it", async ({ page, browser }) => {
  /* the same game: signed out; a member who was not picked; the tester after endMembershipOf; the tester after Remove; and the tester
     on another game in the same feed: no link named "Play the beta" in that clip, on / , /g/<slug> and /<handle> */ });
test("a waiting beta shows no button to its testers", async ({ page, browser }) => {});
test("a long game name and the extra link do not push the feed sideways on a phone", async ({ page, browser }) => { /* scrollWidth equals clientWidth */ });
```

  Push. Expected: `browser` fails in the new cases (no link named "Play the beta"); "nobody else sees it" passes already, and the report line says so.
- [ ] **Step 2 (green):** the three `load`s and the two components. Push. Expected: all pass.
- [ ] **Step 3:** send the coordinator the green run and one line each for "Play the beta, in the feed" and "Play the beta, on a maker's page", phone and computer. Mark the branch ready after the Owner's "fine". After two rounds without "fine", stop.
- [ ] **Step 4, the real site** (the Owner's, once games can be played there and with Stripe still in test mode): with two test accounts, one a maker with a live game and one a member, the maker pulls a beta and adds the member; the Owner accepts it; the member sees "Play the beta" and plays; a third account does not see it. Write what was seen in `docs/superpowers/progress.md`.

---

# Branch D: `beta/numbers`

Needs branch A, and the wishlist plan's branch C (`wishlist/numbers`: `playNumbers`, `makerNumberLines`, the numbers on `/make/<game>`) on `main`.

### Task 10: The beta's own line in a maker's numbers

**Files:**
- Modify: `src/features/play/sessions.ts`, `src/features/make/numbers.ts`, `src/features/make/make.ts`, `src/routes/make/[game]/+page.server.ts`, `+page.svelte`
- Test: `tests/features/play/sessions.pg.test.ts` (add a case), `tests/features/make/numbers.test.ts` (add cases), `tests/browser/beta-maker.test.ts` (add a case)

- `playNumbers(gameId: string, since: Date, bases: readonly PlayBasis[] = ["member", "free_game"]): Promise<{ plays: number; minutes: number }>` in `src/features/play/sessions.ts` (wishlist plan, Task 7): the third argument is new, and with it left out every caller means what it meant. The query takes the list as a parameter; nothing else about it changes.
- `betaNumberLines(input: { plays: number; minutes: number }): string[]` in `src/features/make/numbers.ts`, re-exported by `make.ts`: the wishlist plan's own plays and minutes lines (`makerNumberLines` with `open: true` and no wishlists), each with "Beta: " in front and its first letter in lower case:

  ```
  Beta: played 40 times in the last 7 days
  Beta: 90 minutes played in the last 7 days
  ```

  and, from the same source, "Beta: played 1 time in the last 7 days", "Beta: less than a minute played in the last 7 days", and the one line "Beta: no plays in the last 7 days".
- `load` of `/make/<game>`: for a live game with a beta branch named, `playNumbers(game.id, new Date(systemClock.epochMs() - PLAYED_FOR_MS), ["beta"])` (the real clock, as the wishlist plan's own call: beats are stamped with it), before launch and after: a beta is played before launch. The lines go right after the game's own numbers, as ordinary text.
- Beta play has no maker's-own or staff play to leave out: a `beta` session is always a picked member's.

- [ ] **Step 1 (red):** `sessions.pg.test.ts`, with `TestClock`: a game with two `member` sessions and three `beta` sessions that each have an attentive beat in the last seven days, and one `beta` session eight days ago: `playNumbers(id, since)` answers 2 plays, `playNumbers(id, since, ["beta"])` answers 3, and the minutes follow the same split (Review Focus 10). `tests/features/make/numbers.test.ts`: one case per line above. `beta-maker.test.ts`: after a tester has played the beta and touched it once (the steps of Task 8's beat case; if branch C is not on `main` yet, the session and its beat are written through `tests/browser/support/database.ts`, and the report line says so), the maker's page shows "Beta: played 1 time in the last 7 days" and the game's own plays line reads "No plays in the last 7 days"; a live game with no beta branch shows no line that starts "Beta:". Stubs. Push. Expected: `verify` fails in `numbers.test.ts`, `postgres` in the new case (the third argument is ignored), `browser` in the new case.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Send the coordinator the run and one line for "a maker's numbers, with a beta"; mark the branch ready after "fine".

---

# Branch E: `beta/old-files`

Needs branch A, and slice 4's branch L (`sweepOldPulls`) on `main`.

### Task 11: The sweep and a beta's files

**Files:**
- Modify: `src/features/play/sweep.ts`
- Test: `tests/features/play/sweep.pg.test.ts` (add cases)

- Slice 4's sweep deletes a pull's files when the pull is not its game's `livePullId` or `pendingPullId`, is not its game's newest pull, and no pass for it is still running. Two changes to that one query, each with its line of why:
  - a pull that is its game's `betaPullId` or `betaPendingPullId` is never swept: testers are playing it, or staff are about to;
  - "its game's newest pull" becomes "its game's newest **release** pull": that rule keeps the files a maker can still send for review, and a beta is sent in the press that pulls it, so a beta pull that is neither accepted nor waiting has no further use.
- Nothing else changes: twenty pulls a run, files first and the `PullCleanup` row after, the wait for running passes.

- [ ] **Step 1 (red):** with `TestClock` and `MemoryFileStore`:

```ts
it("never touches an accepted beta's files, or a waiting one's", async () => { /* a week later, every file of both is there */ });
it("deletes a beta's files once a newer beta is accepted and its testers' passes have run out", async () => {
  /* B1 accepted, a tester's pass for it; B2 accepted. At once: nothing. 24 hours and a second later: B1's files are gone, B2's and the release's are all there */ });
it("deletes a beta that was sent back, and one that was replaced while waiting", async () => {});
it("still keeps the release's newest pull when a beta pull is newer", async () => { /* a sent-back release pull R2, then a beta pull: R2's files stay */ });
```

  Push. Expected: `postgres` fails in the first and third cases (an accepted beta that is not the newest pull is swept; a sent-back beta that is the newest pull is kept).
- [ ] **Step 2 (green):** the query. Push. Expected: all pass. Branch E is ready to merge.

---

## Notes for the plans that follow

- **Slice 4.** `takeDown` (Task 10) clears `betaPullId`, `betaPendingPullId`, `betaPendingSince` and `betaReason` in its transaction, as `takeOff` does here (Task 3); `Game_beta_check` refuses one that does not. A suspended account that is a tester is not handled here: slice 4's Task 18 decides what a suspended account may play, and a beta follows the release.
- **Slice 5.** Nothing to do: the roll-up reads `member` sessions only, and beta play is `beta`. A member who plays only a beta in a month "played nothing" for the pool, as the design's rule for that case already says.
- **Worth the Owner's eye, left out on purpose:**
  - A pass already handed out lasts up to a day. A tester who is removed, or a beta that is replaced, keeps loading that beta's files until their pass runs out; a new Play is refused at once. It is the same as a membership that ends (slice 2's note); ending passes early is one item on slice 2's list.
  - A maker can learn whether an email address is a paying member by trying to add it (Found 8).
  - Nothing ends a beta but removing its testers, a newer beta, or the game leaving Ruken (Q2).
  - Nothing tells a tester they were picked; the maker does (design).
  - Staff's "Played so far" on the release's review page (slice 2, `playSummary`) counts every session of the game, beta ones included. It is a staff check, not a number a maker or the pool sees.
  - A beta's tester list has no limit (design: "Added later if it is ever needed").
