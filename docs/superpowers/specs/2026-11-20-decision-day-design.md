# Decision day and the weekly seats

Staged path, spec stage. Lane 3 (a migration and `cloudflare/`), so this spec has a plan audit before it merges, and each lane 3 unit has the Owner's approval before its merge. Cycle 3: this version answers the ten red findings and six notes of `audits/2026-11-20-decision-day-1-plan-audit.md` (named (F1) to (F10) and (N1) to (N6) where they landed), the two reds and note of cycle 2 ((F11), (F12), (N7)), and the Owner's three card answers.

## 0. The Owner's words

- **Owner, 2026-11-17 06:52 UTC:** "Slow number of seats makes the most sense, we pick one day where everyone finds out if they got accepted, it becomes a ritual, the number of acceptances per week is capped but grows every 3 months up to 500 total worldwide maximum".
- **Owner, 2026-11-17 06:53 UTC, on a card:** the 500 is "500 a week, at most": the weekly number grows every 3 months until it reaches 500 games a week, then stays there.
- **Owner, 2026-11-17 06:47 UTC:** maker screens get an Accepted screen "with the blurred background similar to the one where we first submit it", and the acceptance rate "on the first screen at the top like a label".
- **Owner, 2026-11-17 06:50 UTC, on a card:** until 20 games are decided the label says "A person checks every game."; from 20 on it shows the measured rate.
- **Owner, 2026-11-20 00:16 UTC, on three cards:** decision day is "Friday, noon New York time"; "10 a week" to start; the seats grow by "Half again each time" every 3 months.

