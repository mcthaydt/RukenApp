# Plan audit: the wishlist before launch, and beta builds

Date: 2026-11-14. Stage 3 (plan audit), one session for both plans, because each relies on the other.

- Wishlist: design `docs/superpowers/specs/2026-11-14-wishlist-before-launch-design.md`; plan `docs/superpowers/plans/2026-11-14-wishlist-before-launch.md`, read as merged by #70 (`88715b7`).
- Beta builds: design `docs/superpowers/specs/2026-11-14-beta-builds-design.md`; plan `docs/superpowers/plans/2026-11-14-beta-builds.md`, read as merged by #69.
- Read beside them: `CLAUDE.md`, `AGENTS.md`, the main design, the plans of slices 2, 3, 4 and 5 and their audits, `docs/superpowers/progress.md`, and the code on `main` at `59fa8af` (`src/features/play/`, `src/features/games/`, `src/lib/server/`, `src/lib/safe-next.ts`, `src/lib/clock.ts`, `cloudflare/worker.js`, `wrangler.jsonc`, `playwright.config.ts`, `tests/architecture.test.ts`, `tests/support/`, `tests/browser/support/`).
- No test ran: this is a plan audit, and no session runs tests (CLAUDE.md). No code was written.

Line numbers are those of the plans before the fixes below.

## Counts

| Rank | Found | Fixed in the plans here | Left |
|---|---|---|---|
| Blocks execution | 1 | 1 | 0 |
| Should fix | 10 | 9 | 1 (S10, with the Owner as Q-A) |
| Note | 13 | — | 13 |

One question went to the Owner through the coordinator (Q-A, below).

## Blocks execution

### B1. Beta Task 10 changes `playNumbers` in a way the wishlist plan forbids, and its test cannot be typed

- Beta plan, lines 56, 67, 679 and 691; wishlist plan, lines 58 and 443 to 444.
- The wishlist plan was changed for beta after the beta plan read it (`2b5030b` to `88715b7`): `playNumbers(gameId, since, bases)` now takes the bases as a required argument and "has no default, so a basis counts only where someone wrote it down". The beta plan, merged later from its first reading, still says Task 10 adds a third, optional argument with the default `["member", "free_game"]`, and its test calls `playNumbers(id, since)` with two arguments, which typecheck refuses. The beta plan's own rule (line 64) makes the session that meets this stop, so Task 10 could not run as written.
- **Fixed (beta plan):** the row in "What this plan relies on" and "The wishlist plan", 2, now describe the wishlist's `playNumbers(gameId, since, bases)` and `COUNTED_BASES`. Task 10 no longer touches `src/features/play/sessions.ts`: it calls `playNumbers(game.id, since, ["beta"])`, and its database case names the bases on both calls (`COUNTED_BASES` answers 2, `["beta"]` answers 3). The file map's "playNumbers takes the bases to count" line is gone.

## Should fix

### S1. Where "Play the beta" goes against `data-play-slot`

- Beta plan, lines 627 and 646; wishlist plan, lines 60 and 773.
- The wishlist promises one `<div data-play-slot>` per clip "with nothing else in it", so that "a second line can go right under the button in either state". The beta plan says only "directly under that game's own button", and its test measures against "the Play link" and "the button named Wishlist". Put inside the slot, the link would break the wishlist's own promise; put anywhere else, it may not sit under the button.
- **Fixed (beta plan, Task 9):** the link is the element right after that game's `[data-play-slot]`, outside it, and the test measures its top against the bottom of `[data-play-slot]` in both states.

### S2. Where the beta's numbers go against `data-numbers`

- Beta plan, lines 434 and 688; wishlist plan, lines 61 and 497.
- The wishlist makes the numbers one block, `<section data-numbers>`, "anything else about the game goes below it". The beta's two lines are numbers too, but the plan says only "right after the game's own numbers, as ordinary text".
- **Fixed (beta plan, Task 10):** the beta's lines are paragraphs inside the same `<section data-numbers>`, after the game's own lines; Task 6's Beta section sits below that section and below the wishlist's "Players can play from 30 November." line.

### S3. A maker's page does not know the device

