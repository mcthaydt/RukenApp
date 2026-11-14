# Slice 4: Submitting and the Admin Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff have one portal where they accept games, take them down, read reports and act on them, with an authenticator code and a second owner behind the actions that need them; and a new maker is walked from a short address to a first game in three steps.

**Architecture:** One new feature, `moderation` (reports), and more of `admin` (the portal's screens, the mails to a maker, the guards). The authenticator code, staff roles, the record of staff actions and suspension live in `accounts`, the lowest feature, so every feature above can read them. Taking a game down and marking it free are added to slice 2's games service; taking a page down is added to slice 3's pages service. The maker's three steps are three small routes under `/make/start` that call slice 3's and slice 2's own services and components; no screen is built twice.

**Tech Stack:** as slices 1 to 3 (Node 24.22.1, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0, Postgres 16, Vitest 5.0.3, Playwright 1.63.0, Cloudflare Workers, Resend through slice 1's `Mailer`). The authenticator code is checked by one small file carried from the old repository, with `node:crypto` (already used by `play/pass.ts`) and `symmetricEncrypt`/`symmetricDecrypt` from `better-auth/crypto` (better-auth 1.7.7, already installed). **No new package.**

**Spec:** `docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md` (sections 5.1 and 5.3 "report", 5.4, 5.5 without Money, 5.7 "A new maker", 5.8, 7.1, 7.2, 8, 9, 10). Read it with `CLAUDE.md`, `AGENTS.md`, slice 1's plan ("How a task runs", "The look", Tasks 4, 20), slice 2's plan ("The Owner's decisions … and the Calls", Tasks 26 to 31, "Notes for the plans that follow"), slice 3's plan (Tasks 4, 5, 7, 13, 22, 24, 25, "Notes for the plans that follow") and slice 5's plan (`docs/superpowers/plans/2026-11-14-slice-5-money.md`, on `plan/slice-5` until it merges: "What this slice needs and no plan provides yet", Tasks 32 and 33).

**Planned against:** `main` at `527bca3` (slice 1 merged; slice 2's branches A to D and its first-owner command merged; slice 3's plan merged, none of its code), plus what slice 2's and slice 3's plans say their later branches will produce. `src/features/admin/`, `src/features/make/`, `src/features/pages/` and `src/features/feed/` could not be read as code. "What this plan relies on", below, names each piece; if one is not on `main` as named when its task starts, stop and report. The old repository (`mcthaydt/RukenAppFailed`, archived) was read for the carried file and its neighbours; `OLD/` below means its top folder.

## Global Constraints

- No session runs tests, lint or typecheck itself. Push, then read CI on the pull request (CLAUDE.md, Owner 2026-11-13).
- Every task is test-first, in two pushes, exactly as slice 1's "How a task runs" says: red (the test and stubs that throw `not built yet`), then green. A pull request is opened as a draft at the first push and marked ready only when its branch's last task is green.
- No new dependency. Anything that seems to need one is a stop: report it with the exact name and version, for the Owner's yes.
- `.github/workflows/ci.yml` does not change in this slice.
- This repository is public. No secret, real address or key goes in: no staff member's email, no authenticator key. Test values are plainly fake. No strategy, research or reason behind a business decision goes in any file, comment, commit or pull request.
- Not built in this slice: the money screens of the portal, the second person on a payout and connecting the bank (slice 5; this slice gives it the code check and the roles it asks for); like, save, follow (a later spec); sign in with Google (after launch). No button, table or column is made for any of them (CLAUDE.md: build nothing ahead of its user).
- **A person always decides** (design 5.5). Nothing in this slice accepts, sends back, takes down or suspends by itself; code only checks what code can know.
- **Every staff action is recorded by the system** (design 5.5): who, what, when, about whom or what, and the reason. The rows are only ever added (`StaffAction`, and slice 2's `GameReview`). No screen has a field for who or when.
- Nobody types a fact. A queue's counts and a report's age are read from rows; no form has a field for an amount or a count.
- Time comes from an injected `Clock`. Feature code never calls `Date.now()` or `new Date()` with no argument. An authenticator code is checked against the clock that is passed in.
- Layers, lowest first (already in `FEATURE_ORDER`): `accounts`, `membership`, `games`, `play`, `money`, `pages`, `feed`, `make`, `moderation`, `admin`. A feature imports only from features below it. A route, a component and `src/params/` reach a feature's browser code only through `<feature>.browser.ts` and its server code only through `<feature>.ts`. Tests live only in `tests/`, mirroring `src/`.
- A staff page answers 404, never "forbidden", to anyone who may not open it, so its address looks like any address the site does not have (slice 2, Task 30).
- Comments say why, never which plan asked. A carried file loses its old-plan references and keeps the reason.
- Every screen and message passes the drunk grandma test. The words in this plan are the words to ship; a change to them is a deviation to report.
- The look (design 5.8). Every screen in this slice is one of Ruken's own and wears the Card Table look from `src/lib/look.css` and only its classes: the Dictionary of Color Combinations palette as slice 1 set it, buttons with 12px corners, cards with 20px. No file under `src/routes/` gets a `<style>` block, a `style=` attribute or a colour of its own. **This slice adds no class and no colour.** Nothing here spends money, so nothing is Blue `pay` ("Continue to payment" stays its only use) and nothing is pip red (the one small mark on the paywall card stays its only use). A button that takes something down is the card's plain button or a `quiet` one, never a colour of its own. The one screen outside the look is the feed, which gains one mark (Task 16) in its own component.
- Every journey file starts with `test.beforeEach(forgetRateLimits)`. Every new or changed screen is attached with `showTheOwner(page, testInfo, "<screen>")`, which gives the Owner a phone and a computer screenshot named `look: <screen>`. For a screen that existed before (the feed, a maker's page, `/make`, `/make/<game>`, `/admin/games`, `/admin/games/<game>`), the branch's report to the coordinator gives two runs: the last green run on `main` (before) and the branch's green run (after), with one line per screen saying what changed. The branch is marked ready only after the Owner's "fine". After two rounds without "fine", stop (CLAUDE.md, Pace). There are no pixel goldens.

## What this plan relies on

| Piece | From | Used for |
|---|---|---|
| `prisma()`, `Clock`, `TestClock`, `startTestDatabase()`, `requireEnv`, `reject_append_only_change('<Table>')` | slice 1 | every table, time and setting; the add-only tables |
| `Caller` (`{ kind: "user"; userId; sessionId; staffRoles }`, read fresh on every request), `locals.caller`, `signedInOnly`, `staffRolesOf`, `StaffAssignment`, `StaffRole` (`owner`, `curator`, `support`, `moderator`, `head_curator`, `finance`), `Session`, `authServices()`, `createHandle` | slice 1 | who is asking; the code is tied to a session |
| `Mailer`, `MailMessage`, `mailFailureCode`, `runAfterAnswer`, the account mails in `src/features/accounts/mails.ts` (their shape and tone), `createCaptureMailer` | slice 1 | the mails to a maker |
| `RateLimiter.hit(key, { max, windowMs })`, keys starting `api:` | slice 1, Task 4 | wrong codes, reports |
| `purgeDueAccounts` in `src/features/accounts/deletion.ts` ("each later slice that adds a person's data adds its own removal here, with a test") | slice 1, Task 20 | a deleted person's authenticator, suspension and reports |
| `safeNextPath`, `src/routes/+error.svelte`, `src/lib/look.css`, `CLASSES`, `CARD_SCREENS`, `expectOneCard`, `filledButtons`, `showTheOwner`, `forgetRateLimits`, `signUp`, `signUpInItsOwnContext` | slice 1 | the screens and the journeys |
| `grantFirstOwner`, `POST /jobs/first-owner`, `hasJobSecret` (on `main`) | slice 2, Task 29 | the first owner; this slice keeps it as it is |
| `GAME_STAFF_ROLES` in `src/features/accounts/staff.ts`; `staffOnly(caller)` in `src/features/admin/staff-only.ts`; `src/features/admin/admin.ts`; `/admin/games`, `/admin/games/<game>` with Accept and Send back | slice 2, Tasks 29, 30 | the portal's first queue, which this slice builds around |
| The games service: `accept`, `sendBack`, `waitingGames`, `gameForReview`, `gameForMaker`, `gamesOf`, `pullLatest`, `sendForReview`, `takeOff`, `putBack`, `liveGameBySlug`, `createGame`; `stateWords`; `GameError`; `Game.state` (`taken_down` is in the enum and nothing sets it), `Game.stateReason`, `Game.freeToPlay`; `GameReview`; `MakerAction`; `FileStore.deleteAll(prefix)` | slice 2, Tasks 11, 26, 31 | taking a game down, sending it again, marking it free, editing it |
| `/make`, `/make/new`, `/make/<game>` and the line "Come back here to see when it's live." | slice 2, Tasks 27, 28 | onboarding's step 3; the line this slice replaces |
| `submitGame`, `addGame`, `signInAsStaff`, `signInAs`, `grantStaffRole(email, role)`, `startGame`, `uploadClip` in `tests/browser/support/` | slice 2, Tasks 28, 30, 31 | the journeys |
| `MakerPage` (`userId`, `handle`, `name`, `oneLine`, `themeId`, `photoKey`), the pages service (`savePage`, `saveTheme`, `savePhoto`, `pageOf`, `pageByHandle`), `handleProblem`, `cleanHandle`, `RESERVED_HANDLES` and the test that ties it to `src/routes/`, `PageError`, `THEMES`, `ThemePicker.svelte`, `PHOTO_MAX_BYTES`, `/make/page` and its three neighbours | slice 3, Tasks 4, 5, 7, 20, 24, 25 | onboarding's steps 1 and 2; taking a page down |
| `Feed.svelte` (the right side under Share), `MakerPage.svelte` (its foot), `clipOf(page, slug)`, `makePage` | slice 3, Tasks 13, 14, 22 | where Report goes |
| `liveGames` and the feed service | slice 3, Tasks 9, 12 | a suspended maker's games leave the feed |

**What slice 4 adds to earlier slices' features:** to `accounts`, the authenticator, granting roles, `StaffAction` and suspension; to `games`, `takeDown`, `setFree`, `updateGame`, and `putBack` for a taken-down game; to `pages`, a page that is taken down. Nothing of theirs is changed in meaning. `staffOnly` gains a second, optional argument (Task 4).

**What other slices get from this one, by name:**

| Slice | Needs | Here |
|---|---|---|
| 5, Task 33 | "a function a form action calls with the request, which passes only when this staff session entered a code from its authenticator app within the last ten minutes, and otherwise sends the person to slice 4's code screen and back" | `freshCodeOnly(event: { locals: App.Locals; url: URL }): Promise<void>`, exported by `src/features/admin/admin.ts` (Task 4). It returns when this session entered a right code under ten minutes ago (`CODE_FRESH_MS`); otherwise it throws SvelteKit's `redirect(303, "/admin/code?next=<this page>")`, or to `/admin/authenticator?next=…` when the person has not set one up; signed out or not staff, `error(404)`. The code screen comes back to `next`. A form's post is not replayed: the person lands on the page they were on and presses the button again, and the code screen says so. |
| 5, Tasks 32, 33 | a finance role | `finance` is already in `StaffRole`. This slice makes it grantable, as "Money", on `/admin/staff` (Task 7). Slice 5 keeps its own `MONEY_STAFF_ROLES`; nothing here would use it. |
| 5, Task 32 | `staffOnly(caller, roles = GAME_STAFF_ROLES)` | Task 4 makes exactly this change, so slice 5 uses what is on `main` and adds nothing. |
| 5, Task 33 | two staff accounts, for the second person | An owner adds any account as staff on `/admin/staff` (Task 7). The portal's front says so until there are two owners, each with an authenticator (Task 6). |
| 2 | reports; the queue for submitted games | Slice 2 built the queue (`/admin/games`, Task 30). This slice does not build it again: it puts the portal around it and adds live games to it (Task 10). Reports are branches E, F and H. |
| 3 | onboarding wraps `/make/page`; Report on the feed and a page; a way for `pageByHandle` to answer nothing | branches I, F and G |

Slice 5's payout approval needs **branches A and B only**. They come first, need nothing of slice 3, and are four and three tasks.

## Found while planning

Read on 2026-11-14, on `main` at `527bca3` and in the old repository. Where the code and this plan disagree when execution reads it, stop and report.

1. **The old admin was a second app with its own sign-in.** `OLD/apps/admin` had its own better-auth, with better-auth's two-factor plugin, a code at every sign-in, recovery codes, sessions of 30 minutes idle and 12 hours in all, and `Session.stepUpAt` for "a fresh code". Design 7.1 has one app and one sign-in. What design 5.5 keeps of it is three rules: a role sets what someone may do; money actions need a second person and a fresh code; there are at least two superadmins. So what is carried is the one file that does not depend on that app, `OLD/apps/admin/src/lib/server/auth/totp-step.ts` (42 lines: which 30-second step a code belongs to, RFC 6238) with its test, and three of its rules as numbers: a code is accepted once; ten wrong codes in a row lock the codes for fifteen minutes; ten tries a minute. The rest of that app is not carried.
2. **The carried file keyed its HMAC with the key's text**, because better-auth's plugin does. Here the key is 20 random bytes and the HMAC is keyed with those bytes, which is what RFC 6238 and every authenticator app do. The file's test values do not change: RFC 6238's test key is the 20 bytes of the text `12345678901234567890`, whose base32 is `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ`.
3. **better-auth already has what encrypts the key.** `better-auth/crypto` exports `symmetricEncrypt({ key, data })` and `symmetricDecrypt({ key, data })` (read in `node_modules`, 1.7.7). The key is kept encrypted with `BETTER_AUTH_SECRET`, so this slice needs no new setting and the Owner types nothing.
4. **The old admin drew a QR picture with `uqr` 0.1.3.** That package is not in this repository's `package.json`. This plan draws no QR (question 1b).
5. **`main` has no `GAME_STAFF_ROLES` yet**: `src/features/accounts/staff.ts` holds `staffRolesOf` and `grantFirstOwner` only, and there is no `src/features/admin/`. Both arrive with slice 2's branch S, which branches A and B therefore need.
6. **Nothing on `main` reads `head_curator` or `support` apart** from the lists they are in. The staff screen offers the four roles something uses (Task 7).
7. **Slice 3's test of reserved words reads `src/routes/`**, so `/report` and `/suspended` fail it until they are listed. Tasks 15 and 17 list them. `admin` and `make` are already words Ruken uses.
8. **Not settled by reading:** whether `authServices()` hands out its `Mailer` (Task 8 says what to do if not); how slice 3's `Feed.svelte` lays out its right side (Task 16 places Report under Share, as design 5.1's sketch does, in whatever markup is there).

## The Owner's decisions, the open questions, and the Calls in this plan

- **Owner** (design 5.4, 5.5, 5.7, 8, 9, as approved): staff accept and moderate in an admin portal, and the admin rules stay; every clip and every maker's page has a Report button with a short list of reasons; staff can take down a game, take down a page or suspend an account, each with a reason that is recorded and sent to the maker; a new maker is walked through three steps, one screen each; two superadmin accounts with authenticator apps are the Owner's.
- **Owner, 2026-11-14**, relayed by the coordinator: "Start slice 4 plan now".
- **Asked of the coordinator on 2026-11-14.** Until the Owner answers, the working answer is the one marked; a task that depends on an answer says so.
  1. **How the authenticator code is checked.** (A) Our own small check: the carried file, one table, better-auth's encrypt and decrypt; sign-in is not touched. (B) better-auth's two-factor plugin, as the old admin used it: a second step in sign-in itself, recovery codes, its own tables, and changes to the carried sign-in forms. Working answer: A. Branch A.
  1b. **A QR picture on the set-up screen.** (A) None: the key as text to type, and a link that opens the authenticator app when the screen is on the phone itself. (B) Add `uqr` 0.1.3, which the old repository pinned, to draw one; a new dependency here, so the Owner's yes. Working answer: A. Task 5.
  2. **"usually within a day"** (design 5.7: shown only if staff can meet it). (A) The line ends at "when it's live." (B) It ends "usually within a day." Working answer: A. Task 9.
  3. **What suspending an account does** (design 5.5 names it and says no more). (A) It stops what others see and what the person can put up: their page and games leave Ruken and they cannot save a page, send a game or send a report; they can still sign in, play as a member, cancel and delete their account; staff can lift it. (B) They cannot sign in at all, and staff end a member's membership by hand at Stripe. Working answer: A. Task 18.
  4. **Changing a live game's clips through review, and deleting a game's old files from the bucket** (slice 2's notes left both here; the design asks for neither). (A) After launch. (B) One more branch here. Working answer: A; neither is in this plan.
- **Calls** (the Owner can overrule):
  - **One sign-in, and a code only where it guards something.** Staff sign in as everyone does. An authenticator code is asked for before changing who is staff (this slice) and before a money action (slice 5), and it is good for ten minutes in the session that entered it. Accepting a game, sending one back, taking something down and suspending do not ask for a code: they are not money actions (slice 2 made the same Call for Accept), each is recorded, and each can be undone. The old admin's short sessions and its code at every sign-in are not carried. Worth the Owner's eye.
  - **A code is accepted once, and wrong ones lock.** The 30-second step of the last right code is kept for each person, and a code whose step is not newer is refused like a wrong one, so a code read over a shoulder cannot be used again. Ten wrong codes in a row lock that person's codes for fifteen minutes. A code from the step before or after the current one is taken, so a phone's clock a little off still works.
  - **The first right code finishes the set-up** and counts as a fresh code. Until then the key can be shown again; after it, never.
  - **A lost phone.** Another owner presses "Reset authenticator" beside that person on `/admin/staff`, and the person sets up again. Nobody resets their own. This is one reason there are two owners. There are no recovery codes.
  - **Who may do what.** The staff screen offers four roles, in the words a person would say: Owner (`owner`: everything, and who is staff), Checks games (`curator`), Handles reports (`moderator`), Money (`finance`). `head_curator` and `support` stay in the enum, as carried, and keep what slice 2 gave them; nothing here offers them. Reports are opened by `MODERATION_STAFF_ROLES`, `owner` and `moderator`; games by slice 2's `GAME_STAFF_ROLES`; the staff screen by `owner` alone.
  - **Two owners.** An owner role cannot be removed if that would leave fewer than two owners. So the first owner cannot be removed until there are three, and two owners cannot remove each other. The portal's front tells owners, in one line, while there are fewer than two owners with an authenticator set up.
  - **`/jobs/first-owner` stays** as slice 2 built it: it works only while nobody is staff, and it is how the Owner's account becomes the first owner. Slice 2's note expected the old first-owner rule in its place; the old rule (`OLD/packages/core/src/identity/bootstrap-owner.ts`) does the same job from a command line on a server, which this site does not have.
  - **Taking a game down deletes its files**, as a maker's own taking off does (slice 2, Task 31), so every pass for it loads nothing more from that moment. The maker reads why, fixes it, and presses "Send it again", which pulls the files fresh and waits for a person's yes. Its clips stay.
  - **Free is set by staff who check games, with a reason**, on the game's staff page (design 5.2). It takes effect at once, both ways.
  - **The report reasons** (design 10): "It's sexual or adult", "It's hateful or bullying", "It's a scam or a harmful link", "It copies someone else's work", "It's broken or won't play" (a game only), "Something else" (which needs a line saying what). Anyone can report, with or without an account. Five reports an hour from one address. Who reported is kept only when they were signed in, and staff never see it on the queue.
  - **Report is its own small screen** (`/report`), reached by a mark on the clip and a link at the foot of a page, so it works with no script and the feed stays free of words (design 5.1: Play is the only button with words).
  - **A report is closed by a decision**: nothing to do, the game taken down, the page taken down, or the account suspended. A decision closes every open report about the same thing.
  - **A page that is taken down** is a missing page to everyone but its maker, who reads why on `/make/page`, changes it, and presses "I've fixed it. Look again.", which puts one line in the report queue. Staff put it back up from there.
  - **A suspended account's page and games are hidden, not deleted.** Lifting the suspension brings them back as they were. A pass already given for one of their games keeps loading its files until it runs out, at most a day; taking the game down as well stops that at once.
  - **The mails** are five, all to a maker, all plain text: your game is live; your game was sent back, and why; your game was taken down, and why; your page was taken down, and why; your account is suspended, and why. The first three are design 7.1's list; the last two are design 5.5's "a reason that is recorded and sent to the maker". Each is sent after the answer, and a failed send is logged by its code only (slice 1's rule).
  - **The three steps live at `/make/start`.** Someone with no page and no game who opens `/make` is sent there. Step 1 saves the page with the address as its name, so the page exists from the first step; step 2 offers the name, the one line, a photo and the colours on one screen, each of which can be left as it is; step 3 is slice 2's `/make/new`, with the "Step 3 of 3" line. "Skip for now" on step 2 goes to step 3. Anyone can leave the steps for `/make` at any time.
  - **"Free or taken" is said as the person types**, by a small address that answers for one name, asked half a second after the last key. With no script the Save button says the same thing.
  - **A game's name, one line and "Plays on" can be changed by its maker at any time**, live or not. They are words like a page's words: live when saved, and moderated through Report. The game's address does not change with its name, so a shared link keeps working.

## Where execution stops and waits for the Owner

There is no command for the Owner in this slice: no new setting, secret, bucket or address (the authenticator's key is kept under a secret the site already has). What the Owner does is done on the site's own screens, because that is the product. The stops are:

- **Questions 1 to 3**, before the task each names. Branch A's first push waits for question 1; nothing else in A or B waits.
- **"Fine" on the screenshots**, once per branch that has screens (A, B, C, D, F, G, H, I, J; each branch's last step).
- **The two owners**, when branch B is on `main` and deployed (Task 7, step 3). The Owner, signed in as the first owner (slice 2's G4): opens `/admin/authenticator` and sets up their authenticator app; has a second person sign up on the site; adds them on `/admin/staff` as Owner; that person sets up their own authenticator. Slice 5's payout approval can start after this.
- **FloorFifty free on launch day** (Task 23): one press on its staff page, with a reason.
- **The real site**, Task 23.

A stop holds only its own branch. Branches that do not need the answer go on.

## How a task runs

As slice 1's plan, word for word: two pushes (red with stubs, then green), the tracker ticked with both CI run numbers, one report line to the coordinator after each task, a draft pull request per branch, never ready while red, `main` merged in (never rebased) when it has moved. **Carrying a file** is as slice 2's plan says: copy it from `OLD/` to the new path, rewrite its imports, change only what the task lists, remove old-plan references from comments; its test is carried the same way.

**Where a branch runs.** A, C, E and G are logic with small screens and run in the cloud. B, D, F, H, I and J are screens: the coordinator chooses whether each runs in the cloud, judged from the screenshots, or as a local session on the Owner's computer (CLAUDE.md, "Where sessions run"). Either way every test runs in CI.

## Branches

Eleven branches. Each starts from `main` only after what it needs is merged and green; at most three pull requests are open at once.

| # | Branch | Tasks | Needs on `main` | Ends with |
|---|---|---|---|---|
| A | `slice-4/staff-security` | 1 to 4 | slice 1; slice 2's branch S | an authenticator can be set up, a code entered, and `freshCodeOnly` asked |
| B | `slice-4/staff-roles` | 5 to 7 | A | the portal's front; an owner adds and removes staff; two owners |
| C | `slice-4/maker-mails` | 8, 9 | slice 2's branches M and S | a maker is mailed when their game is live or sent back |
| D | `slice-4/take-down` | 10 to 12 | B, C | staff take a game down and mark one free; the maker sends it again |
| E | `slice-4/report-rules` | 13, 14 | slice 2; slice 3's branch B | the reports table, the reasons, the reports service |
| F | `slice-4/report` | 15, 16 | E; slice 3's branches D and H | Report on a clip and on a maker's page |
| G | `slice-4/standing` | 17, 18 | C, E; slice 3's branches B and C | a page can be taken down; an account can be suspended |
| H | `slice-4/reports-queue` | 19, 20 | B, D, E, G | `/admin/reports`: the queue and its decisions |
| I | `slice-4/first-steps` | 21 | slice 3's branch I; slice 2's branch M | the maker's three steps |
| J | `slice-4/edit-game` | 22 | slice 2's branch M | a maker changes a game's name, line and "Plays on" |
| K | `slice-4/real-site` | 23 | all of the above | design 8's lines for this slice, in journeys and on the real site |

A and B are first and are all slice 5 waits for. C, E, I and J use nothing of A or B and can run beside them. If the date presses, J is the branch that can move after launch without breaking a line of design 8; that is the Owner's choice, not this plan's.

## File map

```
prisma/schema/accounts.prisma            StaffAuthenticator, StaffCodeEntry (A); StaffAction (B); AccountSuspension (G)
prisma/schema/moderation.prisma          Report                                               (E)
prisma/schema/pages.prisma               MakerPage gains takenDownAt, takenDownReason         (G)
src/lib/totp.ts                          which 30-second step a code belongs to; base32; the app link (A, carried)
src/features/accounts/
  authenticator.ts       start, enter a code, is a code fresh; the lock; a code is used once  (A)
  staff.ts               gains grantRole, removeRole, staffList, resetAuthenticator, the two-owners rule (B)
  staff-actions.ts       recordStaffAction: the one way a staff action is written down        (B)
  suspension.ts          suspend, liftSuspension, suspensionOf, suspendedAccounts             (G)
  handle.ts, caller.ts   the caller carries why they are suspended, if they are               (G)
  deletion.ts            the purge removes a person's authenticator and suspension            (A, G)
src/features/games/service.ts            gains takeDown, setFree, liveGamesForStaff, updateGame; putBack takes a taken-down game (D, J)
src/features/pages/service.ts            gains takePageDown, putPageUp; pageByHandle hides a taken-down or suspended page (G)
src/features/moderation/
  moderation.ts          entry
  reasons.ts             REPORT_REASONS, reasonWords, reasonsFor
  service.ts             sendReport, openReports, reportForStaff, decide
  services.ts            built once
src/features/admin/
  admin.ts               entry: staffOnly, freshCodeOnly, the mails, the role lists and words
  staff-only.ts          staffOnly(caller, roles = GAME_STAFF_ROLES)                           (A)
  fresh-code.ts          freshCodeOnly(event)                                                  (A)
  roles.ts               OFFERED_ROLES and their words; MODERATION_STAFF_ROLES                 (B, H)
  maker-mails.ts         the five mails' words; tellMaker                                      (C, D, G)
  age.ts                 agoWords: "2 hours ago"                                               (H)
src/routes/
  admin/+page.server.ts, +page.svelte                 the portal's front                      (B)
  admin/authenticator/, admin/code/                   set up; enter a code                    (A)
  admin/staff/                                        who is staff                            (B)
  admin/games/, admin/games/[game]/                   gain live games, Take it down, Free     (D)
  admin/reports/, admin/reports/[report]/, admin/suspended/                                   (H)
  report/+page.server.ts, +page.svelte                Report                                  (F)
  suspended/+page.server.ts, +page.svelte             what a suspended person sees            (G)
  make/start/, make/start/page/, make/start/free/+server.ts   the three steps                 (I)
  make/+page.server.ts                                sends a brand-new maker to the steps    (I)
  make/new/+page.svelte                               the "Step 3 of 3" line                  (I)
  make/[game]/+page.server.ts, +page.svelte           the mail line; "Send it again"          (C, D)
  make/[game]/edit/                                   name, one line, Plays on                (J)
  make/page/+page.server.ts, +page.svelte             a taken-down page says why              (G)
src/features/feed/Feed.svelte, src/features/pages/MakerPage.svelte    gain Report            (F)
src/hooks.server.ts                                   the suspended step                      (G)
tests/support/totp.ts                    codeAt(key, ms): a code for a test
tests/browser/support/staff.ts           setUpAuthenticator, giveFreshCode, signInAsOwner
tests/features/accounts/…  tests/features/moderation/…  tests/features/admin/…  tests/lib/totp.test.ts   mirror src/
tests/browser/authenticator.test.ts, staff.test.ts, maker-mails.test.ts, take-down.test.ts, report.test.ts,
  standing.test.ts, reports-queue.test.ts, first-steps.test.ts, edit-game.test.ts, submit-and-moderate.test.ts;
  accept.test.ts, make.test.ts, feed.test.ts, maker-page.test.ts and edit-page.test.ts gain cases
```

## Review Focus

Each line names an input the design implies and no ordinary test would meet. Each has its test in the task named.

1. A right authenticator code typed twice, or the same code sent by two requests at the same moment: the first is taken and the second is refused like a wrong code (Task 3).
2. A code entered ten minutes ago to the second, in this session; and a fresh code entered in another session of the same person: neither passes `freshCodeOnly` (Tasks 3, 4).
3. Ten wrong codes in a row, then the right one: refused until fifteen minutes have passed, and the eleventh wrong code after the lock ends does not lock again by itself (Task 3).
4. Someone signed in with no staff role, or signed out, asks for `/admin/code`, `/admin/authenticator`, `/admin/staff` or any queue: 404, and no key is made for them (Tasks 4, 6, 7).
5. `/admin/code?next=https://elsewhere.example` or `next=//elsewhere.example`: after a right code the person lands on `/admin`, never off the site (Task 4).
6. Two owners each remove the other at the same moment; an owner removes their own role: two owners are left every time (Task 5).
7. An owner posts "Add" or "Remove" by hand with a code that is eleven minutes old: sent to the code screen, and nothing changes (Task 7).
8. A maker whose account was deleted while their game waited: Accept still works, no mail is sent, and nothing reads "Something went wrong" (Task 9).
9. A reason of 2,000 characters, or one that holds `<script>`: refused over 500; shown and mailed as plain text, never as markup (Tasks 8, 10).
10. A game taken down while a member is playing it: the next file the game asks for answers 404, with a pass that is still good (Task 10).
11. A maker presses "Send it again" on a taken-down game while suspended, or on someone else's game: refused, and the game is not waiting (Tasks 11, 18).
12. A report with a made-up reason, a reason that belongs to games sent for a page, a slug that is not live, or a handle nobody has: refused in words or a missing page, and no row is made (Tasks 14, 15).
13. The sixth report in an hour from one address: told to wait, in words, and no row is made; the same signed-in person reporting the same game twice: one row (Task 14).
14. Two staff decide the same report at the same moment: one decision is recorded, the other is told it was already decided, and the game is taken down once (Task 19).
15. A suspended person posts straight to `/make/page`, `/make/new` or `/report` without opening the screen: sent to `/suspended`, and nothing is saved (Task 18).
16. A suspended maker's game by its own link (`/g/<game>`, `/g/<game>/play`) and their page by its address: missing pages; lifted, they are back as they were (Task 18).
17. A new maker types an address that is taken, reserved, or too short, with and without script: told at once in the same words, and step 2 is not reached (Task 21).
18. A maker leaves the steps half way and comes back a day later: `/make` takes them to the first step they have not done, never back to step 1 with their address gone (Task 21).

---

# Branch A: `slice-4/staff-security`

Needs slice 2's branch S. Small on purpose: slice 5's payout approval waits for this branch and the next. **Its first push waits for the Owner's answer to question 1.** If the answer is B, stop and report: Tasks 1 to 3 change shape.

### Task 1: Which code is right (`src/lib/totp.ts`)

**Files:**
- Create: `src/lib/totp.ts`, `tests/lib/totp.test.ts`, `tests/support/totp.ts`

Carried from `OLD/apps/admin/src/lib/server/auth/totp-step.ts` and `totp-step.test.ts`. Changes: the key is a `Uint8Array` of the key's own bytes, not text ("Found while planning", 2); `codeForStep` is exported; the comments about better-auth's plugin go, the reasons stay. It sits in `src/lib/` because it is arithmetic with no feature logic.

**Interfaces:**
- Produces:
  - `TOTP_STEP_MS = 30_000`
  - `codeForStep(key: Uint8Array, step: number): string`: six digits, HMAC-SHA-1 of the step as eight big-endian bytes (RFC 4226 §5.3).
  - `acceptedTotpStep(key: Uint8Array, code: string, nowMs: number): number | null`: the step whose code this is, among the current step and the one either side; every candidate compared in constant time, none skipped; the later step when two share a code; `null` for anything that is not six digits.
  - `base32(bytes: Uint8Array): string` and `fromBase32(text: string): Uint8Array | null` (RFC 4648's alphabet, upper case, no padding; `fromBase32` takes lower case and spaces, and answers `null` for any other character).
  - `authenticatorLink(key: string, account: string): string`: `otpauth://totp/Ruken:<account>?secret=<key>&issuer=Ruken&algorithm=SHA1&digits=6&period=30`, the account URL-encoded.
  - `tests/support/totp.ts`: `codeAt(key: string, ms: number): string`, `codeForStep(fromBase32(key), floor(ms / 30000))`.

- [ ] **Step 1 (red):** the carried test, with the key as bytes:

```ts
const KEY = new TextEncoder().encode("12345678901234567890");        // RFC 6238, Appendix B
it("names the 30-second step whose code was entered (RFC 6238 test values)", () => {
  expect(acceptedTotpStep(KEY, "287082", 59_000)).toBe(1);
  expect(acceptedTotpStep(KEY, "081804", 1_111_111_109_000)).toBe(37_037_036);
  expect(acceptedTotpStep(KEY, "005924", 1_234_567_890_000)).toBe(41_152_263);
  expect(acceptedTotpStep(KEY, "279037", 2_000_000_000_000)).toBe(66_666_666);
});
it("accepts the step before and the step after, and no further", () => { /* "005924" at ±30 s: 41_152_263; at ±60 s: null */ });
it("is null for a wrong code, or one that is not six digits", () => { /* "000000", "28708", "2870822", "28708a" */ });
it("writes a key the way an authenticator app reads it", () => {
  expect(base32(KEY)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  expect(fromBase32("gezd gnbv gy3t qojq gezd gnbv gy3t qojq")).toEqual(KEY);
  expect(fromBase32("GEZD1")).toBeNull();                               // 1 is not in the alphabet
});
it("makes the link an authenticator app opens", () => {
  expect(authenticatorLink("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "a b@example.com"))
    .toBe("otpauth://totp/Ruken:a%20b%40example.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Ruken&algorithm=SHA1&digits=6&period=30");
});
```

  Stubs. Push. Expected: `verify` fails in `totp.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 2: The authenticator tables

**Files:**
- Create: `prisma/migrations/<timestamp>_staff_authenticator/migration.sql`
- Modify: `prisma/schema/accounts.prisma`
- Test: `tests/features/accounts/authenticator-schema.pg.test.ts`

| Model | Columns |
|---|---|
| `StaffAuthenticator` | `userId` the id (a `User`, `onDelete: Restrict`), `secret` (the key's base32 text, encrypted), `confirmedAt?`, `lastStep BigInt?` (the step of the last right code), `failures Int` default 0, `lockedUntil?`, `createdAt`, `updatedAt` |
| `StaffCodeEntry` | `sessionId` the id (a `Session`, `onDelete: Cascade`), `userId` (a `User`), `enteredAt`; one row a session, overwritten by each right code, gone with the session |

In the migration SQL, by hand: CHECK `StaffAuthenticator_failures_check` (`"failures" >= 0`). No add-only trigger: both rows change.

- [ ] **Step 1 (red):** the two tables exist; one authenticator a person; a negative count is refused; deleting a session deletes its entry. Push. Expected: `postgres` fails: the tables do not exist.
- [ ] **Step 2 (green):** the schema and the migration, made with `prisma migrate diff` from the schema on `main`, as slice 1's Task 21 did. Push. Expected: all pass, the drift test included.

### Task 3: Setting up, entering a code, and whether a code is fresh

**Files:**
- Create: `src/features/accounts/authenticator.ts`
- Modify: `src/features/accounts/accounts.ts`, `src/features/accounts/services.ts`, `src/features/accounts/deletion.ts`
- Test: `tests/features/accounts/authenticator.pg.test.ts`, `tests/features/accounts/purge.pg.test.ts` (one case)

**Interfaces:**
- Consumes: Task 1; `symmetricEncrypt`, `symmetricDecrypt` from `better-auth/crypto`.
- Produces, in `authenticator.ts`, re-exported by `accounts.ts`:
  - `CODE_FRESH_MS = 10 * 60_000`, `MAX_WRONG_CODES = 10`, `CODE_LOCK_MS = 15 * 60_000`
  - `interface AuthenticatorDeps { db: PrismaClient; clock: Clock; secret: string }` (`secret` is `BETTER_AUTH_SECRET`)
  - `type AuthenticatorState = "none" | "started" | "ready"`; `authenticatorState(deps, userId): Promise<AuthenticatorState>` (`ready` once `confirmedAt` is set)
  - `startAuthenticator(deps, input: { userId: string; email: string }): Promise<{ key: string; link: string } | "ready">`: with no row, makes 20 random bytes (`crypto.getRandomValues`), stores their base32 encrypted, and answers the key and its link; with an unconfirmed row, answers that row's key again; with a confirmed one, `"ready"` and no key.
  - `type CodeOutcome = "ok" | "wrong" | "locked" | "not_set"`; `enterCode(deps, input: { userId: string; sessionId: string; code: string }): Promise<CodeOutcome>`, in this order: no row, `not_set`; `lockedUntil` in the future, `locked`; a lock that has run out is cleared together with the count; spaces are taken out of the code; `acceptedTotpStep` answers `null`, the count rises by one in a statement that returns the new count, the tenth sets `lockedUntil` to now plus `CODE_LOCK_MS`, `wrong`; a step is claimed by one statement, `UPDATE "StaffAuthenticator" SET "lastStep" = <step>, "failures" = 0, "lockedUntil" = NULL, "confirmedAt" = COALESCE("confirmedAt", <now>) WHERE "userId" = <id> AND ("lastStep" IS NULL OR "lastStep" < <step>)`; no row changed, `wrong` (the code was used already, and the answer does not say so); else the session's `StaffCodeEntry` is written with `enteredAt` now, `ok`.
  - `hasFreshCode(deps, sessionId: string): Promise<boolean>`: this session has an entry and `0 <= now - enteredAt < CODE_FRESH_MS`.
  - `resetAuthenticatorRow(tx, userId): Promise<void>`: deletes the row and that person's entries (Task 5 calls it; the purge calls it).
- `authServices()` gains `authenticator`, the five functions bound to their deps, built once beside what is there.
- `purgeDueAccounts` removes the person's authenticator (`resetAuthenticatorRow`).

A comment beside the claim says why it is one statement: of two requests with the same code at the same moment, Postgres lets one change the row.

- [ ] **Step 1 (red):** `authenticator.pg.test.ts`, with a `TestClock` and `codeAt`:

```ts
it("is none, then started, then ready after the first right code", async () => {});
it("shows the same key again until it is confirmed, and never after", async () => {});
it("keeps the key encrypted", async () => { /* the row's secret is not the key and does not contain it */ });
it("takes a right code once", async () => { /* ok, then wrong for the same code */ });                         // Review Focus 1
it("lets one of two requests with the same code through", async () => { /* Promise.all: one ok, one wrong */ }); // Review Focus 1
it("takes the next step's code after this step's", async () => {});
it("locks after ten wrong codes, for fifteen minutes", async () => {
  /* ten wrong: the tenth and a right one after it are "locked"; clock +14:59, right: "locked"; +15:00, right: "ok" */ });  // Review Focus 3
it("starts counting again after a lock runs out", async () => { /* lock, wait it out, one wrong: "wrong", and a right one is "ok" */ });   // Review Focus 3
it("says a code is fresh for ten minutes, in the session that entered it", async () => {
  /* ok at t; +9:59 true; +10:00 false; another session of the same person: false */ });                    // Review Focus 2
it("answers not_set for someone with no authenticator, and is not fresh", async () => {});
```

  The purge case: a purged person has no authenticator row. Stubs. Push. Expected: `postgres` fails with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 4: The two screens, and `freshCodeOnly`

**Files:**
- Create: `src/features/admin/fresh-code.ts`, `src/routes/admin/authenticator/+page.server.ts`, `+page.svelte`, `src/routes/admin/code/+page.server.ts`, `+page.svelte`, `tests/browser/support/staff.ts`, `tests/browser/authenticator.test.ts`
- Modify: `src/features/admin/staff-only.ts`, `src/features/admin/admin.ts`, `src/features/accounts/staff.ts` and `accounts.ts` (`STAFF_ROLES`), `tests/browser/support/database.ts`
- Test: `tests/features/admin/staff-only.test.ts` (add cases), `tests/features/admin/fresh-code.pg.test.ts`, `tests/browser/authenticator.test.ts`

**Interfaces:**
- `STAFF_ROLES: readonly StaffRole[]`, all six, in `accounts/staff.ts`: "any staff at all".
- `staffOnly(caller: Caller, roles: readonly StaffRole[] = GAME_STAFF_ROLES): { userId: string; sessionId: string }`: as slice 2's, with the list to check as a second, optional argument, and the session's id in the answer. Every call slice 2 made still means what it meant.
- `freshCodeOnly(event: { locals: App.Locals; url: URL }): Promise<void>` in `fresh-code.ts`, re-exported by `admin.ts`: `staffOnly(caller, STAFF_ROLES)` (so 404 for anyone else); `authenticatorState` not `ready`, `redirect(303, "/admin/authenticator?next=<here>")`; `hasFreshCode` false, `redirect(303, "/admin/code?next=<here>")`; else it returns. `<here>` is `url.pathname + url.search`, URL-encoded.

**`/admin/authenticator`** (any staff), before it is set up:

```
Set up your authenticator

An authenticator is an app on your phone that shows a new 6-digit code every 30 seconds. Ruken asks for a code before anything that moves money or changes who is staff.

1. Open your authenticator app and add an account.
2. Choose to type a setup key, and type this one:

   GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ

   Reading this on your phone? Open it in your authenticator app

3. Type the code the app shows now.

Code
[        ]

[ Finish ]
```

- `load`: `startAuthenticator`. The key is shown in groups of four, in a `<code data-key="<the key, no spaces>">`; "Open it in your authenticator app" is a link to `authenticatorLink(key, <the person's email>)`. The page is sent with `cache-control: no-store`.
- Action `finish`: `enterCode`. `ok`: a 303 to `safeNextPath(next)`, or to `/admin/authenticator` with no `next`. `wrong`: `<p class="problem" role="alert">That code didn't work. Wait for a new one and try again.</p>`. `locked`: "Too many wrong codes. Try again in 15 minutes."
- Once it is set up, the screen is: the heading "Your authenticator is set up", the line "Ruken will ask for a code before anything that moves money or changes who is staff.", the `note` "Lost your phone? Ask another owner to reset it.", and a link, "Back to the staff pages", to `/admin`. No key, ever again.

**`/admin/code`** (any staff with an authenticator; without one, a 303 to `/admin/authenticator` with the same `next`):

```
Enter your code

Open your authenticator app and type the 6-digit code for Ruken.

Code
[        ]

[ Continue ]

If you were pressing a button, press it again after this.

Back
```

- The field: `name="code"`, `inputmode="numeric"`, `autocomplete="one-time-code"`, `maxlength="7"`, autofocused. Both screens' fields are the same.
- Action `enter`: at most 10 a minute a person (`hit("api:staff-code:<userId>", { max: 10, windowMs: 60_000 })`; over it, the locked words); `enterCode`; `ok`: a 303 to `safeNextPath(next)`, which is `/admin` for anything that is not a path on this site; the two refusals as above. "Back" is a link to the same checked `next`.

Grandma: each screen asks for one thing. The set-up is three numbered lines in the order a person does them. A wrong code says what to do next. The line under Continue says why the page they come back to looks as it did.

Look: `<main class="card">` on both; `h1`; the steps are an `<ol>` of ordinary text; the key is a `statement`; the hint is a `note`; the refusal is `problem`; Finish and Continue are each the card's one filled button; the rest are links. No new class, no red, no Blue.

**The journeys' helpers**, `tests/browser/support/staff.ts`: `signInAsOwner(page): Promise<{ email }>` (a sign-up in `page`, then `grantStaffRole(email, "owner")`); `setUpAuthenticator(page): Promise<{ key: string }>` (opens `/admin/authenticator`, reads `data-key`, types `codeAt(key, Date.now())`, presses Finish); `giveFreshCode(email): Promise<void>` in `tests/browser/support/database.ts` (writes a confirmed `StaffAuthenticator` if there is none and a `StaffCodeEntry` for each of that person's sessions, dated now). A code works once and the journeys do not wait thirty seconds for another, so only this file's journeys type real codes; every other journey that needs a fresh code uses `giveFreshCode`.

- [ ] **Step 1 (red):** `staff-only.test.ts`: with `["owner"]`, a curator is 404 and an owner passes; with `STAFF_ROLES`, a `support` role passes and a member with no role is 404; with no second argument, slice 2's cases as they were. `fresh-code.pg.test.ts`: signed out and no role, 404; staff with no authenticator, a redirect to `/admin/authenticator?next=%2Fadmin%2Fstaff`; staff with one and no entry, to `/admin/code?next=%2Fadmin%2Fstaff`; with an entry from this session nine minutes ago, it returns; from ten minutes ago, the redirect (Review Focus 2). `authenticator.test.ts`:

```ts
test.beforeEach(forgetRateLimits);
test("a staff member sets up their authenticator, then enters a code when asked", async ({ page }, testInfo) => {
  await signInAsOwner(page);
  await page.goto("/admin/authenticator");
  await expectOneCard(page); await showTheOwner(page, testInfo, "setting up an authenticator");
  const key = (await page.locator("[data-key]").getAttribute("data-key"))!;
  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("alert")).toHaveText("That code didn't work. Wait for a new one and try again.");
  await page.getByLabel("Code").fill(codeAt(key, Date.now()));
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("heading", { name: "Your authenticator is set up" })).toBeVisible();
  await expect(page.locator("[data-key]")).toHaveCount(0);
  await showTheOwner(page, testInfo, "an authenticator, set up");
  await page.goto("/admin/code?next=%2Fadmin%2Fauthenticator");
  await expectOneCard(page); await showTheOwner(page, testInfo, "entering a code");
  await page.getByLabel("Code").fill(codeAt(key, Date.now() + 30_000));           // the next step: this step's code was used
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/admin/authenticator");
});
test("the same code does not work twice", async ({ page }) => { /* set up; /admin/code with the code just used: the alert */ });   // Review Focus 1
test("a code never sends anyone off the site", async ({ page }) => {
  /* /admin/code?next=https://elsewhere.example and ?next=//elsewhere.example: after a right code, the address is /admin */ });   // Review Focus 5
test("neither screen is there for anyone else, and no key is made", async ({ page }) => {
  /* signed out and a plain member: 404 on both; no StaffAuthenticator row for the member */ });                                   // Review Focus 4
test("each card has one filled button", async ({ page }) => { /* filledButtons(page) has count 1 on both */ });
```

  Stubs. Push. Expected: `verify` fails in the new `staff-only.test.ts` cases, `postgres` in `fresh-code.pg.test.ts`, `browser` in `authenticator.test.ts` (404 at `/admin/authenticator` for an owner).
- [ ] **Step 2 (green):** the code. Push. Expected: all pass, slice 2's `accept.test.ts` included.
- [ ] **Step 3:** send the coordinator the green run and one line each for "setting up an authenticator", "an authenticator, set up" and "entering a code", and say that `freshCodeOnly` and `staffOnly(caller, roles)` are on the branch as slice 5's Tasks 32 and 33 name them. Mark the branch ready after "fine".

---

# Branch B: `slice-4/staff-roles`

Needs branch A. With it on `main`, slice 5 has everything it asked of this slice.

### Task 5: The record of staff actions, and the rules for roles

**Files:**
- Create: `prisma/migrations/<timestamp>_staff_actions/migration.sql`, `src/features/accounts/staff-actions.ts`
- Modify: `prisma/schema/accounts.prisma`, `src/features/accounts/staff.ts`, `src/features/accounts/accounts.ts`, `src/features/accounts/services.ts`
- Test: `tests/features/accounts/staff-actions.pg.test.ts`, `tests/features/accounts/staff.pg.test.ts` (add cases)

**The table:** `StaffAction`: `id`, `staffUserId` (a `User`), `kind StaffActionKind`, `subjectUserId?` (a `User`: who it was done to), `gameId?` (a `Game`), `reason?`, `detail?` (a role's name, for the two role kinds), `at`, `createdAt`; added and never changed (`reject_append_only_change('StaffAction')`); CHECK `StaffAction_reason_check` (a reason, when there is one, is 1 to 500 characters); index on `at`. `StaffActionKind` starts with `role_granted`, `role_removed`, `authenticator_reset`; each later task that records a new kind adds its value in its own migration. Accept and Send back keep their own record, slice 2's `GameReview`; nothing is written twice. Rows are kept when an account is purged: they are the record of what staff did.

**Interfaces:**
- `recordStaffAction(tx, clock, action: { staffUserId: string; kind: StaffActionKind; subjectUserId?: string; gameId?: string; reason?: string; detail?: string }): Promise<void>` in `staff-actions.ts`, re-exported by `accounts.ts`: the one way a row is written, always inside the transaction that does the thing, so there is never an action with no record or a record with no action.
- In `staff.ts`:
  - `class StaffError extends Error` with `code: "NO_ACCOUNT" | "TWO_OWNERS" | "NOT_YOURS"` and words a person can read.
  - `grantRole(deps, input: { staffUserId: string; email: string; role: StaffRole }): Promise<void>`: the address trimmed and in lower case; no active account, `StaffError("NO_ACCOUNT", "No account has that email. They sign up on the site first.")`; already has the role, nothing is added and nothing recorded; else one `StaffAssignment` and one `role_granted` row.
  - `removeRole(deps, input: { staffUserId: string; userId: string; role: StaffRole }): Promise<void>`: under the lock `grantFirstOwner` takes (`pg_advisory_xact_lock(hashtextextended('first-owner', 0))`), so two removals cannot both count two owners: removing `owner` when two or fewer accounts hold it, `StaffError("TWO_OWNERS", "Ruken needs two owners. Make someone else an owner first.")`; else the row is deleted and one `role_removed` row written. When it was the person's last role, their authenticator goes too (`resetAuthenticatorRow`).
  - `resetAuthenticator(deps, input: { staffUserId: string; userId: string }): Promise<void>`: your own, `StaffError("NOT_YOURS", "Ask another owner to reset yours.")`; else `resetAuthenticatorRow` and one `authenticator_reset` row.
  - `staffList(db): Promise<{ userId: string; email: string; roles: StaffRole[]; authenticator: AuthenticatorState }[]>`, by email.
  - `ownersReady(db): Promise<number>`: how many accounts hold `owner` and have a confirmed authenticator.
  - `deps` is `{ db: PrismaClient; clock: Clock }`.

- [ ] **Step 1 (red):** `staff-actions.pg.test.ts`: a row is written with the clock's time; an update and a delete are refused by the trigger; a reason of 501 characters is refused. `staff.pg.test.ts`: granting to an unknown address refuses with the words; granting twice leaves one role and one record; `Promise.all` of two owners removing each other leaves two owners and one refusal (Review Focus 6); an owner removing their own role with two owners is refused, with three it works; removing a last role removes the authenticator; resetting your own is refused; resetting another's makes them `none` and writes one row; `ownersReady` counts only owners whose authenticator is confirmed. Stubs. Push. Expected: `postgres` fails with "not built yet"; the table does not exist.
- [ ] **Step 2 (green):** the code and the migration. Push. Expected: all pass.

### Task 6: The portal's front (`/admin`)

**Files:**
- Create: `src/features/admin/roles.ts`, `src/routes/admin/+page.server.ts`, `+page.svelte`, `tests/browser/staff.test.ts`
- Modify: `src/features/admin/admin.ts`
- Test: `tests/features/admin/roles.test.ts`, `tests/browser/staff.test.ts`

- `roles.ts`, pure: `OFFERED_ROLES: readonly { role: StaffRole; name: string; does: string }[]` = Owner ("Everything, and who is staff"), Checks games (`curator`, "Accepts games, sends them back, takes them down"), Handles reports (`moderator`, "Reads reports and acts on them"), Money (`finance`, "Sees the money pages and approves payouts"); `roleWords(roles: readonly StaffRole[]): string`, the names of a person's roles joined with " · ", a role that is not offered shown by its own name with `_` as a space.

**The screen** (any staff; 404 for anyone else):

```
Staff pages

Games                    2 waiting
Who is staff
Your authenticator       Set up

Ruken needs two owners, each with an authenticator. Right now there is 1.
```

- Each line is a link; its `note` beside it is read from rows when the page is made. "Games" (to `/admin/games`, with `waitingGames().length` as "`<n>` waiting" or "Nothing waiting") shows for `GAME_STAFF_ROLES`; "Who is staff" (to `/admin/staff`) for `owner`; "Your authenticator" (to `/admin/authenticator`, "Set up" or "Not set up yet") for everyone. A line for a queue arrives with the branch that builds the queue (Task 20 adds "Reports" and "Suspended accounts"; slice 5 adds its own).
- The last line shows only to an owner, and only while `ownersReady` is under 2.
- `/admin/games` and `/admin/games/<game>` gain one link at the top, "Staff pages", to `/admin`.

Grandma: a short list of where to go, each with what is waiting there. A person sees only what they can open.

Look: `<main class="card">`; `h1`; a `<ul>` of `row`s, each a link and a `note`; the last line a `note`. No button at all on this card; no new class.

- [ ] **Step 1 (red):** `roles.test.ts`: the four names; `roleWords(["owner", "finance"])` is "Owner · Money"; `roleWords(["head_curator"])` is "head curator". `staff.test.ts`:

```ts
test.beforeEach(forgetRateLimits);
test("the staff pages show a person what they can open", async ({ page, browser }, testInfo) => {
  await signInAsOwner(page);
  await page.goto("/admin");
  await expectOneCard(page); await showTheOwner(page, testInfo, "the staff pages");
  for (const name of ["Games", "Who is staff", "Your authenticator"]) await expect(page.getByRole("link", { name })).toBeVisible();
  await expect(page.getByText("Not set up yet")).toBeVisible();
  /* a curator in another context: "Games" and "Your authenticator", and no "Who is staff" */
});
test("the staff pages are not there for anyone else", async ({ page }) => { /* signed out and a plain member: 404 */ });   // Review Focus 4
```

  Push. Expected: `verify` fails in `roles.test.ts`; `browser` fails with 404 at `/admin`.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 7: Who is staff (`/admin/staff`)

**Files:**
- Create: `src/routes/admin/staff/+page.server.ts`, `+page.svelte`
- Test: `tests/browser/staff.test.ts` (add cases)

**The screen** (`owner` only):

```
Who is staff

first@example.com
Owner · authenticator set up
  Remove Owner

second@example.com
Money · no authenticator yet
  Remove Money · Reset authenticator

Add someone

Their email
[                        ]
They need a Ruken account first.

( ) Owner: everything, and who is staff
( ) Checks games: accepts games, sends them back, takes them down
( ) Handles reports: reads reports and acts on them
( ) Money: sees the money pages and approves payouts

[ Add ]

Staff pages
```

- `load`: `staffOnly(caller, ["owner"])`, then `staffList`. Opening the screen needs no code.
- Three actions, `add`, `remove` and `reset`. Each starts with `staffOnly(caller, ["owner"])` and `await freshCodeOnly(event)`, then calls `grantRole`, `removeRole` or `resetAuthenticator`, and answers with a 303 back to `/admin/staff`. A `StaffError` shows its words in `problem` above "Add", with the email as typed. A role that is not one of `OFFERED_ROLES`, or no role picked: "Pick what they do."
- "Remove `<role name>`" is one small form a role; "Reset authenticator" shows for everyone but yourself, and only when theirs is `started` or `ready`. The second line of each person reads `roleWords` and one of "authenticator set up", "authenticator started", "no authenticator yet".
- To give someone a second role, add them again with it.

Grandma: who is staff, in the words for what they do; under it, one small form. A press that needs a code sends the person to the code screen, which says to press again.

Look: `<main class="card">`; each person is ordinary text with a `note` under it and `quiet` buttons; the roles are `choice` rows; "Add" is the card's one filled button. No new class.

- [ ] **Step 1 (red):**

```ts
test("an owner adds a second owner, who then appears with their role", async ({ page, browser }, testInfo) => {
  const owner = await signInAsOwner(page);
  const second = await signUpInItsOwnContext(browser);
  await giveFreshCode(owner.email);
  await page.goto("/admin/staff");
  await page.getByLabel("Their email").fill(second.email);
  await page.getByLabel(/^Owner/).check();
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(second.email)).toBeVisible();
  await expectOneCard(page); await showTheOwner(page, testInfo, "who is staff");
  expect(await staffRolesOfEmail(second.email)).toEqual(["owner"]);
});
test("adding someone asks for a code first, and changes nothing until it is entered", async ({ page, browser }) => {
  /* an owner with an authenticator and no fresh code presses Add: the address is /admin/code?next=%2Fadmin%2Fstaff, and the second account has no role.
     With a code dated eleven minutes ago in the database: the same */ });                                                    // Review Focus 7
test("an address with no account is refused in words, and stays typed", async ({ page }) => { /* "No account has that email. They sign up on the site first." */ });
test("the second-to-last owner cannot be removed", async ({ page, browser }) => { /* two owners; Remove Owner → "Ruken needs two owners. Make someone else an owner first." */ });
test("an owner resets someone's authenticator, and never their own", async ({ page, browser }) => { /* no "Reset authenticator" beside yourself; beside the other: afterwards "no authenticator yet" */ });
test("the front page says when Ruken has fewer than two owners with an authenticator", async ({ page }) => { /* "Right now there is 0." for a lone owner with none */ });
test("only an owner opens it", async ({ page }) => { /* a curator and a finance role: 404 */ });                              // Review Focus 4
```

  Push. Expected: `browser` fails in the new cases: 404 at `/admin/staff`.
- [ ] **Step 2 (green):** the route. Push. Expected: all pass.
- [ ] **Step 3:** send the coordinator the green run and one line each for "the staff pages" and "who is staff"; mark the branch ready after "fine". Then, once the branch is on `main` and deployed, the Owner's steps under "Where execution stops" ("The two owners"), and one line to the coordinator when both owners have an authenticator: slice 5's payout approval can start.

---

# Branch C: `slice-4/maker-mails`

Needs slice 2's branches M and S. Uses nothing of branches A and B.

### Task 8: The words of the mails, and sending one after the answer

**Files:**
- Create: `src/features/admin/maker-mails.ts`
- Modify: `src/features/admin/admin.ts`
- Test: `tests/features/admin/maker-mails.test.ts`

**Interfaces:**
- Produces, pure, each answering a `MailMessage` (slice 1's shape: `to`, `subject`, `text`), plain text only, in the tone of `src/features/accounts/mails.ts`. `site` is the site's own origin (`BETTER_AUTH_URL`, as the account mails use it), never written in the repository:
  - `gameLiveMessage(to, game: { name: string; slug: string }, site: string)`: subject "Your game is live on Ruken"; text "`<name>` is live on Ruken.", a blank line, "See it: `<site>`/g/`<slug>`", "Your games: `<site>`/make".
  - `gameSentBackMessage(to, game: { name; slug }, reason: string, site)`: subject "Your game needs a change"; "We looked at `<name>` and sent it back.", "What to fix: `<reason>`", "When it's fixed, send it again here: `<site>`/make/`<slug>`".
  - `tellMaker(deps: { mailer: Mailer; runInBackground: RunInBackground; log: (line: string) => void }, what: string, message: MailMessage | null): void`: with `null` it does nothing; else it sends after the answer and logs a failure as "`<what>` not sent: `<mailFailureCode(error)>`", never the error's own text (slice 1's `mailLater`, which a comment names as the reason).
- The reason is put in the text as it was typed, on its own line, and nothing in a mail is HTML, so markup in a reason is shown as the characters it is.
- The three other mails (taken down, page taken down, suspended) arrive in this file with the tasks that send them (10, 17, 18).

- [ ] **Step 1 (red):** one case a mail, asserting the subject and the whole text for a game named "Tiny game" at `https://ruken.test`; a reason holding `<script>alert(1)</script>` is in the text exactly as typed (Review Focus 9); `tellMaker` with a mailer that throws logs one line that holds the code and not the address; with `null` it sends nothing. Stubs. Push. Expected: `verify` fails with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 9: A maker is told when their game is live or sent back

**Files:**
- Modify: `src/routes/admin/games/[game]/+page.server.ts`, `src/routes/make/[game]/+page.svelte`, `src/features/games/service.ts` (`gameForReview` also answers the maker's `email` as `null` when the account is not `active`), `tests/browser/support/` (a way to read the journeys' sent mail, as slice 1's sign-up journeys read theirs)
- Test: `tests/browser/maker-mails.test.ts`, `tests/browser/make.test.ts` (the changed line), `tests/features/games/review.pg.test.ts` (one case)

- After `accept`, the action calls `tellMaker(…, "game live mail", email === null ? null : gameLiveMessage(…))`; after `sendBack`, the same with `gameSentBackMessage`. The mailer is the one `authServices()` builds; if it does not hand it out, `src/features/accounts/services.ts` gains the one line that does. The decision is already saved when the mail is tried, so a mail that fails never undoes it.
- On `/make/<game>`, the line under "Waiting for review" changes from "Come back here to see when it's live." to **"We'll email you when it's live."** (design 5.7; question 2's working answer. If the Owner answers B, the line is "We'll email you when it's live, usually within a day.").

Grandma: the mail says what happened in its subject, and its last line is where to go.

- [ ] **Step 1 (red):** `review.pg.test.ts`: `gameForReview` answers `email: null` for a maker whose account is `deleted`. `maker-mails.test.ts`:

```ts
test.beforeEach(forgetRateLimits);
test("a maker is mailed when their game is accepted", async ({ page, browser }) => {
  const waiting = await submitGame(browser);
  await signInAsStaff(page);
  await page.goto(`/admin/games/${waiting.slug}`);
  await page.getByRole("button", { name: "Accept" }).click();
  const mail = await lastMailTo(waiting.makerEmail);
  expect(mail.subject).toBe("Your game is live on Ruken");
  expect(mail.text).toContain(`/g/${waiting.slug}`);
});
test("a maker is mailed why their game was sent back", async ({ page, browser }) => { /* "The clip is sideways." is in the text; the subject is "Your game needs a change" */ });
test("accepting the game of a deleted maker still works, and mails nobody", async ({ page, browser }) => {
  /* set the maker's User.status to deleted in the database; Accept → /admin/games; no mail to that address */ });                // Review Focus 8
```

  `make.test.ts`: the waiting game's page reads "We'll email you when it's live." Push. Expected: `postgres` fails in the new case; `browser` fails: no mail arrives, and the old line is on the page.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch C is ready to merge after "fine" on "a game waiting for review" (before and after).

---

# Branch D: `slice-4/take-down`

Needs branches B and C.

### Task 10: Taking a game down, and marking one free

**Files:**
- Create: `prisma/migrations/<timestamp>_game_staff_actions/migration.sql` (`StaffActionKind` gains `game_taken_down`, `game_made_free`, `game_made_paid`)
- Modify: `prisma/schema/accounts.prisma`, `src/features/games/service.ts`, `src/features/games/games.ts`, `src/features/admin/maker-mails.ts`
- Test: `tests/features/games/take-down.pg.test.ts`, `tests/features/admin/maker-mails.test.ts` (one case)

**Interfaces**, added to the games service:
- `takeDown(gameId: string, staffUserId: string, reason: string): Promise<void>`: the reason is 1 to 500 characters after trimming, else `GameError("INVALID", "Say why, so the maker knows what to fix.")`; the game is `live`, else `GameError("NOT_READY", "This game isn't live.")`. In one transaction: state `taken_down`, `stateReason` the reason, `livePullId`, `pendingPullId` and `pendingSince` null, one `StaffAction` (`game_taken_down`, the game, the maker as subject, the reason). Then `deleteAll("files/<publicId>/")`, the database first, for the reason slice 2's `takeOff` gives. Its clips stay.
- `setFree(gameId: string, staffUserId: string, free: boolean, reason: string): Promise<void>`: the same rule for the reason ("Say why."); already as asked, nothing changes and nothing is recorded; else `freeToPlay` and one `StaffAction` (`game_made_free` or `game_made_paid`, the game, the reason).
- `liveGamesForStaff(): Promise<{ slug: string; name: string; makerEmail: string | null; free: boolean }[]>`, by name.
- `gameForReview(slug)` also answers `state`, `free`, `filesLeft` (as `gameForMaker` does for a game off Ruken) and `freeReason` (the reason on the newest `game_made_free` row, when the game is free).
- `gameTakenDownMessage(to, game: { name; slug }, reason, site)` in `maker-mails.ts`: subject "Your game was taken off Ruken"; "We took `<name>` off Ruken.", "Why: `<reason>`", "You can fix it and send it again here: `<site>`/make/`<slug>`", "We'll check it before it's live again."

- [ ] **Step 1 (red):** `take-down.pg.test.ts`: taking a live game down makes it `taken_down` with the reason, `liveGameBySlug` null, every key under `files/<publicId>/` gone and the clips kept, one `game_taken_down` row with the staff account, the maker and the clock's time; a reason of 501 characters and an empty one refuse and change nothing (Review Focus 9); a waiting game refuses with "This game isn't live."; a live game with an update pending loses the pending pull too; `setFree(true)` then `liveGameBySlug(…).freeToPlay` is true and one row holds the reason; `setFree(true)` again adds no row; `setFree(false)` writes `game_made_paid`; `liveGamesForStaff` lists live games only. The mail's case as Task 8's. Stubs. Push. Expected: `verify` and `postgres` fail with "not built yet".
- [ ] **Step 2 (green):** the code and the migration. Push. Expected: all pass.

### Task 11: The maker sends a taken-down game again

**Files:**
- Modify: `src/features/games/service.ts` (`putBack`), `src/routes/make/[game]/+page.server.ts`, `+page.svelte`
- Test: `tests/features/games/take-down.pg.test.ts` (add cases), `tests/browser/take-down.test.ts`

- `putBack` (slice 2, Task 31) also takes a game that is `taken_down`: one `MakerAction` (`put_back`), state `draft`, then `pullLatest` and `sendForReview`, exactly as for a game its maker took off. Someone else's game is `NOT_FOUND`, as before.
- On `/make/<game>`, a taken-down game reads "Taken down: `<reason>`" (slice 2's `stateWords`), and its one button is **"Send it again"**, with the `note` "Fix what the reason says in your repository first. We'll copy your game again and check it before it's live." and slice 2's "Copying your game can take a minute. Keep this page open." After it, "Waiting for review".

Grandma: the page says why in the maker's own state line, and the one button is the way back.

Look: as slice 2's "Put it back": the card's one plain `<button>`; the notes are `note`. No new class.

- [ ] **Step 1 (red):** `take-down.pg.test.ts`: `putBack` on a taken-down game pulls again, makes it `waiting` with a pending pull and **not** live, and writes one `put_back` row; another maker's taken-down game is `NOT_FOUND` (Review Focus 11). `take-down.test.ts` (the maker's side; the staff side is Task 12): a game taken down through the database helper reads "Taken down: The clip shows another game." and, after "Send it again", "Waiting for review", with `/g/<slug>` still 404. Attach "a game taken down, as its maker sees it". Push. Expected: `postgres` and `browser` fail: `putBack` refuses the state, and there is no "Send it again".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 12: Live games on the staff pages: Take it down, and Free to play

**Files:**
- Modify: `src/routes/admin/games/+page.server.ts`, `+page.svelte`, `src/routes/admin/games/[game]/+page.server.ts`, `+page.svelte`
- Test: `tests/browser/take-down.test.ts` (add cases), `tests/browser/accept.test.ts` (unchanged; it must still pass)

**`/admin/games`** gains a second list under the first:

```
Live games

Floor Fifty      maker@example.com      Free to play
Tiny game        maker@example.com
```

None: "No game is live yet." Each name links to the game's staff page.

**`/admin/games/<game>`**, for a live game with nothing waiting, shows what slice 2's page shows (the clips, the game in its frame, "Played so far") and, in place of Accept and Send back:

```
Free to play: no
Why it should be free   [                          ]   [ Make it free ]

Take it down, and say why   [                          ]   [ Take it down ]
```

- A free game reads "Free to play: yes. `<freeReason>`", and its button is "Make it paid again", with the same field.
- "Take it down" does not act at once. It shows, on the same address (a second form; no script needed), one card:

```
Take Tiny game down?

It leaves Ruken right away. Anyone playing it is stopped.
Its maker is emailed this reason: The clip shows another game.

[ Take it down ]      Keep it up
```

  "Keep it up" is a link back. The second press calls `takeDown`, then `tellMaker` with `gameTakenDownMessage`, then goes to `/admin/games`.
- A live game with an update waiting keeps slice 2's Accept and Send back for the update, and shows these two lines under them.
- A game that is `taken_down` shows its reason and, when `filesLeft`, one `quiet` button, "Delete the rest of its files" (`deleteAll` again), as slice 2's page does for a game taken off.
- Actions: `free`, `paid`, `confirm` (shows the card; refuses an empty reason with "Say why, so the maker knows what to fix."), `takeDown`, `deleteRest`. Each starts with `staffOnly(caller)`. None asks for a code (the Calls).

Grandma: two plain lines, each with its field beside its button. Taking down asks once more, and says in two lines what will happen and what the maker will read.

Look: the page stays slice 2's wide page; "Make it free" and "Take it down" are `quiet`; the confirm screen is `<main class="card">` with the question as its `h1` and "Take it down" its one plain `<button>`. Nothing red: taking down spends no money. No new class.

- [ ] **Step 1 (red):**

```ts
test("staff take a live game down, the maker is told why, and a member's game stops loading", async ({ page, browser }, testInfo) => {   // design 8; Review Focus 10
  const game = await addGame(browser);
  const member = await browser.newPage(); await payAsNewMember(member);
  await member.goto(`/g/${game.slug}/play`);
  const frameUrl = await member.locator("iframe.frame").getAttribute("src");
  await signInAsStaff(page);
  await page.goto("/admin/games");
  await showTheOwner(page, testInfo, "games, waiting and live");
  await page.getByRole("link", { name: game.name }).click();
  await showTheOwner(page, testInfo, "a live game, for staff");
  await page.getByLabel("Take it down, and say why").fill("The clip shows another game.");
  await page.getByRole("button", { name: "Take it down" }).click();
  await expect(page.getByRole("heading", { name: `Take ${game.name} down?` })).toBeVisible();
  await expectOneCard(page); await showTheOwner(page, testInfo, "taking a game down");
  await page.getByRole("button", { name: "Take it down" }).click();
  await expect(page).toHaveURL("/admin/games");
  expect((await page.goto(`/g/${game.slug}`))?.status()).toBe(404);
  expect((await page.goto(`${frameUrl}main.js`))?.status()).toBe(404);
  expect((await lastMailTo(game.makerEmail)).text).toContain("Why: The clip shows another game.");
});
test("taking down needs a reason, and Keep it up changes nothing", async ({ page, browser }) => {});
test("staff make a game free with a reason, and anyone can then play it", async ({ page, browser }) => {
  /* "Launch day." → "Free to play: yes. Launch day."; a signed-out page opens /g/<slug>/play and the frame loads; "Make it paid again" → the signed-out page meets /join */ });
test("a moderator and a plain member do not open a game's staff page", async ({ page }) => { /* 404 */ });
```

  Push. Expected: `browser` fails in the new cases: no "Live games", no field.
- [ ] **Step 2 (green):** the routes. Push. Expected: all pass.
- [ ] **Step 3:** send the coordinator the two runs (before: `main`; after: this branch) and one line each for "games, waiting and live", "a live game, for staff", "taking a game down" and "a game taken down, as its maker sees it". Mark the branch ready after "fine".

---

# Branch E: `slice-4/report-rules`

Needs slice 2 and slice 3's branch B. Uses nothing of branches A to D.

### Task 13: The reports table and the reasons

**Files:**
- Create: `prisma/schema/moderation.prisma`, `prisma/migrations/<timestamp>_reports/migration.sql`, `src/features/moderation/reasons.ts`, `src/features/moderation/moderation.ts`
- Modify: `prisma/schema/accounts.prisma`, `games.prisma` (relations)
- Test: `tests/features/moderation/schema.pg.test.ts`, `tests/features/moderation/reasons.test.ts`

**The table:** `Report`: `id`, `about ReportAbout { game, page }`, `gameId?` (a `Game`), `pageUserId?` (a `User`: the page's maker, so a report follows the page when its address changes), `reason ReportReason { adult, hateful, scam, copied, broken, other, look_again }`, `note?`, `reporterUserId?` (a `User`, `onDelete: SetNull`), `createdAt`, `decidedAt?`, `decidedByUserId?` (a `User`), `decision ReportDecision? { nothing, game_taken_down, page_taken_down, page_put_back, account_suspended }`; index on (`decidedAt`, `createdAt`). In the migration SQL, by hand: CHECK `Report_about_check` (a `game` report has a game and no page; a `page` report the other way); CHECK `Report_note_check` (500 characters at most); CHECK `Report_decided_check` (`decidedAt`, `decidedByUserId` and `decision` are all set or all null). A report is changed once, when it is decided, so it has no add-only trigger.

**Interfaces**, pure, in `reasons.ts`, re-exported by `moderation.ts`:
- `REPORT_REASONS: readonly { reason: ReportReason; words: string; about: readonly ReportAbout[] }[]`, in this order: `adult` "It's sexual or adult"; `hateful` "It's hateful or bullying"; `scam` "It's a scam or a harmful link"; `copied` "It copies someone else's work"; `broken` "It's broken or won't play" (a game only); `other` "Something else". `look_again` is not in the list: only a maker's own "Look again" makes one (Task 17).
- `reasonsFor(about: ReportAbout)`: the list for a game (six) or a page (five).
- `reasonWords(reason: ReportReason): string`: the words above, and "The maker asked for another look" for `look_again`.

- [ ] **Step 1 (red):** `schema.pg.test.ts`: the table exists; a game report with no game, and one with both a game and a page, are refused; a note of 501 characters is refused; a decision with no time is refused; deleting the reporter's `User` row leaves the report with no reporter. `reasons.test.ts`: six for a game, five for a page with no `broken`; every reason has words; none of the words ends in a full stop. Stubs. Push. Expected: `verify` fails with "not built yet"; `postgres`: the table does not exist.
- [ ] **Step 2 (green):** the schema, the migration and the list. Push. Expected: all pass.

### Task 14: The reports service

**Files:**
- Create: `src/features/moderation/service.ts`, `src/features/moderation/services.ts`
- Modify: `src/features/moderation/moderation.ts`, `src/features/accounts/deletion.ts` (the purge clears `reporterUserId` on the person's reports; the reports stay)
- Test: `tests/features/moderation/service.pg.test.ts`, `tests/features/accounts/purge.pg.test.ts` (one case)

**Interfaces:**
- `class ModerationError extends Error` with `code: "INVALID" | "NOT_FOUND" | "TOO_MANY" | "DECIDED"`.
- `sendReport(input: { about: ReportAbout; slug?: string; handle?: string; reason: string; note: string; reporterUserId: string | null; address: string }): Promise<void>`, in this order: a game that is not live (`liveGameBySlug`) or a page nobody has (`pageByHandle`), `NOT_FOUND`; a reason not in `reasonsFor(about)`, `INVALID` "Pick what's wrong."; the note trimmed, over 500 characters, `INVALID` "Keep it under 500 letters."; `other` with an empty note, `INVALID` "Tell us what's wrong."; then `hit("api:report:<address>", { max: 5, windowMs: 3_600_000 })`, refused, `TOO_MANY` "You've sent a lot of reports. Try again in an hour."; a signed-in person who already has an open report about the same thing, nothing more is written; else one row. The address is used for the limit and is not stored.
- `openReports(): Promise<{ id: string; about: ReportAbout; title: string; reasonWords: string; createdAt: Date }[]>`, oldest first; `title` is the game's name or the page's `@handle`.
- `reportForStaff(id: string): Promise<{ id; about; reason; reasonWords; note: string | null; createdAt: Date; decided: boolean; othersOpen: number; game: { id; slug; name; state } | null; page: { userId; handle; name; oneLine; takenDown: boolean } | null; makerUserId: string } | null>`: `othersOpen` is how many other open reports are about the same thing. It never answers who reported.
- `decide(input: { reportId: string; staffUserId: string; decision: ReportDecision }): Promise<void>`: in one statement, every open report about the same thing as this one gets the decision, the clock's time and the staff account, `WHERE "decidedAt" IS NULL`; when this report was already decided, `DECIDED` "Someone already decided this one." (Task 19 does the taking down; this only closes).
- `moderationServices()`: built once, as the other features build theirs.

- [ ] **Step 1 (red):** one case for each line of `sendReport` above, with its words (Review Focus 12); the sixth report in an hour from one address refuses with the words and writes no row, and a different address still gets through (Review Focus 13); the same signed-in person, the same game, twice: one row; signed out twice: two rows; `openReports` is oldest first and leaves out decided ones; `reportForStaff` counts the others and has no reporter in it; `decide` closes every open report about that game and none about another; a second `decide` on the same report refuses with `DECIDED`; `Promise.all` of two decisions: one resolves, one refuses (Review Focus 14). The purge case: a purged person's report stays, with no reporter. Stubs. Push. Expected: `postgres` fails with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch E is ready to merge.

---

# Branch F: `slice-4/report`

Needs branch E and slice 3's branches D and H.

### Task 15: The report screen (`/report`)

**Files:**
- Create: `src/routes/report/+page.server.ts`, `+page.svelte`, `tests/browser/report.test.ts`
- Modify: `src/features/pages/handle.ts` (`report` joins `RESERVED_HANDLES`), `tests/browser/support/look.ts` (`CARD_SCREENS`)
- Test: `tests/browser/report.test.ts`, `tests/features/pages/handle.test.ts` (its list)

`/report?game=<slug>` or `/report?page=<handle>`. No account is needed.

```
Report this game                      (or "Report this page")

Tiny game, by @night-owl              (or "@night-owl")

What's wrong?
( ) It's sexual or adult
( ) It's hateful or bullying
( ) It's a scam or a harmful link
( ) It copies someone else's work
( ) It's broken or won't play
( ) Something else

Anything to add?
[                                ]
You can leave this empty.

[ Send report ]

Back
```

- `load`: exactly one of `game` and `page`, naming a live game or a page that is there; anything else is the missing page. A game whose maker has no page reads the game's name alone.
- Action `send`: `sendReport`, with `getClientAddress()` and the caller's id or `null`. A `ModerationError` shows its words in `problem` above the button and keeps the choice and the note; `NOT_FOUND` is the missing page. Success shows, in the card's place:

```
Thanks. A person at Ruken will look at it.

Back to the game                      (or "Back to the page")
```

- "Back" and the last link go to `/g/<slug>` or `/<handle>`.

Grandma: one question, six plain answers, one button. The thanks says what happens next.

Look: `<main class="card">`; `h1`; the reasons are `choice` rows; the box is a `textarea` with a `note`; "Send report" is the card's one filled button. No new class.

- [ ] **Step 1 (red):**

```ts
test.beforeEach(forgetRateLimits);
test("anyone reports a game, with no account", async ({ page, browser }, testInfo) => {
  const game = await addGame(browser);
  await page.goto(`/report?game=${game.slug}`);
  await expectOneCard(page); await showTheOwner(page, testInfo, "reporting a game");
  await page.getByLabel("It's broken or won't play").check();
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Thanks. A person at Ruken will look at it.")).toBeVisible();
  await showTheOwner(page, testInfo, "a report, sent");
  expect(await openReportsAbout(game.slug)).toBe(1);                       // tests/browser/support/database.ts
});
test("a page's report has no 'broken' answer", async ({ page }) => { /* makePage; /report?page=<handle>: five radios */ });
test("Something else needs a line, and what was picked stays", async ({ page, browser }) => { /* "Tell us what's wrong." */ });
test("nothing to report: a missing page", async ({ page }) => {
  /* /report, /report?game=nope, /report?page=nobody, /report?game=a&page=b: 404; a posted reason "made-up": "Pick what's wrong." and no row */ });   // Review Focus 12
test("the sixth report in an hour is told to wait", async ({ page, browser }) => { /* "You've sent a lot of reports. Try again in an hour." */ });      // Review Focus 13
```

  Push. Expected: `verify` fails in `handle.test.ts` once the folder exists without the word; `browser` fails with 404 at `/report`.
- [ ] **Step 2 (green):** the route and the word. Push. Expected: all pass.

### Task 16: Report on a clip and on a maker's page

**Files:**
- Modify: `src/features/feed/Feed.svelte`, `src/features/pages/MakerPage.svelte`
- Test: `tests/browser/feed.test.ts`, `tests/browser/maker-page.test.ts` (one case each)

- **On a clip** (design 5.1's sketch: "⋯ report", at the right, under Share): a link whose accessible name is "Report", to `/report?game=<slug>`, drawn as three dots the way Share's mark is drawn (a plain line shape in the component, no icon file), 48px at least to press. It carries no words: Play stays the only button with words.
- **On a maker's page** (design 5.3's sketch: "report", at the foot): a small text link, "Report this page", to `/report?page=<handle>`, in the page's own text colour. A maker does not see it on their own page.

Grandma: on a page, the words say what the link does. On a clip, three dots under Share are where a person looks for "more", as on Reels.

Look: both are in their feature's own component, as slice 3 keeps the feed's and the page's styles. No colour is added: the mark takes the colour Share's has, and the link the page's text colour.

- [ ] **Step 1 (red):** `feed.test.ts`: in `clipOf(page, slug)`, a link named "Report" goes to `/report?game=<slug>`, its box is 48px or more each way, and the clip still has exactly one button or link with visible words, Play. `maker-page.test.ts`: a visitor sees "Report this page" going to `/report?page=<handle>`; its maker, signed in, does not. Attach "the feed, with report" and "a maker's page, with report". Push. Expected: `browser` fails in the two cases.
- [ ] **Step 2 (green):** the two components. Push. Expected: all pass.
- [ ] **Step 3:** send the coordinator the two runs (before: `main`; after: this branch) and one line each for "reporting a game", "a report, sent", "the feed, with report" and "a maker's page, with report". Mark the branch ready after "fine".

---

# Branch G: `slice-4/standing`

Needs branches C and E, and slice 3's branches B and C. **Task 18 waits for the Owner's answer to question 3**; if the answer is B, stop and report: its effects change.

### Task 17: A page that is taken down

**Files:**
- Create: `prisma/migrations/<timestamp>_page_taken_down/migration.sql` (`MakerPage` gains `takenDownAt?`, `takenDownReason?`; `StaffActionKind` gains `page_taken_down`, `page_put_back`)
- Modify: `prisma/schema/pages.prisma`, `accounts.prisma`, `src/features/pages/service.ts`, `pages.ts`, `src/features/moderation/service.ts` (`askToLookAgain`), `src/features/admin/maker-mails.ts`, `src/routes/make/page/+page.server.ts`, `+page.svelte`
- Test: `tests/features/pages/taken-down.pg.test.ts`, `tests/features/admin/maker-mails.test.ts` (one case), `tests/browser/standing.test.ts`

**Interfaces:**
- In the pages service: `takePageDown(userId: string, staffUserId: string, reason: string): Promise<void>` (the reason 1 to 500 characters, else `PageError("INVALID", "Say why, so the maker knows what to fix.")`; no page, `NOT_FOUND`; sets the two columns and writes one `page_taken_down` row); `putPageUp(userId: string, staffUserId: string): Promise<void>` (clears them; one `page_put_back` row). `pageByHandle` answers `null` for a taken-down page, so `/<handle>` is the missing page and `/<handle>/out/<link>` counts nothing. `pageOf` (the maker's own view) also answers `takenDownReason`. The address stays the maker's; nobody else can take it.
- In the moderation service: `askToLookAgain(makerUserId: string): Promise<void>`: one `Report` about the maker's page with the reason `look_again` and the maker as reporter, unless one is already open.
- `pageTakenDownMessage(to, page: { handle: string }, reason, site)`: subject "Your page was taken off Ruken"; "We took your page (`<site>`/`<handle>`) off Ruken.", "Why: `<reason>`", "Change it here, then ask us to look again: `<site>`/make/page".

**On `/make/page`**, a taken-down page shows at the top of the card, above the fields:

```
Your page is off Ruken: Your links go to a scam site.
Change it, save, then ask us to look again.

[ I've fixed it. Look again. ]
```

After the press, the second line reads "We'll look again. You'll get an email if it's back." and the button is gone until the page is decided. The maker can still save every field.

Grandma: why, what to do, and one button, in that order.

Look: the first line is a `problem`; the button is `quiet`, so Save stays the card's one filled button. No new class.

- [ ] **Step 1 (red):** `taken-down.pg.test.ts`: a taken-down page's `pageByHandle` is null and `pageOf` holds the reason; `tapLink` on it is `NOT_FOUND` and counts nothing; another person saving that address is told it is taken; `putPageUp` brings it back with its links and counts; both write one `StaffAction`; `askToLookAgain` twice makes one open report. The mail's case. `standing.test.ts`: a page taken down in the database is a missing page to a visitor; its maker reads the reason on `/make/page`, presses the button, and reads the second line; attach "a page taken down, as its maker sees it". Stubs. Push. Expected: `verify`, `postgres` and `browser` fail.
- [ ] **Step 2 (green):** the code and the migration. Push. Expected: all pass.

### Task 18: A suspended account

**Files:**
- Create: `prisma/migrations/<timestamp>_suspension/migration.sql`, `src/features/accounts/suspension.ts`, `src/routes/suspended/+page.server.ts`, `+page.svelte`
- Modify: `prisma/schema/accounts.prisma` (`AccountSuspension`; `StaffActionKind` gains `account_suspended`, `suspension_lifted`), `src/features/accounts/caller.ts`, `handle.ts`, `accounts.ts`, `deletion.ts`, `src/hooks.server.ts`, `src/features/games/service.ts`, `src/features/pages/service.ts`, `src/features/pages/handle.ts` (`suspended` joins `RESERVED_HANDLES`), `src/features/admin/maker-mails.ts`
- Test: `tests/features/accounts/suspension.pg.test.ts`, `tests/features/accounts/handle.test.ts` (add cases), `tests/features/games/service.pg.test.ts`, `tests/features/pages/taken-down.pg.test.ts` (one case each), `tests/features/admin/maker-mails.test.ts` (one case), `tests/browser/standing.test.ts` (add cases)

**The table:** `AccountSuspension`: `userId` the id (a `User`), `reason`, `staffUserId`, `at`. A row means suspended; lifting deletes it. Both are also written to `StaffAction`, which is the lasting record. CHECK `AccountSuspension_reason_check` (1 to 500 characters).

**Interfaces:**
- In `suspension.ts`: `suspend(deps, input: { userId: string; staffUserId: string; reason: string }): Promise<void>` (the reason rule, "Say why, so they know."; a staff account cannot be suspended: `StaffError("NOT_YOURS", "Remove their staff roles first.")`; already suspended, nothing changes); `liftSuspension(deps, input: { userId: string; staffUserId: string }): Promise<void>`; `suspendedAccounts(db): Promise<{ userId; email; reason; at }[]>`, newest first.
- `Caller`'s user kind gains `suspendedReason: string | null`, read by the request hook in the same query as the staff roles, fresh on every request.
- `suspendedStep`, a `Handle` in `accounts/handle.ts`, added to `sequence(…)` in `src/hooks.server.ts` after `createHandle`: a suspended caller asking for any address under `/make`, with any method, or posting to `/report`, is answered with a 303 to `/suspended`. Everything else goes on: they can still sign in and out, play as a member, open `/me`, cancel and delete their account. One place, so a post that never opened the screen is stopped too.
- What others see: `liveGameBySlug`, `liveGames` and `pageByHandle` leave out a game or page whose maker is suspended (one more condition on each query, with a comment saying why it is a condition and not a deleted row: lifting brings everything back as it was). `gameForReview` and `waitingGames` do not leave them out: staff still see them.
- The purge removes a deleted person's suspension row.
- `accountSuspendedMessage(to, reason, site)`: subject "Your Ruken account is suspended"; "We suspended your Ruken account.", "Why: `<reason>`", "Your page and your games are off Ruken while it is suspended. You can still sign in, play, and manage your membership: `<site>`/me".

**`/suspended`** (a signed-in, suspended person; anyone else is sent to `/`):

```
Your account is suspended

Why: Your links go to a scam site.

Your page and your games are off Ruken for now. You can still play, and manage your membership.

[ Go to your account ]
```

Grandma: what happened, why, what still works, and one button to it.

Look: `<main class="card">`; the reason is a `statement`; "Go to your account" is a link with `class="button"`. No new class.

- [ ] **Step 1 (red):** `suspension.pg.test.ts`: suspending writes the row and one `StaffAction` with the reason; a second suspend adds nothing; a staff account refuses; lifting deletes the row and writes one action; an empty reason refuses. `handle.test.ts`: a suspended caller's `GET /make`, `POST /make/page?/save`, `POST /make/new?/create` and `POST /report?/send` answer 303 to `/suspended`, and `GET /me`, `GET /`, `GET /g/x/play` and `POST /sign-out` go on (Review Focus 15). The games and pages cases: a suspended maker's live game is not in `liveGames` and `liveGameBySlug` is null, their page's `pageByHandle` is null, and both are back after lifting (Review Focus 16). The mail's case. `standing.test.ts`:

```ts
test("a suspended maker's page and games are gone for everyone else, and they are told why", async ({ page, browser }, testInfo) => {
  const game = await addGame(browser);
  await suspendInDatabase(game.makerEmail, "Your links go to a scam site.");     // the staff screen is Task 20
  expect((await page.goto(`/g/${game.slug}`))?.status()).toBe(404);
  await signInAs(page, game.makerEmail);
  await page.goto("/make");
  await expect(page).toHaveURL("/suspended");
  await expectOneCard(page); await showTheOwner(page, testInfo, "a suspended account");
  await page.getByRole("link", { name: "Go to your account" }).click();
  await expect(page).toHaveURL("/me");
});
test("a suspended person cannot save anything by posting straight to a form", async ({ page, browser }) => {
  /* page.request.post to /make/page?/save and /report?/send, signed in: both end at /suspended; no page row changed, no report row */ });   // Review Focus 15
test("lifting it brings the game back", async ({ page, browser }) => { /* delete the row: /g/<slug> is 200 */ });                              // Review Focus 16
```

  Stubs. Push. Expected: `verify`, `postgres` and `browser` fail.
- [ ] **Step 2 (green):** the code and the migration. Push. Expected: all pass. Branch G is ready to merge after "fine" on its two screens.

---

# Branch H: `slice-4/reports-queue`

Needs branches B, D, E and G.

### Task 19: Deciding a report

**Files:**
- Create: `src/features/admin/decide-report.ts`, `src/features/admin/age.ts`
- Modify: `src/features/admin/admin.ts`, `src/features/admin/roles.ts` (`MODERATION_STAFF_ROLES: readonly StaffRole[] = ["owner", "moderator"]`)
- Test: `tests/features/admin/decide-report.pg.test.ts`, `tests/features/admin/age.test.ts`

**Interfaces:**
- `decideReport(input: { reportId: string; staffUserId: string; decision: ReportDecision; reason: string }): Promise<{ mail: MailMessage | null }>` in `admin`, the one feature above games, pages, moderation and accounts. First `decide` (Task 14), so of two staff only one goes on (the other gets `DECIDED`); then, by decision: `nothing`, no more; `game_taken_down`, `takeDown` and the game's mail; `page_taken_down`, `takePageDown` and the page's mail; `page_put_back`, `putPageUp` and no mail beyond what the maker sees; `account_suspended`, `suspend` and its mail. A decision that does not fit the report (`game_taken_down` on a page's report) is `ModerationError("INVALID", …)`. A refused reason is checked before `decide`, so a report is never closed with nothing done. The route sends the mail with `tellMaker`.
- `agoWords(then: Date, now: Date): string` in `age.ts`, pure: "just now" under a minute, "`<n>` minutes ago", "`<n>` hours ago", "`<n>` days ago", with "1 minute ago", "1 hour ago", "1 day ago". Slice 2's `/admin/games` wrote "sent 2 hours ago" its own way; if it has a function for it on `main`, use that one and do not write this.

- [ ] **Step 1 (red):** `decide-report.pg.test.ts`: each decision does its one thing, closes every open report about the same thing, and answers its mail; an empty reason on a take-down refuses and leaves the report open; a decision that does not fit refuses; `Promise.all` of two staff taking the same game down: one `game_taken_down` row, one refusal with "Someone already decided this one." (Review Focus 14). `age.test.ts`: 30 seconds, 1 and 59 minutes, 1 and 23 hours, 1 and 3 days. Stubs. Push. Expected: `verify` and `postgres` fail with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 20: The reports queue (`/admin/reports`), and suspended accounts

**Files:**
- Create: `src/routes/admin/reports/+page.server.ts`, `+page.svelte`, `src/routes/admin/reports/[report]/+page.server.ts`, `+page.svelte`, `src/routes/admin/suspended/+page.server.ts`, `+page.svelte`, `tests/browser/reports-queue.test.ts`
- Modify: `src/routes/admin/+page.server.ts`, `+page.svelte` (two more lines, for `MODERATION_STAFF_ROLES`: "Reports", with "`<n>` waiting" or "Nothing waiting", and "Suspended accounts")

All three need `staffOnly(caller, MODERATION_STAFF_ROLES)`.

**`/admin/reports`:**

```
Reports

Tiny game          It's hateful or bullying          2 hours ago
@night-owl         It's a scam or a harmful link     1 day ago
```

Oldest first; none: "Nothing is waiting." Each first word links to the report.

**`/admin/reports/<report>`**, for a game:

```
Report: Tiny game

It's hateful or bullying
"The second level has slurs on the walls."
2 hours ago · 3 other reports about this game

See it on Ruken                       (a link to /g/<slug>, in a new tab)

[ Nothing to do ]

Take the game down, and say why       [                    ]   [ Take it down ]
Suspend its maker, and say why        [                    ]   [ Suspend ]
```

For a page: "Report: @night-owl", then the page's name, its one line and "See the page"; its two lines are "Take the page down, and say why" and "Suspend its maker, and say why". For a taken-down page whose maker asked for another look: "The maker asked for another look", "See what they changed" (the staff view below), and the choices are "Put the page back up" and "Leave it down".

- A report that is already decided reads "Decided." and has no buttons.
- `?show=page` on a page's report shows the page's name, one line and links as a plain list of text and addresses (never as links that are followed), read with `pageOf`, so staff can read a page that is down.
- Each button is its own small form: `nothing`, `takeGameDown`, `takePageDown`, `suspend`, `putBack`, `leaveDown` (which is `nothing`). Each calls `decideReport`, then `tellMaker`, then goes to `/admin/reports`. A refusal shows its words in `problem` beside its field. None asks for a code (the Calls).
- "Nothing to do" tells nobody. Whoever reported is never told and never shown.

**`/admin/suspended`:**

```
Suspended accounts

maker@example.com        Your links go to a scam site.        3 days ago        [ Lift ]
```

None: "Nobody is suspended." "Lift" calls `liftSuspension` and comes back.

Grandma: the queue is three columns: what, why, how long ago. A report's page says what was said, then the choices from mildest to strongest, each with its reason beside its button.

Look: the two lists and the report are each `<main class="card">`. "Nothing to do" is the report card's one plain button; "Take it down", "Suspend" and "Lift" are `quiet`; the quoted note is a `statement`; the age line a `note`. No new class; nothing red.

- [ ] **Step 1 (red):**

```ts
test.beforeEach(forgetRateLimits);
test("a report reaches the staff pages, and staff take the game down from it", async ({ page, browser }, testInfo) => {     // design 8
  const game = await addGame(browser);
  const visitor = await browser.newPage();
  await visitor.goto(`/report?game=${game.slug}`);
  await visitor.getByLabel("It's hateful or bullying").check();
  await visitor.getByRole("button", { name: "Send report" }).click();
  await signInAsModerator(page);                                            // tests/browser/support/staff.ts: a sign-up, then the moderator role
  await page.goto("/admin");
  await page.getByRole("link", { name: "Reports" }).click();
  await expectOneCard(page); await showTheOwner(page, testInfo, "the reports queue");
  await page.getByRole("link", { name: game.name }).click();
  await expectOneCard(page); await showTheOwner(page, testInfo, "a report");
  await page.getByLabel("Take the game down, and say why").fill("Slurs in the second level.");
  await page.getByRole("button", { name: "Take it down" }).click();
  await expect(page).toHaveURL("/admin/reports");
  await expect(page.getByText("Nothing is waiting.")).toBeVisible();
  expect((await page.goto(`/g/${game.slug}`))?.status()).toBe(404);
});
test("Nothing to do closes the report and changes nothing else", async ({ page, browser }) => {});
test("staff take a page down, the maker asks for another look, and staff put it back", async ({ page, browser }) => {
  /* makePage; report it; "Take the page down" with a reason: /<handle> is 404 and the maker is mailed. The maker presses "I've fixed it. Look again.":
     the queue holds "The maker asked for another look"; "Put the page back up": /<handle> is 200 */ });
test("staff suspend a maker from a report, then lift it", async ({ page, browser }, testInfo) => {
  /* "Suspend" with a reason: the game is 404; /admin/suspended lists the address with the reason (attach "suspended accounts"); "Lift": the game is 200 */ });
test("a report someone else already decided says so", async ({ page, browser }) => { /* decide it in the database, then press: "Someone already decided this one." */ });   // Review Focus 14
test("a curator and a plain member do not open the queue", async ({ page }) => { /* 404 on all three addresses */ });        // Review Focus 4
```

  Push. Expected: `browser` fails in the new cases: 404 at `/admin/reports`.
- [ ] **Step 2 (green):** the routes. Push. Expected: all pass.
- [ ] **Step 3:** send the coordinator the green run and one line each for "the reports queue", "a report", "suspended accounts", and "the staff pages" (before and after: two more lines). Mark the branch ready after "fine".

---

# Branch I: `slice-4/first-steps`

Needs slice 3's branch I (the `/make/page` screens) and slice 2's branch M. Uses nothing of branches A to H.

### Task 21: A new maker's three steps (`/make/start`)

**Files:**
- Create: `src/routes/make/start/+page.server.ts`, `+page.svelte`, `src/routes/make/start/page/+page.server.ts`, `+page.svelte`, `src/routes/make/start/free/+server.ts`, `src/features/make/steps.ts`, `tests/browser/first-steps.test.ts`
- Modify: `src/features/make/make.ts`, `src/routes/make/+page.server.ts`, `src/routes/make/new/+page.server.ts`, `+page.svelte`
- Test: `tests/features/make/steps.test.ts`, `tests/browser/first-steps.test.ts`, `tests/browser/make.test.ts` (slice 2's cases start with a maker who has a page, or expect the redirect)

Design 5.7: three steps, one screen each, a "Step 1 of 3" line and a way back on each. The steps call the same services as slice 3's `/make/page` screens (`savePage`, `savePhoto`, `saveTheme`) and use its `ThemePicker.svelte`; slice 3's four screens stay as the place to change a page later.

- `steps.ts`, pure: `nextStep(maker: { hasPage: boolean; hasGame: boolean; sawPageStep: boolean }): "/make/start" | "/make/start/page" | "/make/new?step=3" | null`: no page, step 1; a page, no game and step 2 not yet seen, step 2; a page and no game, step 3; a game, `null` (the steps are over for good). "Seen" is a cookie, `ruken_step2=1`, for a year, set when step 2 is saved or skipped: it only saves a person from being shown step 2 again, so it need not be more than a cookie.
- `/make` (slice 2): when `nextStep` is not `null` and the address has no `?stay=1`, a 303 to it. "Your games" keeps a way out of the steps: every step's last link is "Do this later", to `/make?stay=1`.
- `GET /make/start/free?name=<text>`: signed in only (else 404); answers `{ "free": true }` or `{ "free": false, "problem": "<words>" }` from slice 3's `handleProblem` and whether a page has that address; `cache-control: no-store`; at most 60 a minute a person (`api:handle-free:<userId>`), over it `{ "free": false, "problem": "Slow down a little." }`.

**Step 1, `/make/start`:**

```
Step 1 of 3

Pick your address

[ yourname ]
People will find you at <this site>/yourname. Use letters, numbers and hyphens.
                                              (as they type: "yourname is free." or the refusal)

[ Save and go on ]

Do this later
```

- Action `save`: `savePage` with the address as typed and the same text as the page's name. A `PageError` shows its words in `problem`, with the address kept. Success: a 303 to `/make/start/page`.
- The page's own script: half a second after the last key (a timer the journeys move with Playwright's `page.clock`), it asks `/make/start/free` and writes the answer in a `<p role="status">` under the field: "`<name>` is free." or the refusal's words. With no script the line is not there, and Save says the same thing.
- Someone who already has a page is sent to the next step.

**Step 2, `/make/start/page`:**

```
Step 2 of 3

Your page

Your name
[ yourname ]

One line about you
[ ]

A photo
[ file field ]
A JPEG, PNG or WebP, up to 5 MB.

Your colours
(•) [ Aa ▬ ]  Ruken's own colours    ( ) [ Aa ▬ ]  ( ) [ Aa ▬ ]  …

You can change all of this later.

[ Save and go on ]

Skip for now          Back
```

- One form, `enctype="multipart/form-data"`. Action `save`: `savePage` (the name and the line, the address as it is), then `savePhoto` when a file was chosen, then `saveTheme`; the first refusal shows its words in `problem` with what was typed kept, and what was saved before it stays saved. Slice 3's size check before the body is read applies here too. Success, and "Skip for now" (a link to `/make/new?step=3` through an action that only sets the cookie): the cookie, then a 303 to `/make/new?step=3`. "Back" goes to `/make/page`, where the address can be changed.
- The page says "Saved. Your page is live." nowhere here: the next screen is the next step. The page is live all the same (design 5.3).

**Step 3, `/make/new?step=3`:** slice 2's new-game screen, with one line above its heading, "Step 3 of 3", and, under its button, "Do this later" (to `/make?stay=1`) and "Back" (to `/make/start/page`). Nothing else on it changes. After it, the maker is on their game's page as slice 2 built it, and after "Send for review" reads "Waiting for review" and Task 9's line.

Grandma: each screen is one thing, says which step it is, and has one filled button; every step can be left and come back to, and `/make` always opens the first step not yet done.

Look: each is `<main class="card">`; "Step 1 of 3" is a `note` above the `h1`; the colours are slice 3's `ThemePicker`; "Save and go on" is the card's one filled button; "Skip for now", "Back" and "Do this later" are links. No new class.

- [ ] **Step 1 (red):** `steps.test.ts`: the four answers of `nextStep`. `first-steps.test.ts`:

```ts
test.beforeEach(forgetRateLimits);
test("a new maker goes from an address to a game waiting for review, in three steps", async ({ page }, testInfo) => {   // design 8
  await signUp(page);
  await page.clock.install();
  await page.goto("/make");
  await expect(page).toHaveURL("/make/start");
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await expectOneCard(page); await showTheOwner(page, testInfo, "step 1, your address");
  const handle = freshHandle();
  await page.getByRole("textbox").fill(handle);
  await page.clock.runFor(600);
  await expect(page.getByRole("status")).toHaveText(`${handle} is free.`);
  await page.getByRole("button", { name: "Save and go on" }).click();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expectOneCard(page); await showTheOwner(page, testInfo, "step 2, your page");
  await page.getByLabel("One line about you").fill("I make small games.");
  await page.getByRole("button", { name: "Save and go on" }).click();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await showTheOwner(page, testInfo, "step 3, your first game");
  /* connect GitHub, fill the form, add both clips, agree, Send for review (slice 2's helpers) */
  await expect(page.getByText("Waiting for review")).toBeVisible();
  await expect(page.getByText("We'll email you when it's live.")).toBeVisible();
  expect((await page.goto(`/${handle}`))?.status()).toBe(200);
});
test("a taken, reserved or too-short address is said at once, in the words Save uses", async ({ page, browser }) => {
  /* another maker's address → "That one is taken. Pick another."; "make" → the same; "ab" → "Use at least 3 letters or numbers.";
     each first in the status line after page.clock.runFor(600), then again as the alert after Save; the address is still /make/start */ });   // Review Focus 17
test("the address step works with no script", async ({ browser }) => { /* a context with javaScriptEnabled: false: no status line; Save refuses and accepts as above */ });   // Review Focus 17
test("step 2 can be skipped, and is not shown again", async ({ page }) => { /* "Skip for now" → step 3; /make → /make/new?step=3 */ });
test("a maker who left half way comes back to the first step not done", async ({ page }) => {
  /* save step 1, "Do this later" → "Your games"; open /make again → /make/start/page, and the address is still theirs */ });                 // Review Focus 18
test("a maker with a game is never sent to the steps", async ({ page, browser }) => { /* signInAs the maker addGame made: /make stays /make */ });
test("the free-or-taken address is for signed-in people", async ({ request }) => { /* 404 signed out */ });
```

  Stubs. Push. Expected: `verify` fails in `steps.test.ts`; `browser` fails: `/make` does not move, and `/make/start` is 404.
- [ ] **Step 2 (green):** the routes. Push. Expected: all pass, slice 2's and slice 3's journeys included.
- [ ] **Step 3:** send the coordinator the two runs and one line each for the three steps ("step 3, your first game" is a before and after of slice 2's "the new-game form"). Mark the branch ready after "fine".

---

# Branch J: `slice-4/edit-game`

Needs slice 2's branch M.

### Task 22: Changing a game's name, one line and "Plays on" (`/make/<game>/edit`)

**Files:**
- Create: `src/routes/make/[game]/edit/+page.server.ts`, `+page.svelte`, `tests/browser/edit-game.test.ts`
- Modify: `src/features/games/service.ts`, `src/features/games/games.ts`, `src/routes/make/[game]/+page.svelte` (one link, "Change its name or one line")
- Test: `tests/features/games/service.pg.test.ts` (add cases), `tests/browser/edit-game.test.ts`

- `updateGame(gameId: string, makerUserId: string, changes: { name: string; oneLine: string; playsOn: PlaysOn }): Promise<void>`: this maker's game, in any state but `taken_down`, else `NOT_FOUND` or `GameError("NOT_READY", "This game was taken down. Send it again first.")`; the name and the line by the rules `createGame` has, with its words. The game's address (`slug`) and its public id do not change.

```
Change Tiny game

Name
[ Tiny game ]

One line
[ A game for the tests. ]

Plays on
(•) Phone and computer   ( ) Computer only

[ Save ]

Back to Tiny game
```

Under the name, one `note`: "Its address stays `<this site>`/g/`<slug>`, so links you've shared keep working." Success goes back to `/make/<game>`.

Grandma: three fields that hold what is there now, and one button.

Look: `<main class="card">`; `choice` rows; Save is the one filled button. No new class.

- [ ] **Step 1 (red):** the service cases: a changed name keeps the slug; a name of two characters refuses with `createGame`'s words; another maker's game is `NOT_FOUND`; a taken-down game refuses. `edit-game.test.ts`: a maker changes the name of a live game, and `/g/<slug>` shows the new name at the old address; "Computer only" then shows "This one needs a computer." to a phone; a refusal keeps what was typed; another maker gets 404; attach "changing a game". Stubs. Push. Expected: `postgres` and `browser` fail.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch J is ready to merge after "fine".

---

# Branch K: `slice-4/real-site`

### Task 23: Design 8's lines for this slice, and the real site

**Files:**
- Create: `tests/browser/submit-and-moderate.test.ts`
- Modify: `docs/superpowers/progress.md`

- [ ] **Step 1: the lines, end to end, through the real screens.** One journey: a new maker signs up, goes through the three steps and sends a game (Task 21's steps); an owner, made with `signInAsOwner`, sets up an authenticator, adds a second account as "Checks games" with a real code, and that second person accepts the game on `/admin/games`; the maker is mailed; the game is in the feed with `@<handle>` under it and on the maker's page; a visitor reports it from the clip's mark; a moderator finds the report on `/admin/reports` and takes the game down; the game is gone from the feed and the maker's game page reads "Taken down: " with the reason. Every part was built and tested by the tasks before, so this journey passes on its first push: a test with no red, and the report line says so. If it fails, the defect is in the task that owns the failing screen: fix it there, test first.
- [ ] **Step 2:** set slice 4's lines in `docs/superpowers/progress.md`: which of design 8's lines now have a journey ("A maker signs up, connects GitHub, submits a game, and sees it 'Waiting for review'", through the three steps; "Staff accept it, and it appears in the feed and on the maker's page. Staff can send one back and take one down"; "A report reaches the admin portal").
- [ ] **Step 3: what a person checks on the real site**, the Owner or the coordinator with the Owner, once every branch is on `main` and deployed. Nothing is typed into the repository; progress.md records what was checked, by whom and when, with no address and no email. Both owners open `/admin` and read no "Ruken needs two owners" line; an owner adds a test account as "Money", is asked for a code, enters it from their phone, and removes the account again; a new account opened on a phone is walked through the three steps, and its address answers "is free" as it is typed; a test game sent from it arrives on `/admin/games`, is sent back with a reason, and the mail with that reason arrives; sent again, it is accepted, the "live" mail arrives, and the game is in the feed; a report sent from the clip's mark, signed out, arrives on `/admin/reports`; from it the test game is taken down, its address is a missing page, and the mail arrives; **FloorFifty's staff page reads "Free to play: yes" with its reason** (the Owner presses "Make it free" once, design 5.2), and a signed-out phone plays it.
- [ ] **Step 4:** set slice 4's row in progress.md from what is true: "done" only when every branch is merged, `main` is green, and Step 3 passed.

---

## Notes for the plans that follow

- **Slice 5 (money).** `freshCodeOnly(event)` and `staffOnly(caller, roles)` are in `src/features/admin/admin.ts` as Tasks 32 and 33 name them. A code is fresh for ten minutes in the session that entered it (`CODE_FRESH_MS`). `giveFreshCode(email)` in `tests/browser/support/database.ts` is how a journey gets one without waiting thirty seconds for a second code. "Money" (`finance`) is offered on `/admin/staff`; `/admin`'s list takes one more line for the money pages. The second person on a payout is slice 5's own rule; `recordStaffAction` is there for its actions, each new kind added to `StaffActionKind` in its own migration. A suspended maker's statements and payouts are a question for the Owner before the first payout: nothing here holds money back.
- **After launch, left out on purpose** (question 4): changing a live game's clips through review (today: take it off, change them, put it back); deleting a game's old pulls from the bucket.
- **The privacy text** (the Owner's, before live mode) should say that a report made while signed in is kept with the account that made it, that staff do not see who reported, and that an authenticator's key is kept encrypted.
- Worth the Owner's eye before launch, left out on purpose: staff sign in as everyone does, with no code at sign-in and no shorter session (the Calls); taking something down and suspending ask for no code; there are no recovery codes, so two owners who both lose their phones need the database; there is no QR picture on the set-up screen (question 1b); the record of staff actions has no screen of its own yet, only the table; a report's reporter is never told what was decided; reports are limited by address, so many people behind one address share five an hour; a suspended member keeps paying and playing until they cancel; a suspended maker's games are hidden but a pass already given lasts up to a day; nothing tells a maker when a suspension is lifted; a deleted maker's live games stay as slice 2 left them.
- `head_curator` and `support` are in `StaffRole` and are offered nowhere. If nothing ever uses them, removing them is one migration; if the Owner wants a second level of staff, that is where it goes.
