# Games Before Launch: the Wishlist and a Maker's Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A game the Owner accepts before 30 November is in the feed at once with "Wishlist" where Play would be; at 11:00 Chicago time on the 30th every one opens by the clock, everyone who wishlisted gets one email, and a maker sees how many people wishlisted each game and, after launch, how much it was played.

**Architecture:** One new small feature, `launch`, between `games` and `play` in the layers: the launch moment and `isOpen(now)`, the wishlist rows, and the launch email. Nothing is stored or flipped at launch: every screen and route asks `isOpen` with a time it is handed. `play` asks it before handing out a pass; the feed, a game's address and a maker's page show Wishlist in place of Play; `/make/<game>` shows counts read from rows. The email is one job at `/jobs/launch-mail`, started by a Cloudflare cron on the Worker and safe to start again.

**Tech Stack:** as slices 1 to 4 (Node 24.22.1, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0, Postgres 16, Vitest 5.0.3, Playwright 1.63.0, Cloudflare Workers with a Cron Trigger, Resend through slice 1's `Mailer`). **No new package.**

**Spec:** `docs/superpowers/specs/2026-11-14-wishlist-before-launch-design.md` (approved by the Owner, 2026-11-14), which builds on `docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md` (sections 5.1, 5.2, 5.3, 5.4, 5.8, 6, 7.1, 7.3). Read them with `CLAUDE.md`, `AGENTS.md`, slice 1's plan ("How a task runs", "The look"), slice 2's plan (`docs/superpowers/plans/2026-11-13-slice-2-games-play.md`: the Calls, Tasks 16 to 18, 21, 26, 28, 30, 31), slice 3's plan (`docs/superpowers/plans/2026-11-14-slice-3-feed-maker-page.md`: Tasks 9, 12, 13, 14, 15, 22) and slice 4's plan (`docs/superpowers/plans/2026-11-14-slice-4-submitting-admin.md`: Tasks 9, 18, 25) with its audit (S4, S9).

**Planned against:** `main` at `d497163` (slice 1 merged; slice 2's branches A to E and P and its first-owner command merged; the plans of slices 3, 4 and 5 merged, none of their code), plus what slice 2's and slice 3's plans say their later branches will produce. Slice 2's branches M, S and F and all of slice 3 could not be read as code. "What this plan relies on", below, names each piece with its slice and task; if one is not on `main` as named when its task starts, stop and report.

## Global Constraints

- No session runs tests, lint or typecheck itself. Push, then read CI on the pull request (CLAUDE.md, Owner 2026-11-13).
- Every task is test-first, in two pushes, exactly as slice 1's "How a task runs" says: red (the test and stubs that throw `not built yet`), then green. A pull request is opened as a draft at the first push and marked ready only when its branch's last task is green.
- No new dependency. Anything that seems to need one is a stop: report it with the exact name and version, for the Owner's yes.
- `.github/workflows/ci.yml` does not change.
- This repository is public. No secret, real address or key goes in. No strategy, research or reason behind a business decision goes in any file, comment, commit or pull request.
- **The launch moment is one constant**, 11:00 America/Chicago on 30 November 2026, and one pure function, `isOpen(nowMs)`. Nothing else decides whether Ruken is open: no column, no setting on the real site, no job that flips anything (design, approach A).
- **Not built** (design, "Not in this"): a release date per game; a wishlist after launch; any chart or deep number; beta builds; any notice but the one email. No button, table or column is made for any of them.
- Nobody types a fact. Every number on the maker's screen is counted from stored rows each time the page opens; no form has a field for a count.
- Time comes from an injected `Clock`. Feature code never calls `Date.now()` or `new Date()` with no argument.
- Layers, lowest first, after Task 1: `accounts`, `membership`, `games`, `launch`, `play`, `money`, `pages`, `feed`, `make`, `moderation`, `admin`. A feature imports only from features below it, through `<feature>.ts`; a component reaches a feature only through `<feature>.browser.ts`. Tests live only in `tests/`, mirroring `src/`.
- The email is plain text, sent once per person, and only to a confirmed address. Logs never hold an address.
- Comments say why, never which plan asked.
- Every screen and message passes the drunk grandma test. The words in this plan are the words to ship; a change to them is a deviation to report.
- The look (design 5.8). `/make/<game>` and `/join` are Ruken's own screens and use `src/lib/look.css` and only its classes; **this plan adds no class and no colour**. The feed and a maker's page keep their styles in their own components (slice 3): the Wishlist button there is drawn exactly as that screen's Play is. Nothing here spends money, so nothing is Blue `pay` and nothing is pip red.
- Every journey file starts with `test.beforeEach(forgetRateLimits)`. Every new or changed screen is attached with `showTheOwner(page, testInfo, "<screen>")`. For a screen that existed before (the feed, a maker's page, `/make/<game>`, `/join`), the branch's report gives two runs, before (`main`) and after (the branch), with one line per screen. The branch is marked ready only after the Owner's "fine". After two rounds without "fine", stop (CLAUDE.md, Pace). There are no pixel goldens.

## What this plan relies on

| Piece | From | Used for |
|---|---|---|
| `prisma()`, `Clock`, `systemClock`, `TestClock`, `startTestDatabase()`, `requireEnv`, `optionalEnv`, `reject_append_only_change('<Table>')` | slice 1 (on `main`) | tables, time, settings, the add-only table |
| `locals.caller`, `Caller`, `signedInRedirect` and the `next` of `/sign-up` and `/sign-in` (checked by `safeNextPath`), `User.emailVerified`, `User.status`, the "Confirm your email" resend on `/me` | slice 1 (on `main`) | who is asking; the way back after sign-up; who gets the email |
| `Mailer`, `MailMessage`, `createResendMailer`, `mailFailureCode`, `createCaptureMailer`, `authServices().mailer` | slice 1 (on `main`) | the launch email |
| `hasJobSecret`, `/jobs/purge-accounts` (its shape), the scheduled handler in `cloudflare/worker.js`, `triggers.crons` in `wrangler.jsonc`, `tests/wrangler.test.ts`, `--test-scheduled` in `playwright.config.ts` | slice 1, Task 20; slice 2, Task 29 (on `main`) | the job, its address and its cron |
| `purgeDueAccounts` in `src/features/accounts/deletion.ts` ("a later slice that stores more of a person adds its own removal here, with a test") | slice 1, Task 20 (on `main`) | a deleted account's wishlist |
| `src/lib/look.css` and `CLASSES`, `expectOneCard`, `showTheOwner`, `forgetRateLimits`, `signUp`, `payAsNewMember` | slice 1 (on `main`) | the screens and the journeys |
| `Game`, `LiveGame` (`id`, `slug`, `name`, `makerUserId`, `freeToPlay`), `gamesServices().service.liveGameBySlug(slug)` | slice 2, Tasks 1, 11 (on `main`) | which game a press is for |
| `PlaySession` (`gameId`, `basis`, `startedAt`), `PlayBeat` (`sessionId`, `receivedAt`, `attentive`), `countedMs`, `LONGEST_COUNTED_GAP_MS`, `playBasis`, `createPlayService`, `startPlay`, `recordBeat`, `playServices()` | slice 2, Tasks 16 to 18 (on `main`) | the play gate; plays and minutes |
| `/g/<game>/play` and its `load`, which sends a `{ refused: "join" }` to `/join` | slice 2, Task 21 (branch F) | the play gate's last step |
| `/make/<game>`, `gameForMaker(slug, makerUserId)`, the state line, "See it on Ruken" | slice 2, Tasks 26, 28 (branch M) | where the maker's numbers go |
| `accept`; `addGame(browser, options?)` answering `{ slug, name, publicId, makerEmail, makerUserId }`, `submitGame`, `signInAs(page, email)`, `signInAsStaff(page)`, `tests/browser/support/database.ts` | slice 2, Tasks 26, 30, 31 (branches M, S) | journeys that need a live game, its maker and staff |
| `liveGames(filter?)` answering `ListedGame[]` | slice 3, Task 9 (branch C) | the games an email may name |
| `Feed.svelte` (the band, with Play as `<a href="/g/<slug>/play">`), the `load` of `/` and of `/g/[game]`, `clipOf(page, slug)`, the case "Play is the only thing with words to press" | slice 3, Tasks 13 to 15 (branch D) | where Wishlist goes in the feed |
| `MakerPage.svelte` (one `<article>` a game, with Play), the `load` of `/[handle=handle]`, `makePage`, `freshHandle`, `THEMES` | slice 3, Task 22 (branch H) | where Wishlist goes on a maker's page |

**What this plan adds to earlier slices' features:** to `accounts`, one line in the purge; to slice 1's `MailMessage`, an optional `idempotencyKey`; to `play`, `startPlay` takes the launch time and can refuse with `not_open`, and `playNumbers`; to `make`, the words of the numbers; to `feed` and `pages`, one prop on each screen's component. To `tests/architecture.test.ts`, one name in `FEATURE_ORDER`. Nothing of theirs is changed in meaning: with Ruken open, every screen and route behaves as its own slice built it.

**What slice 4 should know** (it is not built yet): its Task 25 also changes `cloudflare/worker.js`'s scheduled handler. Task 11 here changes only which address a run knocks on, by the cron that started it; whichever of the two lands second merges `main` in and keeps both. Its Task 18 (a suspended maker's games leave `liveGames`) needs nothing here: the email and the screens read live games through the games service.

**What the beta builds plan gets from this one** (its design is `docs/superpowers/specs/2026-11-14-beta-builds-design.md`, planned beside this plan; relayed by the coordinator, 2026-11-14). Four things this plan holds, so beta adds to them without rewriting:

1. **Plays are counted by naming the bases that count.** `playNumbers(gameId, since, bases)` takes the list (Task 7); this plan calls it with `COUNTED_BASES`, `["member", "free_game"]`. It is never written as "everything but the maker's own and staff's", so a new basis counts nowhere until someone names it.
2. **The before-launch refusal is in `startPlay`, the ordinary play path, and is keyed on the basis** (Task 5). Nothing in the play route's `load` refuses before `startPlay` is called, so a branch of that `load` that goes another way (its own start function) is not refused by this plan's rule.
3. **The Wishlist or Play button sits in one wrapper that is always there**, `<div data-play-slot>`, in each clip of the feed and each game of a maker's page (Tasks 13, 14), so a second line can go right under the button in either state.
4. **On `/make/<game>` the numbers are one block, `<section data-numbers>`, right under the state line** (Task 8); anything else about the game goes below it.

## Found while planning

Read on 2026-11-14, on `main` at `d497163`. Where the code and this plan disagree when execution reads it, stop and report.

1. **The journeys run on the real clock, against one running site.** Today is before launch; on 30 November it will be after. Without a way to set the launch time for a request, slice 2's and slice 3's journeys that press Play would fail the day this lands, and this plan's Wishlist journeys would fail on the 30th. There is a pattern for tests-only settings (`STRIPE_API_BASE`, refused when Stripe is live; `GITHUB_API_BASE`, refused unless it is this machine). Task 2 adds one in that pattern.
2. **`FEATURE_ORDER` has no `launch`** (`tests/architecture.test.ts:12`). The design asks for "a small `launch` feature low in the layers"; design 7.1 lets a plan adjust names, not the rule.
3. **Cloudflare's Cron Triggers** (https://developers.cloudflare.com/workers/configuration/cron-triggers/, read 2026-11-14): five fields, in UTC; days of the month 1 to 31 and months 1 to 12 are both allowed, so `*/10 17 30 11 *` is every ten minutes from 17:00 to 17:50 UTC on 30 November. A new trigger "may take several minutes (up to 15 minutes) to propagate", and runs can be missed until then. The handler is told which expression started it (`controller.cron`). Locally, `/cdn-cgi/local/scheduled?cron=*+*+*+*+*` runs the handler with a chosen expression. 30 November is in Central Standard Time, so 11:00 in Chicago is 17:00 UTC.
4. **Resend** (https://resend.com/docs/api-reference/introduction and its idempotency page, read 2026-11-14): "The default maximum rate limit is 10 requests per second per team"; over it, a 429. A request may carry an `Idempotency-Key` header; a second send with the same key within 24 hours is not sent again.
5. **No journey can read a sent mail** (`MAIL_ALLOWLIST: "nobody@ruken.test"` in `playwright.config.ts`; slice 4's audit, S4, found the same). So the email's sending is proved against a real Postgres with `createCaptureMailer`, and the journey proves the job's address, its secret and its answer. If slice 4's stand-in for Resend is on `main` when Task 11 starts, its journey may also read the mail; say so in the report line.
6. **A person who signs up before the site's own mail domain exists gets no confirmation mail** (design 7.3: until then mail reaches only the Owner's address). `/me` already has "Confirm your email" with a button that sends it again (slice 1), so they can confirm later; the job mails whoever is confirmed when it runs, and can be run again.
7. **`FeedClip` holds a game's `slug`, not its id** (slice 3, Task 12). So the wishlist service answers slugs to the screens.
8. **SvelteKit runs a page's `load` when a link to it is hovered** (slice 3's audit, S3). Task 12's `load` adds a game only for a cookie this site set after the person pressed Wishlist, and adding twice changes nothing, so an early `load` is harmless.
9. **`/join` takes a payment before launch**, for a membership that cannot be used until the 30th. Nothing in either design says what should happen. Asked of the Owner (Q1, below).
10. **Not settled by reading:** whether Wrangler 4.156.0's `--test-scheduled` hands `?cron=` to `controller.cron` as the current page describes (Task 11, step 3, says what to do if not); whether slice 3 builds a maker's games as paper cards (its audit, S4): Task 14 puts Wishlist where that screen's Play is, in whatever markup is there.

## The Owner's decisions, the open questions, and the Calls in this plan

- **Owner, 2026-11-14** (the design, as approved): one launch switch, by the clock (approach A); accepted games show "Opens 30 November" and Wishlist where Play goes, in the feed, on the maker's page and at `/g/<game>`; signed out, Wishlist goes to the short sign-up and straight back; the play route refuses everyone before launch but the game's own maker and staff; FloorFifty is shown the same way; one email at launch to confirmed addresses, recorded so a second run sends nothing new; light numbers on `/make/<game>`, no charts.
- **Asked of the coordinator on 2026-11-14.** Q2 is answered; Q1 is with the Owner and is marked where it bites.
  - **Q1. Before launch, can someone pay?** A (this plan's pick): before launch `/join` shows the price and one line, "Membership opens 30 November.", and no payment can start (Task 6). B: no code; the Owner keeps Stripe in test mode until launch morning. C: allow paying early. **Task 6 is built only on the Owner's A.**
  - **Q2. The real-site checks that need a stranger to play.** Once the play gate is on `main`, only a game's maker and staff can play on the real site until launch, so design 8's "a stranger signs up, pays with a real card, and is in the game they tapped" and "anyone can play FloorFifty without an account" cannot be checked there by a person before 11:00 on the 30th. A (this plan's pick): the gate stays strict; those two lines are proved by CI's journeys and checked by a person at 11:00 on launch day; everything else is checked before, with the Owner as maker and staff. B: hold branch B back until slices 2 and 3 have made those checks. C: a setting that opens the real site early (not offered by this plan: it is the failure the design names). **Coordinator, 2026-11-14: A; the gate stays strict.**
- **Calls** (the Owner can overrule):
  - **Where the switch lives.** `src/features/launch/`, between `games` and `play`: the switch, the wishlist and the email in one small feature. `play` reads the switch from below; `feed`, `pages` and `make` sit above and never touch it: their routes hand the screen what to show.
  - **The journeys' switch.** A tests-only setting, `LAUNCH_TEST_SWITCH=on`, makes the journeys' site open whatever the date, and a cookie, `rk_test_launch=before`, makes one browser's requests see the day before launch. The site refuses to start with the setting on unless its own address (`BETTER_AUTH_URL`) is plain `http` on `localhost` or `127.0.0.1`, so it cannot be turned on for the real site by mistake. The real site reads the real clock and ignores the cookie. Worth the Owner's eye: it is the one place a setting touches launch.
  - **The play gate is inside `startPlay`**, the only place a pass is handed out, so no route can forget it. Before launch it refuses everyone whose reason to play is not "their own game" or "staff", before the paywall and before anything is stored. The play address then sends the person back to the game, which says when it opens.
  - **A maker reaches their own game before launch from `/make/<game>`**: one line, "Players can play from 30 November.", and a link, "Play it yourself". The feed shows everyone the same thing, maker and staff included. Staff reach any accepted game by its play address; they played it when they accepted it.
  - **Wishlist is a form that posts**, so it works with no script; with script the same form is sent in the background and the button changes in place, so the clip keeps playing. A link can never add a game: only a post from Ruken's own page does.
  - **Signed out**, the press sets a 30-minute cookie that names the game, then goes to `/sign-up?next=/g/<game>`. Back at `/g/<game>`, signed up or signed in, the game named by the cookie is added and the cookie is gone. From the feed at `/` or from a maker's page, the person lands on that game's own address, which is the feed opened at it.
  - **Before launch a clip shows only "Opens 30 November" and Wishlist** where Play goes, on a phone too. "This one needs a computer." returns with Play at launch: a person on a phone can still want to be told.
  - **The button's words**: "Wishlist", and once added "On your wishlist". A small heart, drawn in the component as one plain line shape like the feed's share mark, is empty before and filled after. No new colour.
  - **A maker's own wishlist of their own game is not counted**, as their own play is not.
  - **A play, in the maker's numbers,** is one opening of the game in which the person touched it at least once (a session with an attentive beat). Minutes are the counted time of those sessions, by slice 2's rule (`countedMs`), added up and rounded down. Both are over sessions started in the last seven days, with basis `member` or `free_game`. Two tabs of one person count twice here; slice 5's pay does not use these numbers.
  - **The numbers' words**: before launch "No wishlists yet", "Wishlisted by 1 person", "Wishlisted by 12 people". After launch "Played 340 times in the last 7 days" and "1,200 minutes played in the last 7 days" ("1 time", "1 minute"; "Less than a minute played in the last 7 days"; with no plays, the one line "No plays in the last 7 days"), then "Wishlisted by 12 people before launch" when anyone did. They show for a live game only.
  - **The email.** Subject "Your games are out on Ruken" (the design's). For each game, in the order the person added them: "`<name>` is out. Play it now:" and the game's address on a line of its own (slice 1's rule for links). Last line: "You got this email because you used Wishlist on Ruken. It's the only one we'll send about it." It names only games that are live when the job runs.
  - **The job's address and cron.** `POST /jobs/launch-mail`, behind `JOBS_SECRET` like the daily job. The cron is `*/10 17 30 11 *`: 17:00 UTC on 30 November and five more tries that hour. Each run sends only to people with no `WishlistMail` row, 500 at most, so a run that fails or stops is finished by the next with nobody mailed twice. Before 11:00 it sends nothing. More than seven days after launch it sends nothing either, so the same cron a year later mails nobody.
  - **Once, not twice.** For each person the job writes their `WishlistMail` row and sends the mail inside one database transaction: the row stays only if Resend said yes. Two runs at the same moment cannot both hold the same person's row, so they cannot both send. The mail also carries an idempotency key made from the person's id, so Resend itself refuses a second copy within a day.
  - **A mail that was not sent is not recorded**: held back by `MAIL_ALLOWLIST`, or refused by Resend. The next run tries those people again.
  - **`WishlistMail` is kept when an account is deleted**; the person's `Wishlist` rows go. The mail row holds only the tombstone's id and a time, and is add-only.

## Where execution stops and waits for the Owner

There is no setting, secret, bucket or address for the Owner here. `LAUNCH_TEST_SWITCH` is for the journeys and is never set on the real site. The stops are:

- **Q1's answer**, before Task 6. Branch B's Task 5 does not wait for it.
- **"Fine" on the screenshots**, once per branch that has screens: B (if Task 6 is built), C, E, F.
- **The real site**, Task 15, before launch and at 11:00 on launch day.
- **Launch day, only if Cloudflare shows the 17:00 run failed and the later runs did not finish it** (Task 15, step 4): one command for Windows PowerShell, `$secret = Read-Host "JOBS_SECRET"; Invoke-RestMethod -Method Post -Uri "https://SITE/jobs/launch-mail" -Headers @{ Authorization = "Bearer $secret" } -ContentType "application/json"` (the answer says how many were sent and how many are left; run it again while `left` is above 0).

A stop holds only its own branch. Branches that do not need the answer go on.

## How a task runs

As slice 1's plan, word for word: two pushes (red with stubs, then green), the tracker ticked with both CI run numbers, one report line to the coordinator after each task, a draft pull request per branch, never ready while red, `main` merged in (never rebased) when it has moved.

**Where a branch runs.** A, B, C and D are logic with small changes to screens that exist, and run in the cloud. E and F are the feed and a maker's page: the coordinator chooses whether each runs in the cloud, judged from the screenshots, or as a local session on the Owner's computer (CLAUDE.md, "Where sessions run"). Either way every test runs in CI.

## Branches

Seven small branches. Each starts from `main` only after what it needs is merged and green; at most three pull requests are open at once.

| # | Branch | Tasks | Needs on `main` | Ends with |
|---|---|---|---|---|
| A | `wishlist/switch` | 1 to 4 | slice 1; slice 2's branch A (both there today) | the switch, the journeys' switch, the tables, the wishlist service, a deleted account's wishlist |
| B | `wishlist/play-gate` | 5, 6 | A; slice 2's branch F | nobody but a game's maker and staff plays before launch; `/join` holds payments until launch (Task 6, on the Owner's A to Q1) |
| C | `wishlist/numbers` | 7, 8 | A; slice 2's branch M | a maker's numbers on `/make/<game>`, and "Play it yourself" |
| D | `wishlist/launch-mail` | 9 to 11 | A; slice 3's branch C | the email's words, the job, its address and its cron |
| E | `wishlist/button` | 12, 13 | A, B; slice 3's branch D | Wishlist in the feed and at `/g/<game>`, and the way back after sign-up |
| F | `wishlist/maker-page` | 14 | E; slice 3's branch H | Wishlist on a maker's page |
| G | `wishlist/real-site` | 15 | all of the above | the design's goals in one journey, and on the real site |

**A can start today.** B, C and D need nothing of each other and can run side by side as their slice 2 and slice 3 branches land. **E needs B**: with the button on `main` and no gate, a person could still play by typing a game's play address. Between B and E, Play on the real site sends a person back to the game they were on; merge E as soon after B as slice 3's branch D allows, and the coordinator holds the Owner's first Accept on the real site until E is on `main`. D must be deployed days, not minutes, before the 30th (a new cron takes up to fifteen minutes to start).

**For 25 November:** A to E are the design's goals for the feed, `/g/<game>`, play, the email and the numbers, and are right after slice 3's branch D. F waits for slice 3's branch H; if H is late, F is the branch that slips, and a maker's page then shows Play before launch, which sends the person back to the game, where Wishlist is. That is the Owner's choice to accept, not this plan's.

## File map

```
prisma/schema/launch.prisma              Wishlist, WishlistMail                                  (A)
src/features/launch/
  launch.ts              entry (server)
  launch.browser.ts      entry for components: sendWish                                         (E)
  switch.ts              LAUNCH_MS, isOpen, OPENS_WORDS                                         (A)
  now.ts                 createLaunchNow: the real clock, or the journeys' switch               (A)
  wishlist.ts            add, remove, slugsOf, countFor                                         (A)
  view.ts                wishlistView: what a screen is handed; WISH_COOKIE                     (E)
  wish.ts                sendWish: the button's background post (browser)                       (E)
  mail.ts                launchMessage: the email's words                                       (D)
  send.ts                sendLaunchMails: one email a person, once                              (D)
  services.ts            built once
src/lib/server/mail.ts                   MailMessage gains idempotencyKey                        (D)
src/features/accounts/deletion.ts        the purge removes a person's wishlist                   (A)
src/features/play/sessions.ts            startPlay takes launchNowMs, refuses not_open (B); playNumbers (C)
src/features/make/numbers.ts             makerNumberLines, PLAYED_FOR_MS, COUNTED_BASES          (C)
src/features/feed/Feed.svelte            Wishlist in place of Play before launch                 (E)
src/features/pages/MakerPage.svelte      the same, on a maker's page                             (F)
src/routes/
  g/[game]/play/+page.server.ts          not_open goes back to the game                          (B)
  join/+page.server.ts, +page.svelte     "Membership opens 30 November."                         (B, Task 6)
  make/[game]/+page.server.ts, +page.svelte      the numbers; "Play it yourself"                 (C)
  jobs/launch-mail/+server.ts            the job's address                                       (D)
  g/[game]/wishlist/+server.ts           the button's post                                       (E)
  +page.server.ts, g/[game]/+page.server.ts, and their +page.svelte    hand the feed its launch prop (E)
  [handle=handle]/+page.server.ts, +page.svelte                        the same, for a maker's page (F)
cloudflare/worker.js, wrangler.jsonc     the launch cron, and which address it knocks on         (D)
playwright.config.ts, .env.example       LAUNCH_TEST_SWITCH                                      (A)
tests/architecture.test.ts               FEATURE_ORDER gains launch                              (A)
tests/browser/support/launch.ts          beforeLaunch(context), atLaunch(context)                (A)
tests/browser/support/database.ts        addWishlistRow (C), wishlistOf (E)
tests/features/launch/…  tests/features/make/numbers.test.ts  tests/lib/server/mail.test.ts     mirror src/
tests/browser/play-gate.test.ts, launch-mail-job.test.ts, wishlist.test.ts, before-launch.test.ts;
  make.test.ts, maker-page.test.ts and join.test.ts gain cases
```

## Review Focus

Each line names an input the design implies and no ordinary test would meet. Each has its test in the task named.

1. One millisecond before 11:00 and 11:00 exactly, at each of the three gates: a wishlist is taken and then not; a member is refused and then plays; the job sends nothing and then sends (Tasks 1, 3, 5, 10).
2. `LAUNCH_TEST_SWITCH` set on a site whose address is not this machine, or the test cookie sent to the real site: the site refuses to start in the first case and ignores the cookie in the second (Task 2).
3. Two presses of Wishlist at the same moment, and a press on a page that is out of date (the button says "Wishlist" but the game is already on the list): one row, no error, and the list ends as the press asked (Tasks 3, 12).
4. Before launch, by typing the play address: a paying member, someone signed out on a free game, and a stranger. Each is sent back to the game; no pass and no session is stored; nobody is shown the price (Task 5).
5. The job started twice at the same moment, and started again after it finished: each person gets one email (Task 10).
6. A game removed from a wishlist before the job runs; every game removed; a wishlisted game its maker took off Ruken: the email leaves it out, and with nothing left to name no email is sent and none is recorded (Task 10).
7. An address not confirmed at 11:00 and confirmed that evening: nothing at 11:00, one email on the next run; a run more than seven days after launch sends nothing (Task 10).
8. Resend refuses one person in the middle of a run, or `MAIL_ALLOWLIST` holds a mail back: the others are sent, that person is not recorded, the log holds a code and no address, and the next run sends only to them (Task 10).
9. A link, a picture address or a form on another site that points at a game's wishlist address: nothing is added. `back=https://elsewhere.example`: the person lands on the game, never off the site (Task 12).
10. Signed out, Wishlist on game A, then a sign-up whose `next` was changed by hand to game B: B is not added; A is, when the person next opens it within thirty minutes (Tasks 12, 13).
11. A browser with no script: the button still adds and removes, by a full page load (Task 13).
12. A phone and a computer-only game before launch: "Opens 30 November" and Wishlist, no Play, no "This one needs a computer." (Task 13).
13. The maker's own play, staff's play, the maker's own wishlist: none is in the numbers; someone signed out playing a free game is (Tasks 3, 7).
14. A deleted account: its wishlist rows are gone and the maker's count drops; while it waits its 14 days it gets no email (Tasks 4, 10).
15. A game's name that holds `<b>` or is 40 characters of "W": the email shows it as typed, as plain text; nothing on the feed scrolls sideways with the Wishlist button there (Tasks 9, 13).

---

# Branch A: `wishlist/switch`

Needs slice 1 and slice 2's branch A, both on `main` today. Nothing a person can see changes with this branch.

### Task 1: The switch

**Files:**
- Create: `src/features/launch/switch.ts`, `src/features/launch/launch.ts`
- Modify: `tests/architecture.test.ts` (`FEATURE_ORDER` gains `"launch"` after `"games"`)
- Test: `tests/features/launch/switch.test.ts`

**Interfaces:**
- Produces, pure:
  - `LAUNCH_MS: number`: the instant of `2026-11-30T11:00:00[America/Chicago]`, worked out with `Temporal` (as `src/lib/clock.ts` does), never written as a number.
  - `isOpen(nowMs: number): boolean`: `nowMs >= LAUNCH_MS`.
  - `OPENS_WORDS = "Opens 30 November"`.
  - `launch.ts` re-exports the three.

- [ ] **Step 1 (red):**

```ts
it("opens at 11:00 in Chicago on 30 November 2026, and not a moment before", () => {          // Review Focus 1
  expect(LAUNCH_MS).toBe(Date.UTC(2026, 10, 30, 17, 0, 0));
  expect(isOpen(LAUNCH_MS - 1_000)).toBe(false);                                                // 10:59:59
  expect(isOpen(LAUNCH_MS - 1)).toBe(false);
  expect(isOpen(LAUNCH_MS)).toBe(true);                                                         // 11:00:00
});
it("stays open", () => { expect(isOpen(LAUNCH_MS + 400 * 24 * 60 * 60 * 1000)).toBe(true); });
it("says the day it opens, and the words cannot drift from the moment", () => {
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Chicago", day: "numeric", month: "long" }).format(LAUNCH_MS);
  expect(OPENS_WORDS).toBe(`Opens ${day}`);
});
```

  Stubs, and the name in `FEATURE_ORDER` (a feature folder that is not in the order fails the layer test, which is not this task's red). Push. Expected: `verify` fails in `switch.test.ts` only, with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 2: The journeys' switch

**Files:**
- Create: `src/features/launch/now.ts`, `src/features/launch/services.ts`, `tests/browser/support/launch.ts`
- Modify: `src/features/launch/launch.ts`, `playwright.config.ts` (the app's `env` gains `LAUNCH_TEST_SWITCH: "on"`, with a comment), `.env.example` (one commented line, under "Tests only")
- Test: `tests/features/launch/now.test.ts`

"Found while planning", 1. Every route in this plan asks for the launch time through this one function and never reads a clock itself.

**Interfaces:**
- Produces:
  - `TEST_LAUNCH_COOKIE = "rk_test_launch"`.
  - `createLaunchNow(settings: { LAUNCH_TEST_SWITCH?: string; BETTER_AUTH_URL?: string }, clock: Clock): (cookies: { get(name: string): string | undefined }) => number`.
    - `LAUNCH_TEST_SWITCH` missing or empty: the function answers `clock.epochMs()`, whatever cookie comes.
    - `"on"`: allowed only when `BETTER_AUTH_URL` parses as a URL whose protocol is `http:` and whose host name is `localhost` or `127.0.0.1`. Then the function answers `LAUNCH_MS + 86_400_000` (open), or `LAUNCH_MS - 86_400_000` when the cookie's value is exactly `before`.
    - `"on"` with any other address, or any other value of the setting: `createLaunchNow` throws `LAUNCH_TEST_SWITCH is for tests on this machine. Remove it from this site's settings.`
  - `launchServices(): { now(cookies): number }` in `services.ts`, built once from `process.env` and `systemClock` (Task 3 adds `wishlist`). `launch.ts` re-exports `launchServices`. A site with the switch wrongly set throws the first time anything asks for the launch time, so its pages fail rather than open early.
  - `tests/browser/support/launch.ts`: `beforeLaunch(context: BrowserContext): Promise<void>` adds the cookie `rk_test_launch=before` for the journeys' site, and `atLaunch(context)` removes it. Their first users are Tasks 5 and 8, on branches that do not need each other, so the helper is made here.
- A comment in `now.ts` says why the journeys' site is open by default: every journey of the earlier slices presses Play, and must not change with the date.

- [ ] **Step 1 (red):**

```ts
const clock = new TestClock("2026-11-20T12:00:00Z");
const none = { get: () => undefined };
const before = { get: (name: string) => (name === "rk_test_launch" ? "before" : undefined) };
it("reads the real clock when the switch is not set, whatever cookie comes", () => {            // Review Focus 2
  const now = createLaunchNow({ BETTER_AUTH_URL: "https://ruken.example" }, clock);
  expect(now(none)).toBe(clock.epochMs()); expect(now(before)).toBe(clock.epochMs());
});
it.each(["https://ruken.example", "https://localhost:4173", "http://localhost.evil.example", "not a url", undefined])(
  "refuses to start with the switch on at %j", (address) => {                                   // Review Focus 2
    expect(() => createLaunchNow({ LAUNCH_TEST_SWITCH: "on", BETTER_AUTH_URL: address }, clock)).toThrow("LAUNCH_TEST_SWITCH is for tests on this machine");
  });
it("refuses a value it does not know", () => { /* "true" and "off" throw the same words */ });
it.each(["http://localhost:4173", "http://127.0.0.1:4173"])("on this machine (%s) the site is open, and one cookie makes it the day before", (address) => {
  const now = createLaunchNow({ LAUNCH_TEST_SWITCH: "on", BETTER_AUTH_URL: address }, clock);
  expect(isOpen(now(none))).toBe(true); expect(isOpen(now(before))).toBe(false);
  expect(isOpen(now({ get: () => "after" }))).toBe(true);
});
```

  Stubs. Push. Expected: `verify` fails in `now.test.ts` with "not built yet"; `browser` passes (nothing reads the setting yet).
- [ ] **Step 2 (green):** the code and the two settings files. Push. Expected: all pass.

### Task 3: The wishlist: its tables and its service

**Files:**
- Create: `prisma/schema/launch.prisma`, `prisma/migrations/<timestamp>_wishlist/migration.sql`, `src/features/launch/wishlist.ts`
- Modify: `prisma/schema/accounts.prisma`, `prisma/schema/games.prisma` (relations), `src/features/launch/services.ts`, `src/features/launch/launch.ts`
- Test: `tests/features/launch/schema.pg.test.ts`, `tests/features/launch/wishlist.pg.test.ts`

**The tables** (design, "Stored"):

| Model | Columns |
|---|---|
| `Wishlist` | `id` (`cuid(2)`), `userId` (a `User`), `gameId` (a `Game`), `addedAt`, `createdAt`; unique on (`userId`, `gameId`); index on `gameId`. Removing a game deletes the row |
| `WishlistMail` | `userId` the id (a `User`), `sentAt`, `createdAt`; added and never changed (`reject_append_only_change('WishlistMail')`) |

Relations are `onDelete: Restrict`, as the other tables'.

**Interfaces:**
- Produces, from `createWishlist(deps: { db: PrismaClient; clock: Clock })`:
  - `add(userId: string, gameId: string, launchNowMs: number): Promise<"added" | "open">`: `isOpen(launchNowMs)` answers `"open"` and stores nothing (design: no wishlist after launch). Otherwise one row with the clock's time; a row that is already there is left as it is, and two adds at the same moment make one row and no error (`createMany` with `skipDuplicates`).
  - `remove(userId: string, gameId: string, launchNowMs: number): Promise<"removed" | "open">`: open answers `"open"` and deletes nothing; otherwise the row is deleted, and a row that is not there is not an error.
  - `slugsOf(userId: string): Promise<string[]>`: the slugs of the games on this person's list.
  - `countFor(gameId: string, makerUserId: string): Promise<number>`: the rows for this game, the maker's own left out.
  - `launchServices()` gains `wishlist`; `launch.ts` re-exports `type Wishlist` (the service's type).

- [ ] **Step 1 (red):** `schema.pg.test.ts`: both tables exist; a second `Wishlist` row for the same person and game rejects; a `Wishlist` row can be deleted; `UPDATE` and `DELETE` on `WishlistMail` reject; a second `WishlistMail` row for one person rejects. `wishlist.pg.test.ts`, with a `TestClock` and two games made as `tests/features/games/service.pg.test.ts` makes them:

```ts
const BEFORE = LAUNCH_MS - 1;
it("adds a game once, with the clock's time", async () => {
  expect(await wishlist.add(player, game.id, BEFORE)).toBe("added");
  expect(await wishlist.add(player, game.id, BEFORE)).toBe("added");
  expect(await prisma.wishlist.findMany()).toMatchObject([{ userId: player, gameId: game.id, addedAt: new Date(clock.epochMs()) }]);
});
it("makes one row from two presses at the same moment", async () => {                           // Review Focus 3
  expect(await Promise.all([wishlist.add(player, game.id, BEFORE), wishlist.add(player, game.id, BEFORE)])).toEqual(["added", "added"]);
  expect(await prisma.wishlist.count()).toBe(1);
});
it("removes it, and removing what is not there is not an error", async () => { /* "removed" twice; no row */ });
it("takes nothing from 11:00 on, and removes nothing", async () => {                            // Review Focus 1
  expect(await wishlist.add(player, game.id, LAUNCH_MS)).toBe("open");
  expect(await prisma.wishlist.count()).toBe(0);
  await wishlist.add(player, game.id, BEFORE);
  expect(await wishlist.remove(player, game.id, LAUNCH_MS)).toBe("open");
  expect(await prisma.wishlist.count()).toBe(1);
});
it("lists a person's games by slug", async () => { /* two games added: both slugs; another person's are not there */ });
it("counts the people who want a game, and not its maker", async () => {                        // Review Focus 13
  /* two players and the maker add it: countFor(game.id, maker) is 2; another game's count is 0 */ });
```

  Stubs. Push. Expected: `postgres` fails in both files (`relation "Wishlist" does not exist`, "not built yet").
- [ ] **Step 2 (green):** the schema, the migration (made with `prisma migrate diff` from `main`'s schema, then the trigger by hand, as slice 2's Task 1 was) and the code. Push. Expected: all pass, the migrations' drift check and the layer test included.

### Task 4: A deleted account's wishlist goes with it

**Files:**
- Modify: `src/features/accounts/deletion.ts`
- Test: `tests/features/accounts/purge.pg.test.ts` (add cases)

In the purge's transaction, beside the line that removes a person's GitHub connection: `tx.wishlist.deleteMany({ where: { userId } })`, with a comment: the games a person wanted are theirs. `WishlistMail` is not touched; a comment says why (it holds only the tombstone's id and when a mail went, and is add-only).

- [ ] **Step 1 (red):** a purged account has no `Wishlist` rows, and `countFor` its game drops by one (Review Focus 14); its `WishlistMail` row, if it had one, is still there; an account still inside its 14 days keeps its rows. Push. Expected: `postgres` fails in the first case (the row is still there).
- [ ] **Step 2 (green):** the line. Push. Expected: all pass. Branch A is ready to merge.

---

# Branch B: `wishlist/play-gate`

Needs branch A, and slice 2's branch F (`/g/<game>/play`) on `main`.

### Task 5: Nobody but a game's maker and staff plays before launch

**Files:**
- Create: `tests/browser/play-gate.test.ts`
- Modify: `src/features/play/sessions.ts`, `src/routes/g/[game]/play/+page.server.ts`, every test that calls `startPlay` (search `startPlay(`)
- Test: `tests/features/play/sessions.pg.test.ts` (add cases), `tests/browser/play-gate.test.ts`

**Interfaces:**
- Consumes: `isOpen` (Task 1), `launchServices().now` (Task 2), `playBasis` (slice 2, Task 17).
- Produces:
  - `startPlay(input: { game: LiveGame; viewer: … | null; clientAddress: string; launchNowMs: number })` answers, besides what slice 2 built, `{ refused: "not_open" }`. The rule, first in the function: when `isOpen(input.launchNowMs)` is false and `playBasis(…)` is neither `"own_game"` nor `"staff"`, it answers `{ refused: "not_open" }`; nothing is stored, no pass is made, and the rate limit is not touched. `launchNowMs` is required, so every caller must say what time it is. A comment says why the check is here and not in the route: this is the one place the ordinary Play hands out a pass. The route's `load` refuses nothing for launch before it calls `startPlay`.
  - `startReviewPlay` is not changed: only staff reach it.
  - The play route passes `launchNowMs: launchServices().now(cookies)`, and for `{ refused: "not_open" }` redirects (303) to `/g/<slug>`. Its other answers are as slice 2 built them.
- Every existing `startPlay` call in the tests gains `launchNowMs: LAUNCH_MS`; no assertion of theirs changes.

Grandma: someone who gets to a game's play address early lands on the game itself, which says "Opens 30 November". Nobody is shown a price for something they cannot use yet, and nobody sees an error.

- [ ] **Step 1 (red):** `sessions.pg.test.ts`:

```ts
const early = LAUNCH_MS - 1;
it("refuses a member, a stranger and a free game's visitor before launch, and stores nothing", async () => {   // Review Focus 1, 4
  expect(await service.startPlay({ game, viewer: member, clientAddress: "203.0.113.1", launchNowMs: early })).toEqual({ refused: "not_open" });
  expect(await service.startPlay({ game, viewer: stranger, clientAddress: "203.0.113.1", launchNowMs: early })).toEqual({ refused: "not_open" });
  expect(await service.startPlay({ game: freeGame, viewer: null, clientAddress: "203.0.113.1", launchNowMs: early })).toEqual({ refused: "not_open" });
  expect(await prisma.playPass.count()).toBe(0); expect(await prisma.playSession.count()).toBe(0);
});
it("lets a game's own maker and staff play before launch, and records why", async () => {
  /* the maker: a session with basis "own_game"; staff: basis "staff"; a maker on someone else's game: { refused: "not_open" } */ });
it("lets the member in at 11:00", async () => { /* launchNowMs: LAUNCH_MS → a frame address; basis "member" */ });
it("does not count a refused early press against the address's limit", async () => { /* 40 early presses, then one at LAUNCH_MS: it plays */ });
```

  `play-gate.test.ts`:

```ts
test.beforeEach(forgetRateLimits);
test("before launch a member who types the play address lands back on the game", async ({ page, browser }) => {   // Review Focus 4
  const game = await addGame(browser);
  await payAsNewMember(page);
  await beforeLaunch(page.context());
  await page.goto(`/g/${game.slug}/play`);
  await expect(page).toHaveURL(`/g/${game.slug}`);
  await expect(page.locator("iframe")).toHaveCount(0);
});
test("before launch nobody is shown the price for a game", async ({ page, browser }) => { /* signed out: /g/<slug>/play → /g/<slug>, never /join */ });
test("before launch a free game is closed too", async ({ page, browser }) => { /* addGame({ free: true }); signed out → /g/<slug> */ });
test("a maker plays their own game before launch", async ({ page, browser }) => {
  const game = await addGame(browser);
  await signInAs(page, game.makerEmail); await beforeLaunch(page.context());
  await page.goto(`/g/${game.slug}/play`);
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
});
test("staff play a game before launch", async ({ page, browser }) => { /* signInAsStaff(page); the same */ });
```

  Stubs (the new field, ignored). Push. Expected: `postgres` fails in the first new case (a frame address where `not_open` is expected); `browser` fails in the first three journeys (the game loads, or the price card shows).
- [ ] **Step 2 (green):** the rule and the route's redirect. Push. Expected: all pass, slice 2's and slice 3's journeys included: without the cookie the journeys' site is open.

### Task 6: `/join` holds payments until launch (only on the Owner's A to Q1)

**Do not start this task until the coordinator relays the Owner's answer to Q1.** On B or C, skip it, say so in the tracker, and branch B is ready after Task 5.

**Files:**
- Modify: `src/features/launch/switch.ts`, `src/features/launch/launch.ts`, `src/routes/join/+page.server.ts`, `src/routes/join/+page.svelte`
- Test: `tests/features/launch/switch.test.ts` (one case), `tests/browser/join.test.ts` (add cases)

- `switch.ts` gains `MEMBERSHIP_OPENS_WORDS = "Membership opens 30 November."`, re-exported by `launch.ts`, and `switch.test.ts` gains the same check `OPENS_WORDS` has, so the day in it cannot drift from the moment.
- `load` gains `opens: string | null`: `MEMBERSHIP_OPENS_WORDS` when `isOpen(launchServices().now(cookies))` is false, else null.
- The price card, before launch: the price and its two choices as today, and in place of the button, that line as ordinary text. "Not now" stays. The actions that start a payment redirect (303) to `/join` before launch, so a post by hand starts nothing.
- A member's card and the paused card are not changed.

Grandma: the card still says what it costs; one short line says when it can be bought; the way back is where it was.

Look: no new class; the line is ordinary text on the card, not a `problem` (nothing went wrong).

- [ ] **Step 1 (red):** the `switch.test.ts` case; and in `join.test.ts`, before launch (`beforeLaunch`): the price card shows "Membership opens 30 November." and no button named "Continue" or "Continue to payment", signed out and signed in; a post by hand to the pay action lands on `/join` and the stand-in Stripe saw no checkout; `showTheOwner` "the paywall card before launch". Without the cookie: the card is as today. Stub the constant as an empty string. Push. Expected: `verify` fails in the one new case; `browser` fails in the new cases (the button is there).
- [ ] **Step 2 (green):** the code. Push. Expected: all pass, slice 1's pay journeys included.
- [ ] **Step 3:** send the coordinator the two runs and one line for "the paywall card before launch". Mark the branch ready after "fine".

---

# Branch C: `wishlist/numbers`

Needs branch A, and slice 2's branch M (`/make/<game>`) on `main`.

### Task 7: How much a game was played

**Files:**
- Modify: `src/features/play/sessions.ts`
- Test: `tests/features/play/sessions.pg.test.ts` (add cases)

**Interfaces:**
- Produces, added to `createPlayService`: `playNumbers(gameId: string, since: Date, bases: readonly PlayBasis[]): Promise<{ plays: number; minutes: number }>`. Over this game's `PlaySession` rows whose basis is one of `bases` and whose `startedAt` is at or after `since`: `plays` is how many of them have at least one attentive beat; `minutes` is their counted time added up, in whole minutes, rounded down. Counted time is slice 2's rule: each attentive beat adds the time since the beat before it in its session (or since the session started), `LONGEST_COUNTED_GAP_MS` at most.
- An empty `bases` answers zeros without asking the database. The list is always named by the caller: the function has no default, so a basis counts only where someone wrote it down.
- One `$queryRaw`, because the page must not read a week of beats into the Worker: the gap before each beat is `"receivedAt"` minus `LAG("receivedAt") OVER (PARTITION BY "sessionId" ORDER BY "receivedAt", "id")`, or minus the session's `"startedAt"` for its first beat; each gap is cut with `LEAST` at the limit, passed in as a parameter from `LONGEST_COUNTED_GAP_MS`; attentive gaps are summed. A comment says that this is `countedMs` written for the database, and that the test below holds the two together. The database's `bigint` answers are turned into numbers before they leave the function.

- [ ] **Step 1 (red):** with `TestClock`, sessions and beats made through `startPlay` and `recordBeat`:

```ts
it("counts plays and whole minutes, exactly as countedMs does", async () => {
  /* a member's session of 9 attentive beats 15 s apart (135 s) and a free game's visitor's of 4 (60 s), both on one free game:
     { plays: 2, minutes: 3 }; and minutes equals Math.floor(sum of countedMs over the same rows / 60_000) */ });
it("counts only the bases it is given", async () => {                                            // Review Focus 13
  /* member, free_game, own_game and staff sessions, each with beats: with ["member", "free_game"] the maker's own and staff's are left out;
     with ["member"] only the member's counts; with [] it answers zeros */ });
it("does not call it a play when the person never touched the game", async () => { /* only beats that are not attentive: plays 0 */ });
it("counts a long silence as 45 seconds", async () => { /* one attentive beat ten minutes after the start, then 5 more 15 s apart: 120 s → minutes 2 */ });
it("leaves out a session that started before the window, and another game's", async () => {});
it("answers zeros for a game nobody played", async () => { expect(await service.playNumbers(game.id, since, ["member", "free_game"])).toEqual({ plays: 0, minutes: 0 }); });
```

  Stub. Push. Expected: `postgres` fails in the new cases with "not built yet".
- [ ] **Step 2 (green):** the query. Push. Expected: all pass.

### Task 8: A maker's numbers (`/make/<game>`)

**Files:**
- Create: `src/features/make/numbers.ts`
- Modify: `src/features/make/make.ts`, `src/features/games/service.ts` (`gameForMaker` also answers the game's `id` and `state`, if it does not already), `src/routes/make/[game]/+page.server.ts`, `+page.svelte`, `tests/browser/support/database.ts`
- Test: `tests/features/make/numbers.test.ts`, `tests/browser/make.test.ts` (add cases)

**The screen**, for a live game, under its state line. Before launch:

```
Tiny game
Live
See it on Ruken

Wishlisted by 12 people
Players can play from 30 November.  Play it yourself
```

After launch:

```
Played 340 times in the last 7 days
1,200 minutes played in the last 7 days
Wishlisted by 12 people before launch
```

**Interfaces:**
- Produces, pure, in `numbers.ts`, re-exported by `make.ts`:
  - `PLAYED_FOR_MS = 7 * 24 * 60 * 60 * 1000`.
  - `COUNTED_BASES: readonly PlayBasis[] = ["member", "free_game"]`, with a comment: how much a game was played, so free play counts and the maker's own and staff's do not (design).
  - `makerNumberLines(input: { open: boolean; wishlists: number; plays: number; minutes: number }): string[]`, the words under "The numbers' words" in the Calls, numbers written with `toLocaleString("en-US")`. Lines take no full stop (design 5.8: labels do not).
- `load`, for a game whose state is `live` only: `open` from `isOpen(launchServices().now(cookies))`; `wishlists` from `countFor(game.id, userId)`; when open, `playNumbers(game.id, new Date(systemClock.epochMs() - PLAYED_FOR_MS), COUNTED_BASES)` (the real clock: beats are stamped with it); it answers `numbers: string[]` and `playItYourself: boolean` (true before launch). A game in any other state gets no numbers.
- The page: right under the state line, one `<section data-numbers>` holding each line of `numbers` as a paragraph of ordinary text; before launch, the `note` "Players can play from 30 November." and beside it a link, "Play it yourself", to `/g/<slug>/play`.
- `tests/browser/support/database.ts`: `addWishlistRow(email: string, slug: string): Promise<void>`, one row written straight into the journeys' database (the button arrives in branch E).

Grandma: each number is a sentence a person would say, and says what it counts and over how long. There is nothing to press but the one link, which says what it does.

Look: no new class. The numbers are ordinary text; the line about players is a `note`; "Play it yourself" is a link, not a button (the page's one filled button stays "Send for review").

- [ ] **Step 1 (red):** `numbers.test.ts`:

```ts
it.each([[0, ["No wishlists yet"]], [1, ["Wishlisted by 1 person"]], [12, ["Wishlisted by 12 people"]], [1200, ["Wishlisted by 1,200 people"]]])(
  "before launch, %i wishlists read %j", (wishlists, lines) => {
    expect(makerNumberLines({ open: false, wishlists, plays: 99, minutes: 99 })).toEqual(lines);
  });
it("after launch, says plays, minutes, and who wishlisted before", () => {
  expect(makerNumberLines({ open: true, wishlists: 12, plays: 340, minutes: 1200 })).toEqual([
    "Played 340 times in the last 7 days", "1,200 minutes played in the last 7 days", "Wishlisted by 12 people before launch"]);
});
it("says one time, one minute and one person", () => {
  expect(makerNumberLines({ open: true, wishlists: 1, plays: 1, minutes: 1 })).toEqual([
    "Played 1 time in the last 7 days", "1 minute played in the last 7 days", "Wishlisted by 1 person before launch"]);
});
it("says less than a minute, not 0 minutes", () => {
  expect(makerNumberLines({ open: true, wishlists: 0, plays: 2, minutes: 0 })).toEqual(["Played 2 times in the last 7 days", "Less than a minute played in the last 7 days"]);
});
it("says one line when nobody played, and nothing about wishlists when nobody did", () => {
  expect(makerNumberLines({ open: true, wishlists: 0, plays: 0, minutes: 0 })).toEqual(["No plays in the last 7 days"]);
});
```

  `make.test.ts`:

```ts
test("before launch a maker sees how many people wishlisted their game, and can play it", async ({ page, browser }, testInfo) => {
  const game = await addGame(browser);
  await signInAs(page, game.makerEmail); await beforeLaunch(page.context());
  await page.goto(`/make/${game.slug}`);
  await expect(page.getByText("No wishlists yet")).toBeVisible();
  const one = await signUpInItsOwnContext(browser); const two = await signUpInItsOwnContext(browser);
  await addWishlistRow(one.email, game.slug); await addWishlistRow(two.email, game.slug); await addWishlistRow(game.makerEmail, game.slug);
  await page.reload();
  await expect(page.getByText("Wishlisted by 2 people")).toBeVisible();                          // the maker's own is not counted
  await expect(page.getByText("Players can play from 30 November.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Play it yourself" })).toHaveAttribute("href", `/g/${game.slug}/play`);
  await expectOneCard(page); await showTheOwner(page, testInfo, "a live game's numbers, before launch");
});
test("after launch a maker sees plays, and who wishlisted before", async ({ page, browser }, testInfo) => {
  /* the same game with two rows, no cookie: "No plays in the last 7 days" and "Wishlisted by 2 people before launch";
     no "Play it yourself"; showTheOwner "a live game's numbers, after launch" */ });
test("a game that is not live shows no numbers", async ({ page }) => { /* startGame(page): no text matching /wishlist|Played|No plays/i */ });
```

  `signUpInItsOwnContext` is slice 1's. Stubs. Push. Expected: `verify` fails in `numbers.test.ts` ("not built yet"); `browser` fails in the first two journeys (no such text).
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. A plays line above zero is not reached by a journey here (it needs the play screen); Task 15's journey reaches it. Say so in the report line.
- [ ] **Step 3:** send the coordinator the two runs (before: `main`; after: this branch) and one line each for "a live game's numbers, before launch" and "a live game's numbers, after launch". Mark the branch ready after "fine".

---

# Branch D: `wishlist/launch-mail`

Needs branch A, and slice 3's branch C (`liveGames`) on `main`. It must be deployed days before the 30th.

### Task 9: The email's words, and a key Resend can refuse a second copy by

**Files:**
- Create: `src/features/launch/mail.ts`
- Modify: `src/lib/server/mail.ts`
- Test: `tests/features/launch/mail.test.ts`, `tests/lib/server/mail.test.ts` (add cases)

**Interfaces:**
- `MailMessage` gains `idempotencyKey?: string`. `createResendMailer` sends it as the header `Idempotency-Key` when it is set, and sends no such header otherwise ("Found while planning", 4). A comment says what it is for.
- Produces, pure: `launchMessage(input: { to: string; userId: string; games: readonly { name: string; slug: string }[]; site: string }): MailMessage`: subject `Your games are out on Ruken`; `idempotencyKey` `launch-mail/<userId>`; the text below. `site` is the site's own origin (`BETTER_AUTH_URL`), never written in the repository.

```
Tiny game is out. Play it now:

https://ruken.test/g/tiny-game

Other game is out. Play it now:

https://ruken.test/g/other-game

You got this email because you used Wishlist on Ruken. It's the only one we'll send about it.
```

- [ ] **Step 1 (red):** `launch/mail.test.ts`: the subject, the key and the whole text above for those two games at `https://ruken.test` for user `u1`; one game gives one block and the same last line; a name holding `<b>bold</b>` is in the text exactly as typed (Review Focus 15); the games come out in the order given. `server/mail.test.ts`: with a key, the request to Resend carries `Idempotency-Key: launch-mail/u1`; without one, the header is absent; the body never holds the key. Stubs. Push. Expected: `verify` fails in both files.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass, slice 1's mail tests included.

### Task 10: One email a person, once

**Files:**
- Create: `src/features/launch/send.ts`
- Modify: `src/features/launch/launch.ts`
- Test: `tests/features/launch/send.pg.test.ts`

**Interfaces:**
- Consumes: `isOpen`, `LAUNCH_MS`, `launchMessage`, `Mailer`, `mailFailureCode`.
- Produces:
  - `LAUNCH_MAILS_A_RUN = 500`, `LAUNCH_MAIL_FOR_MS = 7 * 24 * 60 * 60 * 1000`.
  - `sendLaunchMails(deps: { db: PrismaClient; clock: Clock; mailer: Mailer; liveGames(): Promise<readonly { id: string; slug: string; name: string }[]>; site: string; log(line: string): void; max?: number }, launchNowMs: number): Promise<"not_open" | "over" | { sent: number; heldBack: number; failed: number; left: number }>`.
- What it does, in this order:
  1. `isOpen(launchNowMs)` false: `"not_open"`. `launchNowMs` at or past `LAUNCH_MS + LAUNCH_MAIL_FOR_MS`: `"over"`. Either way nothing is read and nothing is sent.
  2. The live games, read once.
  3. The people due: `User` rows that are `active`, with `emailVerified` true, at least one `Wishlist` row for a game that is live and no `WishlistMail` row, by their earliest `addedAt`. (So people whose only games left the site never fill a run.) The first `max` (default `LAUNCH_MAILS_A_RUN`) are done in this run; `left` is how many more are due.
  4. For each person, one transaction (its timeout raised to 15 seconds, for a slow answer from the mail service), in this order: insert their `WishlistMail` row with the clock's time; read their `Wishlist` rows, oldest first, and keep those whose game is live; with none left, roll back and go on; build `launchMessage` and `mailer.send` it. `true`: commit, `sent` rises. `false` (the allow-list held it): roll back, `heldBack` rises. A throw: roll back, `failed` rises, and one line is logged, `launch mail not sent: <mailFailureCode(error)>`, never the error's own text. An insert refused because the row is already there (another run got there first): skipped, counted as nothing.
- A comment beside the transaction says why the row is written first and the mail sent inside it: a second run at the same moment waits on the first's row, so two runs never both send to one person; and the row stays only if the mail went.

- [ ] **Step 1 (red):** with a `TestClock`, `createCaptureMailer` and `liveGames` as a plain function over the test's games; `AT = LAUNCH_MS`:

```ts
it("sends nothing a millisecond before 11:00, and sends at 11:00", async () => {                 // Review Focus 1
  expect(await sendLaunchMails(deps, LAUNCH_MS - 1)).toBe("not_open");
  expect(mailer.sent).toHaveLength(0); expect(await prisma.wishlistMail.count()).toBe(0);
  expect(await sendLaunchMails(deps, AT)).toEqual({ sent: 1, heldBack: 0, failed: 0, left: 0 });
});
it("sends one email that lists all of a person's games, in the order they added them", async () => {
  /* two games added a minute apart: one mail to their address; its text names both, first added first;
     its idempotencyKey is `launch-mail/${userId}`; one WishlistMail row with the clock's time */ });
it("sends nothing new on a second run", async () => {                                            // Review Focus 5
  await sendLaunchMails(deps, AT);
  expect(await sendLaunchMails(deps, AT)).toEqual({ sent: 0, heldBack: 0, failed: 0, left: 0 });
  expect(mailer.sent).toHaveLength(1);
});
it("sends each person one email when two runs start together", async () => {                     // Review Focus 5
  /* five people; await Promise.all([sendLaunchMails(deps, AT), sendLaunchMails(deps, AT)]); mailer.sent has 5 messages to 5 different addresses */ });
it("leaves out a game that was removed, and sends nothing to someone who removed them all", async () => {   // Review Focus 6
  /* the second person has no mail and no WishlistMail row */ });
it("leaves out a game that is no longer live", async () => {                                     // Review Focus 6
  /* liveGames answers one of the two: the mail names one; with neither live: no mail, no row */ });
it("waits for an address to be confirmed", async () => {                                         // Review Focus 7
  /* emailVerified false: sent 0, no row; set it true; the next run sends 1 */ });
it("mails nobody whose account is waiting to be deleted or is deleted", async () => {});         // Review Focus 14
it("does not record a mail the allow-list held back", async () => {                              // Review Focus 8
  /* a mailer whose send answers false: { sent: 0, heldBack: 1, failed: 0, left: 0 }, no row; with the capture mailer the next run sends 1 */ });
it("goes on past a person the mail service refuses, and tries only them next time", async () => { // Review Focus 8
  /* three people; the mailer throws Object.assign(new Error("to: someone@example.com refused"), { code: "RESEND", responseCode: 422 }) for the second:
     { sent: 2, heldBack: 0, failed: 1, left: 0 }; the log is ["launch mail not sent: RESEND 422"] and holds no "@"; two rows;
     the next run, with a mailer that works, sends 1, to the second person */ });
it("stops at its limit and says how many are left", async () => {
  /* max: 2 with three people due: { sent: 2, …, left: 1 }; the next run: { sent: 1, …, left: 0 } */ });
it("sends nothing more than seven days after launch", async () => {                              // Review Focus 7
  expect(await sendLaunchMails(deps, LAUNCH_MS + LAUNCH_MAIL_FOR_MS)).toBe("over");
});
```

  Stub. Push. Expected: `postgres` fails in `send.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 11: The job's address and its cron

**Files:**
- Create: `src/routes/jobs/launch-mail/+server.ts`, `tests/browser/launch-mail-job.test.ts`
- Modify: `src/features/launch/services.ts` (`launchServices()` gains `sendMails(launchNowMs)`, built from `prisma()`, `systemClock`, `authServices().mailer`, `gamesServices().service.liveGames`, `BETTER_AUTH_URL` and `console.error`; it asks for `gamesServices()` when it is called, not when `launchServices()` is built, so a page that only asks for the launch time needs none of the games' settings), `wrangler.jsonc`, `cloudflare/worker.js`, `tests/wrangler.test.ts`
- Test: `tests/wrangler.test.ts` (add cases), `tests/browser/launch-mail-job.test.ts`

- `POST /jobs/launch-mail`: 404 without the job's secret (`hasJobSecret`), as the daily job. Then `sendMails(launchServices().now(cookies))`: `"not_open"` answers 409 `{ "problem": "Ruken is not open yet." }`; `"over"` answers 410 `{ "problem": "The launch email is over." }`; otherwise 200 and the four numbers as JSON.
- `wrangler.jsonc`: `"crons": ["17 9 * * *", "*/10 17 30 11 *"]`, with a comment above it: the second is every ten minutes from 17:00 to 17:50 UTC on 30 November, which is 11:00 in Chicago, the launch; each run sends only what is left.
- `cloudflare/worker.js`: `const LAUNCH_CRON = "*/10 17 30 11 *";`. The scheduled handler, when `controller.cron === LAUNCH_CRON`, knocks on `/jobs/launch-mail` exactly as it knocks on the daily job (same headers), and throws unless the answer is 200 with `failed` and `left` both 0; the error's text gives the status or the four numbers and nothing else, so a run that did not finish shows as failed in Cloudflare and the next one carries on. For any other cron it does what it does on `main` when this task starts (one daily call today; two if slice 4's Task 25 has landed), unchanged.

- [ ] **Step 1 (red):** `tests/wrangler.test.ts`: `triggers.crons` is exactly the two expressions above; `cloudflare/worker.js` holds the second one, as text, and the address `/jobs/launch-mail`. `launch-mail-job.test.ts`:

```ts
test.beforeEach(forgetRateLimits);
const secret = { authorization: "Bearer test-only-jobs-secret", "content-type": "application/json" };
test("the job is not there without the secret", async ({ request }) => {
  expect((await request.post("/jobs/launch-mail")).status()).toBe(404);
  expect([404, 405]).toContain((await request.get("/jobs/launch-mail")).status());
});
test("with the secret it answers how many it sent", async ({ request }) => {
  const answer = await request.post("/jobs/launch-mail", { headers: secret });
  expect(answer.status()).toBe(200);
  const body = (await answer.json()) as Record<string, unknown>;
  for (const key of ["sent", "heldBack", "failed", "left"]) expect(Number.isInteger(body[key])).toBe(true);
});
test("before launch it sends nothing and says so", async ({ request }) => {
  const answer = await request.post("/jobs/launch-mail", { headers: { ...secret, cookie: "rk_test_launch=before" } });
  expect(answer.status()).toBe(409);
  expect(await answer.json()).toEqual({ problem: "Ruken is not open yet." });
});
test("the launch cron runs the job", async ({ request }) => {
  expect((await request.get(`/cdn-cgi/local/scheduled?cron=${encodeURIComponent("*/10 17 30 11 *")}`)).status()).toBe(200);
});
test("the daily cron still runs the daily job", async ({ request }) => {
  expect((await request.get("/cdn-cgi/local/scheduled")).status()).toBe(200);
});
```

  Push. Expected: `verify` fails in the two `wrangler.test.ts` cases; `browser` fails in the second and third journeys (404). The two cron journeys pass in the red (the handler makes the daily call for any cron): say so.
- [ ] **Step 2 (green):** the route, the cron and the handler. Push. Expected: all pass. The journeys' people have unconfirmed addresses and `MAIL_ALLOWLIST` holds every mail, so the job's answer there is small numbers and no mail; Task 10 is the proof of the sending.
- [ ] **Step 3: if the launch cron's journey cannot tell the two jobs apart.** A 200 from `/cdn-cgi/local/scheduled` shows the handler did not throw, not which address it knocked on. Add one check that does: after the launch-cron request, the job's own answer to a second hand-started call is still a 200 (nothing broke), and `tests/wrangler.test.ts` pins that the handler's `LAUNCH_CRON` branch names `/jobs/launch-mail` and the other branch does not. If Wrangler 4.156.0 does not hand `?cron=` to `controller.cron` ("Found while planning", 10), report what `controller.cron` was, keep the text checks, and do not loosen the handler's exact match.

Branch D is ready to merge. Tell the coordinator the day it was deployed.

---

# Branch E: `wishlist/button`

Needs branches A and B, and slice 3's branch D (the feed at `/` and at `/g/<game>`) on `main`.

### Task 12: The button's post, and what a screen is handed

**Files:**
- Create: `src/features/launch/view.ts`, `src/routes/g/[game]/wishlist/+server.ts`, `tests/browser/wishlist.test.ts`
- Modify: `src/features/launch/launch.ts`, `tests/browser/support/database.ts` (`wishlistOf(email): Promise<string[]>`, the slugs on a person's list)
- Test: `tests/features/launch/view.test.ts`, `tests/browser/wishlist.test.ts`

**Interfaces:**
- Produces:
  - `WISH_COOKIE = "rk_wish"`.
  - `wishlistView(deps: { now(cookies): number; wishlist: Wishlist }, input: { caller: Caller; cookies: Cookies; arrivedAt?: { id: string; slug: string } }): Promise<{ opens: string; wishlisted: string[] } | null>` in `view.ts`, re-exported by `launch.ts`. Open: null, and a leftover wish cookie is deleted. Before launch: when `arrivedAt` is given, the caller is signed in and the wish cookie's value is `arrivedAt.slug`, that game is added and the cookie deleted; then it answers `OPENS_WORDS` and `slugsOf` the caller (an empty list for someone signed out).
  - `POST /g/<game>/wishlist`, a form post with `want` (`on` or `off`) and an optional `back`:
    1. `liveGameBySlug(params.game)`; null is a 404. A `want` that is neither word is a 400.
    2. Open: nothing changes; the answer goes to `/g/<slug>`.
    3. Signed out: for `want=on` it sets the wish cookie to the slug (`httpOnly`, `sameSite: "lax"`, `secure` as the site's other cookies are, path `/`, 30 minutes); the answer goes to `` `/sign-up?next=${encodeURIComponent(`/g/${slug}`)}` ``.
    4. Signed in: `add` or `remove`; the answer goes to `safeNextPath(back)`, or `/g/<slug>` when `back` is missing or refused.
    5. The answer's form: a request whose `accept` header holds `application/json` gets 200 and `{ "on": true | false }` for step 4, or `{ "go": "<address>" }` for steps 2 and 3; any other request gets a 303 to that address.
  - There is no `GET`: a link cannot add a game. SvelteKit already refuses a form post from another site.

- [ ] **Step 1 (red):** `view.test.ts`, with plain functions for `now` and the wishlist and a small cookie jar: open answers null and deletes a leftover cookie; before launch, signed out: `{ opens: "Opens 30 November", wishlisted: [] }` and nothing is added; signed in with the cookie for the game they arrived at: it is added once, the cookie is gone, and its slug is in `wishlisted`; with the cookie for another game: nothing is added and the cookie stays (Review Focus 10); with no `arrivedAt`: nothing is added. `wishlist.test.ts`, each with `beforeLaunch(page.context())` unless it says otherwise, posting with `page.request` (which carries the page's cookies):

```ts
test.beforeEach(forgetRateLimits);
const post = (page: Page, slug: string, form: Record<string, string>, headers = {}) =>
  page.request.post(`/g/${slug}/wishlist`, { form, headers, maxRedirects: 0 });
test("signed in, a post adds the game and another takes it off", async ({ page, browser }) => {
  const game = await addGame(browser); const me = await signUp(page); await beforeLaunch(page.context());
  const added = await post(page, game.slug, { want: "on" });
  expect(added.status()).toBe(303); expect(added.headers().location).toBe(`/g/${game.slug}`);
  expect(await wishlistOf(me.email)).toEqual([game.slug]);
  await post(page, game.slug, { want: "on" });                                                   // a press on a page that is out of date
  expect(await wishlistOf(me.email)).toEqual([game.slug]);                                       // Review Focus 3
  await post(page, game.slug, { want: "off" });
  expect(await wishlistOf(me.email)).toEqual([]);
});
test("a script is answered in JSON", async ({ page, browser }) => { /* accept: application/json → 200 { on: true }, then { on: false } */ });
test("signed out, it remembers the game and goes to sign-up", async ({ page, browser }) => {
  /* 303 to /sign-up?next=%2Fg%2F<slug>; a cookie rk_wish with the slug, HttpOnly, Lax; in JSON: { go: that address } */ });
test("it never sends anyone off the site", async ({ page, browser }) => {                        // Review Focus 9
  /* signed in, back: "https://elsewhere.example" and back: "//elsewhere.example": location is /g/<slug> each time */ });
test("a link cannot add a game", async ({ page, browser }) => {                                  // Review Focus 9
  /* signed in: page.goto(`/g/${slug}/wishlist`) answers 404 or 405, and wishlistOf is [] */ });
test("a post from another site is refused", async ({ page, browser }) => {                       // Review Focus 9
  /* headers: { origin: "https://elsewhere.example" } → 403; wishlistOf is [] */ });
test("a game that is not live, and a want that is not a word, are refused", async ({ page }) => { /* 404; 400 */ });
test("from launch on, it adds nothing", async ({ page, browser }) => {
  /* no cookie: want=on → 303 to /g/<slug>; wishlistOf is [] */ });
```

  Stubs. Push. Expected: `verify` fails in `view.test.ts` ("not built yet"); `browser` fails in `wishlist.test.ts` (404 or 405 at the address).
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 13: Wishlist in the feed, and at a game's address

**Files:**
- Create: `src/features/launch/wish.ts`, `src/features/launch/launch.browser.ts`
- Modify: `src/features/feed/Feed.svelte`, `src/routes/+page.server.ts`, `src/routes/+page.svelte`, `src/routes/g/[game]/+page.server.ts`, `src/routes/g/[game]/+page.svelte`
- Test: `tests/features/launch/wish.test.ts`, `tests/browser/wishlist.test.ts` (add cases), `tests/browser/feed.test.ts` (one case)

**The screen**, before launch (the design's sketch):

```
┌─────────────────────┐
│                     │
│   (the game's clip) │
│─────────────────────│
│ @maker              │
│ FloorFifty          │
│ Up to 4 friends...  │
│ Opens 30 November   │
│ [ ♡ Wishlist      ] │
└─────────────────────┘
```

**Interfaces:**
- Produces, in `wish.ts`, with no browser API named in it, re-exported by `launch.browser.ts`: `sendWish(post: (body: URLSearchParams) => Promise<Response>, want: "on" | "off"): Promise<{ on: boolean } | { go: string } | "failed">`. It posts `want`, and answers the JSON's `on`, or its `go`; a response that is not 200, a body of another shape, or a `post` that rejects answers `"failed"`.
- `load` of `/`: gains `launch: await wishlistView(launchServices(), { caller: locals.caller, cookies })`. `load` of `/g/[game]`: the same, with `arrivedAt: { id: game.id, slug: game.slug }`, so the game a signed-out person pressed is added when they come back. Both pages pass `launch={data.launch}` to `<Feed>`.
- `Feed.svelte` gains the prop `launch: { opens: string; wishlisted: string[] } | null`. With null it is exactly as slice 3 built it. Play (or the computer-only line and its button) moves inside one `<div data-play-slot>` in every clip's band, open or not, with nothing else in it. Before launch that wrapper holds, in their place:
  - `<p>` with `launch.opens`.
  - `<form method="post" action="/g/<slug>/wishlist">` holding `<input type="hidden" name="want">` (`off` when the game is on the list, else `on`), `<input type="hidden" name="back" value="/g/<slug>">` and one `<button aria-pressed={on}>`: a heart drawn as one plain line shape (`aria-hidden`; filled when on) and the words "Wishlist", or "On your wishlist" when on.
  - With script, the form's submit is taken over: `sendWish` with `fetch` to the form's address and `accept: application/json`; `{ on }` changes that clip's button in place; `{ go }` goes there (`location.assign`); `"failed"` lets the form post in the ordinary way.
- Its styles, in the component: the button is exactly what Play is there (the band's width, 24rem at most, 48px tall at least, 12px corners, paper with an ink label, weight 600, 0.97 when pressed); the heart is 1em and takes the label's colour; the line above it is body text in chalk. On or off, the button's colours do not change: the words and the heart say which.

Grandma (the design's line): one button, a word everyone knows, and the date it opens right beside it. Pressed, it says "On your wishlist"; pressed again, it goes back.

- [ ] **Step 1 (red):** `wish.test.ts`: `{ on: true }` and `{ on: false }` come back as they are; `{ go: "/sign-up?next=%2Fg%2Fx" }` comes back; a 500, a body of `{}` and a rejected post are each `"failed"`; the body posted is `want=on`. `wishlist.test.ts` gains:

```ts
test("before launch a game shows the day it opens and Wishlist, and no Play", async ({ page, browser }, testInfo) => {
  const game = await addGame(browser); await beforeLaunch(page.context());
  await page.goto(`/g/${game.slug}`);
  const clip = clipOf(page, game.slug);
  await expect(clip.getByText("Opens 30 November")).toBeVisible();
  await expect(clip.getByRole("button", { name: "Wishlist" })).toHaveAttribute("aria-pressed", "false");
  await expect(clip.locator("[data-play-slot]").getByRole("button", { name: "Wishlist" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Play" })).toHaveCount(0);
  const box = await boxOf(clip.getByRole("button", { name: "Wishlist" })); expect(box.height).toBeGreaterThanOrEqual(48);
  await showTheOwner(page, testInfo, "the feed before launch");
});
test("signed in, one press adds the game and the next removes it", async ({ page, browser }, testInfo) => {
  const game = await addGame(browser); const me = await signUp(page); await beforeLaunch(page.context());
  await page.goto(`/g/${game.slug}`); const clip = clipOf(page, game.slug);
  await clip.getByRole("button", { name: "Wishlist" }).click();
  await expect(clip.getByRole("button", { name: "On your wishlist" })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(`/g/${game.slug}`);                                               // no page load
  expect(await wishlistOf(me.email)).toEqual([game.slug]);
  await showTheOwner(page, testInfo, "a game on your wishlist");
  await page.reload();
  await expect(clipOf(page, game.slug).getByRole("button", { name: "On your wishlist" })).toBeVisible();
  await clipOf(page, game.slug).getByRole("button", { name: "On your wishlist" }).click();
  await expect(clipOf(page, game.slug).getByRole("button", { name: "Wishlist" })).toBeVisible();
  expect(await wishlistOf(me.email)).toEqual([]);
});
test("signed out, Wishlist goes to the short sign-up and straight back to the same game, now wishlisted", async ({ page, browser }) => {
  const game = await addGame(browser); await beforeLaunch(page.context());
  await page.goto(`/g/${game.slug}`);
  await clipOf(page, game.slug).getByRole("button", { name: "Wishlist" }).click();
  await expect(page).toHaveURL(`/sign-up?next=%2Fg%2F${game.slug}`);
  const me = await fillSignUp(page);                                                             // slice 1's sign-up steps, on the page as it stands
  await expect(page).toHaveURL(`/g/${game.slug}`);
  await expect(clipOf(page, game.slug).getByRole("button", { name: "On your wishlist" })).toBeVisible();
  expect(await wishlistOf(me.email)).toEqual([game.slug]);
});
test("someone who already has an account signs in instead, and the game is on their list", async ({ page, browser }) => {
  /* as above, then "Sign in" on the sign-up page (it carries next), sign in as an account made earlier: the same end */ });
test("the remembered game is the only one added", async ({ page, browser }) => {                 // Review Focus 10
  /* signed out, press Wishlist on game A; change next by hand to /g/<B> and sign up: B's button reads "Wishlist", wishlistOf is [];
     open /g/<A>: "On your wishlist", wishlistOf is [A] */ });
test("in the feed at the front, a press adds the game without leaving", async ({ page, browser }) => { /* "/": the clip found by data-slug; URL stays "/" */ });
test("with no script the button still works", async ({ browser }) => {                           // Review Focus 11
  /* a context with javaScriptEnabled: false, signed up through the form, beforeLaunch: press → a page load back to /g/<slug> with "On your wishlist"; press → "Wishlist" */ });
test("a computer-only game on a phone shows the same before launch", async ({ page, browser }, testInfo) => {   // Review Focus 12
  /* addGame({ playsOn: "computer_only" }): "Opens 30 November" and Wishlist; no "This one needs a computer."; no "Share the link" */ });
test("a long name and the button do not push the feed sideways", async ({ page, browser }) => {  // Review Focus 15
  /* a 40-character name of "W": scrollWidth equals clientWidth */ });
test("from 11:00 the button is Play", async ({ page, browser }) => {
  /* no cookie: the clip has the link Play, inside its one [data-play-slot]; no text "Opens 30 November" and no button named "Wishlist" or "On your wishlist" */ });
```

  `fillSignUp(page)` is the part of slice 1's `signUp` that fills and sends the form on the page it is given; if `signUp` cannot be split that way, add it beside `signUp` in `tests/browser/support/account.ts`. In `feed.test.ts`, slice 3's case "Play is the only thing with words to press" gains its second half: with `beforeLaunch`, the only buttons with words in a clip are "Wishlist" or "On your wishlist". Stubs for `sendWish`. Push. Expected: `verify` fails in `wish.test.ts`; `browser` fails in every new case but the last (the clip shows Play).
- [ ] **Step 2 (green):** the component, the two loads, the helper. Push. Expected: all pass, slice 3's feed journeys included.
- [ ] **Step 3:** send the coordinator the two runs (before: `main`; after: this branch) and one line each for "the feed before launch" and "a game on your wishlist". Mark the branch ready after "fine".

---

# Branch F: `wishlist/maker-page`

Needs branch E, and slice 3's branch H (`/<handle>`) on `main`.

### Task 14: Wishlist on a maker's page

**Files:**
- Modify: `src/features/pages/MakerPage.svelte`, `src/routes/[handle=handle]/+page.server.ts`, `+page.svelte`
- Test: `tests/browser/maker-page.test.ts` (add cases)

- `load` gains `launch: await wishlistView(launchServices(), { caller: locals.caller, cookies })` (no `arrivedAt`: the wish cookie is spent at the game's own address). The page passes it to `<MakerPage>`.
- `MakerPage.svelte` gains the same prop as the feed. With null it is as slice 3 built it. Each game's Play moves inside one `<div data-play-slot>`, open or not. Before launch the wrapper holds, in its place, `launch.opens` and the same form as the feed's, with `back` set to `/<handle>`, taken over by `sendWish` in the same way. Signed out, the person goes to sign-up and lands on the game's own address, wishlisted (Task 12).
- Its styles, in the component: the button is exactly what Play is on that page, in the theme's button colours; the heart takes the label's colour; the line above it is the page's text colour.

Grandma: under each of a maker's games, the day it opens and one button, the same word as in the feed.

- [ ] **Step 1 (red):**

```ts
test("before launch a maker's page shows the day each game opens and Wishlist", async ({ page, browser }, testInfo) => {
  const game = await addGame(browser); const theme = THEMES[0]!;
  const made = await makePage(game.makerEmail, { handle: freshHandle(), name: "Night Owl", themeId: theme.id });
  const me = await signUp(page); await beforeLaunch(page.context());
  await page.goto(`/${made.handle}`);
  const games = page.getByRole("region", { name: "Games" });
  await expect(games.getByText("Opens 30 November")).toBeVisible();
  await expect(games.getByRole("link", { name: "Play" })).toHaveCount(0);
  const button = games.getByRole("button", { name: "Wishlist" });
  await expect(button).toHaveCSS("background-color", rgb(theme.button)); await expect(button).toHaveCSS("color", rgb(theme.buttonText));
  await button.click();
  await expect(games.getByRole("button", { name: "On your wishlist" })).toBeVisible();
  await expect(page).toHaveURL(`/${made.handle}`);
  expect(await wishlistOf(me.email)).toEqual([game.slug]);
  await showTheOwner(page, testInfo, "a maker's page before launch");
});
test("signed out on a maker's page, Wishlist ends on the game, wishlisted", async ({ page, browser }) => { /* → /sign-up?next=%2Fg%2F<slug> → /g/<slug>, "On your wishlist" */ });
test("from 11:00 a maker's page shows Play", async ({ page, browser }) => { /* no cookie: Play, and no "Opens 30 November" */ });
```

  Push. Expected: `browser` fails in the first two cases (the page shows Play).
- [ ] **Step 2 (green):** the component and the load. Push. Expected: all pass, slice 3's maker-page journeys included.
- [ ] **Step 3:** send the coordinator the two runs and one line for "a maker's page before launch". Mark the branch ready after "fine".

---

# Branch G: `wishlist/real-site`

### Task 15: The design's goals, in one journey and on the real site

**Files:**
- Create: `tests/browser/before-launch.test.ts`
- Modify: `docs/superpowers/progress.md`

- [ ] **Step 1: the goals, end to end, through the real screens.** One journey. A maker's game is accepted (`addGame`). A visitor, with `beforeLaunch`, opens `/`, finds the game with "Opens 30 November", presses Wishlist, signs up, and is back on the game with "On your wishlist"; they type the play address and land back on the game. The maker, with `beforeLaunch`, reads "Wishlisted by 1 person" on `/make/<game>`, presses "Play it yourself", and the game loads. Then launch, for both (`atLaunch`): the visitor's clip shows Play; a paying member plays the game with one attentive beat (slice 2's play-time journey's steps); the maker's page reads "Played 1 time in the last 7 days", "Less than a minute played in the last 7 days" and "Wishlisted by 1 person before launch"; the job, started with the secret, answers 200. Every part was built and tested by the tasks before, so this journey passes on its first push: a test with no red, and the report line says so. If it fails, the defect is in the task that owns the failing screen: fix it there, test first.
- [ ] **Step 2:** set this work's lines in `docs/superpowers/progress.md`: each of the design's four goals, and which journey or database test proves it.
- [ ] **Step 3: what a person checks on the real site before launch**, the Owner or the coordinator with the Owner, on a phone and on a computer, once every branch is on `main` and deployed. Nothing is typed into the repository; progress.md records what was checked, by whom and when, with no address and no email. An accepted game is in the feed and at its own address with "Opens 30 November" and Wishlist, and no Play. A second account (not staff, not the maker) presses Wishlist signed out, signs up, and is back on the game with "On your wishlist"; pressing again takes it off. That account's play address goes back to the game. On `/make/<game>` the maker reads the count, and "Play it yourself" opens the game. Cloudflare's page for the Worker lists two cron triggers. If Q1 was A: `/join` reads "Membership opens 30 November." and has no pay button.
- [ ] **Step 4: at 11:00 Chicago time on 30 November**, the same person. The feed shows Play on every game, and FloorFifty plays with no account (design 5.2). A stranger signs up, pays and is in the game they tapped (Q2's A: this is its first check by a person). The account that wishlisted, with its address confirmed, has one email, "Your games are out on Ruken", and its link opens the game. Cloudflare's log for the 17:00 UTC run shows it finished; if it shows a failure and the 17:50 run does too, the Owner runs the one command under "Where execution stops" and reads `left`. Later that day, `/make/<game>` reads plays and minutes. No second email arrives.
- [ ] **Step 5:** set this work's row in progress.md from what is true: "done" only when every branch is merged, `main` is green, and Steps 3 and 4 passed. Until 30 November it reads "built; the launch-day check is open".

---

## Notes for the plans that follow

- **After launch, a small clean-up, on the Owner's word:** the launch cron, the job, `launch/send.ts` and `launch/mail.ts`, the wish cookie, the Wishlist button in the two components, `add` and `remove`, and the journeys' switch all have no user once the email has gone and a week has passed. What stays is `isOpen` (true for ever, so it can go too), the `Wishlist` and `WishlistMail` rows, and "Wishlisted by 12 people before launch" on `/make/<game>`. Until that clean-up, the cron fires again on 30 November of the next year and the job answers "over".
- **A release date per game, and a wishlist after launch** (design, "Not in this") would replace the one constant with a date on the game. `isOpen` is asked in four places (`startPlay`, `wishlistView`, the wishlist service, the job); each would ask the game instead.
- **Deep analytics** (Owner: "Deep Later"): `playNumbers` is one query over a week of one game's beats on every open of `/make/<game>`. If the Worker's numbers ever show it slow, a sum kept per day is the first thing to try, the same answer slice 3's notes give for the feed's order.
- **The privacy text** (the Owner's, before live mode) should say that Ruken keeps which games a person wishlisted until they take them off or delete their account, and sends one email about them at launch.
- Worth the Owner's eye, left out on purpose: there is no limit on how fast one account can press Wishlist (each press changes at most one row of its own); a person who wishlists and never confirms their address gets no email, and nothing on the game's screen tells them so (`/me` does); an account that signs up before the mail domain exists must use "Confirm your email" on `/me` after 18 November; the count on `/make/<game>` includes accounts waiting their 14 days to be deleted; a maker can see how many people wishlisted, never who.