- Beta plan, line 627; slice 3 plan, Task 22 (the maker page's `load` hands each game its name, slug and upright clip, and no `needsComputer`).
- "None at all for a clip whose `needsComputer` is true" has nothing to read on a maker's page.
- **Fixed (beta plan, Task 9):** in the feed the rule stands; on a maker's page the link is shown as that page shows Play, and a phone that presses it on a computer-only game is sent to the game's page by Task 8's second step.

### S4. Beta's `startPlay` call needs the launch time

- Beta plan, line 407; wishlist plan, lines 360 and 363 (`launchNowMs` is required, "so every caller must say what time it is").
- **Fixed (beta plan, Task 5):** the case passes `launchNowMs: LAUNCH_MS` to `startPlay`.

### S5. The query for minutes must see every beat before it keeps the attentive ones, and must not count a negative gap

- Wishlist plan, line 445; `src/features/play/time.ts:22-27`.
- `countedMs` makes every beat the "before" of the next, attentive or not, and clamps each gap at 0 as well as at 45 seconds. A query that filters `attentive` in the same `SELECT` as its `LAG` takes each gap from the last attentive beat instead, and counts more than `countedMs` does after a look away; a query without the clamp at 0 differs for a first beat stamped before its session's start. The plan's test of nine beats 15 seconds apart would not catch the first.
- **Fixed (wishlist plan, Task 7):** the `LAG` is worked out over all of a session's beats in an inner query and the attentive ones are kept in the outer one; each gap is `GREATEST(…, 0)` then `LEAST(…, limit)`; one more case, "a look away starts the count again, as countedMs does" (attentive, not attentive, attentive, 15 seconds apart: 30 seconds, as `countedMs` answers).

### S6. `safeNextPath` does not say when it refused

- Wishlist plan, line 711, and its test at line 735; `src/lib/safe-next.ts:16-22`.
- `safeNextPath` answers `/` for an address it refuses, so "`safeNextPath(back)`, or `/g/<slug>` when `back` is missing or refused" would send `back=https://elsewhere.example` to `/`, and the plan's own journey expects `/g/<slug>`.
- **Fixed (wishlist plan, Task 12):** `back` counts only when `safeNextPath(back)` answers it unchanged; otherwise the answer goes to `/g/<slug>`.

### S7. The wishlist table says both "deleted with the game" and `Restrict`

- Wishlist plan, lines 291 and 294.
- Games are never deleted (a maker takes one off; staff take one down); every relation is `onDelete: Restrict`. "Removing a game deletes the row" invites a cascade.
- **Fixed (wishlist plan, Task 3):** the line now says a game is never deleted, so its rows stay, and a game that is not live is left out where it matters (the email reads live games; the screens show only live games).

### S8. "Refuses to start" is not what Task 2 builds

- Wishlist plan, lines 86 and 251.
- The Call says the site refuses to start with the switch on away from this machine; Task 2 builds a check that throws the first time anything asks the launch time. Either fails closed; the words should match what is built.
- **Fixed (wishlist plan, the Calls):** "the first time anything asks for the launch time, the site throws, so its pages fail rather than open early".

### S9. The dates were not set against the chain

- Wishlist plan, line 135.
- See "The dates", below. The wishlist plan named only F as able to slip.
- **Fixed (wishlist plan, "For 25 November"):** one paragraph with the chain as it stands on 14 November and which branches are at risk.

### S10. Q1 and "they can play early" cannot both hold on the real site

- Wishlist plan, lines 82 and 409 to 428 (Q1, Task 6); beta design, "What the Owner decided" ("yes, they can play early") and "Needs, and when"; beta plan, line 665 (Task 9, step 4).
- Only members play a beta. If the Owner answers A to the wishlist's Q1, `/join` takes no payment before 11:00 on the 30th, so nobody can become a member on the real site before launch, early beta play there applies to nobody, and beta Task 9 step 4 (a test-account member, before launch) cannot be done. CI still proves early beta play, because the journeys' site is open by default.
- **Not fixed: the Owner's.** Sent to the coordinator as Q-A.

## Notes

1. **`LAUNCH_TEST_SWITCH` cannot open the real site** (wishlist plan, Task 2; `playwright.config.ts:48-80`; `src/features/games/services.ts:46-52` for the pattern). Checked: the real site's `BETTER_AUTH_URL` is `https://` (`.env.example`: "with https://"), so the switch with that address throws; the plan's test covers `https://localhost`, `http://localhost.evil.example`, a non-address and a missing one; without the switch the cookie is never read; any other value of the switch throws. The check runs where the launch time is asked, so a wrongly set site fails closed (S8). The only way past it is a real site whose own address is `http://localhost`, where sign-in would not work either.
2. **The cron is right for 11:00 CST on 30 November 2026.** Daylight time in Chicago ended on 1 November 2026, so the 30th is UTC−6 and 11:00 is 17:00 UTC; `*/10 17 30 11 *` fires at 17:00, 17:10 … 17:50 UTC that day (a Monday). It also fires every 30 November after; the job answers `"over"` then (seven days), so it mails nobody. After 17:50 there is no further run: someone who confirms their address later is mailed only by a hand run (Review Focus 7's "next run" is the Owner's command).
3. **The launch mail cannot double-send through two runs.** The `WishlistMail` row is inserted first in each person's transaction and is unique per person, so a second run's insert waits on the first's lock and then fails, and is skipped; the row commits only after Resend said yes. The one window left is a mail Resend accepted whose commit then fails: the next run sends it again with the same `Idempotency-Key`, which Resend refuses to repeat within 24 hours. Two corner cases remain and are small enough to leave: Resend refuses a reused key whose body differs (a game left Ruken between the two runs), which shows as `failed` for that person until 24 hours pass; and a hand run more than 24 hours later would send again. Neither needs the person to have done anything twice.
4. **A person Resend always refuses makes every run "fail" in Cloudflare** (wishlist plan, Task 11: the handler throws unless `failed` and `left` are 0). Running again does not help them; `left` is what the Owner reads (Task 15, step 4 already says so).
5. **Resend's own limits are the Owner's account.** The free plan sends 100 mails a day; more people than that are `failed` until the plan allows them, and are mailed by a later run. Nobody is mailed twice. Worth the Owner's eye before 30 November.
6. **Workers Paid** (slice 2's S1) gives the cron's run room for 500 Resend calls in one invocation; a free plan's 50 would not. S1 is already the Owner's.
7. **The transaction holds a database lock across one call to Resend.** The purge already uses an interactive transaction through the request-scoped adapter (#68), so this is expected to work; the first push of Task 10 shows it.
8. **`$queryRaw` with a list of enum values** needs the cast (`"basis" = ANY(${bases}::"PlayBasis"[])`); Prisma passes a text array otherwise. The executor meets this in the first red-to-green push.
9. **A suspended maker's beta** (slice 4, Task 18): `betaFor` does not carry the suspension condition, but `/g/<game>/play` asks `liveGameBySlug` first, which does, so the beta answers 404. `slugsFor` may name a game the feed no longer shows; nothing reads it for that game.
10. **`startBetaPlay`'s type** is `StartedPlay | { refused: "not_tester" }`; once the wishlist lands, `StartedPlay` also holds `join` and `not_open`, which `startBetaPlay` never answers. Harmless; a narrower type can come with the code.
11. **Staff cannot play an accepted beta** unless they are a picked member: `startReviewPlay` is for a waiting beta. As the design says.
12. **Both plans were written against `main` at `d497163`**; `main` is now `59fa8af` (slice 3's themes, #66; the Worker memory fix, #68; the beta plan, #69). Nothing either plan names changed: `FEATURE_ORDER` (`tests/architecture.test.ts:12-23`) is as both plans list it, without `launch`.
13. **Both `cloudflare/worker.js` edits** (wishlist Task 11, slice 4 Task 25) are already called out in the wishlist plan; whichever lands second merges `main` in and keeps both.

## The two plans against each other

| What | Wishlist plan | Beta plan | Fits |
|---|---|---|---|
| Layers | `launch` after `games` in `FEATURE_ORDER` (Task 1) | the same list; nothing in `games` reads `launch` | yes |
| The before-launch refusal | inside `startPlay`, keyed on the basis; the route refuses nothing before it (Task 5) | `startBetaPlay` asks no launch time; the `?beta=1` branch comes before `startPlay` (Tasks 5, 8) | yes |
| `startPlay`'s input | `launchNowMs` required | one test call lacked it | fixed (S4) |
| `playNumbers` | `(gameId, since, bases)`, no default | an optional third argument | fixed (B1) |
| `data-play-slot` | one wrapper per clip, nothing else in it | "under the button" | fixed (S1) |
| `data-numbers` | one section under the state line | "after the game's own numbers" | fixed (S2) |
| `beforeLaunch`, `atLaunch` | Task 2 | Task 8's early-play journey | yes |
| `Feed.svelte` and `MakerPage.svelte` props | `launch` | `betaSlugs` | yes; separate props |

## The plans against slices 2, 3, 4 and 5

Checked by name and signature, in the code on `main` where it is there and in the slice's plan where it is not:

- On `main`: `startPlay({ game, viewer, clientAddress })`, `StartedPlay`, `PLAY_STARTS_PER_ADDRESS`, `recordBeat`, `playSummary` (`src/features/play/sessions.ts`); `PlayBasis` with four values and `playBasis` (`may-play.ts`; `play.ts` exports the type); `countedMs`, `LONGEST_COUNTED_GAP_MS` (`time.ts`); `LiveGame` with `id`, `slug`, `name`, `makerUserId`, `freeToPlay`, `livePullId`, `connectHosts` (`games/service.ts`); `pullGame(deps, gameId)`, `checkBranch`, `GameError` and its five codes; `createGamesServices(source, parts)`; `createRateLimiter(prisma, clock)`; `Mailer.send` answering a boolean, `mailFailureCode`, `MailMessage` (`to`, `subject`, `text`); `hasJobSecret`; `safeNextPath`; `User.emailVerified`, `UserStatus`; the purge's transaction and its GitHub line (`deletion.ts:118`); `TestClock(string)`, `createCaptureMailer().sent`, `signUp`, `signUpInItsOwnContext`, `payAsNewMember`, `forgetRateLimits`, `boxOf`, `expectOneCard`, `showTheOwner`, `rgb`.
- Slice 2's plan: `addGame(browser, { name?, playsOn?, free? })` answering `{ slug, name, publicId, makerEmail, makerUserId }`; `signInAs`, `signInAsStaff`, `submitGame`, `startGame`, `sessionsOf`, `endMembershipOf`; `gameForMaker`, `stateWords`, `sendForReview` ("its newest pull"), `waitingGames`, `accept`, `sendBack`, `takeOff`, `putBack`, `FileStore.deleteAll`; `startReviewPlay({ game, pullId, staffUserId })`, `staffOnly`, `GAME_STAFF_ROLES`; the play route's `load` order (Task 21: the game, a phone on a computer-only game, then `startPlay`).
- Slice 3's plan: `liveGames(filter?)` answering `ListedGame extends LiveGame` (so `id`, `slug`, `name`) in the games service; `memberBeatsByGame(since)` reading `member` sessions; `FeedClip` with `slug` and `needsComputer`; `Feed.svelte`'s `section[data-slug]` and its Play link; `MakerPage.svelte`'s `<section aria-label="Games">` and one `<article>` a game; `clipOf`, `makePage`, `freshHandle`, `THEMES`; `pageByHandle` with `makerUserId`, `handlesOf`.
- Slice 4's plan: `takeDown` (Task 10), `sweepOldPulls` and its four conditions (Task 25), the second call in the scheduled handler, suspension leaving games out of `liveGameBySlug` and `liveGames` (Task 18).
- Slice 5's plan: the roll-up reads `member` sessions only.

All are there with the shapes the two plans use, apart from what is fixed above.

## The dates, honestly

As `main` and progress.md stand on 14 November: slice 2's branches A to E, P and S0 are merged; M is a draft (#63); S and F have not started. Slice 3's branch A is merged; B to J have not started. Slice 4 has not started.

- **Wishlist on `main` by Wednesday 25 November.** A can start today. B needs slice 2's F; C needs slice 2's M; D needs slice 3's C, which needs slice 2's M, P and S. E needs B and slice 3's D, which needs slice 3's C and slice 2's F. F needs E and slice 3's H, which needs slice 3's B and D. So E, the branch that puts Wishlist in the feed, is at the end of a chain of five other branches (slice 2's M, S and F; slice 3's C and D) plus B, and one "fine" round on its screenshots. At the pace of 13 and 14 November (seven slice-2 branches merged in two days) A to E by the 25th is possible with no slack; F is the likeliest to slip, as the plan already says. D must also be deployed days before the 30th, and the site's first deploy waits on the Owner's domain (18 November).
- **Beta on `main` by Friday 27 November.** A needs slice 2's M, P and S; B adds slice 3's B; D follows the wishlist's C; C needs the wishlist's B, E and F and slice 3's D and H, so it cannot start before the wishlist is finished and has at most two days with a "fine" round inside them; E needs slice 4's branch L, and slice 4 has not started. A, B and D by the 27th are likely; C is at risk, as the beta plan already says; E will most likely land after launch, which the plan allows (it breaks no line of the design: a replaced beta's files stay in the bucket until then).

## Question for the Owner (sent to the coordinator)

**Q-A. Can anyone play a beta early on the real site?** With the wishlist's Q1 answered A, nobody can become a member before 11:00 on 30 November, so early beta play applies to nobody there and the beta's real-site check waits for launch day.

- (a) Q1 = A; the beta's real-site check moves to launch day or later, and early beta play is proven in CI only. **The pick:** it matches "we won't tell anyone until everything is done", and nothing new is built.
- (b) Q1 = B (no code; Stripe in test mode until launch morning): test accounts can pay and test betas early on the real site, but anyone who finds the site can "pay" with a test card, and those memberships stay active after the switch to live unless they are cleared.
- (c) Q1 = C: real payments before launch, which needs live payments open early; the Owner said that waits until the app is finished.

## Fixes made in this session

Each is in the plan named, with the finding above:

- Beta plan: B1 (lines 56, 67, 141 to 160's file map, Task 10), S1 (Task 9), S2 (Tasks 6, 10), S3 (Task 9), S4 (Task 5).
- Wishlist plan: S5 (Task 7), S6 (Task 12), S7 (Task 3), S8 (the Calls), S9 ("For 25 November").
