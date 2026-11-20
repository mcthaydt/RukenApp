# Decision day and the weekly seats

Staged path, spec stage. Lane 3 (a migration and `cloudflare/`), so this spec has a plan audit before it merges, and each lane 3 unit has the Owner's approval before its merge.

## 0. The Owner's words

- **Owner, 2026-11-17 06:52 UTC:** "Slow number of seats makes the most sense, we pick one day where everyone finds out if they got accepted, it becomes a ritual, the number of acceptances per week is capped but grows every 3 months up to 500 total worldwide maximum".
- **Owner, 2026-11-17 06:53 UTC, on a card:** the 500 is "500 a week, at most": the weekly number grows every 3 months until it reaches 500 games a week, then stays there.
- **Owner, 2026-11-17 06:47 UTC:** maker screens get an Accepted screen "with the blurred background similar to the one where we first submit it", and the acceptance rate "on the first screen at the top like a label".
- **Owner, 2026-11-17 06:50 UTC, on a card:** until 20 games are decided the label says "A person checks every game."; from 20 on it shows the measured rate.
- Three choices are open on cards (section 8): which day and time, how many seats to start with, and how the seats grow. The spec is written with the recommended answer in each place and marks it **(card)**; an answer that differs changes only that number or word.

This builds on the review command of unit S (`POST /jobs/review`, `src/routes/jobs/review/+server.ts`, merged in #194) and lines up with the game facts spec (#195), which adds parts to that command and writes `firstLiveAt` on a game's first yes.

## 1. What happens in a week

1. Makers send games in, any day, as now.
2. During the week the Owner looks at each waiting game and says yes or sends it back, with the same command as now. For a **new game**, nothing changes for its maker yet: the decision is **held**.
3. Each week has a number of **seats**: how many new games can get a yes that week. Once the seats are taken, the command refuses another yes for that week. A game left waiting stays in the list for the next week.
4. On **decision day**, at one moment, every held decision goes out together: each yes makes its game live, each send back sends its game back, and each maker sees their answer the next time they open Ruken. Makers whose game got in see the Accepted screen (section 5.2).

What is **not** held, and uses no seat: an update to a live game, and a game that was live before (taken off and put back). Those are decided at once, as today, since the game already has its place. Call (section 8).

### 1.1 The moment

Decision day is every **Friday at 12:00 noon, New York time (card)**, stored as a weekday, a time and a zone (`America/New_York`), so it stays at noon local time across daylight saving. A decision belongs to the first decision day whose moment is after the decision was made: a yes at 11:59 on a Friday goes out at noon that day; a yes at 12:00 goes out the next Friday.

### 1.2 The seats

- The first decision day is the first Friday after the unit that turns this on (H) merges; its date is written in `src/features/games/library/decision-days.json` by that unit, from `date`, never typed.
- Seats on the first decision day: **10 (card)**.
- Every 3 months after the first decision day (counted in calendar months: the first decision day on or after the same date 3, 6, 9 ... months later), the seats grow **by half again (card)**: after n steps, the starting seats × 1.5ⁿ, rounded half up to a whole game once (never rounding a rounded number), and never above **500**: 10, 15, 23, 34, 51, 76, 114, 171, 256, 384, 500. It reaches 500 after 10 steps, about two and a half years.
- The schedule lives in code (`decision-days.json` and the pure `seats.ts`), never typed into the database. Each decision day's seats are recorded on its row when it goes out, so a later change to the schedule never rewrites what a past week had.
- Only a yes for a new game takes a seat. A send back takes none.

## 2. The review command

The command stays one `POST /jobs/review` with the job secret, and its JSON stays readable in a terminal. What changes:

- **`list`** says the week first: `"says": "3 games are waiting. 7 of 10 seats are taken for Friday 27 November."` Each waiting game also says `"decided": "yes"`, `"sent back"` or `null`, so the Owner sees which games are already decided and held.
- **`accept`** for a new game, with a seat left: holds the yes and answers `"Floor Fifty gets in on Friday 27 November. 8 of 10 seats are taken."` With no seat left it changes nothing and answers 409, `"This week's 10 seats are taken. Send it back, or leave it for next week."`
- **`send-back`** for a new game: holds it and answers `"Floor Fifty goes back to its maker on Friday 27 November."`
- **`accept` or `send-back`** on a game already decided and held: 409, `"You already decided on Floor Fifty. It goes out on Friday 27 November."` A held decision is final (section 8).
- Updates and games that were live before: as today, at once.
- `look` is unchanged apart from saying `"decided"` as `list` does.

The words for a day are made by one pure function (`dayWords`, "Friday 27 November", the decision day's own date in its own zone), with tests.

**A maker changes a waiting game.** A maker can still change a waiting game and send it again (Check and send). A held decision applies only to the files and answers it was made on: if the game's waiting pull is no longer the one the decision named when its day comes, the decision lapses, its seat is free again in `list` at once, and the game stays waiting for the Owner to look at again. The maker is told nothing about a decision that lapsed, since they were never told it was made.

**Lining up with #195.** Unit Q of the game facts spec changes `review-order.ts` and what `look` shows. H and Q both change `review-order.ts` and the review route, so they never run side by side: whichever starts second starts from a `main` holding the other. K writes `firstLiveAt` "on the first yes"; with this spec the first yes that makes a game live is the release, so `firstLiveAt` is written by the release's write (or by the at-once yes for a game that was never held, which cannot happen for a new game once H is on `main`). Whichever of K and H merges second moves that write.

## 3. The release

- A job, `POST /jobs/decision-day`, with the job secret, answering 404 without it, like the other jobs.
- It finds the latest decision day whose moment has passed and that has not gone out. If there is none, it answers `{ "says": "Nothing to send out." }` and changes nothing.
- Otherwise, in **one transaction**: for each decision held for that day whose game is still waiting on the same pull, a yes does what `accept` does today (state `live`, `livePullId`, clears what was waiting and what was to fix, `firstLiveAt` once K is on `main`), and a send back does what `sendBack` does today (state `sent_back`, `toFix` from the decision's parts). A held decision whose pull changed lapses (section 2). Then it writes the decision day's row with the seats it had and the time it went out. Answer: `{ "says": "Friday 27 November went out: 8 got in, 5 went back." }`
- It runs again safely: a day that has gone out is never sent out twice (the row's unique day refuses it, and the transaction rolls back).
- A missed day (the job did not run, say) goes out the next time the job runs; any later day's decisions wait for their own day.
- **The schedule.** The Worker's `scheduled` handler (`cloudflare/worker.js`) gets a second cron in `wrangler.jsonc`, `"0 * * * *"` (every hour, on the hour), which knocks on `/jobs/decision-day` only; the daily `"17 9 * * *"` keeps knocking on the purge and money jobs only (`controller.cron` tells them apart). A decision day at noon New York time goes out on the hour it starts, within a minute. An answer other than 200 throws, so a failed run shows in Cloudflare.

## 4. What is stored

One migration (unit D), adding:

- **`DecisionDay`**: `day` (a date, unique: the decision day in its own zone), `seats` (the seats it had, from the schedule), `wentOutAt` (timestamptz). Added and never changed (the add-only trigger, as `GameReview` has). A row means: this day's decisions went out at this time.
- **`GameReview.goesOutOn`**: a date, null for a decision that took effect at once. Set when the decision is made, never changed (the table is already add-only). A held decision is a review whose `goesOutOn` names a day with no `DecisionDay` row yet.
- **`Game.acceptedSeenAt`**: timestamptz, null until the maker has seen the Accepted screen for the game (section 5.2). Written once.

Seats taken for a day = the held yeses for that day whose game is still waiting on the pull they named. Nothing counts them by hand.

Merging D applies the migration to the test site's database (the deploy runs `prisma migrate deploy`), which is what the Owner's approval of D is for. Undoing it is a second migration.

## 5. What the maker sees

### 5.1 While a game waits

The Waiting screen and the line in Your games stay "Waiting for review". The next-step line under it changes from "We're looking at it. Come back here to see when it's live." to:

> We tell everyone on Fridays at noon New York time. The next one is Friday 27 November.

It reads the same whether or not a decision is held, so nothing is given away early, and it promises no day for this game, since a game may wait for a later week. ("noon New York time" follows the card.)

### 5.2 The Accepted screen

After the decision day a game got in, the first time its maker opens the game (from Your games, or its address), they see the Accepted screen instead of the Live screen, once:

- Behind everything, the game's own video, blurred and dimmed, as the Live screen and the sent screen do it (reusing that backdrop, not copying it).
- The heading **"You're in."**, the line **"Floor Fifty is live on Ruken."** and under it, quieter, **"It's one of 8 games that got in this week."** (the measured count of that day's yeses).
- One big blue button, **"See your game"**, to the game's Live screen.

Opening it writes `acceptedSeenAt`, so it shows once; with it set, the game opens on Live as today. An update's yes, a game that was live before, and every game already live when D merges, never show it (D's migration sets `acceptedSeenAt` for games already live).

A game sent back on decision day opens on the Sent back screen, as today.

### 5.3 The label on Your games

At the top of Your games (`/make`), above the list, a small label:

- Until 20 games have a first decision that has gone out: **"A person checks every game."**
- From 20 on: **"12% of games get in."**, the measured rate, a whole percent rounded to nearest.

The rate: each game counts once, by its first decision that has gone out (a held decision counts only from its decision day); over the last 90 days by that decision's going-out time; yeses over all such games. Updates never count. Computed from `GameReview` and `DecisionDay` rows on each load, never typed.

## 6. Boundaries

- No new dependency, tool, environment or spend. One more cron trigger on the existing Worker (Cloudflare's free plan allows it). One migration, in D.
- The test site's database changes only by D's merge and, after H, by the release job's own writes.
- Nothing runs on the Owner's computer; the Owner has no steps of their own here beyond the approvals.
- Nothing here changes the review command's look beyond section 2; #195's Q owns the rest of it.

## 7. The plan: units, lanes and order

Each unit is one session and one pull request, from a `main` that holds what it waits on.

| Unit | Lane | Waits on | Owns | Output | Check |
|---|---|---|---|---|---|
| D, decision days stored | **3** (`prisma/schema/`, `prisma/migrations/`) | this spec's plan audit; not alongside P or K (each changes `games.prisma` and adds a migration: whichever starts later waits for the other to merge) | `prisma/schema/games.prisma`, the migration, `src/features/games/library/decision-days.json`, `src/features/games/seats.ts` (the schedule: the next decision day after a moment, a day's seats, `dayWords`), and their tests | the table and columns, the schedule maths; nothing a maker or the Owner sees changes | the plan audit before; CI green; the implementation audit; the Owner's approval of the merge (the migration) |
| H, hold and release | **3** (`cloudflare/worker.js`) | D on `main`; not alongside Q (both change `review-order.ts` and the review route) | `src/features/games/service.ts` (hold, seats taken, release), `review-order.ts`, `review.ts` (the waiting line), `src/routes/jobs/review/+server.ts`, `src/routes/jobs/decision-day/+server.ts`, `cloudflare/worker.js`, `wrangler.jsonc` (the cron), and their tests | sections 1 to 3 and 5.1, working | CI green; the implementation audit; the Owner's approval of the merge (turns the ritual on and adds a cron) |
| A, accepted and the label | **2** (the maker's screens and `src/features/games/`) | H on `main` | `src/features/games/acceptance.ts`, `src/routes/make/+page.server.ts` and `+page.svelte` (the label), `src/routes/make/[game]/+page.server.ts` and `+page.svelte`, a new `src/routes/make/parts/AcceptedScreen.svelte`, `GameBackdrop.svelte` and `upright.svelte.ts` (the backdrop shared with `LiveScreen.svelte`), the browser helpers in `tests/browser/support/` that make live games, `service.ts` (the rate, `acceptedSeenAt`), and their tests | sections 5.2 and 5.3 | CI green; one fresh review; the visual check on the five devices for the Accepted screen and Your games |

Why: D alone holds the migration and changes nothing anyone sees, so its merge is easy to judge. H turns the ritual on, and a held decision must never be written by a `main` that cannot send it out, so holding and releasing merge together. A is screens only.

**A starts from earlier work.** The Accepted screen thread left a patch, not on any branch: `/mnt/project-files/handover/2026-11-20-accepted-screen-and-rate-wip.patch` (against #194's head 99f41ad; it applies to `main`). It holds `src/features/games/acceptance.ts` (the rate's words and one query over `GameReview`, each game once by its first decision, 90 days, a game that got in never shown as 0%), its tests, and Live's blurred backdrop pulled out into `parts/GameBackdrop.svelte` and `parts/upright.svelte.ts`. A takes it as a starting point, checks it with typecheck and lint (not run on it yet), and changes the query to count a held decision only from its decision day (5.3). The browser helpers that leave a game live (`gameWhere`, `putGameWhereStaffLeaveIt` with state live, `addGame`) set `acceptedSeenAt`, unless a test asks for the Accepted screen, so the Live journeys keep landing on Live.

Expected time: D 4 hours, H 8 hours, A 6 hours, plus the audits. Models and effort as Settings in `CLAUDE.md` names them (execution against a spec: Sonnet 5.5, medium; lane 3 audits: Opus 5.5, medium).

### Unit D, step by step

- [ ] **Step 1: the failing tests.** `seats.test.ts`: the next decision day after a moment (a Friday at 11:59 and 12:00 New York time; across both daylight saving changes; a Saturday); a day's seats at the first day, the day before and the day of each 3-month step, the rounding, and 500 from the tenth step on. `schema.pg.test.ts`: `DecisionDay` refuses an update and a second row for a day; `GameReview.goesOutOn` cannot be changed; games live before the migration have `acceptedSeenAt`. Run them: they fail for those reasons.
- [ ] **Step 2: the schedule and the migration.** Paste the empty output of `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --shadow-database-url "$TEST_DATABASE_URL" --script` into the pull request. Run again: pass. Open the draft pull request; it says merging applies the migration to the test site's database and that undoing it is a second migration.
- [ ] **Step 3: finish.** The implementation audit on a named commit; fix its findings; the Owner's approval of the merge. Delete the live-state file, merge `main` in, mark ready, merge on green.

### Unit H, step by step

- [ ] **Step 1: the failing tests.** `review-order.test.ts` stays as is (the order's shape does not change). `service.pg.test.ts`: a new game's yes and send back are held with the right `goesOutOn` and leave the game waiting; a yes with no seat left is refused and changes nothing; a second decision on a held game is refused; an update's yes and a put-back game's yes act at once and take no seat; a maker's new version makes a held yes lapse and frees its seat; the release sends out a day's decisions in one transaction, skips a lapsed one, writes the day's row, and a second run changes nothing; a missed day goes out on the next run; a later day's decisions wait. A route test for `/jobs/decision-day` (404 without the secret, the answers in section 3) and for `list`, `accept` and `send-back`'s new words. `review.test.ts`: the waiting line of 5.1. A worker test: the hourly cron knocks only on `/jobs/decision-day`, the daily one only on the purge and money jobs. Run them: they fail for those reasons.
- [ ] **Step 2: hold, the seats, the release and the cron.** Write the first decision day into `decision-days.json` from `date`. Run again: pass. Open the draft pull request; it says merging turns the ritual on and adds a cron on the test site.
- [ ] **Step 3: finish.** The implementation audit; fix; the Owner's approval of the merge. Delete the live-state file, merge `main` in, mark ready, merge on green.

### Unit A, step by step

- [ ] **Step 1: the failing tests.** `service.pg.test.ts`: the rate (each game once, first gone-out decision, 90 days, held decisions not counted before their day, updates never), the plain line under 20. A journey, `make-accepted.test.ts`: after a release, the maker opening the game sees the Accepted screen with section 5.2's words and count, presses "See your game" with the keyboard, and opening it again shows Live; a sent-back game opens on Sent back; Your games shows the label. Run them: they fail for those reasons.
- [ ] **Step 2: the screen and the label.** Run again, the browser file on `computer`, `phone` and `tablet`: pass. Open the draft pull request.
- [ ] **Step 3: finish.** The visual check on the five devices for the Accepted screen and Your games; the fresh lane 2 review; fix; delete the live-state file, merge `main` in, mark ready, merge on green.

## 8. Decisions

1. **Settled, Owner 2026-11-17:** seats per week, growing every 3 months, to at most 500 a week; one decision day when everyone finds out.
2. **Settled, Owner 2026-11-17, on cards:** the Accepted screen with the blurred background; the label "A person checks every game." until 20 games are decided, then the measured rate.
3. **Open, on cards (2026-11-20):** the day and time (recommended Friday, noon New York time), the starting seats (recommended 10 a week), and the growth (recommended half again every 3 months).
4. **Calls** the Owner may overrule:
   - Both yes and send back are held to decision day, so everyone finds out on the same day.
   - Updates, and games that were live before, are decided at once and take no seat.
   - A held decision is final; changing one before its day would need a later spec.
   - A maker may still change a waiting game; a held decision on the old version lapses quietly.
   - A full week refuses a yes; the game stays in the list for next week, with no waiting list of its own.
   - The Accepted screen's quiet line "It's one of 8 games that got in this week."
   - The first decision day is the first Friday after H merges; the 3-month steps count from it.

## 9. Acceptance criteria

- A new game's yes or send back made before a decision day's moment changes nothing a maker sees until that moment; at that moment (within the hour the cron runs), every held decision for that day takes effect together, in one transaction.
- A decision made at or after the moment goes out the next decision day.
- A yes for a new game with no seat left that week is refused with section 2's words, and nothing is written.
- Seats for a day follow section 1.2's schedule, never pass 500, and are recorded on the day's row when it goes out.
- An update's yes, and a put-back game's yes, act at once and take no seat.
- A held decision whose game was sent again with new files lapses: not applied, its seat free.
- The release job answers 404 without the secret, changes nothing when nothing is due, and never sends out a day twice.
- The hourly cron knocks only on the release job; the daily cron is unchanged in what it does.
- A waiting game shows section 5.1's line whether or not it is decided.
- A maker whose game got in sees the Accepted screen once, with the measured count, then Live; a game sent back opens on Sent back.
- Your games shows the label of section 5.3, with the rate measured from rows.
- Everything works by keyboard alone with focus visible, every target is at least 44 by 44, nothing scrolls sideways, and the Accepted screen and Your games pass the visual check on the five devices.