This builds on the review command of unit S (`POST /jobs/review`, `src/routes/jobs/review/+server.ts`, merged in #194) and lines up with the game facts spec (#195), which adds parts to that command and writes `firstLiveAt` on a game's first yes.

## 1. What happens in a week

1. Makers send games in, any day, as now.
2. During the week the Owner looks at each waiting game and says yes or sends it back, with the same command as now. For a **new game**, nothing changes for its maker yet: the decision is **held**.
3. Each week has a number of **seats**: how many new games can get a yes that week. Once the seats are taken, the command refuses another yes for that week. A game left waiting stays in the list for the next week.
4. On **decision day**, at one moment, every held decision goes out together: each yes makes its game live, each send back sends its game back, and each maker sees their answer the next time they open Ruken. Makers whose game got in see the Accepted screen (section 5.2).

What is **not** held, and uses no seat: an update to a live game, and a game that **was live before** (section 1.3). Those are decided at once, as today, since the game already has its place. Call (section 8).

### 1.1 The moment

Decision day is every **Friday at 12:00 noon, New York time**, stored as a weekday, a time and a zone (`America/New_York`), so it stays at noon local time across daylight saving. A decision is held for the first decision day whose moment is after the decision was made **and that has not gone out yet** (F6): a yes at 11:59 on a Friday goes out at noon that day; a yes at 12:00 goes out the next Friday.

### 1.2 The seats

- The first decision day is the first Friday after H's last commit (below). D ships `src/features/games/library/decision-days.json` with `"firstDay": null`, which means the ritual is off and `seats.ts` names no decision day; H writes the date (from `date`, never typed) in its last commit, after the Owner's approval of H's merge: the first Friday after that commit (N1, N7).
- Seats on the first decision day: **10**.
- Every 3 months after the first decision day, the seats grow. Step n starts on the first decision day on or after the first decision day's date plus 3n calendar months; a date past the end of its month is clamped to the month's last day (30 November plus 3 months is 28 February, or 29 in a leap year) (N2). The seats grow **by half again**: at step n, the starting seats × 1.5ⁿ, rounded half up to a whole game once (never rounding a rounded number), and never above **500**: 10, 15, 23, 34, 51, 76, 114, 171, 256, 384, 500. It reaches 500 at step 10, about two and a half years.
- The schedule lives in code (`decision-days.json` and the pure `seats.ts`), never typed into the database. Each decision day's seats are recorded on its row when it goes out, so a later change to the schedule never rewrites what a past week had.
- Only a held yes takes a seat. A send back takes none.

### 1.3 Decisions that took effect, and "was live before"

A `GameReview` row is one of three things (F1, F2):

- **At once**: `goesOutOn` is null. It took effect when it was made. Every review on `main` before D is one of these.
- **Held**: `goesOutOn` names a day with no `DecisionDay` row yet. It has **not** taken effect, and nothing a maker sees may read it.
- **Gone out**: its day has a row, and the release wrote a `DecisionOutcome` row for it saying `applied` or `lapsed` (section 4). Only `applied` took effect.

**A decision that took effect** is one at once, or gone out and `applied`. Every reader of `GameReview` outside the review command and the release reads only these, through one shared Prisma filter in `service.ts` (`tookEffect`): `{ OR: [{ goesOutOn: null }, { outcome: { result: "applied" } }] }`.

**A game was live before** when it has a decision that took effect as a yes (F4). That is the one test, in one function (`wasLiveBefore`), for the review command's hold choice, the Accepted screen and the waiting line. It does not read `firstLiveAt`, so it works whether or not K is on `main`.

## 2. The review command

The command stays one `POST /jobs/review` with the job secret, and its JSON stays readable in a terminal. What changes:

- **`list`** says the week first: `"says": "3 games are waiting. 7 of 10 seats are taken for Friday 27 November."` Each waiting game also says `"decided": "yes"`, `"sent back"` or `null` (a held decision on it that has not lapsed), and its `"kind"` is `"game"` (would be held), `"back"` (was live before, decided at once, no seat; F4) or `"update"` (live).
- **`accept`** for a game that would be held, with a seat left: holds the yes and answers `"Floor Fifty gets in on Friday 27 November. 8 of 10 seats are taken."` With no seat left it changes nothing and answers 409, `"This week's 10 seats are taken. Send it back, or leave it for next week."`
- **`send-back`** for a game that would be held: holds it and answers `"Floor Fifty goes back to its maker on Friday 27 November."`
- **`accept` or `send-back`** on a game with a held decision that has not lapsed: 409, `"You already decided on Floor Fifty. It goes out on Friday 27 November."` A held decision is final (section 8). A game whose held decision lapsed can be decided again, and that new decision is held as any other.
- `"update"` and `"back"` games: as today, at once; an at-once yes also writes `acceptedSeenAt` when it is null (F5).
- `look` is unchanged apart from saying `"decided"` and `"kind"` as `list` does.

**One lock (F6).** Holding a decision and sending a day out both run inside one transaction that first takes `pg_advisory_xact_lock` on one fixed key (a constant in `service.ts`, named for this). Inside it, a hold picks the first decision day after now that has no `DecisionDay` row, counts that day's seats taken, and writes. So two yeses at the last seat cannot both get in, and a yes that commits while a release runs waits for it and is then held for the next day, never left on a day that has already gone out.

The words for a day are made by one pure function (`dayWords`, "Friday 27 November", the decision day's own date in its own zone), with tests.

**A maker changes a waiting game (F3).** A maker can still change a waiting game: its answers and videos are saved at once (`saveAnswer`, `saveClip`), and Check and send can copy new files (`pullLatest`). **Every maker write to a waiting game** writes `Game.changedAt` in the same write (F12); on `main` today those are those three. A held decision applies only to the game as it was decided: it **lapses** when the game's waiting pull is no longer the one it names, or when `changedAt` is after its `decidedAt`, or when the game is no longer waiting. A lapsed decision's seat is free again in `list` at once (the seats count uses the same test), and the game stays waiting for the Owner to look at again. The maker is told nothing about a decision that lapsed, since they were never told it was made.

**What changes on `main` for held decisions (F1).** H moves these readers to `tookEffect`, so a held or lapsed decision changes nothing a maker sees:

- `ownGame` (`service.ts:477`), and the name answer that keeps the address once a game has a yes (`:525`): a held yes leaves the address following the name.
- `gameSelect` and `makerView` (`:798` `everLive`, `:814` `sentBackLast`, and `partsToFix`): a held yes does not set `addressStays` on the name question (`src/routes/make/[game]/[question=question]/+page.server.ts:173`), and a held send back shows nothing to fix.
- `gamesOf` (`:891` `sentBackLast`).
- `waitingGames` and `gameForReview` read every review, since the command is where held decisions are shown.

**Lining up with #195.** Unit Q of the game facts spec changes `review-order.ts` and what `look` shows. K writes `firstLiveAt` "on the first yes"; with this spec the write that first makes a game live is the release (or an at-once yes, which for a game never live cannot happen once H is on `main`). Whichever of K and H merges second moves that write. #195 also adds maker writes to a waiting game (screenshots and videos by position in K, the new answers in Q): whichever of H and K or Q merges second makes each of them set `changedAt`, with a test each that it makes a held decision lapse (F12). #195 section 3 already says "if a later spec makes games go live on a set day after the yes, it is that write instead".

## 3. The release

- A job, `POST /jobs/decision-day`, with the job secret, answering 404 without it, like the other jobs.
- It finds **every** decision day whose moment has passed and that has no `DecisionDay` row, and sends them out **oldest first, each in its own transaction**, under the lock of section 2 (F7). If there is none, it answers `{ "says": "Nothing to send out." }` and changes nothing.
- For one day, in its transaction: for each decision held for that day, if it has lapsed (section 2) the release writes its `DecisionOutcome` as `lapsed` and changes nothing else; otherwise a yes does what `accept` does today (state `live`, `livePullId`, clears what was waiting and what was to fix, `firstLiveAt` once K is on `main`) and a send back does what `sendBack` does today (state `sent_back`, `toFix` from the decision's parts), and the release writes its `DecisionOutcome` as `applied` (F2). Then it writes the day's `DecisionDay` row with the seats it had and the time it went out.
- Answer, one line per day: `{ "says": ["Friday 27 November went out: 8 got in, 5 went back."] }`, counted from that day's `applied` outcomes.
- It runs again safely: a day with a row is never sent out twice (the row's unique day refuses a second, and its transaction rolls back).
- **The schedule.** `wrangler.jsonc` gets a second cron, `"0 * * * *"` (every hour, on the hour). Which job each cron knocks on is a table in a small pure module beside the Worker, `cloudflare/crons.js`: `"17 9 * * *"` knocks on the purge and money jobs, as today, and `"0 * * * *"` on `/jobs/decision-day` only; a cron not in the table throws (F10). `worker.js`'s `scheduled` reads `controller.cron` and knocks on that cron's paths. An answer other than 200 throws, so a failed run shows in Cloudflare.
- A decision day at noon New York time goes out on the hour it starts. If Cloudflare fires that hour's run a moment early, the job finds nothing due and the day goes out on the next hour, still within section 9's hour (N4).
- Cron triggers per account are limited by plan (Cloudflare's Workers limits page, https://developers.cloudflare.com/workers/platform/limits/, "Cron Triggers"). This Worker has one today and adds one (N5); H's session reads that page before building and stops if two do not fit.

## 4. What is stored

One migration (unit D), adding:

- **`DecisionDay`**: `day` (a date, unique: the decision day in its own zone), `seats` (the seats it had, from the schedule), `wentOutAt` (timestamptz). Added and never changed (the add-only trigger, as `GameReview` has). A row means: this day's decisions went out at this time.
- **`GameReview.goesOutOn`**: a date, null for a decision that took effect at once. Set when the decision is made, never changed (the table is already add-only).
- **`DecisionOutcome`** (F2): `reviewId` (unique, to `GameReview`), `result` (an enum, `applied` or `lapsed`), `createdAt`. Added and never changed (the add-only trigger). Written only by the release, one per held decision of the day it sends out. A CHECK cannot see another table, so H's release tests hold the rule that only a review with `goesOutOn` gets one.
- **`Game.changedAt`** (F3): timestamptz, null. The last time the maker changed the game while it was waiting.
- **`Game.acceptedSeenAt`** (F5): timestamptz, null until the maker has seen the Accepted screen for the game. The migration sets it, to the migration's time, for **every game that has an `accepted` review, whatever its state** (all of them took effect, since none is held before D), so no game that was ever live shows the Accepted screen.

Seats taken for a day = the held yeses for that day that have not lapsed. Nothing counts them by hand.

Merging D applies the migration to the test site's database (the deploy runs `prisma migrate deploy`), which is what the Owner's approval of D is for. Undoing it is a second migration.

## 5. What the maker sees

### 5.1 While a game waits

The Waiting screen and the line in Your games stay "Waiting for review". For a game that **would be held** (not live, and not live before), the next-step line under it changes from "We're looking at it. Come back here to see when it's live." to (N3):

> We tell everyone on Fridays at noon New York time. The next one is Friday 27 November.

It reads the same whether or not a decision is held, so nothing is given away early, and it promises no day for this game, since a game may wait for a later week. A game that was live before, decided at once, keeps today's line. While the ritual is off (`firstDay` null), every game keeps today's line.

### 5.2 The Accepted screen

The Accepted screen shows when a game is live, its `acceptedSeenAt` is null, and its newest decision that took effect is a gone-out `applied` yes (F5). That happens only for a game a release made live for the first time: every game with a yes before D has `acceptedSeenAt` set by the migration, and an at-once yes sets it too. The first time its maker opens the game (from Your games, or its address), they see:

- Behind everything, the game's own video, blurred and dimmed, as the Live screen does it (reusing that backdrop, not copying it).
- The heading **"You're in."**, the line **"Floor Fifty is live on Ruken."** and under it, quieter, **"It's one of 8 games that got in this week."** (that day's `applied` yeses, counted).
- One big blue button, **"See your game"**, to the game's Live screen.

Pressing "See your game" writes `acceptedSeenAt`, so it shows once (the Owner said yes to this on 2026-11-20 when it was put to them: the site preloads pages when a link is hovered, so a write on opening could use the screen up unseen; a maker who leaves without pressing sees it again); with it set, the game opens on Live as today. A game sent back on decision day opens on the Sent back screen, as today.

### 5.3 The label on Your games

At the top of Your games (`/make`), above the list, a small label:

- While fewer than 20 games count (below): **"A person checks every game."**
- From 20 on: **"12% of games get in."**, the measured rate, a whole percent rounded to nearest; a rate that rounds to 0% with at least one game in shows "1%".

The rate (F9), one definition for the spec, A's tests and the query A starts from:

- Only decisions that took effect count (section 1.3); updates never count (a review made while the game was live).
- Each game counts once, dated by its first decision that took effect (for a held one, the time its day went out).
- A game counts if that date is in the last 90 days. The floor of 20 counts the same games.
- A counted game **got in** if any of its decisions that took effect was a yes (a game sent back, fixed and then let in counts as in). Call (section 8): the other reading, "its first decision was a yes", would make the rate lower; this one is the patch's and is recommended, since a game that got in did get in.
- Computed from `GameReview`, `DecisionOutcome` and `DecisionDay` rows on each load, never typed.

## 6. Boundaries

- No new dependency, tool, environment or spend. One more cron trigger on the existing Worker (section 3). One migration, in D.
- The test site's database changes only by D's merge and, after H, by the review command's and the release job's own writes.
- Nothing runs on the Owner's computer; the Owner has no steps of their own here beyond the approvals.
- Nothing here changes the review command's look beyond section 2; #195's Q owns the rest of it.

## 7. The plan: units, lanes and order

Each unit is one session and one pull request, from a `main` that holds what it waits on.

| Unit | Lane | Waits on | Owns | Output | Check |
|---|---|---|---|---|---|
| D, decision days stored | **3** (`prisma/schema/`, `prisma/migrations/`) | this spec's plan audit; not alongside P or K (each changes `games.prisma` and adds a migration: whichever starts later waits for the other to merge) | `prisma/schema/games.prisma`, the migration, `src/features/games/library/decision-days.json` (`firstDay: null`), `src/features/games/seats.ts` (the schedule: the next decision day after a moment, a day's seats, `dayWords`, all naming no day while `firstDay` is null), `tests/features/games/schema.pg.test.ts`, and their tests | the tables and columns, the backfill, the schedule maths; nothing a maker or the Owner sees changes | the plan audit before; CI green; the implementation audit; the Owner's approval of the merge (the migration) |
| H, hold and release | **3** (`cloudflare/`) | D on `main`; not alongside Q, R, F, P or K (F8): Q and R change `review-order.ts`, the review route or its tests; R, F, P and K change `service.ts`. Whichever starts second starts from a `main` holding the other | `src/features/games/service.ts` (hold, the lock, seats taken, `tookEffect`, `wasLiveBefore`, `changedAt`, the readers of section 2, the release), `review-order.ts`, `review.ts` (the waiting line), `src/routes/jobs/review/+server.ts`, `src/routes/jobs/decision-day/+server.ts`, `cloudflare/worker.js`, `cloudflare/crons.js`, `wrangler.jsonc` (the cron), `decision-days.json` (the first day, last commit), `tests/wrangler.test.ts` (changed: lines 160 to 162 pin `crons` to the daily one; they now pin both, because H adds the hourly one on purpose; F10), and their tests | sections 1 to 3 and 5.1, working | CI green; the implementation audit; the Owner's approval of the merge (turns the ritual on and adds a cron) |
| A, accepted and the label | **2** (the maker's screens, `src/features/games/`, `tests/browser/support/`) | H on `main`; not alongside F, P, K or Q (F11): they change `LiveScreen.svelte`, `src/routes/make/[game]/+page.server.ts`, `service.ts`, `tests/browser/support/game.ts` and `database.ts`. Whichever starts second starts from a `main` holding the other | `src/features/games/acceptance.ts`, `service.ts` (the rate, `acceptedSeenAt`), `src/routes/make/+page.server.ts` and `+page.svelte` (the label), `src/routes/make/[game]/+page.server.ts` and `+page.svelte`, a new `src/routes/make/parts/AcceptedScreen.svelte`, `GameBackdrop.svelte` and `upright.svelte.ts` (the backdrop shared with `LiveScreen.svelte`), the browser helpers in `tests/browser/support/` that make live games, and their tests | sections 5.2 and 5.3 | CI green; one fresh review; the visual check on the five devices for the Accepted screen and Your games |

Why: D alone holds the migration and changes nothing anyone sees, so its merge is easy to judge. H turns the ritual on, and a held decision must never be written by a `main` that cannot send it out, so holding and releasing merge together. A is screens only.

**A starts from earlier work.** The Accepted screen thread left a patch, not on any branch: `/mnt/project-files/handover/2026-11-20-accepted-screen-and-rate-wip.patch` (against #194's head 99f41ad; it applies to `main`). It holds `src/features/games/acceptance.ts` (the rate's words and one query over `GameReview`), its tests, and Live's blurred backdrop pulled out into `parts/GameBackdrop.svelte` and `parts/upright.svelte.ts`. A's first step applies it and runs typecheck and lint on it before building on it (N6), then changes the query to section 5.3's definition: only decisions that took effect, dated by when they took effect. The browser helpers that leave a game live (`gameWhere`, `putGameWhereStaffLeaveIt` with state live, `addGame`) set `acceptedSeenAt`, unless a test asks for the Accepted screen, so the Live journeys keep landing on Live.

Expected time: D 4 hours, H 10 hours, A 6 hours, plus the audits. Models and effort as Settings in `CLAUDE.md` names them (execution against a spec: Sonnet 5.5, medium; lane 3 audits: Opus 5.5, medium).

### Unit D, step by step

- [ ] **Step 1: the failing tests.** `seats.test.ts`: with `firstDay` null, no decision day; with a first day set by the test, the next decision day after a moment (a Friday at 11:59 and 12:00 New York time; across both daylight saving changes; a Saturday); a day's seats at the first day, the day before and the day of each 3-month step, a first day on the 30th or 31st (clamped), the rounding, and 500 from step 10 on. `schema.pg.test.ts`: `DecisionDay` and `DecisionOutcome` refuse an update and a second row for a day or a review; `GameReview.goesOutOn` cannot be changed; after the migration, every game with an `accepted` review has `acceptedSeenAt`, a taken-off one included, and a game with none has null. Run them: they fail for those reasons.
- [ ] **Step 2: the schedule and the migration.** (Correction from D's build and audit: Prisma 7 has no `--shadow-database-url` flag. Put `datasource: { url, shadowDatabaseUrl }` in a scratch Prisma config and run `pnpm exec prisma migrate diff --config <that file> --from-migrations prisma/migrations --to-schema prisma/schema --script --exit-code`; the same check also works as `--from-config-datasource` against a database built by `migrate deploy` from empty. H and later migration units use the same.) Paste the empty output of `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --shadow-database-url "$TEST_DATABASE_URL" --script` into the pull request. Run again: pass. Open the draft pull request; it says merging applies the migration to the test site's database and that undoing it is a second migration.
- [ ] **Step 3: finish.** The implementation audit on a named commit; fix its findings; the Owner's approval of the merge. Delete the live-state file, merge `main` in, mark ready, merge on green.

### Unit H, step by step

- [ ] **Step 0: check the cron limit.** Read Cloudflare's limits page (section 3) and note in the pull request how many cron triggers the account's plan allows; stop and report if two do not fit.
- [ ] **Step 1: the failing tests.** `review-order.test.ts` stays as is (the order's shape does not change). `service.pg.test.ts`: a new game's yes and send back are held with the right `goesOutOn` and leave the game waiting; a held yes leaves `addressStays` false and the address following the name, and a held send back shows nothing to fix (F1); a yes with no seat left is refused and changes nothing; a second decision on a held game is refused, and on a lapsed one is held again; an update's yes acts at once and takes no seat; a taken-off-then-put-back game's yes acts at once, takes no seat, and sets `acceptedSeenAt` (F4, F5); a maker's new files, a changed rating, and a changed video each make a held yes lapse and free its seat (F3); two yeses at the last seat at once give one seat and one refusal, and a yes made while a release runs is held for the next day (F6, `pg`); the release sends a day out in one transaction, writes `applied` and `lapsed` outcomes and the day's row, and a second run changes nothing; two missed days go out oldest first in one run (F7); a later day's decisions wait. A route test for `/jobs/decision-day` (404 without the secret, the answers in section 3) and for `list`, `look`, `accept` and `send-back`'s new words and kinds. `review.test.ts`: the waiting line of 5.1 for a held-kind game, and today's line for a put-back game and while `firstDay` is null. `crons.test.ts`: each cron's paths, and an unknown cron throws. `tests/wrangler.test.ts`: both crons (F10). Run them: they fail for those reasons.
- [ ] **Step 2: hold, the lock, the seats, the readers, the release and the cron.** Run again: pass. Open the draft pull request; it names `tests/wrangler.test.ts` as changed and why, and says merging turns the ritual on and adds a cron on the test site.
- [ ] **Step 3: finish.** The implementation audit; fix; the Owner's approval of the merge. In the last commit, write the first decision day into `decision-days.json` from `date` (the first Friday after that commit) and delete the live-state file; merge `main` in, mark ready, merge on green.

### Unit A, step by step

- [ ] **Step 1: the failing tests.** Apply the handover patch and run typecheck and lint on it (N6). `service.pg.test.ts`: the rate of 5.3 (each game once, dated by its first decision that took effect, 90 days, a held decision not counted before its day and a lapsed one never, got in on any yes that took effect, updates never, the floor of 20 over the same games). A journey, `make-accepted.test.ts`: after a release, the maker opening the game sees the Accepted screen with section 5.2's words and count, presses "See your game" with the keyboard, and opening it again shows Live; a sent-back game opens on Sent back; a put-back game's yes opens on Live; Your games shows the label. Run them: they fail for those reasons.
- [ ] **Step 2: the screen and the label.** Run again, the browser file on `computer`, `phone` and `tablet`: pass. Open the draft pull request.
- [ ] **Step 3: finish.** The visual check on the five devices for the Accepted screen and Your games; the fresh lane 2 review; fix; delete the live-state file, merge `main` in, mark ready, merge on green.

## 8. Decisions

1. **Settled, Owner 2026-11-17:** seats per week, growing every 3 months, to at most 500 a week; one decision day when everyone finds out.
2. **Settled, Owner 2026-11-17, on cards:** the Accepted screen with the blurred background; the label "A person checks every game." until 20 games are decided, then the measured rate.
3. **Settled, Owner 2026-11-20 00:16 UTC, on cards:** Friday, noon New York time; 10 seats a week to start; growing by half again every 3 months.
4. **Calls** the Owner may overrule:
   - Both yes and send back are held to decision day, so everyone finds out on the same day.
   - Updates, and games that were live before, are decided at once and take no seat.
   - A held decision is final; changing one before its day would need a later spec.
   - A maker may still change a waiting game; any change makes a held decision lapse quietly, and the Owner decides again.
   - A full week refuses a yes; the game stays in the list for next week, with no waiting list of its own.
   - The Accepted screen's quiet line "It's one of 8 games that got in this week."
   - The first decision day is the first Friday after H's last commit; the 3-month steps count from it.
   - The rate counts a game as in if any decision that took effect was a yes (5.3).

## 9. Acceptance criteria

- A new game's yes or send back made before a decision day's moment changes nothing a maker sees until that moment (its address, its fix list and its state included); at that moment (within the hour the cron runs), every held decision for that day that has not lapsed takes effect together, in one transaction.
- A decision made at or after the moment, or while that day is going out, goes out the next decision day.
- A yes for a new game with no seat left that week is refused with section 2's words, and nothing is written; two yeses at once never take more seats than the day has.
- Seats for a day follow section 1.2's schedule, never pass 500, and are recorded on the day's row when it goes out.
- An update's yes, and a yes for a game that was live before, act at once and take no seat.
- A held decision lapses when the maker changes the game in any way (files, answers, videos) after it: not applied, recorded as lapsed, its seat free.
- The release job answers 404 without the secret, changes nothing when nothing is due, sends out every due day oldest first, and never sends out a day twice.
- The hourly cron knocks only on the release job; the daily cron knocks on what it does today; an unknown cron throws.
- A waiting game that would be held shows section 5.1's line whether or not it is decided; any other waiting game keeps today's line.
- A maker whose game a release made live for the first time sees the Accepted screen once, with the measured count, then Live; no other game ever shows it; a game sent back opens on Sent back.
- Your games shows the label of section 5.3, with the rate measured from rows by 5.3's definition.
- Everything works by keyboard alone with focus visible, every target is at least 44 by 44, nothing scrolls sideways, and the Accepted screen and Your games pass the visual check on the five devices.
