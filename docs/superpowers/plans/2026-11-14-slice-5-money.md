# Slice 5: Money Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each month, every member's fee is split by the Owner's rules, every maker gets a statement that is final on the 10th, and makers who have connected a bank are paid on the 15th.

**Architecture:** One new feature, `money`, between `play` and `pages`. Pure functions work out every amount (what comes off the top, the two halves, the bringing bonus, the play shares, the payout plan); a small double-entry journal, carried from the old repository, stores what they return and is only ever added to. Nothing is typed: payments come from slice 1's `MembershipPayment` rows, Stripe's other fees from Stripe's Fees report, refunds and chargebacks from Stripe's lists, play from slice 2's sessions and beats, who brought whom from slice 1's `MembershipStart` rows. The site's one daily job does all of it, in a fixed order, and every step can run twice without posting twice. Makers connect a bank through Stripe Connect and read their statements in the maker's area; staff see the month and approve the payout run in the admin portal.

**Tech Stack:** as slices 1 and 2 (Node 24.22.1, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0, Postgres 16, Vitest 5.0.3, Playwright 1.63.0, Cloudflare Workers, `stripe` 22.6.2, `@js-temporal/polyfill` 0.5.1). New from Stripe, through the package already pinned: the Reporting API (`stripe.reporting.reportRuns`, `stripe.reporting.reportTypes`), Connect (`accounts`, `accountLinks`, `transfers`, `payouts`), and the lists of refunds and disputes. **No new package.**

**Spec:** `docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md` (sections 5.4 "connects their bank", 5.5 "Money" and "Authority", 5.8, 6, 7.1, 7.2, 7.5). Read it with `CLAUDE.md`, `AGENTS.md`, both earlier plans (above all slice 1's "How a task runs", "The look" and "Notes for the plans that follow", and slice 2's "Notes for the plans that follow"), and the maker agreement, version 1 (`src/features/make/library/maker-agreement-v1.txt`, slice 2's branch M), whose paragraphs 5 and 6 are the rules this slice builds.

**Old repository:** `mcthaydt/RukenAppFailed` at commit `188e8a07546ba19c431468ddf2624e3cc4173d4e`, written below as `OLD/`. Attach it read-only (`add_repo`, access "read") and clone it beside this repository. Do not register it as a repository root.

**Planned against:** `main` at `00d616d` (slice 1's branches and slice 2's branches A to C merged) plus what slice 2's plan says its later branches will produce, and nothing of slice 4, which has no plan yet. Slice 3's plan (`docs/superpowers/plans/2026-11-14-slice-3-feed-maker-page.md`) was merged while this one was being written; this plan relies on nothing in it, and notes one thing it already gives: `split` is in its `RESERVED_HANDLES`, so `/split` (Task 34) can never be a maker's address. `main` was merged into this branch at `7753369`; nothing else that arrived with it was re-read against this plan. Execution starts only when slice 4 is merged and green (design 7.5). "What this plan relies on", below, names each piece; if one is not on `main` as named when its task starts, stop and report.

**The dates.** Branches A to D must be merged and green before 10 December 2026 (the first statement). Branches E to H must be merged before 15 December 2026 (the first payout). Branches I and J can follow. If a branch has taken twice what was expected, the stop rule applies and the Owner decides what moves (CLAUDE.md, "Pace").

## Global Constraints

- No session runs tests, lint or typecheck itself. Push, then read CI on the pull request (CLAUDE.md, Owner 2026-11-13).
- Every task is test-first, in two pushes, exactly as slice 1's "How a task runs" says: red (the test and stubs that throw `not built yet`), then green. A pull request is opened as a draft at the first push and marked ready only when its branch's last task is green.
- No new dependency. The old ledger validated its facts with `zod`, which this repository does not have: the carried code loses those schemas and reads typed rows instead. Anything else that seems to need a package is a stop: report it with the exact name and version, for the Owner's yes.
- `.github/workflows/ci.yml` does not change in this slice.
- This repository is public. No secret, real address, Stripe id or key goes in. Test values are plainly fake. Nothing here says why a business rule is what it is; the design and the maker agreement say what the rules are.
- **Money is whole cents, as `bigint`.** No amount is ever a `number` or a fraction, with one exception that is named where it happens: Stripe's Fees report writes amounts as decimal text (dollars), which is read into whole millionths of a cent (`bigint`) and rounded to cents once per payment, upward (Task 4).
- **The split is worked out only by pure functions** in `src/features/money/`, each with its tests. A file that reads or writes the database holds no arithmetic beyond adding up what a pure function returned.
- **Ledger facts are only ever added.** Every table that holds a fact (`JournalEntry`, `JournalLine`, `PaymentPosting`, `StripeFeeRow`, `FeePosting`, `StripeReversal`, `PlayDay`, `PlayDayRun`, `PoolRun`, `PoolShare`, `Statement`, `StatementLine`, `MoneyJobRun`) refuses `UPDATE` and `DELETE` with slice 1's `reject_append_only_change('<Table>')`. A wrong entry is corrected by a new entry.
- **Nobody types a fact.** No screen, form, command or setting in this slice has a field for an amount, a count, a rate or a date. People make three decisions only: a maker connects a bank, a maker questions a line, and staff approve a payout run or answer a question.
- **Ruken's half is never reduced to pay makers**, and a payout or a bringing bonus is paid only out of the makers' half. No function in this slice moves money from `platform:revenue:premium` to a maker's account, and Task 8's test of a whole month checks it.
- Time comes from an injected `Clock`. Feature code never calls `Date.now()` or `new Date()` with no argument. **Every money date is an America/Chicago date**: a month, a day's 3-hour cap, the 8th, the 10th and the 15th are all worked out through `CALENDAR_ZONE` (`src/lib/clock.ts`).
- Layers: `money` may import `accounts`, `membership`, `games` and `play`, and only through their entry files; `make` and `admin` screens sit above it. `money` is already in `FEATURE_ORDER`. Shared helpers with no feature logic go in `src/lib/`. Tests live only in `tests/`, mirroring `src/`.
- Comments say why, never which plan asked. A carried file loses its old-plan references (`M7.1 §5`, `P8 §6.3`, `R-54`, `audit M3` and the like) and keeps the reason.
- Every screen and message passes the drunk grandma test. The words in this plan are the words to ship; a change to them is a deviation to report. Every money line a maker reads says what it is for in words a person says out loud, and no screen shows a number without saying what it counts.
- Ruken's own screens wear the Card Table look from `src/lib/look.css` and only its classes. This slice adds one class, `rows` (Task 26), with its rule and its name in `CLASSES` on the branch of its first use. No file under `src/routes/` gets a `<style>` block, a `style=` attribute or a colour of its own. Nothing in this slice is `pay` (no press here spends a member's money) and nothing is pip red.
- Every journey file starts with `test.beforeEach(forgetRateLimits)`, and every new screen is attached with `showTheOwner` for the Owner to see before its branch is marked ready (slice 1, Task 37).

## What this plan relies on

| Piece | From | Used for |
|---|---|---|
| `MembershipPayment` (one row per paid invoice: `stripeInvoiceId`, `userId`, `plan`, `periodStart`, `paidAt`, `grossCents`, `taxCents`, `cardFeeCents`; added, never changed) | slice 1, Task 21 (on `main`) | the payments that are split |
| `MembershipStart` (one row per completed checkout: `userId`, `startedAt`, `broughtByUserId`, `arrivalPath`, `arrivedAt`) | slice 1, Tasks 21, 26 (on `main`) | who brought a member |
| `membershipServices()`, `createStripe`, the settings `STRIPE_SECRET_KEY`, `STRIPE_LIVE`, `STRIPE_API_BASE` and their checks | slice 1, Task 26 (on `main`) | the one Stripe client (Task 13 adds `stripe` to what `membershipServices()` answers) |
| `dollars(cents)`, `longDate` from `membership.ts` | slice 1 (on `main`) | every amount and date on a screen |
| `reject_append_only_change()` and how the membership migration attaches it | slice 1, Task 21 (on `main`) | the add-only tables |
| `Clock`, `systemClock`, `CALENDAR_ZONE`, `chicagoDayOf`, `TestClock` | slice 1, Task 2 (on `main`) | every time |
| `prisma()`, `PrismaClient`, `startTestDatabase()`, `requireEnv`, `optionalEnv` | slice 1 (on `main`) | every table read and write, and settings |
| `hasJobSecret(request)`, `JOBS_SECRET`, `cloudflare/worker.js`'s daily knock, the cron in `wrangler.jsonc` (09:17 UTC, early morning in Chicago) | slice 1, Task 20; slice 2, Task 29 (on `main`) | the daily money job |
| `purgeDueAccounts`, which keeps the `User` row | slice 1, Task 20 (on `main`) | a deleted member's and maker's money rows keep their account id |
| `Game` (`id`, `makerUserId`, `name`, `slug`, `publicId`) | slice 2, Task 1 (on `main`) | whose game a play share belongs to, and its name on a statement |
| `PlaySession` (`userId`, `gameId`, `basis`, `startedAt`), `PlayBeat` (`sessionId`, `receivedAt`, `attentive`), both added and never changed | slice 2, Task 16 | play that counts |
| `countedMs`, `LONGEST_COUNTED_GAP_MS` in `src/features/play/time.ts` | slice 2, Task 17 | the same counting rule, by the day (Task 6 adds both to `play.ts`'s exports: slice 2's entry file does not export them) |
| `/make` (the maker's area), `signedInOnly`, `Caller`, `locals.caller` | slice 1, Task 10; slice 2, Task 27 | where the maker's money screens hang |
| `staffOnly(caller)` in `src/features/admin/staff-only.ts`, `StaffRole` with `owner` and `finance`, `/admin/games` | slice 2, Tasks 29, 30 | the staff money screens |
| The stand-in Stripe (`tests/browser/support/fake-stripe-server.ts`), `tests/support/fake-premium-stripe.ts`, `signUp`, `payAsNewMember`, `signInAsStaff`, `addGame` | slice 1, Task 27; slice 2 | journeys and database tests |
| `src/lib/look.css`, `CLASSES`, `CARD_SCREENS`, `expectOneCard`, `showTheOwner`, `forgetRateLimits` | slice 1, branch L | the look of the new screens |

**What this slice needs and no plan provides yet** (slice 4 has no plan):

- **A fresh authenticator code and a second person** (design 5.5: "money actions need a second person and a fresh code from an authenticator app"). Admin sessions, the code and the two superadmins are slice 4's. This plan names what it needs in Task 33 and builds nothing of it. The statement on the 10th needs none of it (the daily job makes it from the clock); the payout on the 15th does. Asked of the coordinator on 2026-11-14 (question 3 below).
- **A maker's handle and page** (slice 3) are not needed: a statement names games, and a maker is an account.
- **Mails.** Design 7.1 lists the mails Ruken sends, and a statement is not one of them, so this slice sends none. A maker finds a new statement in the maker's area.

## Found while planning

Read on 2026-11-14. Where a page or a package and this plan disagree when execution reads it, stop and report.

1. **Stripe's Billing and Tax fees can be read per payment, from the Fees report.** Stripe's Reporting API runs the same Fees report the dashboard shows. The report type `all_fees.balance_transaction_created.itemized.2` gives one row per fee, with `incurred_by` ("ID of the object that incurred the fee"), `incurred_by_type` ("Common values include `charge`, `refund`, `payout`, `transfer`, and `invoice`"), `product`, `feature_name`, `fee_description`, `amount` and `tax` ("expressed in major units of the currency"), `currency`, `balance_transaction_id`, `fee_transaction_id`, `incurred_at`, `balance_transaction_created` and `settled_via` (https://docs.stripe.com/reports/all-fees, https://docs.stripe.com/reports/api). In `stripe` 22.6.2: `stripe.reporting.reportTypes.retrieve(type)` answers `data_available_start` and `data_available_end`; `stripe.reporting.reportRuns.create({ report_type, parameters: { interval_start, interval_end, columns } })` starts a run; `retrieve` answers `status` (`pending`, `succeeded`, `failed`) and, when it succeeded, `result`, a file whose `url` is fetched with the secret key.
2. **Three limits of that report**, all from the same pages: "Fee data becomes available within 96 hours after a fee affects your balance"; it "excludes Terminal device purchases, Stripe Capital fees, Atlas fees, and fees that Stripe invoices after you use a service"; and "certain report types require a live-mode API key" (the package's own comment on `reportRuns.create`). So tests use a stand-in, and the first real read is an Owner stop (M1).
3. **The other two places were looked at and not chosen.** A payment's own balance transaction (`fee`, `fee_details`), which slice 1 reads, holds the card fee only. Balance transactions of type `stripe_fee` ("Fees for Stripe software and services (for example, for Radar, Connect, Billing, and Identity)", https://docs.stripe.com/reports/balance-transaction-types) are totals with a free-text description, not tied to a payment. Working the fees out from Stripe's price list would be a typed number.
4. **An account on "standalone fees"** has its card fee taken later too: the payment's balance transaction then shows a fee of zero and "within 36 hours of the charge" a second, fee-only balance transaction carries "the aggregate fees of all transactions processed within that period" (https://docs.stripe.com/standalone-fees). New accounts start on inline fees. The rule in Task 4 is right for both: a report row is skipped only when it sits in a balance transaction a fee was already read from.
5. **Not in Stripe's pages, so read at M1:** the exact `product` and `feature_name` of a Billing fee and a Tax fee, whether those rows name the invoice or the charge in `incurred_by`, and how many decimals `amount` carries. The plan does not depend on the names (a row is placed by the id it names), and it stops, without guessing, on a row it cannot read.
6. **The old money code** (`OLD/packages/ledger`, `OLD/packages/core/src/money`, `OLD/packages/core/src/premium`, `OLD/packages/billing/src/connect.ts`) is a double-entry journal with months that close and finalize, a pool split "user-centric" (each member's money goes to the games that member played), statements built from journal lines, a payout plan with the $25 minimum and `PO-YYMM-NNNN` ids, and chargebacks that undo a payment in proportion. It took only the card fee off the top, had no bringing bonus, capped play another way, froze a draft of each pool two days before finalizing and compared the two, kept a pseudonymous member key, an earnings "unlock", holds for takedown claims, contributor splits, an ad pool, a store and tips. Design 7.2 carries "the Premium pool, postings, statements, payout plan and ID, chargebacks, arithmetic, periods". Everything else in that list is not carried.
7. **The old Connect code** made one Express account per payee with the `transfers` capability and a manual payout schedule, moved a payout with a transfer and then a payout on the connected account, and guarded each with an idempotency key and a lookup, because "Stripe forgets idempotency keys after about 24 hours". It learned an account's state and a payout's outcome from a second webhook address with its own secret. This plan reads both from Stripe in the daily job and when the maker opens the bank screen, so there is no second address and no new secret.
8. **Stripe's price for sending a payout** is charged to Ruken's account after the payout, not taken from it: "$2 per monthly active account" and "0.25% + 25¢ per payout sent" (https://stripe.com/connect/pricing, read 2026-11-14). The real charge is a row in the Fees report days later. How it "comes out of that payout" (the agreement's words) is the Owner's question 1.
9. **The daily job runs once, at 09:17 UTC**: 03:17 in Chicago in winter and 04:17 in summer. So "the 10th" and "the 15th" mean the job's run on that Chicago date, in the small hours.

## The Owner's decisions, the open questions, and the Calls in this plan

- **Owner, 2026-11-13** (design 6, as approved and revised): tax and every fee Stripe charges on a payment (card, Billing, Tax) come off the top; what is left is half Ruken, half makers; a yearly fee is spread across its twelve months; Ruken's half is never reduced to pay makers; for a member's first 12 months half of that member's makers' share goes to the maker who brought them, by the last arrival before paying, with no time limit, for the first join only, and never for bringing yourself; the rest is divided by play time, at most 180 minutes per member, per game, per day; free play, staff play and a maker's own play never count; statements are final on the 10th and paid on the 15th (the next business day if that is a weekend or holiday) through Stripe Connect; the minimum is $25 and smaller balances carry forward; the cost of sending a payout comes out of that maker's payout and is shown on their statement; chargebacks and refunds follow the carried rules.
- **Owner, 2026-11-14** (the maker agreement, version 1, paragraphs 5 and 6, relayed by the coordinator): the same rules in the words makers agreed to. "Never lose money" and "payouts and the bringing bonus come only from the makers' half" (relayed with it).
- **Owner, 2026-11-14:** this plan is written now, beside slice 2's build ("Slice 5 plan").
- **Asked on 2026-11-14, not yet answered.** Each has the plan's working answer, which is the recommendation; the task that depends on it does not start before the answer, and says so.
  1. **Owner: how the cost of sending a payout comes out of it.** Stripe charges it after the payout. (A) Take the real cost afterwards, as a line on the maker's next statement. (B) Hold back the cost worked out from Stripe's price list, kept in the code as a dated rule, send the rest, and correct to Stripe's real charge on a later statement. (C) Ruken pays it. Working answer: B. Tasks 28 and 31.
  2. **Owner: which makers can connect a bank at first.** (A) The United States only, said in one line on the screen. (B) Every country Stripe allows. Working answer: A. Task 24.
  3. **Coordinator: the second person and the code.** (A) This slice names what it needs from slice 4 and Task 33 waits for it. (B) This slice builds them. Working answer: A. Task 33.
- **Calls** (the Owner can overrule):
  - **A month** is an America/Chicago calendar month, written `YYYY-MM`. A payment belongs to the month its paid period starts in; a yearly payment to that month and the eleven after it, one twelfth each, with the odd cents in the earliest months (carried).
  - **A month closes on the 8th of the next month**, at midnight in Chicago. Until then a fact dated in that month is posted into it; after, into the month that is open. A closed month is never reopened (carried). The old code closed on the 2nd; Stripe's Fees report can run four days behind, so the 8th is the first date by which a month's last fees are in. **It is final on the 10th.** Between the 8th and the 10th nothing about the month can change, and staff can read it on the admin screen before it is final. The old two-day draft and its comparison are not carried: the same check is that a closed month takes no more entries.
  - **Off the top, per payment:** the tax and the card fee, which slice 1 already reads, and every row of Stripe's Fees report that names the payment's invoice, charge or payment intent. A row in a balance transaction a fee was already read from is that same fee and is not taken twice. The rows' fractions of a cent are added up per payment and rounded up to a whole cent, so what is taken is never less than what Stripe charged; at most one cent per payment is taken beyond it.
  - **A fee Stripe charged that names no payment and no payout** (one for the account as a whole) is not taken from makers. It is kept as a fact and shown to staff. If M1 shows that Billing or Tax fees arrive that way, execution stops and the coordinator asks the Owner how they are shared; the plan does not guess.
  - **Rounding.** The makers' half of a payment is half of what is left, rounded half up, once per payment (carried). The month's pool is divided by one largest-remainder rounding, so the shares add up to the pool exactly and no cent is made or lost (carried).
  - **The bringing bonus** is worked out per member and month: half of that member's part of the month's pool, before play divides the rest. It counts for the month of the member's first join and the eleven after it. It goes to the account in `MembershipStart.broughtByUserId` of the member's earliest `MembershipStart` row; a later join never starts a new one, and a first join with no maker, or with the member's own account, gives none.
  - **A member who played nothing that month:** their part, after any bonus, follows everyone else's play that month (design 6, carried). **A month in which no member played anything:** the play part carries into the next month's pool; bonuses are still paid.
  - **Play that counts** is slice 2's `member` sessions only. A member's time on a game on a day is the time covered by any of their sessions, each moment once, cut at Chicago midnight, 10,800 seconds at most. It is added up once a day into `PlayDay` rows, so a statement never reads a month of beats.
  - **Whose game** a play share belongs to is the game's `makerUserId` when the month is made final.
  - **Refunds and chargebacks** undo the payment in proportion, each side giving back what it got, and what Stripe keeps on a chargeback (its fees) is shared half and half between the open month's pool and Ruken (carried). They reach the pool, not a maker's finished statement.
  - **No member key.** Slice 1's note expected a `LEDGER_SUBJECT_KEY` and a pseudonymous member key. The payment and play rows the ledger reads already carry the account id, which stays as a tombstone after an account is deleted, so a second name for it would add a secret and hide nothing. Money tables hold ids and amounts only: no email, name or address.
  - **Everything runs from the daily job**, in one order (Task 19). Stripe's webhooks stay slice 1's; this slice adds no handler to them. A refund, a dispute, a bank account's state and a payout's outcome are each read from Stripe by the job, so a missed event cannot leave the books wrong, and the events slice 1 kept before this slice was deployed need no replay.
  - **Connecting the bank is in this slice**, at `/make/bank` (design 7.1 puts Stripe Connect in `money`; slice 2's notes listed it under slice 4, and the coordinator's brief of 2026-11-14 puts it here).
  - **The $25 minimum** is checked against what the maker is owed, before the cost of sending.
  - **A maker's question about a statement line** (the old "dispute") is the last branch, after the first payout: it is not needed for a statement to be right or a payout to be sent.
  - **Not in this slice:** free-play codes (design 6: built after launch, and design 7.5 does not list them here), a daily comparison of Stripe's invoices with `MembershipPayment` (slice 1's note), typed corrections by staff (the old "adjustments"), and tax forms for makers. Each is a later spec if the Owner asks.

## What the Owner holds, outside this plan

Live payouts need the real terms, the privacy text and a lawyer's maker agreement first (the coordinator's brief; design 9). That is the Owner's, and no task here waits for it: the code is built and checked against Stripe's test mode and a stand-in. It sits before M2's last step, turning Connect on in live mode. The privacy text should say that Ruken keeps what each member paid and how long they played each game, to pay makers, and that a maker's bank details are held by Stripe, not by Ruken.

## Where execution stops and waits for the Owner

The execution session reports to the coordinator and asks for each of these with the exact lines below. Each line is one command for Windows PowerShell; a step goes to a website only where no command can do it, and says so. Words in CAPITALS are the Owner's own values and are never written in the repository.

**M1, asked for when branch C is merged; needed before branch D is marked ready.** The first real read of Stripe's fees. Slice 1's real payment (its Task 31) should already have rows.

1. `$s = Read-Host "JOBS_SECRET"; (Invoke-WebRequest -UseBasicParsing -Method Post -Uri "https://SITE/jobs/money" -Headers @{ Authorization = "Bearer $s" } -ContentType "application/json").Content` (the secret is the one from slice 1's S1 and stays in this window only. The first run asks Stripe for the report; expect `"requested":"requested"` under `"feeReport"`.)
2. The same line again a few minutes later. Expect `"collected":"stored"` under `"feeReport"`, and under `"fees"` a list of what Stripe charged, by `product` and `feature_name`, with how many rows were `payment`, `payout`, `counted` and `unplaced`. No amount of a person's is shown.
3. Paste the answer to the coordinator. Execution checks it against "Found while planning", 5: every Billing and Tax row should be `payment`. If one is `unplaced`, or the run `failed`, stop: that is the Owner's decision named under the Calls.

**M2, asked for when branch D starts; needed before branch E is marked ready.**

1. A website: no command turns Connect on. In Stripe's dashboard, in test mode first: Connect → Get started; choose that Ruken pays out to others; under the Connect settings, name the platform "Ruken" and set its address to the site's. Say "done".
2. The same in live mode, once the Owner's legal texts are in place ("What the Owner holds"). Until then makers on the real site see the bank screen say payouts are not open yet (Task 25).

**M3, on or after 10 December, before 15 December.** The first payout run, approved in the admin portal by the Owner's second staff account, with a fresh code (Task 33). The steps are on the screen; no command.

**M4, Task 37.** The first statement and the first payout, checked on the real site.

## How a task runs, and carrying a file

As slice 1's plan, word for word: two pushes (red with stubs, then green), the tracker ticked with both CI run numbers, one report line to the coordinator after each task, a draft pull request per branch, never ready while red, `main` merged in (never rebased) when it has moved. **Carrying a file** means: copy it from `OLD/` to the new path, rewrite its imports, remove what the task lists under "Trim", make the changes it lists under "Changed", remove old-plan references from comments, change nothing else; its tests are carried the same way, keeping only the cases for what is kept. Two changes apply to every carried file and are not repeated: an account named `creator:<party>:payable` is `maker:<userId>:payable`, and `partyId` is `makerUserId` (one maker is one account, design 5.3); the old `pending` and `held` accounts, and every branch of code that chose between them, are trimmed (there is no earnings unlock and no claim hold in the design).

## Branches

Eleven branches, in this order. Each starts from `main` only after the one before it is merged and green.

| # | Branch | Tasks | Ends with |
|---|---|---|---|
| A | `slice-5/money-rules` | 1 to 8 | every rule as a pure, tested function, and one whole month worked through |
| B | `slice-5/ledger` | 9 to 11 | the ledger tables, the journal, months that close |
| C | `slice-5/facts` | 12 to 19 | payments, Stripe's fees, yearly releases, refunds and chargebacks, and daily play, all posted by one daily job (then M1) |
| D | `slice-5/statements` | 20 to 23 | the month's pool, every maker's statement, final on the 10th |
| E | `slice-5/bank` | 24, 25 | a maker connects a bank (waits for M2 and question 2) |
| F | `slice-5/maker-money` | 26, 27 | a maker sees what they are owed and reads a statement |
| G | `slice-5/payouts` | 28 to 31 | the payout run, sent on the 15th, and its cost (waits for question 1) |
| H | `slice-5/admin-money` | 32, 33 | staff see the month; a second person approves the payout run (waits for slice 4's pieces and question 3) |
| I | `slice-5/split-page` | 34 | the public page: the split, a worked example, and each month's totals |
| J | `slice-5/questions` | 35, 36 | a maker questions a statement line; staff answer |
| K | `slice-5/real-site` | 37 | the first statement and payout checked on the real site (M4) |

## File map

```
prisma/schema/money.prisma               LedgerPeriod, JournalEntry, JournalLine (branch B); PaymentPosting, StripeFeeRun, StripeFeeRow,
                                         FeePosting, StripeReversal, PlayDayRun, PlayDay (branch C); PoolRun, PoolShare, Statement,
                                         StatementLine (branch D); BankAccount (branch E); PayoutRun, Payout (branch G); MoneyJobRun (branch H); StatementQuestion (branch J)
cloudflare/worker.js                     knocks on /jobs/money after /jobs/purge-accounts            (branch C)
src/lib/csv.ts                           parseCsv: rows of text from a CSV file
src/lib/look.css                         gains `rows`                                                 (branch F)
src/features/play/play.ts                also exports countedMs and LONGEST_COUNTED_GAP_MS           (branch A)
src/features/membership/services.ts      membershipServices() also answers `stripe`                   (branch C)
src/features/accounts/staff.ts           MONEY_STAFF_ROLES                                            (branch H)
src/features/money/
  money.ts               entry
  rules.ts               the numbers of the rules, each with the Owner's line beside it
  arithmetic.ts          pct, lrr                                    (carried)
  period.ts              Period, parsePeriod, addMonths, periodOf    (carried, plus periodOf)
  calendar.ts            days, business days, the 8th, 10th and 15th (carried)
  canonical-json.ts      one text for one value, for hashes          (carried)
  posting.ts             PostingLine, withoutZeroLines, requireNonNegative (carried, trimmed)
  pool-share.ts          poolContributions: a payment's makers' half, month by month (carried)
  payment-posting.ts     postPaymentPaid, releases, postRelease, feeParts, postPaymentFee
  reversal-posting.ts    reversePaymentLines, reverseOpenedEntry, postChargebackOpened, postChargebackWon, postRefund, cancelledMonths (carried)
  major-units.ts         microCentsOf, centsRoundedUp
  fee-rows.ts            FEE_REPORT_TYPE, FEE_COLUMNS, feeRowsFrom(csv), placeFee
  bringing.ts            bringerOf
  play-day.ts            countedIntervals, playSecondsOnDay
  makers-pool.ts         allocateMakersPool
  pool-posting.ts        postPoolShares, postPoolCarry               (carried, trimmed)
  statement.ts           buildStatement                              (carried, trimmed)
  payout-id.ts           payoutId, payoutDescriptor                  (carried)
  payout-plan.ts         planPayouts, recheckPayout, payoutCost, postTransfer (carried, changed)
  journal.ts             postEntry, postingPeriod, postingPeriodForMonth, accountBalance, IdempotencyConflict (carried, trimmed)
  periods.ts             closeDuePeriods                             (carried)
  stripe-port.ts         MoneyStripe, bindMoneyStripe
  payments.ts            postUnpostedPayments
  fee-report.ts          collectFeeReport, requestFeeReport
  fees.ts                postFeeRows
  releases.ts            releaseDueMonths                            (carried)
  reversals.ts           readReversals, postReversals                (carried, changed)
  play-rollup.ts         rollUpPlayDays
  pool-run.ts            poolFor(period)
  statements.ts          writeStatements                             (carried, trimmed)
  finalize.ts            finalizeDuePeriods                          (carried, trimmed)
  bank.ts                startBankSetup, refreshBank, bankOf
  payouts.ts             draftPayoutRun, approvePayoutRun            (carried, trimmed)
  payout-execution.ts    executePayouts, settlePayouts               (carried, changed)
  payout-costs.ts        postPayoutCosts, correctPayoutCosts
  questions.ts           askAbout, answerQuestion                    (carried, trimmed)
  daily.ts               runMoneyJob: the steps, in order
  views.ts               makerMoney, statementOf, monthSoFar, splitNumbers: what the screens read
  services.ts            built once from the settings
  library/split-example.json   the made-up inputs of the public page's example
src/routes/
  jobs/money/+server.ts                           the daily money job
  make/bank/, make/bank/back/                     connect your bank
  make/money/, make/money/[period]/               what you're owed; a statement
  admin/money/, admin/money/[period]/             the month; the payout run
  split/                                          the public page
tests/support/fake-money-stripe.ts       a MoneyStripe in memory, for database tests
tests/support/ledger.ts                  balancesOf(prisma), a whole month's set-up
tests/features/money/…  tests/lib/csv.test.ts                mirror src/
tests/browser/bank.test.ts, maker-money.test.ts, admin-money.test.ts, split.test.ts, statement-questions.test.ts, money-job.test.ts
```

## Review Focus

Each line names an input the design implies and no ordinary test would meet. Each has its test in the task named.

1. A payment whose fees are more than what is left after tax: the makers' half is nothing, never less than nothing, and the entry still adds up (Tasks 3, 13).
2. The same Stripe fee seen twice, once on the payment's own balance transaction and once in the Fees report: taken once (Tasks 4, 15).
3. A fee row for a payment that arrives after its month closed: posted into the open month, never into the closed one, and the closed month's statement does not move (Tasks 10, 15, 23).
4. A fee row whose amount is not a number, has too many decimals, or is not in US dollars: kept as a fact, never posted, and the month does not become final until it is dealt with in code (Tasks 4, 15, 23).
5. A yearly payment refunded in its fourth month: the months not yet released are cancelled, latest first, and only what already reached a pool comes out of the open month (Tasks 3, 16, 17).
6. A member with two tabs of one game open, across Chicago midnight, on the night the clocks change: each moment counted once, each day capped at 10,800 seconds, and the 23-hour and 25-hour days are whole days (Tasks 6, 18).
7. A maker who arrives through their own link and joins, and a member whose second join came through another maker: no bonus for either (Task 5).
8. A month in which members paid and nobody played: the bonuses are paid, the rest carries, and nothing is divided by zero (Tasks 7, 21).
9. The daily job stopped halfway and run again, or run twice at once: nothing is posted twice (Tasks 10, 13, 15, 19).
10. A game whose maker's account was deleted: the share is still worked out and stays owed to the tombstone account; nothing is sent, and the purge removes no money row (Tasks 21, 22, 29).
11. A maker owed $24.99, and a maker owed $25.00 whose bank is not connected: neither is paid, both carry forward, and each statement says why in one line (Tasks 22, 27, 28).
12. A payout whose transfer Stripe made but whose answer was lost: the next run finds it and records it instead of sending it again (Task 30).
13. A payout approved for one amount when a chargeback has since lowered what the maker is owed: the lower amount is sent, never the higher (Task 30).
14. The person who proposed a payout run tries to approve it, or approves with an old code: refused (Task 33).
15. A maker opens another maker's statement by typing its address: a missing page (Task 27).
16. Stripe's report run still `pending`, or `failed`: nothing is stored, the job says so, and the next run asks again for the same stretch of time (Task 14).
17. A month's totals after everything is posted: Ruken's revenue is never less than its half of each payment, and every account still adds up to zero (Tasks 8, 21).

---

# Branch A: `slice-5/money-rules`

Pure functions only: no database, no Stripe, no clock. Every file here imports nothing but other files in `src/features/money/` (and, in Task 6, `play.ts`).

### Task 1: The rules' numbers, the arithmetic, months and days

**Files:**
- Create: `src/features/money/rules.ts`, `arithmetic.ts`, `period.ts`, `calendar.ts`, `canonical-json.ts`
- Test: `tests/features/money/rules.test.ts`, `arithmetic.test.ts`, `period.test.ts`, `calendar.test.ts`, `canonical-json.test.ts`

**Interfaces:**
- Produces:
  - `arithmetic.ts`, carried whole from `OLD/packages/ledger/src/arithmetic.ts` with `arithmetic.test.ts`: `FULL_SHARE_BPS = 10_000`, `pct(amount: bigint, bps: number): bigint` (rounded half up, refuses a negative amount), `interface WeightedItem { key: string; weight: bigint }`, `lrr(total: bigint, items: readonly WeightedItem[]): Map<string, bigint>` (largest remainder; ties to the lower key).
  - `period.ts`, carried whole from `OLD/packages/ledger/src/period.ts` with `period.test.ts`: `type Period`, `isPeriod`, `parsePeriod`, `addMonths`. Added: `periodOf(epochMs: number): Period`, the Chicago month an instant falls in, through `Temporal` and `CALENDAR_ZONE` (`OLD/packages/core/src/money/journal.ts`'s `ledgerMonth`, which used `Intl`).
  - `calendar.ts`, carried from `OLD/packages/ledger/src/calendar.ts` with `calendar.test.ts`: `type DateText`, `parseDate`, `addDays`, `dayOfWeek`, `isUsFederalHoliday`, `isBusinessDay`, `nextBusinessDay`, `addBusinessDays`, and, renamed to this design's words: `closeDate(period): DateText` (the 8th of the next month; the old `periodCloseDate`), `finalDate(period): DateText` (the 10th; the old `statementFinalizeDate`), `payoutDate(period): DateText` (the 15th, or the next business day), `questionWindowEnds(finalOn)` and `answerBy(askedOn)` (the old `disputeWindowEnds` and `disputeRespondBy`). Added: `startOfDayMs(date: DateText): number`, midnight in Chicago at the start of that day, through `Temporal`. Trim: `periodFreezeDate`.
  - `canonical-json.ts`, carried whole from `OLD/packages/ledger/src/canonical-json.ts` with its test: `canonicalJson(value: unknown): string`.
  - `rules.ts`, from `OLD/packages/ledger/src/rules.ts`, keeping only what this design uses, each with the Owner's line in a comment:

    | Constant | Value | From |
    |---|---|---|
    | `MAKERS_SHARE_BPS` | `5000` | design 6: "half Ruken, half makers" (the old `CREATOR_POOL_SHARE_BPS`) |
    | `BRINGING_MONTHS` | `12` | design 6: "for a member's first 12 months" |
    | `DAILY_PLAY_CAP_SECONDS` | `10_800` | design 6: "at most 180 minutes per member, per game, per day" |
    | `PAYOUT_MINIMUM_CENTS` | `2500n` | design 6: "The minimum is $25" |
    | `CLOSE_DAY_OF_MONTH` | `8` | this plan's Call |
    | `FINAL_DAY_OF_MONTH` | `10` | design 6: "final on the 10th" |
    | `PAYOUT_DAY_OF_MONTH` | `15` | design 6: "paid on the 15th" |
    | `CHARGEBACK_COST_MAKERS_SHARE_BPS` | `5000` | carried |
    | `POOL_WEIGHT_SCALE` | `1_000_000_000n` | carried (`PREMIUM_WEIGHT_SCALE`) |
    | `QUESTION_WINDOW_DAYS` | `90` | carried (`DISPUTE_WINDOW_DAYS`) |
    | `ANSWER_BUSINESS_DAYS` | `10` | carried (`DISPUTE_RESPONSE_BUSINESS_DAYS`) |

    The bonus is "half of the makers' half": it has no constant of its own, because Task 7 halves a weight, not an amount.

- [ ] **Step 1 (red):** the carried tests under the new names, and:

```ts
it("closes a month on the 8th, makes it final on the 10th and pays on the 15th", () => {
  expect(closeDate("2026-11" as Period)).toBe("2026-12-08");
  expect(finalDate("2026-11" as Period)).toBe("2026-12-10");
  expect(payoutDate("2026-11" as Period)).toBe("2026-12-15");
});
it("pays on the next business day when the 15th is not one", () => {
  expect(payoutDate("2027-04" as Period)).toBe("2027-05-17");   // 15 May 2027 is a Saturday
  expect(payoutDate("2027-01" as Period)).toBe("2027-02-16");   // 15 February 2027 is Washington's Birthday
});
it("knows the Chicago month of an instant, on both sides of midnight", () => {
  expect(periodOf(Date.parse("2026-12-01T05:59:59Z"))).toBe("2026-11");   // 23:59:59 on 30 November in Chicago
  expect(periodOf(Date.parse("2026-12-01T06:00:00Z"))).toBe("2026-12");
});
it("starts a Chicago day at its own midnight, in winter and in summer", () => {
  expect(startOfDayMs("2026-12-10")).toBe(Date.parse("2026-12-10T06:00:00Z"));
  expect(startOfDayMs("2027-07-10")).toBe(Date.parse("2027-07-10T05:00:00Z"));
});
it("keeps every rule's number", () => { /* each constant in the table equals its value */ });
```

  Stubs. Push. Expected: `verify` fails in the five files with "not built yet".
- [ ] **Step 2 (green):** carry the four files; write `rules.ts`, `periodOf`, `startOfDayMs`. Push. Expected: all pass.

### Task 2: A payment's makers' half, month by month

**Files:**
- Create: `src/features/money/posting.ts`, `src/features/money/pool-share.ts`
- Test: `tests/features/money/pool-share.test.ts`

**Interfaces:**
- Produces:
  - `posting.ts`, from `OLD/packages/ledger/src/posting.ts`: `interface PostingLine { account: string; amount: bigint; makerUserId?: string }` (a debit is positive, a credit negative, and an entry's lines add up to zero), `withoutZeroLines`, `requireNonNegative`. Trim: everything about store sales, tips and splits (`CreatorShare`, `StoreSaleAmounts`, `TipAmounts`, `postStoreSale`, `postTip`, `creatorLines`).
  - `pool-share.ts`, carried from `OLD/packages/ledger/src/premium-pool.ts` with `premium-pool.test.ts`: `SERVICE_MONTHS = { monthly: 1, annual: 12 }`, `interface Payment { plan: "monthly" | "annual"; firstPeriod: Period; gross: bigint; tax: bigint; fees: bigint }` and `poolContributions(payment: Payment): { period: Period; amount: bigint }[]`.
  - Changed: the old `fee` (the card fee) is `fees`: the card fee plus every other fee Stripe charged on the payment, in whole cents. Nothing else changes: what is left is `gross − tax − fees`, never below zero; the makers' half is `pct(left, MAKERS_SHARE_BPS)`, rounded once for the whole payment; a yearly payment's half is spread evenly over its twelve months by `lrr`, the odd cents to the earliest months.

- [ ] **Step 1 (red):** the carried cases, and, with the stand-in Stripe's numbers ($9.99, 82 cents tax, a 61-cent card fee) and 12 cents of other fees:

```ts
const monthly = { plan: "monthly", firstPeriod: "2026-11" as Period, gross: 1081n, tax: 82n, fees: 73n } as const;
it("takes tax and every fee off the top, then gives makers half", () => {
  expect(poolContributions(monthly)).toEqual([{ period: "2026-11", amount: 463n }]);   // 1081 − 82 − 73 = 926; half is 463
});
it("gives makers the odd cent, as the carried rule does", () => {
  expect(poolContributions({ ...monthly, fees: 72n })[0]?.amount).toBe(464n);          // 927 left; half up
});
it("spreads a yearly fee over twelve months, the odd cents first", () => {
  const parts = poolContributions({ plan: "annual", firstPeriod: "2026-11" as Period, gross: 10717n, tax: 817n, fees: 387n });
  expect(parts.map((part) => part.period)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09", "2027-10"]);
  expect(parts.map((part) => part.amount)).toEqual([397n, 397n, 397n, 397n, 397n, 396n, 396n, 396n, 396n, 396n, 396n, 396n]);   // 9513 left; half up is 4757
});
it("gives nothing, never less, when the fees are more than what is left", () => {      // Review Focus 1
  expect(poolContributions({ ...monthly, fees: 2000n })).toEqual([{ period: "2026-11", amount: 0n }]);
});
it("refuses a negative amount", () => { /* gross, tax or fees below zero: RangeError */ });
```

  Stubs. Push. Expected: `verify` fails in `pool-share.test.ts` with "not built yet".
- [ ] **Step 2 (green):** carry both files. Push. Expected: all pass.

### Task 3: The entries a payment makes: paid, a later fee, a release, a refund, a chargeback

**Files:**
- Create: `src/features/money/payment-posting.ts`, `src/features/money/reversal-posting.ts`
- Test: `tests/features/money/payment-posting.test.ts`, `reversal-posting.test.ts`

**The accounts.** The carried names, and nothing new here:

| Account | Holds |
|---|---|
| `platform:stripe_clearing` | Ruken's money at Stripe |
| `platform:processor_fees` | fees Ruken carries alone (the card fee is posted here, as carried; what is left to split already leaves it out) |
| `platform:tax_payable` | tax Stripe collected |
| `platform:revenue:premium` | Ruken's half |
| `premium:deferred` | the months of a yearly payment that have not come yet |
| `pool:premium:<period>` | the makers' half for a month, until it is shared out |
| `maker:<userId>:payable` | what a maker is owed |

**Interfaces:**
- Produces, in `payment-posting.ts`, from `OLD/packages/ledger/src/premium-posting.ts` with `premium-posting.test.ts`:
  - `postPaymentPaid(payment: Payment): PostingLine[]` (the old `postPremiumPaid`, `fee` now `fees`), `releases(payment): { period; amount }[]` (the old `premiumReleases`), `postRelease(release): PostingLine[]`, `releaseKey(stripeInvoiceId, period): string`.
  - New: `feeParts(payment: Payment, fee: bigint): { months: { period: Period; amount: bigint }[]; ruken: bigint }`. `payment.fees` is what was already taken; `fee` is one more, in whole cents, above zero. `months[i].amount` is `poolContributions(payment)[i].amount − poolContributions({ ...payment, fees: payment.fees + fee })[i].amount`, with zero months left out; `ruken` is `fee` less their sum. So a later fee takes from each side exactly what it would have taken had it been known when the payment was posted, and the two always add up to the fee.
  - New: `postPaymentFee(parts: ReturnType<typeof feeParts>, accountFor: (period: Period) => string): PostingLine[]`: a credit of the whole fee to `platform:stripe_clearing`, a debit of each month's part to `accountFor(period)` (the caller answers `premium:deferred` for a month not yet released and a pool account otherwise; two months with the same account make one line), and a debit of `ruken` to `platform:revenue:premium`.
- Produces, in `reversal-posting.ts`, carried from `OLD/packages/ledger/src/chargeback.ts` (only `reverseOpenedEntry`, `reversePaymentLines` and the helpers they use) and the whole of `OLD/packages/ledger/src/premium-chargeback.ts`, with the matching cases of `chargeback.test.ts` and the whole of `premium-chargeback.test.ts`: `interface Chargeback` (the old `PremiumChargeback`), `postChargebackOpened(chargeback): PostingLine[]`, `postChargebackWon(opened, openPool, reinstated): PostingLine[]`, `cancelledMonths(releases, cancelled): Map<Period, bigint>`.
  - Changed: `paymentLines` is the payment's entry and every fee entry posted for it since, added up account by account, so a chargeback also undoes the later fees in proportion.
  - New: `postRefund(input: { paymentLines: readonly PostingLine[]; paymentGross: bigint; amount: bigint; feeReturned: bigint; deferredLeft: bigint; openPool: Period }): PostingLine[]`: a chargeback with no dispute fee. It is `postChargebackOpened({ ...input, disputeFee: 0n })`: the refund goes back out of Stripe, each side gives back its part in proportion, the months not yet released are cancelled first, and whatever fee Stripe does not return is shared as the carried rule shares it.
  - Trim: the store's two functions and their type.

- [ ] **Step 1 (red):** the carried cases, and:

```ts
const paid = { plan: "monthly", firstPeriod: "2026-11" as Period, gross: 1081n, tax: 82n, fees: 61n } as const;
it("posts a payment with what is known at the time", () => {
  expect(postPaymentPaid(paid)).toEqual([
    { account: "platform:stripe_clearing", amount: 1020n },
    { account: "platform:processor_fees", amount: 61n },
    { account: "platform:tax_payable", amount: -82n },
    { account: "pool:premium:2026-11", amount: -469n },        // 938 left; half is 469
    { account: "platform:revenue:premium", amount: -530n },    // 1081 − 82 − 469, as carried
  ]);
});
it("splits a later fee as if it had been known", () => {
  expect(feeParts(paid, 12n)).toEqual({ months: [{ period: "2026-11", amount: 6n }], ruken: 6n });   // 469 → 463
  expect(feeParts(paid, 1n)).toEqual({ months: [], ruken: 1n });                                       // 938 → 937: half up is still 469
});
it("posts a later fee out of Stripe, the month's pool and Ruken's half, adding up to zero", () => {
  expect(postPaymentFee(feeParts(paid, 12n), (period) => `pool:premium:${period}`)).toEqual([
    { account: "platform:stripe_clearing", amount: -12n },
    { account: "pool:premium:2026-11", amount: 6n },
    { account: "platform:revenue:premium", amount: 6n },
  ]);
});
it("takes a yearly payment's later fee from the months it belongs to", () => { /* fees + 24: twelve months, 1 cent each from the pool side, 12 from Ruken; accountFor answers "premium:deferred" for all but the first: two debit lines, 1 and 11 */ });
it("takes nothing more from makers once their half is nothing", () => {                // Review Focus 1
  expect(feeParts({ ...paid, fees: 2000n }, 5n)).toEqual({ months: [], ruken: 5n });
});
it("refunds a whole payment: every side gives back what it got", () => { /* the lines of postPaymentPaid(paid) reversed, cash −1081 + feeReturned; adds up to zero */ });
it("refunds part of a yearly payment in its fourth month: the unreleased months first, latest first", () => {   // Review Focus 5
  /* deferredLeft = the eight months not yet released; the pool's part of the refund comes from premium:deferred up to that, the rest from pool:premium:<openPool> */ });
it("every entry here adds up to zero", () => { /* each result's amounts sum to 0n */ });
```

  Stubs. Push. Expected: `verify` fails in both files with "not built yet".
- [ ] **Step 2 (green):** carry, then the three new functions. Push. Expected: all pass.

### Task 4: Reading Stripe's Fees report

**Files:**
- Create: `src/lib/csv.ts`, `src/features/money/major-units.ts`, `src/features/money/fee-rows.ts`
- Test: `tests/lib/csv.test.ts`, `tests/features/money/major-units.test.ts`, `fee-rows.test.ts`

**Interfaces:**
- Produces:
  - `parseCsv(text: string): string[][]` in `src/lib/csv.ts`: commas, quoted fields, a doubled quote inside one, `\r\n` or `\n`, a line break inside a quoted field; a last empty line is not a row. No package.
  - In `major-units.ts`: `MICRO_PER_CENT = 1_000_000n`; `microCentsOf(text: string): bigint | null`: Stripe's decimal dollars (`"0.06993"`, `"2"`, `"0.25"`) as whole millionths of a cent, read digit by digit, never through a `number`; null for anything that is not digits with at most one point and at most eight decimals, for a minus sign, and for an empty text. `centsRoundedUp(microCents: bigint): bigint`: the least whole cents that cover it.
  - In `fee-rows.ts`:
    - `FEE_REPORT_TYPE = "all_fees.balance_transaction_created.itemized.2"`, and `FEE_COLUMNS`, the columns asked for, in this order: `balance_transaction_id`, `balance_transaction_created`, `fee_transaction_id`, `incurred_by`, `incurred_by_type`, `incurred_at`, `product`, `feature_name`, `fee_description`, `amount`, `tax`, `currency`, `settled_via`.
    - `interface FeeRow { balanceTransactionId: string; balanceTransactionAt: string; feeTransactionId: string; incurredBy: string; incurredByType: string; incurredAt: string; product: string; featureName: string; description: string; amountText: string; taxText: string; currency: string; settledVia: string }` and `feeRowsFrom(csv: string): FeeRow[]`: the header must be exactly `FEE_COLUMNS` (else it throws "Stripe's fee report has columns this code does not know"); every other line is one row, as text, changed in nothing.
    - `feeMicroCents(row: FeeRow): bigint | null`: `amount` plus `tax` (Stripe's tax on its own fee is part of what Stripe took), or null when either cannot be read or the currency is not `usd`.
    - `interface KnownIds { payments: ReadonlyMap<string, string>; payouts: ReadonlyMap<string, string>; counted: ReadonlySet<string> }`: `payments` maps an invoice, charge or payment-intent id to the payment's invoice id; `payouts` maps a transfer id, a payout id or a maker's Stripe account id to the maker's account id; `counted` holds the balance transactions a fee was already read from (a payment's own, a refund's, a dispute's).
    - `placeFee(row: FeeRow, known: KnownIds): { kind: "unreadable" } | { kind: "counted" } | { kind: "payment"; stripeInvoiceId: string } | { kind: "payout"; makerUserId: string } | { kind: "unplaced" }`, the first that applies, in that order: `feeMicroCents` is null; `balanceTransactionId` is in `counted`; `incurredBy` is in `payments`; `incurredBy` is in `payouts`; none.

- [ ] **Step 1 (red):**

```ts
it.each([["0.06993", 6_993_000n], ["2", 200_000_000n], ["0.25", 25_000_000n], ["10.00", 1_000_000_000n], ["0", 0n]])("reads %j as %j millionths of a cent", (text, micro) => { expect(microCentsOf(text)).toBe(micro); });
it.each(["", "-0.07", "0.123456789", "1e-3", "0,07", "abc", "1.2.3", " 0.07"])("cannot read %j", (text) => { expect(microCentsOf(text)).toBeNull(); });   // Review Focus 4
it("rounds up to the cent, and leaves a whole cent alone", () => {
  expect(centsRoundedUp(11_988_000n)).toBe(12n); expect(centsRoundedUp(12_000_000n)).toBe(12n); expect(centsRoundedUp(1n)).toBe(1n); expect(centsRoundedUp(0n)).toBe(0n);
});
it("reads the report's rows as text and changes nothing", () => { /* a three-line CSV in FEE_COLUMNS' order, one description holding a comma in quotes: two rows, every field as written */ });
it("refuses a report whose columns are not the ones asked for", () => { /* a renamed column: throws */ });
const row = { ...blankRow, balanceTransactionId: "txn_fee", incurredBy: "in_1", amountText: "0.06993", taxText: "0", currency: "usd" };
const known = { payments: new Map([["in_1", "in_1"], ["ch_1", "in_1"], ["pi_1", "in_1"]]), payouts: new Map([["tr_1", "maker"], ["po_1", "maker"], ["acct_1", "maker"]]), counted: new Set(["txn_charge"]) };
it("places a fee by the id it names", () => {
  expect(placeFee(row, known)).toEqual({ kind: "payment", stripeInvoiceId: "in_1" });
  expect(placeFee({ ...row, incurredBy: "ch_1" }, known)).toEqual({ kind: "payment", stripeInvoiceId: "in_1" });
  expect(placeFee({ ...row, incurredBy: "po_1" }, known)).toEqual({ kind: "payout", makerUserId: "maker" });
  expect(placeFee({ ...row, incurredBy: "" }, known)).toEqual({ kind: "unplaced" });
});
it("does not take a fee twice", () => {                                                  // Review Focus 2
  expect(placeFee({ ...row, balanceTransactionId: "txn_charge" }, known)).toEqual({ kind: "counted" });
});
it("never guesses at a row it cannot read", () => {                                      // Review Focus 4
  expect(placeFee({ ...row, amountText: "n/a" }, known)).toEqual({ kind: "unreadable" });
  expect(placeFee({ ...row, currency: "eur" }, known)).toEqual({ kind: "unreadable" });
});
it("counts Stripe's tax on its own fee as part of the fee", () => { expect(feeMicroCents({ ...row, taxText: "0.00007" })).toBe(7_000_000n); });
```

  And for `parseCsv`: a plain line; a quoted field with a comma; `""` inside quotes; `\r\n`; a line break inside quotes; an empty text gives no rows. Stubs. Push. Expected: `verify` fails in the three files with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 5: Who brought a member

**Files:**
- Create: `src/features/money/bringing.ts`
- Test: `tests/features/money/bringing.test.ts`

**Interfaces:**
- Produces: `interface Join { userId: string; startedAtMs: number; broughtByUserId: string | null }` (one `MembershipStart` row) and `bringerOf(joins: readonly Join[], period: Period): string | null`. `joins` are one member's joins, in any order. The first is the one with the least `startedAtMs` (ties: the order given). Null when there are no joins, when the first has no `broughtByUserId`, when it is the member's own `userId`, when `period` is before the first join's Chicago month, or when it is `BRINGING_MONTHS` or more months after it. Otherwise the first join's `broughtByUserId`.

- [ ] **Step 1 (red):**

```ts
const first = { userId: "member", startedAtMs: Date.parse("2026-11-30T18:00:00Z"), broughtByUserId: "maker-a" };
it("pays the maker who brought the first join, for that month and the eleven after", () => {
  expect(bringerOf([first], "2026-11" as Period)).toBe("maker-a");
  expect(bringerOf([first], "2027-10" as Period)).toBe("maker-a");
  expect(bringerOf([first], "2027-11" as Period)).toBeNull();
  expect(bringerOf([first], "2026-10" as Period)).toBeNull();
});
it("counts only the first join, however the later ones arrived", () => {                // Review Focus 7
  const later = { userId: "member", startedAtMs: Date.parse("2027-02-01T18:00:00Z"), broughtByUserId: "maker-b" };
  expect(bringerOf([later, first], "2027-03" as Period)).toBe("maker-a");
  expect(bringerOf([{ ...first, broughtByUserId: null }, later], "2027-03" as Period)).toBeNull();
});
it("gives no bonus for bringing yourself", () => {                                       // Review Focus 7
  expect(bringerOf([{ ...first, broughtByUserId: "member" }], "2026-11" as Period)).toBeNull();
});
it("uses the Chicago month of the join", () => { /* a join at 2026-12-01T05:00:00Z is November: 2027-10 pays, 2027-11 does not */ });
it("has no bringer with no joins", () => { expect(bringerOf([], "2026-11" as Period)).toBeNull(); });
```

  Stub. Push. Expected: `verify` fails in `bringing.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 6: A member's play on a game on a day

**Files:**
- Create: `src/features/money/play-day.ts`
- Modify: `src/features/play/play.ts` (also export `countedMs` and `LONGEST_COUNTED_GAP_MS` from `time.ts`: slice 2's entry file leaves them out, and this is the one place outside `play` that must count the same way)
- Test: `tests/features/money/play-day.test.ts`

**Interfaces:**
- Consumes: `LONGEST_COUNTED_GAP_MS`, `countedMs` from `play.ts`.
- Produces:
  - `interface SessionBeats { startedAtMs: number; beats: readonly { atMs: number; attentive: boolean }[] }`.
  - `countedIntervals(session: SessionBeats): { fromMs: number; toMs: number }[]`: the stretches slice 2's `countedMs` counts, as stretches: beats in time order; an attentive beat counts from the beat before it (or the start) to itself, and when that is longer than `LONGEST_COUNTED_GAP_MS`, only the last `LONGEST_COUNTED_GAP_MS` before the beat; a beat that is not attentive counts nothing; every beat is the "before" of the next. Their lengths always add up to `countedMs(session.startedAtMs, session.beats)`.
  - `playSecondsOnDay(sessions: readonly SessionBeats[], day: DateText): number`: every session's stretches, cut to `[startOfDayMs(day), startOfDayMs(addDays(day, 1)))`, joined so that a moment covered by two sessions counts once, added up, rounded down to whole seconds, `DAILY_PLAY_CAP_SECONDS` at most. The caller passes one member's sessions of one game.

- [ ] **Step 1 (red):**

```ts
const at = (text: string) => Date.parse(text);
const beats = (start: number, count: number) => Array.from({ length: count }, (_, i) => ({ atMs: start + 15_000 * (i + 1), attentive: true }));
it("counts what slice 2 counts, as stretches", () => {
  const session = { startedAtMs: 0, beats: [{ atMs: 15_000, attentive: true }, { atMs: 30_000, attentive: false }, { atMs: 600_000, attentive: true }] };
  expect(countedIntervals(session)).toEqual([{ fromMs: 0, toMs: 15_000 }, { fromMs: 555_000, toMs: 600_000 }]);
  expect(countedIntervals(session).reduce((sum, part) => sum + part.toMs - part.fromMs, 0)).toBe(countedMs(0, session.beats));
});
it("counts a moment once when two tabs are open", () => {                                // Review Focus 6
  const start = at("2026-12-05T18:00:00Z");
  const one = { startedAtMs: start, beats: beats(start, 40) };                           // ten minutes
  const two = { startedAtMs: start + 300_000, beats: beats(start + 300_000, 40) };       // ten minutes, starting five in
  expect(playSecondsOnDay([one, two], "2026-12-05")).toBe(900);
});
it("cuts a session at Chicago midnight", () => {
  const start = at("2026-12-06T05:55:00Z");                                              // 23:55 on the 5th
  const session = { startedAtMs: start, beats: beats(start, 40) };
  expect(playSecondsOnDay([session], "2026-12-05")).toBe(300);
  expect(playSecondsOnDay([session], "2026-12-06")).toBe(300);
});
it("stops at three hours a day", () => { /* 800 beats from 12:00 Chicago time (3 h 20 min): 10_800 */ });
it("treats the 23-hour and the 25-hour day as whole days", () => {                       // Review Focus 6
  /* 2027-03-14 (clocks go forward): a session from 01:30 to 03:30 local counts 3_600 on that day; 2027-11-07 (clocks go back): a session across the repeated hour counts every real second once */ });
it("counts nothing with no sessions, and nothing for a day the sessions do not touch", () => {});
```

  Stubs. Push. Expected: `verify` fails in `play-day.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code and the two exports. Push. Expected: all pass, the layer test included.

### Task 7: Sharing out a month's pool

**Files:**
- Create: `src/features/money/makers-pool.ts`, `src/features/money/pool-posting.ts`
- Test: `tests/features/money/makers-pool.test.ts`, `pool-posting.test.ts`

**Interfaces:**
- Produces, in `makers-pool.ts`, from `OLD/packages/ledger/src/premium-weights.ts` and `pool-outcome.ts` with their tests:
  - `interface MemberMonth { userId: string; contribution: bigint; broughtBy: string | null; plays: readonly { gameId: string; seconds: number }[] }`: `contribution` is the cents this member's payments put into the month (Task 2's parts for the month, with every fee known so far); `broughtBy` is Task 5's answer for the month; `plays` are the month's `PlayDay` rows.
  - `type PoolOutcome = { kind: "shared"; games: { gameId: string; weight: bigint; amount: bigint }[]; bringers: { makerUserId: string; weight: bigint; members: number; amount: bigint }[]; carry: bigint } | { kind: "carry"; amount: bigint }`.
  - `allocateMakersPool(pool: bigint, members: readonly MemberMonth[]): PoolOutcome`. The carried algorithm with two changes, in weights of `POOL_WEIGHT_SCALE` (billionths of a cent):
    1. A member with a zero contribution is left out (carried). For each other member, `whole = contribution × POOL_WEIGHT_SCALE`. With a `broughtBy`: `bonus = whole / 2n` (rounded down) is added to that maker's weight, and `rest = whole − bonus`; with none, `rest = whole`.
    2. A member who played: `rest` is split over their games by seconds, each rounded down (carried). A member who did not: `rest` is added to the idle total (carried).
    3. The idle total is split over every game by all paying members' seconds (carried). With no seconds at all it becomes the weight of a carry.
    4. The pool as it stands is split once by `lrr` over the games' weights (keys `game:<id>`), the makers' bonus weights (keys `bring:<userId>`) and the carry (key `carry`). A pool of zero or less, or no weight but the carry's: `{ kind: "carry", amount: pool }` (carried: the whole pool moves on). Games and bringers are listed in id order; a zero share stays in the list.
  - The carried checks stay: a member twice, a negative contribution, seconds that are not a whole number of zero or more each throw.
- Produces, in `pool-posting.ts`, from `OLD/packages/ledger/src/pool-posting.ts`: `interface PoolEntry { key: string; kind: "pool_share" | "pool_carry"; gameId: string | null; lines: PostingLine[] }`, and
  - `postPoolShares(period: Period, outcome: Extract<PoolOutcome, { kind: "shared" }>, makerOf: ReadonlyMap<string, string>): PoolEntry[]`: one entry per game with a share above zero (key `pool:<period>:game:<gameId>`: a debit to `pool:premium:<period>`, a credit to `maker:<makerOf.get(gameId)>:payable`), one per bringer with a share above zero (key `pool:<period>:bring:<makerUserId>`, no game), and a carry entry when `carry` is not zero.
  - `postPoolCarry(period: Period, amount: bigint): PoolEntry[]` (carried): what moves from `pool:premium:<period>` into the next month's pool; nothing for zero.
  - Trim: the ad pool, the split of a game's share between parties, `postPoolOutcome`'s late-money case.

- [ ] **Step 1 (red):** the carried cases that still apply, and:

```ts
const member = { userId: "m", contribution: 463n, broughtBy: "b", plays: [{ gameId: "g1", seconds: 3600 }, { gameId: "g2", seconds: 1800 }] };
it("gives the bringer half of the member's part, and play the rest", () => {
  expect(allocateMakersPool(463n, [member])).toMatchObject({ kind: "shared", carry: 0n,
    bringers: [{ makerUserId: "b", members: 1, amount: 232n }],
    games: [{ gameId: "g1", amount: 154n }, { gameId: "g2", amount: 77n }] });      // the odd cent goes to the largest remainder
});
it("shares the whole part by play when nobody brought the member", () => {
  expect(allocateMakersPool(463n, [{ ...member, broughtBy: null }])).toMatchObject({ bringers: [], games: [{ gameId: "g1", amount: 309n }, { gameId: "g2", amount: 154n }] });
});
it("lets a member who played nothing follow everyone else's play, after their bonus", () => {
  const idle = { userId: "idle", contribution: 400n, broughtBy: "b", plays: [] };
  const played = { userId: "p", contribution: 400n, broughtBy: null, plays: [{ gameId: "g1", seconds: 60 }] };
  expect(allocateMakersPool(800n, [idle, played])).toMatchObject({ bringers: [{ makerUserId: "b", amount: 200n }], games: [{ gameId: "g1", amount: 600n }], carry: 0n });
});
it("pays the bonus and carries the rest when nobody played", () => {                     // Review Focus 8
  expect(allocateMakersPool(463n, [{ ...member, plays: [] }])).toMatchObject({ kind: "shared", games: [], bringers: [{ makerUserId: "b", amount: 232n }], carry: 231n });
  expect(allocateMakersPool(463n, [{ ...member, broughtBy: null, plays: [] }])).toEqual({ kind: "carry", amount: 463n });
});
it("shares the pool as it stands, so a refund lowers every share in proportion", () => { /* the first case with a pool of 232n: bringer 116n, g1 77n, g2 39n */ });
it("carries a pool of nothing or less, whole", () => { expect(allocateMakersPool(-50n, [member])).toEqual({ kind: "carry", amount: -50n }); });
it("always shares out exactly the pool", () => { /* for each shared case above: games + bringers + carry === pool */ });
it("does not depend on the order members or plays arrive in", () => {});
```

  `pool-posting.test.ts`: a share to a game credits its maker and names the game; two games of one maker are two entries; a bringer's entry names no game; a zero share makes no entry; a carry moves between the two months' pool accounts; every entry adds up to zero. Stubs. Push. Expected: `verify` fails in both files with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 8: One whole month, worked through

**Files:**
- Test: `tests/features/money/worked-month.test.ts`

No new code: this is the old `golden-months.test.ts` rewritten for this design, as one month written out by hand. It proves the rules together, and Task 34's public page shows a smaller example from the same functions.

- [ ] **Step 1:** the month, in one test file, with every amount written out and none computed by the code under test:
  - Three members. A: monthly, $10.81 with 82 cents tax, a 61-cent card fee and 12 cents of later fees; brought by maker X; played game 1 (maker X) for 2 hours and game 2 (maker Y) for 1 hour. B: yearly, $107.17 with $8.17 tax, $3.41 card fee and 46 cents of later fees, in the first of its twelve months; nobody brought them; played game 2 for 30 minutes. C: monthly, the same amounts as A; brought themselves; played nothing.
  - The test posts each payment (`postPaymentPaid`), each later fee (`feeParts`, `postPaymentFee`), then shares the month's pool (`allocateMakersPool`, `postPoolShares`), keeping a map of account balances as it goes, and expects, to the cent: the pool before it is shared; X's bonus; game 1's and game 2's shares; what X and Y are owed; Ruken's revenue; the tax owed; what is left in `premium:deferred` for B's eleven months.
  - Then, for Review Focus 17 and the Global Constraints: every entry added up to zero; all accounts together add up to zero; `platform:revenue:premium` holds at least the sum, over the three payments, of what was left after tax and every fee, less each payment's makers' half; and the makers' accounts hold exactly what left the pool.
  - Then one more step in the same file: A's payment is refunded in full (`postRefund`) before the pool is shared; the pool is shared again from the lower amount; the same checks hold.

  The file's first comment says how each expected number was worked out, so a reader can redo it with a pencil. Push. Expected: all pass (the functions exist). If a number differs, the hand-worked number is checked first, then the code: stop and report which was wrong before changing either.
- [ ] **Step 2:** Branch A is ready to merge.

---

# Branch B: `slice-5/ledger`

### Task 9: The ledger tables

**Files:**
- Create: `prisma/schema/money.prisma`, `prisma/migrations/<timestamp>_ledger/migration.sql`
- Modify: `prisma/schema/accounts.prisma`, `prisma/schema/games.prisma` (relations)
- Test: `tests/features/money/schema.pg.test.ts`

**The tables**, from `OLD/packages/db/prisma/schema.prisma` (`LedgerPeriod`, `JournalEntry`, `JournalLine`) and `OLD/packages/db/prisma/migrations/20261017100000_m7_money/migration.sql`:

| Model | Columns |
|---|---|
| `LedgerPeriod` | `period` (the id, `YYYY-MM`), `state LedgerPeriodState` default `open`, `closedAt?`, `finalAt?`, `createdAt` |
| `JournalEntry` | `id` (cuid(2)), `idempotencyKey` unique, `period` (a `LedgerPeriod`), `kind JournalEntryKind`, `stripeInvoiceId?` (the payment the entry belongs to, when it has one), `gameId?` (a `Game`, `onDelete: Restrict`), `reversesId?` (a `JournalEntry`), `linesHash`, `createdAt`; index on `period` and on `stripeInvoiceId` |
| `JournalLine` | `id`, `entryId` (a `JournalEntry`), `account`, `makerUserId?` (a `User`, `onDelete: Restrict`), `amount BigInt`, `createdAt`; index on `entryId` and on `account` |

Enums: `LedgerPeriodState { open, closed, final }`; `JournalEntryKind { payment, payment_fee, release, refund, chargeback, pool_share, pool_carry, transfer, payout_cost, correction }`.

In the migration SQL, by hand, each copied from the old migration and renamed: CHECK `LedgerPeriod_period_check` (`YYYY-MM`); CHECK `JournalLine_maker_check` (an account that starts `maker:` names its `makerUserId`, is `maker:<that id>:payable`, and no other account names one); the add-only trigger on `JournalEntry` and `JournalLine` (`reject_append_only_change`, slice 1's function); the constraint triggers `JournalEntry_balances` and `JournalLine_balances` with their function `check_journal_entry_balances()` (deferred to the end of the transaction: an entry's lines add up to zero, and an entry has at least two lines); the trigger `JournalEntry_open_period` with `reject_entry_into_final_period()` (no entry into a month that is `final`); and `LedgerPeriod_forward_only` with `guard_forward_only()`, cut down to this one table (`open → closed → final`, never back, never deleted).

- [ ] **Step 1 (red):**

```ts
it("makes the ledger tables", async () => { /* arrayContaining ["LedgerPeriod", "JournalEntry", "JournalLine"] */ });
it("refuses an entry whose lines do not add up to zero", async () => { /* +100 and −99 in one transaction: the commit rejects */ });
it("refuses an entry with one line", async () => {});
it("refuses to change or delete an entry or a line", async () => { /* UPDATE and DELETE on each reject */ });
it("refuses an entry into a month that is final", async () => {});
it("moves a month only forward", async () => { /* open → closed → final passes; final → closed, closed → open and DELETE reject */ });
it("ties a maker's account to that maker", async () => { /* 'maker:u1:payable' with makerUserId u2 rejects; 'pool:premium:2026-11' with a makerUserId rejects */ });
it("refuses a month that is not YYYY-MM", async () => {});
```

  Push. Expected: `postgres` fails in `schema.pg.test.ts`: the tables do not exist.
- [ ] **Step 2 (green):** the schema and the migration, made with `prisma migrate diff` from the schema on `main`, as slice 1's Task 21 did. Push. Expected: all pass, the drift test included.

### Task 10: The journal

**Files:**
- Create: `src/features/money/journal.ts`
- Test: `tests/features/money/journal.pg.test.ts`, `tests/support/ledger.ts`

**Interfaces:**
- Produces, carried from `OLD/packages/core/src/money/journal.ts` with the matching cases of `journal.pg.test.ts`:
  - `type MoneyTx`: what these functions use of a transaction (`$queryRaw`, `$executeRaw`, `journalEntry`, `journalLine`, `ledgerPeriod`).
  - `postingPeriod(tx, factAtMs: number, nowMs: number): Promise<Period>` and `postingPeriodForMonth(tx, month: Period, nowMs): Promise<Period>`: the fact's month while it is `open`, otherwise the month of `nowMs`; a missing month's row is made, open. It throws when the current month is not open.
  - `interface EntryDraft { key: string; period: Period; kind: JournalEntryKind; stripeInvoiceId?: string | null; gameId?: string | null; reversesId?: string | null; lines: readonly PostingLine[] }`, `postEntry(tx, draft): Promise<"posted" | "repeat">` and `class IdempotencyConflict`: the same key with the same lines is a repeat and writes nothing; the same key with other lines throws.
  - `accountBalance(tx, account: string): Promise<bigint>` and, new, `accountBalances(tx, prefix: string): Promise<Map<string, bigint>>` (every account that starts with the prefix).
  - New: `lockLedger(tx): Promise<void>`: a transaction-scoped advisory lock (`pg_advisory_xact_lock(hashtextextended('ledger', 0))`, as slice 1's `lockMembership` takes its own). Every function in this slice that posts takes it first, so two runs of the daily job take turns and the second finds the first one's entries.
  - Changed: `postEntry` answers what it did (the old one answered nothing); the hash uses `canonical-json.ts` and Web Crypto or `node:crypto` (the Worker has `nodejs_compat`, as `src/lib/server/job-secret.ts` already relies on).
  - Trim: `recordFact` and the `MoneyFact` table (the facts are slice 1's and this slice's own rows), `creatorSharesFor`, `lockParties`, `lockedUnlockedParties`, `createFirstSplit`, `ledgerDay` (use `chicagoDayOf`), `ledgerMonth` (use `periodOf`).
- `tests/support/ledger.ts`: `balancesOf(prisma): Promise<Record<string, bigint>>` (every account's balance) and `expectBooksBalanced(prisma)` (all lines add up to zero), for this and later database tests.

- [ ] **Step 1 (red):** the carried cases, and:

```ts
it("posts an entry once, and answers a repeat", async () => { /* "posted", then "repeat"; one row */ });
it("refuses the same key with other lines", async () => { /* IdempotencyConflict */ });
it("posts a late fact into the open month, never the closed one", async () => {         // Review Focus 3
  /* 2026-11 closed, clock in December: postingPeriod(tx, a November instant, now) is "2026-12" */ });
it("posts a fact into its own month while that month is open", async () => {});
it("makes two posters take turns", async () => {                                         // Review Focus 9
  /* two transactions take lockLedger; the second waits until the first commits, then sees its entry */ });
it("adds up one account, and every account under a prefix", async () => {});
```

  Stubs. Push. Expected: `postgres` fails in `journal.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** carry and trim. Push. Expected: all pass.

### Task 11: Months that close

**Files:**
- Create: `src/features/money/periods.ts`
- Test: `tests/features/money/periods.pg.test.ts`

**Interfaces:**
- Produces, carried from `OLD/packages/core/src/money/period.ts` with `period.pg.test.ts`: `closeAt(period): number` (midnight in Chicago at the start of `closeDate(period)`), `finalAt(period): number` (the same for `finalDate`), `latestPeriodDue(nowMs, momentOf): Period`, `closePeriod(deps: { db; clock }, period): Promise<{ closed: boolean }>` (refuses before `closeAt`; a second call answers `closed: false`), `closeDuePeriods(deps): Promise<Period[]>` (every month whose time has come, oldest first).
- Changed: the hour is midnight (the old code closed at 00:00 and finalized at 09:00; the daily job runs once, in the small hours). Trim: `periodFreezeAt`, the state-machine table (`assertMove`): the database's `LedgerPeriod_forward_only` is the one rule.

- [ ] **Step 1 (red):** with `TestClock`: a month does not close before the 8th's midnight in Chicago (`2026-12-08T05:59:59Z`: refused; one second later: closed); closing twice changes nothing; `closeDuePeriods` on 8 January closes November and December in that order when both are open; a month with no row yet is made and closed; `latestPeriodDue` on the 7th answers the month before last. Stubs. Push. Expected: `postgres` fails in `periods.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** carry. Push. Expected: all pass. Branch B is ready to merge.

---

# Branch C: `slice-5/facts`

Each task here adds one step of the daily job: it reads facts that already exist (slice 1's and slice 2's rows, or Stripe), stores what it read as rows that are never changed, and posts entries whose keys make a second run harmless. Every posting function takes `lockLedger` first.

### Task 12: The fact tables

**Files:**
- Create: `prisma/migrations/<timestamp>_money_facts/migration.sql`
- Modify: `prisma/schema/money.prisma`, `prisma/schema/accounts.prisma`, `prisma/schema/games.prisma`, `prisma/schema/membership.prisma` (relations)
- Test: `tests/features/money/schema.pg.test.ts` (add cases)

| Model | Columns |
|---|---|
| `PaymentPosting` | `stripeInvoiceId` (the id; a `MembershipPayment` by its `stripeInvoiceId`), `firstPeriod` (the month the payment's first part went to), `stripeChargeId` unique, `stripePaymentIntentId?` unique, `balanceTransactionId` unique (the payment's own, which slice 1 read the card fee from), `postedAt`, `createdAt`. One row per payment posted: what Task 4 needs to place a fee, read from Stripe when the payment is posted |
| `StripeFeeRun` | `id`, `intervalStart` unique, `intervalEnd`, `stripeReportRunId` unique, `state FeeRunState` default `requested`, `rowCount?`, `problem?`, `requestedAt`, `storedAt?`, `createdAt`. One row per stretch of time asked of Stripe; the stretches never overlap |
| `StripeFeeRow` | `id`, `runId` (a `StripeFeeRun`), `rowNumber Int`, the thirteen fields of Task 4's `FeeRow` as text, `createdAt`; unique on (`runId`, `rowNumber`); index on `incurredBy`. One row per line of Stripe's report, exactly as Stripe wrote it |
| `FeePosting` | `feeRowId` (the id; a `StripeFeeRow`), `kind FeeKind`, `stripeInvoiceId?`, `makerUserId?` (a `User`), `microCents BigInt`, `postedAt`, `createdAt`. One row per report line that was placed |
| `StripeReversal` | `id` (set in code: `refund:<Stripe's id>`, `dispute:<Stripe's id>:opened`, `:won` or `:lost`), `kind ReversalKind`, `stripeInvoiceId`, `amountCents BigInt`, `feeCents BigInt` (Stripe's dispute fee; zero for a refund), `returnedCents BigInt` (what Stripe gave back: a card fee with a refund, the money with a won dispute), `balanceTransactionIds String[]`, `at`, `createdAt` |
| `PlayDayRun` | `day` (the id, a `Date`), `rolledAt`. A day is here once its play was added up, even when nobody played |
| `PlayDay` | `id`, `day Date`, `userId` (a `User`, `onDelete: Restrict`), `gameId` (a `Game`, `onDelete: Restrict`), `seconds Int`, `createdAt`; unique on (`day`, `userId`, `gameId`); index on `day` |

Enums: `FeeRunState { requested, stored, failed }`; `FeeKind { payment, payout, counted }`; `ReversalKind { refund, chargeback_opened, chargeback_won, chargeback_lost }`.

In the SQL, by hand: the add-only trigger on `PaymentPosting`, `StripeFeeRow`, `FeePosting`, `StripeReversal`, `PlayDay` and `PlayDayRun`; CHECK `PlayDay_seconds_check` (`"seconds" BETWEEN 1 AND 10800`); CHECK `FeePosting_kind_check` (a `payment` row names an invoice and no maker, a `payout` row a maker and no invoice, a `counted` row neither); CHECK `StripeReversal_amounts_check` (none below zero); CHECK `StripeFeeRun_interval_check` (`"intervalEnd" > "intervalStart"`). `StripeFeeRun` is not add-only: its state moves `requested → stored` or `requested → failed`, once, and a trigger refuses any other change.

- [ ] **Step 1 (red):** the seven tables exist; `UPDATE` and `DELETE` on each add-only table reject; 10,801 seconds and 0 seconds reject; two rows for one day, person and game reject; a fee run moves to `stored` once and then refuses a change; two runs with the same start reject; a `payment` posting with no invoice rejects. Push. Expected: `postgres` fails in the new cases: the tables do not exist.
- [ ] **Step 2 (green):** the schema and the migration. Push. Expected: all pass.

### Task 13: What money asks of Stripe, and posting payments

**Files:**
- Create: `src/features/money/stripe-port.ts`, `src/features/money/payments.ts`, `tests/support/fake-money-stripe.ts`
- Modify: `src/features/membership/services.ts` (`MembershipServices` gains `stripe: Stripe`, the client `createMembershipServices` already builds; nothing else changes, and `membership.ts` already exports `membershipServices`)
- Test: `tests/features/money/stripe-port.test.ts`, `payments.pg.test.ts`, `tests/features/membership/services.test.ts` (a case: the answer holds `stripe`)

**Interfaces:**
- Produces, in `stripe-port.ts`: `interface MoneyStripe`, everything `money` asks of Stripe, as one port, so database tests hand it a fake (as slice 1's `PremiumStripe`). This task adds its first method; Tasks 14, 17, 24, 30 add theirs:
  - `paymentIds(stripeInvoiceId: string): Promise<{ chargeId: string; paymentIntentId: string | null; balanceTransactionId: string }>`: the invoice read with `expand: ["payments"]`, its paid payment's payment intent read with `expand: ["latest_charge.balance_transaction"]` (or its charge, for an invoice paid by a bare charge), the same walk `invoiceCardFee` in slice 1's `src/features/membership/subscription.ts` already makes. It throws when the charge or its balance transaction is not there yet.
  - `bindMoneyStripe(stripe: Stripe): MoneyStripe`.
- `tests/support/fake-money-stripe.ts`: `fakeMoneyStripe()`: a `MoneyStripe` in memory with setters a test uses to say what Stripe holds (`addPayment`, and, as later tasks add methods, `setReport`, `addRefund`, `addDispute`, `setAccount`, `failNextTransfer`). It only ever answers what a test set.
- Produces, in `payments.ts`: `postUnpostedPayments(deps: { db: PrismaClient; clock: Clock; stripe: Pick<MoneyStripe, "paymentIds"> }): Promise<{ posted: number }>`. For each `MembershipPayment` with no `PaymentPosting`, oldest `paidAt` first, in one transaction each: `lockLedger`; `firstPeriod = postingPeriod(tx, periodStart, now)` and the entry's month `postingPeriod(tx, paidAt, now)` (the two rules carried from `OLD/packages/core/src/premium/payment.ts`); one `payment` entry (key `paid:<stripeInvoiceId>`, lines `postPaymentPaid` with `fees` the row's `cardFeeCents`); one `PaymentPosting` row with Stripe's three ids. A payment whose ids are not at Stripe yet is left for the next run and counted in nothing.

- [ ] **Step 1 (red):** `stripe-port.test.ts`, with a stubbed Stripe client (as slice 1's `subscription.test.ts`): the three ids from an invoice paid through a payment intent; from one paid by a bare charge; a throw while there is no balance transaction. `payments.pg.test.ts`, with `TestClock`, `fakeMoneyStripe` and `tests/support/ledger.ts`:

```ts
it("posts a payment once, with the lines the rule gives", async () => {
  await addPayment({ invoice: "in_1", gross: 1081n, tax: 82n, cardFee: 61n, plan: "monthly" });
  expect(await postUnpostedPayments(deps)).toEqual({ posted: 1 });
  expect(await postUnpostedPayments(deps)).toEqual({ posted: 0 });                     // Review Focus 9
  expect(await balancesOf(prisma)).toMatchObject({ "pool:premium:2026-11": -469n, "platform:revenue:premium": -530n, "platform:tax_payable": -82n });
  expect(await prisma.paymentPosting.findUniqueOrThrow({ where: { stripeInvoiceId: "in_1" } })).toMatchObject({ firstPeriod: "2026-11", stripeChargeId: "ch_1", balanceTransactionId: "txn_1" });
});
it("puts a yearly payment's first month in its pool and the rest aside", async () => { /* premium:deferred holds eleven parts */ });
it("posts a payment found after its month closed into the open month", async () => {   // Review Focus 3
  /* paid in November, the clock on 9 December with November closed: the entry and firstPeriod are 2026-12 */ });
it("leaves a payment whose charge is not at Stripe yet for the next run", async () => { /* posted: 0; no rows; the next run posts it */ });
it("keeps the books balanced", async () => { await expectBooksBalanced(prisma); });
```

  Stubs. Push. Expected: `verify` fails in `stripe-port.test.ts`, `postgres` in `payments.pg.test.ts`, with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass, the layer test included (`money` reaches `membership` only through `membership.ts`).

### Task 14: Asking Stripe for its fees, and keeping every row

**Files:**
- Create: `src/features/money/fee-report.ts`
- Modify: `src/features/money/stripe-port.ts`, `tests/support/fake-money-stripe.ts`
- Test: `tests/features/money/fee-report.pg.test.ts`, `tests/features/money/stripe-port.test.ts` (add cases)

**Interfaces:**
- `MoneyStripe` gains:
  - `feeReportWindow(): Promise<{ availableFromSec: number; availableToSec: number }>`: `stripe.reporting.reportTypes.retrieve(FEE_REPORT_TYPE)`, its `data_available_start` and `data_available_end`.
  - `startFeeReport(fromSec: number, toSec: number): Promise<string>`: `stripe.reporting.reportRuns.create({ report_type: FEE_REPORT_TYPE, parameters: { interval_start: fromSec, interval_end: toSec, columns: [...FEE_COLUMNS] } })`; the run's id.
  - `feeReport(runId: string): Promise<{ status: "pending" } | { status: "failed"; problem: string } | { status: "succeeded"; csv: string }>`: the run retrieved; when it succeeded, its `result.url` fetched with `Authorization: Bearer <the secret key>` and read as text.
- Produces, in `fee-report.ts`:
  - `collectFeeReport(deps: { db; clock; stripe }): Promise<"none" | "pending" | "stored" | "failed">`: the one run in state `requested`, if any. Still pending: nothing changes. Failed: the run becomes `failed` with Stripe's words. Succeeded: in one transaction, every line of `feeRowsFrom(csv)` becomes a `StripeFeeRow` (numbered from 1) and the run becomes `stored` with its count.
  - `requestFeeReport(deps): Promise<"requested" | "waiting" | "nothing_new">`: `waiting` while a run is `requested`. Otherwise the next stretch starts where the last `stored` run ended (the first ever: Stripe's `availableFromSec`) and ends at Stripe's `availableToSec`; `nothing_new` when that is not later than the start; else the run is started and one `StripeFeeRun` row is written. A `failed` run's stretch is asked for again: the next stretch still starts at the last `stored` end.
  - Why the stretches cannot miss or repeat a fee: the report is by the date a fee reached Ruken's balance, Stripe says its data is complete up to `availableToSec`, and each stretch starts exactly where the last stored one ended.

- [ ] **Step 1 (red):**

```ts
it("asks for everything Stripe has, the first time", async () => {
  stripe.setReportWindow({ availableFromSec: 1_000, availableToSec: 5_000 });
  expect(await requestFeeReport(deps)).toBe("requested");
  expect(await prisma.stripeFeeRun.findFirstOrThrow()).toMatchObject({ intervalStart: new Date(1_000_000), intervalEnd: new Date(5_000_000), state: "requested" });
});
it("waits while Stripe is still working, and asks for nothing else meanwhile", async () => {   // Review Focus 16
  expect(await collectFeeReport(deps)).toBe("pending");
  expect(await requestFeeReport(deps)).toBe("waiting");
  expect(await prisma.stripeFeeRow.count()).toBe(0);
});
it("keeps every row exactly as Stripe wrote it", async () => { /* a two-row CSV: "stored"; two StripeFeeRow rows with rowNumber 1 and 2 and the text of each field; rowCount 2 */ });
it("starts the next stretch where the last one ended", async () => { /* availableToSec moves to 9_000: the second run is 5_000 to 9_000 */ });
it("asks again for a stretch whose run failed", async () => {                                  // Review Focus 16
  /* the run fails: state "failed", no rows; the next request has the same start */ });
it("asks for nothing when Stripe has nothing new", async () => { expect(await requestFeeReport(deps)).toBe("nothing_new"); });
it("stores nothing when the report's columns are not the ones asked for", async () => { /* collectFeeReport throws; the run stays requested; no rows */ });
```

  `stripe-port.test.ts`: the three calls reach Stripe with the type, the stretch and the columns; the file is fetched with the key and never without it. Stubs. Push. Expected: `postgres` fails in `fee-report.pg.test.ts`, `verify` in the new port cases, with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 15: Taking Stripe's other fees off the top

**Files:**
- Create: `src/features/money/fees.ts`
- Test: `tests/features/money/fees.pg.test.ts`

**Interfaces:**
- Produces: `postFeeRows(deps: { db; clock }): Promise<{ payment: number; payout: number; counted: number; unplaced: number; unreadable: number }>`. It looks at every `StripeFeeRow` with no `FeePosting` whose run was stored in the last 62 days, in run and row order, with `KnownIds` built from the database (`payments` from `PaymentPosting`; `payouts` from Task 28's `Payout` rows and Task 24's `BankAccount` rows, empty until those tables exist; `counted` from `PaymentPosting.balanceTransactionId` and `StripeReversal.balanceTransactionIds`), and for each, by `placeFee`:
  - `counted`: one `FeePosting` row, nothing posted.
  - `payment`: under `lockLedger`, one `FeePosting` row with the row's `feeMicroCents`, and the cents this row adds to the payment: `centsRoundedUp` of all the payment's `FeePosting` micro-cents with this row, less `centsRoundedUp` of them without it. When that is above zero: one `payment_fee` entry (key `fee:<feeRowId>`, `stripeInvoiceId` set), its lines from `feeParts` (with `payment.fees` the card fee plus every cent already taken for this payment) and `postPaymentFee`, where a month's account is `premium:deferred` when that month has no release entry yet and is not the payment's first month, and otherwise `pool:premium:<postingPeriodForMonth(month)>`. The entry's own month is `postingPeriod` of the row's `incurredAt`.
  - `payout`: one `FeePosting` row naming the maker; Task 31 posts it.
  - `unplaced` and `unreadable`: nothing is written; the row is looked at again on the next run, for 62 days, and counted in the answer. Task 32 shows both to staff, and Task 23 will not make a month final while a row that reached Ruken's balance in that month is `unreadable`.

- [ ] **Step 1 (red):**

```ts
it("takes a Billing fee and a Tax fee off a payment, rounded up once", async () => {
  await postedPayment({ invoice: "in_1", gross: 1081n, tax: 82n, cardFee: 61n });            // pool 469, Ruken 530 − 61
  await storedRows([{ incurredBy: "in_1", amountText: "0.06993" }, { incurredBy: "ch_1", amountText: "0.04995" }]);
  expect(await postFeeRows(deps)).toMatchObject({ payment: 2 });
  expect(await balancesOf(prisma)).toMatchObject({ "pool:premium:2026-11": -463n });         // 12 cents: 6 from each half
  expect(await postFeeRows(deps)).toMatchObject({ payment: 0 });                             // Review Focus 9
});
it("does not take the card fee a second time", async () => {                                  // Review Focus 2
  await storedRows([{ incurredBy: "ch_1", balanceTransactionId: "txn_1", amountText: "0.61" }]);   // the payment's own balance transaction
  expect(await postFeeRows(deps)).toMatchObject({ counted: 1, payment: 0 });
  expect(await balancesOf(prisma)).toMatchObject({ "pool:premium:2026-11": -469n });
});
it("posts a fee that arrives after the month closed into the open month's pool", async () => {   // Review Focus 3
  /* November closed, the clock on 9 December: pool:premium:2026-11 unchanged, pool:premium:2026-12 is +6n */ });
it("takes a yearly payment's fee from the months still set aside", async () => { /* premium:deferred goes down, the first month's pool by its own cent */ });
it("leaves a row it cannot read unposted, and says so every run", async () => {                // Review Focus 4
  await storedRows([{ incurredBy: "in_1", amountText: "n/a" }]);
  expect(await postFeeRows(deps)).toMatchObject({ unreadable: 1 });
  expect(await prisma.feePosting.count()).toBe(0);
});
it("leaves a fee that names nothing unplaced, and places it once its payment is posted", async () => {
  /* a row for in_2 before in_2 is posted: unplaced; after postUnpostedPayments: payment */ });
it("keeps the books balanced", async () => { await expectBooksBalanced(prisma); });
```

  Stub. Push. Expected: `postgres` fails in `fees.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 16: A yearly payment's months, released as they come

**Files:**
- Create: `src/features/money/releases.ts`
- Test: `tests/features/money/releases.pg.test.ts`

**Interfaces:**
- Produces, carried from `OLD/packages/core/src/premium/release.ts` with `release.pg.test.ts`: `releaseDueMonths(deps: { db; clock }): Promise<{ released: number }>`: for every yearly `PaymentPosting` of the last 400 days, each of its months after the first whose month has begun: what is missing of that month's part (its part by `releases`, with every fee taken so far, less what a refund or chargeback that stands cancelled from it, less what was already released) moves from `premium:deferred` into that month's pool, or into the open month's when that month has closed. Keys `release:<invoice>:<month>`, then `:2`, `:3` for a top-up after a won dispute (carried).
- Changed: it reads `PaymentPosting` and `MembershipPayment` in place of the old `premium_paid` facts, and `StripeReversal` in place of the old chargeback facts; it takes `lockLedger` in place of the old per-invoice lock.

- [ ] **Step 1 (red):** the carried cases under the new names: nothing is due in the first month; in the second month one part is released, once; a missed month is released into the open month; a chargeback cancels the latest months and their releases do not happen; a won dispute brings them back as a top-up; and one new case: **a fee taken after the payment lowers the parts not yet released, and a part already released is not taken back here** (Task 15 took it from the pool). Stub. Push. Expected: `postgres` fails in `releases.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** carry and change. Push. Expected: all pass.

### Task 17: Refunds and chargebacks

**Files:**
- Create: `src/features/money/reversals.ts`
- Modify: `src/features/money/stripe-port.ts`, `tests/support/fake-money-stripe.ts`
- Test: `tests/features/money/reversals.pg.test.ts`, `tests/features/money/stripe-port.test.ts` (add cases)

**Interfaces:**
- `MoneyStripe` gains `refundsSince(sec: number)` and `disputesSince(sec: number)`: `stripe.refunds.list` and `stripe.disputes.list` with `created: { gte: sec }`, every page, each with its balance transactions expanded, answered as `{ id; chargeId; amountCents; status; feeCents; returnedCents; balanceTransactionIds; atSec }[]`. For a dispute, the amounts come from its `balance_transactions` as `OLD/packages/core/src/billing/stripe-events.ts` read them (lines 260 to 320): the first one is what the opening took, with its fee; the one with a `net` above zero is what a win gave back.
- Produces, carried from `OLD/packages/core/src/premium/chargeback.ts` with `chargeback.pg.test.ts`:
  - `readReversals(deps: { db; clock; stripe }): Promise<{ stored: number }>`: both lists since 40 days before the newest `StripeReversal` (the first run: since the oldest `MembershipPayment`); each one whose charge is a `PaymentPosting`'s becomes `StripeReversal` rows that do not exist yet: a succeeded refund, one `refund` row; a dispute, `chargeback_opened` when first seen, and `chargeback_won` or `chargeback_lost` once Stripe says so. One for a charge this database does not have is not Ruken's membership and is skipped.
  - `postReversals(deps: { db; clock }): Promise<{ posted: number }>`: each `StripeReversal` with no entry, oldest first, under `lockLedger`: a refund posts `postRefund` (key `refund:<id>`); an opened chargeback posts `postChargebackOpened` (key `dispute:<id>:opened`); a won one posts `postChargebackWon` against the opened entry (key `dispute:<id>:won`, `reversesId` the opened entry); a lost one posts nothing (the opened entry already says the money is gone). `paymentLines` is the payment's entry plus its fee entries (Task 3); `deferredLeft` is what is still in `premium:deferred` for that payment; `openPool` is the month of the clock.
- Changed: facts come from Stripe's lists in the daily job, not from webhook events (the Calls). Trim: ending the membership after a lost dispute (slice 1's webhooks already mirror the subscription Stripe ends or the Owner cancels; this slice changes nothing in `membership`), the "paid after end" branch (slice 1 records no such payment), the per-invoice lock.

- [ ] **Step 1 (red):** the carried cases under the new names, and:

```ts
it("undoes a refunded payment: each side gives back what it got", async () => {
  /* in_1 posted with its 12 cents of later fees; a full refund, no fee returned: the pool gives back 463, less what the carried rule shares of the fees Stripe kept */ });
it("cancels a yearly payment's unreleased months first", async () => {});                  // Review Focus 5
it("stores a refund once however many runs see it", async () => {});                       // Review Focus 9
it("posts nothing for a lost dispute beyond its opening", async () => {});
it("skips a refund of a charge that is not a membership payment here", async () => {});
it("keeps the books balanced after each", async () => { await expectBooksBalanced(prisma); });
```

  Stubs. Push. Expected: `postgres` fails in `reversals.pg.test.ts`, `verify` in the new port cases, with "not built yet".
- [ ] **Step 2 (green):** carry and change. Push. Expected: all pass.

### Task 18: Adding up each day's play

**Files:**
- Create: `src/features/money/play-rollup.ts`
- Test: `tests/features/money/play-rollup.pg.test.ts`

**Interfaces:**
- Produces: `rollUpPlayDays(deps: { db; clock }): Promise<{ days: DateText[] }>`: every Chicago day that has ended, from the day of the oldest `PlaySession` (or, once there is a `PlayDayRun`, the day after the newest), oldest first, at most 40 days a run. For a day, in one transaction: every `member` session with a `userId` that started within 24 hours before the day's end, with its beats; grouped by person and game; `playSecondsOnDay` for each; one `PlayDay` row for each group with a second or more; one `PlayDayRun` row. Sessions of any other basis are never read (design 6: free play, staff play and a maker's own play do not count; slice 2 recorded which was which).
- A day is added up only after it ends, and a beat is stamped by the server's clock, so a finished day cannot gain a beat later.

- [ ] **Step 1 (red):** with `TestClock`, sessions and beats made through Prisma:

```ts
it("adds up a member's play on a game for a finished day", async () => { /* 20 minutes of beats on the 5th; the clock on the 6th: one PlayDay { day: 2026-12-05, seconds: 1200 } */ });
it("does not touch a day that has not ended", async () => { /* the clock still on the 5th in Chicago: no rows */ });
it("counts only members' play", async () => { /* sessions with basis free_game, staff and own_game on the same day: no PlayDay for them */ });
it("counts two tabs once and stops at three hours", async () => {});                          // Review Focus 6
it("splits a session that crosses midnight between its two days", async () => {});
it("marks a day done even when nobody played, and never adds a day up twice", async () => {   // Review Focus 9
  /* two runs: one PlayDayRun per day; the second run adds nothing */ });
it("catches up after missed days, oldest first", async () => {});
```

  Stub. Push. Expected: `postgres` fails in `play-rollup.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 19: The daily money job

**Files:**
- Create: `src/features/money/daily.ts`, `src/features/money/services.ts`, `src/features/money/money.ts`, `src/routes/jobs/money/+server.ts`
- Modify: `cloudflare/worker.js`, `tests/wrangler.test.ts` (or the test that reads `worker.js`, as slice 1 left it), `tests/browser/support/fake-stripe-server.ts`
- Test: `tests/features/money/daily.pg.test.ts`, `tests/browser/money-job.test.ts`, `tests/features/money/services.test.ts`

**Interfaces:**
- Produces:
  - `runMoneyJob(deps: { db; clock; stripe: MoneyStripe }): Promise<MoneyJobReport>`, the steps in this order, each in its own `try`: a step that throws is named in `problems` with its message and the steps after it still run, except that nothing after a failed `closeDuePeriods` runs (a month must not become final on facts that are not all in):
    1. `postUnpostedPayments` 2. `collectFeeReport` 3. `requestFeeReport` 4. `postFeeRows` 5. `readReversals` 6. `postReversals` 7. `releaseDueMonths` 8. `rollUpPlayDays` 9. `closeDuePeriods`. Later branches add, after these: `finalizeDuePeriods` (Task 23), `executePayouts` and the payouts' outcomes (Task 30), the payout costs (Task 31).
    The facts are read before a month is closed, so what the run of the 8th reads still lands in the month it belongs to.
  - `interface MoneyJobReport { payments: number; feeReport: { collected: "none" | "pending" | "stored" | "failed"; requested: "requested" | "waiting" | "nothing_new" }; fees: { product: string; featureName: string; kind: "payment" | "payout" | "counted" | "unplaced" | "unreadable"; rows: number }[]; reversals: number; released: number; playDays: string[]; closed: string[]; problems: { step: string; message: string }[] }`. `fees` counts rows only: no amount and nothing about a person.
  - `moneyServices(): { runJob(): Promise<MoneyJobReport> }` in `services.ts`, built once from `prisma()`, `systemClock` and `bindMoneyStripe(membershipServices().stripe)`. `money.ts` re-exports `moneyServices` and, as later tasks add them, what the screens read.
  - `POST /jobs/money`: 404 without the job secret (`hasJobSecret`), as `/jobs/purge-accounts`; otherwise `runJob()` and its report as JSON, always with status 200, so a person who runs it (M1) reads the report even when a step failed.
  - `cloudflare/worker.js` knocks on `/jobs/money` after `/jobs/purge-accounts`, the same way; it throws unless both answered 200, and also when the money report's `problems` is not empty, so a failed run shows as failed in Cloudflare. The purge runs first and is not skipped when the money job fails.
- The stand-in Stripe gains what `bindMoneyStripe` calls so far: the report type, creating and retrieving a report run, the report file, and the lists of refunds and disputes; and a page of its own, `POST /test/fees`, with which a journey says what the next report holds.

- [ ] **Step 1 (red):** `daily.pg.test.ts`:

```ts
it("runs the steps in order and reports what each did", async () => { /* one payment, one stored fee row for it: payments 1, fees [{ kind: "payment", rows: 1 }], no problems */ });
it("does nothing the second time", async () => {                                              // Review Focus 9
  await runMoneyJob(deps); const before = await balancesOf(prisma);
  expect((await runMoneyJob(deps)).payments).toBe(0); expect(await balancesOf(prisma)).toEqual(before);
});
it("carries on after a step that fails, and names it", async () => { /* Stripe's refund list throws: problems [{ step: "readReversals" }]; the play days are still added up */ });
it("closes nothing when closing fails, and runs nothing after it", async () => {});
it("reads the 8th's facts before it closes the month", async () => { /* a fee row stored on the run of 8 December for a November payment lands in pool:premium:2026-11, and November is closed after it */ });
```

  `money-job.test.ts` (a journey): without the secret, 404; with it, a member who paid through the stand-in is posted (`payments: 1`), the first run answers `feeReport.requested: "requested"` and the second `feeReport.collected: "stored"`. `services.test.ts`: `moneyServices()` builds from slice 1's settings and adds none. The worker test: `worker.js` names `/jobs/money`. Stubs. Push. Expected: `postgres` fails in `daily.pg.test.ts`, `browser` in `money-job.test.ts` (404), `verify` in the worker test.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch C is ready to merge; ask the coordinator for M1 once it is on `main`.

---

# Branch D: `slice-5/statements`

### Task 20: The pool and statement tables

**Files:**
- Create: `prisma/migrations/<timestamp>_statements/migration.sql`
- Modify: `prisma/schema/money.prisma`, `prisma/schema/accounts.prisma`, `prisma/schema/games.prisma`
- Test: `tests/features/money/schema.pg.test.ts` (add cases)

| Model | Columns |
|---|---|
| `PoolRun` | `period` (the id; a `LedgerPeriod`), `poolCents BigInt` (the makers' half for the month, as shared), `carryCents BigInt`, `members Int` (members whose money was in it), `inputsHash`, `sharedAt`, `createdAt` |
| `PoolShare` | `id`, `period` (a `PoolRun`), `kind PoolShareKind`, `makerUserId` (a `User`), `gameId?` (a `Game`), `weight BigInt`, `amountCents BigInt`, `seconds Int?` (members' counted play on the game that month), `members Int?` (members the bonus is for); unique on (`period`, `gameId`) for a `play` share and on (`period`, `makerUserId`) for a `bringing` share (two partial unique indexes, in the SQL: a `bringing` share has no game, and Postgres lets nulls repeat) |
| `Statement` | `id`, `makerUserId` (a `User`, `onDelete: Restrict`), `period` (a `LedgerPeriod`), `document Json`, `totalsHash`, `createdAt`; unique on (`makerUserId`, `period`) |
| `StatementLine` | `id`, `statementId` (a `Statement`), `source StatementLineSource`, `gameId?`, `ref`, `amountCents BigInt`, `createdAt`; index on `statementId` |

Enums: `PoolShareKind { play, bringing }`; `StatementLineSource { play, bringing, payout_cost, correction }`. In the SQL: the add-only trigger on all four; CHECK `PoolShare_kind_check` (a `play` share names a game and seconds; a `bringing` share names neither a game nor seconds, and names members).

- [ ] **Step 1 (red):** the four tables exist; each refuses `UPDATE` and `DELETE`; a second statement for one maker and month rejects; a `play` share with no game rejects. Push. Expected: `postgres` fails in the new cases.
- [ ] **Step 2 (green):** the schema and the migration. Push. Expected: all pass.

### Task 21: The month's pool

**Files:**
- Create: `src/features/money/pool-run.ts`
- Test: `tests/features/money/pool-run.pg.test.ts`

**Interfaces:**
- Produces:
  - `membersOf(tx, period: Period): Promise<MemberMonth[]>`, from `OLD/packages/core/src/money/pools.ts`'s `readPremiumMembers`: for every `PaymentPosting` whose months include `period`, the month's part by `poolContributions` (with `fees` the card fee plus every cent taken for that payment so far), added up per member (`MembershipPayment.userId`); `broughtBy` from `bringerOf` over that member's `MembershipStart` rows; `plays` from the month's `PlayDay` rows, added up per game. In member id order.
  - `poolFor(tx, period: Period): Promise<{ pool: bigint; members: MemberMonth[]; outcome: PoolOutcome; inputsHash: string }>`: `pool` is minus the balance of `pool:premium:<period>` (the money as it stands, after refunds and chargebacks: carried); `outcome` is `allocateMakersPool(pool, members)`; the hash is of `canonicalJson({ period, pool, members })`. It writes nothing, so Task 32's screen shows a month before it is final with the same function that makes it final.
  - `sharePool(tx, period: Period, nowMs: number): Promise<{ shared: boolean }>`: `false` when the month has a `PoolRun`. Otherwise `poolFor`; the entries of `postPoolShares` (the maker of each game from `Game.makerUserId`, read now) or `postPoolCarry`, posted into `period`; one `PoolRun` row; one `PoolShare` row per game and per bringer with an amount above zero.

- [ ] **Step 1 (red):** with a helper in `tests/support/ledger.ts` that makes a member who paid, was brought and played (`aMonth(prisma, clock, [...])`):

```ts
it("shares the worked month exactly as the pure functions say", async () => {
  /* Task 8's three members, through the database: the same amounts to the cent in maker:<x>:payable and maker:<y>:payable; pool:premium:2026-11 ends at zero */ });
it("pays the bringer only in a member's first twelve months, and never for bringing yourself", async () => {});   // Review Focus 7
it("pays bonuses and carries the rest when nobody played", async () => {                      // Review Focus 8
  /* pool:premium:2026-11 ends at zero; pool:premium:2026-12 holds the carry; PoolRun.carryCents says so */ });
it("still works out the share of a game whose maker's account was deleted", async () => {     // Review Focus 10
  /* the User row is a tombstone: the share is credited to maker:<their id>:payable; then slice 1's purgeDueAccounts runs and every money row is still there, unchanged */ });
it("shares a month once", async () => { /* a second call: { shared: false }, no new entries */ });
it("never takes from Ruken's half", async () => {                                              // Review Focus 17
  /* platform:revenue:premium is the same before and after sharePool */ });
it("shows the same numbers before the month is shared as after", async () => { /* poolFor before equals the PoolShare rows after */ });
```

  Stubs. Push. Expected: `postgres` fails in `pool-run.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 22: A maker's statement

**Files:**
- Create: `src/features/money/statement.ts`, `src/features/money/statements.ts`
- Test: `tests/features/money/statement.test.ts`, `statements.pg.test.ts`

**Interfaces:**
- Produces, pure, in `statement.ts`, from `OLD/packages/ledger/src/statement.ts` with `statement.test.ts`:
  - `interface StatementGame { slug: string; name: string }` (copied in when the month is made final, so a later rename leaves the statement alone).
  - `type StatementLineDoc = { ref: string; amount: bigint } & ({ source: "play"; game: StatementGame; minutes: number } | { source: "bringing"; members: number } | { source: "payout_cost"; payoutId: string } | { source: "correction"; note: string })`.
  - `interface StatementDocument { period: Period; finalAt: string; lines: StatementLineDoc[]; totals: { earned: bigint; broughtForward: bigint; owed: bigint } }`: `earned` is the lines added up; `owed` is the maker's balance after every entry up to and including the month; `broughtForward` is `owed − earned`, what stood before this month's lines (less anything sent to their bank since).
  - `buildStatement(input: { makerUserId: string; period: Period; finalAt: string; shares: readonly { kind: "play" | "bringing"; game: StatementGame | null; amount: bigint; seconds: number | null; members: number | null }[]; others: readonly { kind: "payout_cost" | "correction"; key: string; amount: bigint; payoutId?: string; note?: string }[]; owed: bigint }): { document: StatementDocument; canonical: string; hash: string }`. One `play` line per game, by the game's name; `minutes` is the seconds divided by 60, rounded down; one `bringing` line when any; then payout costs, then corrections, each by key. The same input always gives the same bytes (carried).
  - Trim: store, tip and ad lines, pending and held, the unlock.
- Produces, in `statements.ts`, from `OLD/packages/core/src/money/statements.ts` with `statements.pg.test.ts`: `writeStatements(tx, period: Period, nowMs: number): Promise<{ makers: string[] }>`: a statement for every account with a `PoolShare` in the month, another maker line posted in the month (Tasks 31, 36), or a balance other than zero; its `Statement` row and one `StatementLine` per line. A second call writes nothing.

- [ ] **Step 1 (red):** `statement.test.ts`: the carried cases that still apply, and: two games sort by name; 119 seconds read as 1 minute; a maker with only a bonus has one line; `owed` under what was `earned` when a payout went out before; the same input in another order gives the same `canonical`. `statements.pg.test.ts`: after `sharePool`, each of the worked month's makers has one statement whose lines add up to what the journal credited them; **a maker owed $24.99 gets a statement, with `owed` 2499** (Review Focus 11); **a maker whose account was deleted gets one too** (Review Focus 10); a second call adds none; a maker with nothing this month and nothing owed gets none. Stubs. Push. Expected: `verify` fails in `statement.test.ts`, `postgres` in `statements.pg.test.ts`.
- [ ] **Step 2 (green):** carry, trim and change. Push. Expected: all pass.

### Task 23: Final on the 10th

**Files:**
- Create: `src/features/money/finalize.ts`
- Modify: `src/features/money/daily.ts`
- Test: `tests/features/money/finalize.pg.test.ts`, `tests/features/money/daily.pg.test.ts` (add cases)

**Interfaces:**
- Produces, carried from `OLD/packages/core/src/money/finalize.ts` with `finalize.pg.test.ts`:
  - `finalizePeriod(deps: { db; clock }, period): Promise<{ final: boolean; makers: string[] }>`: refuses before `finalAt(period)`; answers `final: false` for a month already final; refuses while an earlier month is not final (statements carry balances forward, so months go in order); refuses, with the words "Stripe sent a fee this code cannot read", while a `StripeFeeRow` that reached Ruken's balance in that month is unreadable (Task 15); then, in one transaction under `lockLedger`: `sharePool`, `writeStatements`, and the month moves `closed → final`. Any failure undoes all of it.
  - `finalizeDuePeriods(deps): Promise<Period[]>`: every month due and not final, oldest first; it stops at the first that fails.
- `runMoneyJob` gains step 10, `finalizeDuePeriods`, and `MoneyJobReport` gains `final: string[]`.
- Trim: the unlock check, the two-day draft and its comparison (`freezePeriod`, `PoolDriftError`, accepting drafts), the notifications, and drafting the payout run (Task 29 adds that back).

- [ ] **Step 1 (red):**

```ts
it("makes November final on the 10th of December, in Chicago", async () => {
  /* the clock at 2026-12-10T05:59:59Z: refused; one second later: final, with statements */ });
it("takes no entry into a final month, and a later fee does not move its statement", async () => {   // Review Focus 3
  /* a fee row for a November payment stored on 12 December: posted into December; the November statement's bytes are unchanged */ });
it("goes month by month, oldest first, and stops at one that fails", async () => {});
it("will not make a month final while a fee of that month cannot be read", async () => {            // Review Focus 4
  /* the job reports the problem under "finalizeDuePeriods"; the month stays closed; once a change to the code can read the row, the next run makes it final */ });
it("undoes everything when the statements fail", async () => { /* no PoolRun, no entries, the month still closed */ });
it("is final once", async () => { /* a second run: [], nothing new */ });
```

  Stubs. Push. Expected: `postgres` fails in `finalize.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** carry, trim, and the job's step. Push. Expected: all pass. Branch D is ready to merge once M1's answer is in and read (see M1); it must be on `main` before 10 December.

---

# Branch E: `slice-5/bank`

Waits for M2 (Connect turned on in test mode) before it is marked ready, and for the Owner's answer to question 2 before Task 24 starts.

### Task 24: A maker's bank, at Stripe

**Files:**
- Create: `prisma/migrations/<timestamp>_bank/migration.sql`, `src/features/money/bank.ts`
- Modify: `prisma/schema/money.prisma`, `prisma/schema/accounts.prisma`, `src/features/money/stripe-port.ts`, `src/features/money/fees.ts` (`KnownIds.payouts` gains each `BankAccount.stripeAccountId`), `src/features/money/money.ts`, `tests/support/fake-money-stripe.ts`
- Test: `tests/features/money/bank.pg.test.ts`, `tests/features/money/stripe-port.test.ts` (add cases), `tests/features/money/schema.pg.test.ts` (add cases)

**The table:** `BankAccount`: `id`, `userId` unique (a `User`, `onDelete: Restrict`), `stripeAccountId` unique, `detailsSubmitted Boolean` default false, `transfersActive Boolean` default false, `payoutsEnabled Boolean` default false, `checkedAt`, `createdAt`, `updatedAt`. It mirrors Stripe, so it is not add-only. It holds no bank detail: those are Stripe's.

**Interfaces:**
- `MoneyStripe` gains, carried from `OLD/packages/billing/src/connect.ts` with the matching cases of `connect.test.ts`:
  - `createAccount(input: { userId: string }): Promise<string>`: an Express account with the `transfers` capability asked for, a manual payout schedule (money leaves only when Ruken says), `metadata: { userId }` and the idempotency key `connect:<userId>`, so two presses make one account. Changed: `country: "US"` (question 2's working answer: the United States only; if the Owner answers B, the country is left to Stripe's own screen and this line goes).
  - `onboardingLink(input: { stripeAccountId; returnUrl; refreshUrl }): Promise<string>` (`accountLinks.create`, type `account_onboarding`).
  - `accountStatus(stripeAccountId: string): Promise<{ detailsSubmitted: boolean; transfersActive: boolean; payoutsEnabled: boolean }>` (the account read now; `transfersActive` is `capabilities.transfers === "active"`).
  - New: `dashboardLink(stripeAccountId: string): Promise<string>` (`accounts.createLoginLink`): Stripe's own page where an Express account changes its bank.
- Produces, in `bank.ts`, from `OLD/packages/core/src/money/connect.ts` with `connect.pg.test.ts`:
  - `type BankState = "none" | "unfinished" | "ready"`: `ready` is all three flags true.
  - `startBankSetup(deps: { db; clock; stripe; siteOrigin: string; rateLimiter: RateLimiter }, userId: string): Promise<{ url: string } | { refused: "busy" | "not_open" }>`: more than `BANK_SETUPS_PER_PERSON` (`{ max: 5, windowMs: 3_600_000 }`, key `api:bank-setup:<userId>`): `busy`. The person's `BankAccount`, made with `createAccount` when there is none; then an onboarding link whose `returnUrl` and `refreshUrl` are both `<siteOrigin>/make/bank/back`. Stripe refusing because Connect is not turned on for this Stripe account: `not_open`, and no row is written. The old code had no such case and Stripe's pages do not name the error: read it once from Stripe's test mode before M2's first step, match on its `code`, and report what it was.
  - `refreshBank(deps, userId): Promise<BankState>`: reads the account from Stripe now and stores what it says, with the clock's time. Stripe is the truth; nothing here waits for an event.
  - `bankOf(db, userId): Promise<BankState>` (from the stored row) and `bankDashboard(deps, userId): Promise<string | null>` (null unless `ready`).
- Trim: `applyAccountUpdated` and the Connect webhook (the Calls).

- [ ] **Step 1 (red):** the carried cases under the new names, and: a first press makes one account and one row, a second press reuses it; a sixth press in an hour is `busy`; Connect not turned on is `not_open` with no row; `refreshBank` moves `none → unfinished → ready` as the fake's account changes, and back to `unfinished` when Stripe turns payouts off; the table holds no column for a bank's number or a person's name; a deleted maker's row stays after slice 1's `purgeDueAccounts` (it holds Stripe's id for the account and three yes-or-no flags, nothing of the person, and money may still be owed to it). Stubs. Push. Expected: `postgres` fails in `bank.pg.test.ts`, `verify` in the new port cases.
- [ ] **Step 2 (green):** the code and the migration. Push. Expected: all pass.

### Task 25: Connect your bank (`/make/bank`)

**Files:**
- Create: `src/routes/make/bank/+page.server.ts`, `+page.svelte`, `src/routes/make/bank/back/+server.ts`
- Modify: `tests/browser/support/fake-stripe-server.ts`, `tests/browser/support/game.ts` (a helper, `connectBank(page)`)
- Test: `tests/browser/bank.test.ts`

Needs an account (signed out: to sign-in and back). The four states, each one card:

```
Get paid

Ruken pays you through Stripe, straight to your bank.
Stripe will ask who you are and where to send the money. It takes a few minutes.
For now, Ruken can pay bank accounts in the United States.

[ Connect your bank ]

Back to your games
```

```
Get paid

Stripe still needs a few things from you before we can pay you.

[ Finish with Stripe ]

Back to your games
```

```
Get paid

Your bank is connected.
We pay on the 15th of each month, once you're owed $25 or more.

[ Change your bank details ]

See your money
```

```
Get paid

Payouts aren't open yet. What you earn is kept for you.
Come back here to connect your bank once they are.

Back to your games
```

- `load` calls `refreshBank` when the person has a `BankAccount` (so the screen is true the moment they come back from Stripe), else answers `none`. "$25" is `dollars(PAYOUT_MINIMUM_CENTS)` and "the 15th" comes from `PAYOUT_DAY_OF_MONTH`, both passed by `load`; neither is typed into the page.
- The line about the United States is shown only in the first state and only while question 2's answer is A.
- "Connect your bank" and "Finish with Stripe" are the same action, `connect`: `startBankSetup`, then a redirect (303) to Stripe's address. `not_open` shows the fourth card. `busy` shows, above the button: "You've tried that a lot just now. Try again in an hour."
- "Change your bank details" is the action `change`: a redirect (303) to `bankDashboard`.
- `GET /make/bank/back` is where Stripe sends the person, finished or not: a redirect (303) to `/make/bank`, which reads the state fresh.
- A person with no game yet sees the first card with "Add a game first, then come back here to get paid." in place of the button, and a link, "Add a game", to `/make/new`. Stripe accounts are made for makers, not for everyone who signs up.
- The stand-in Stripe gains: creating and retrieving an account, account links, login links, and two pages of its own: `GET /connect/<account>` with two buttons, "Finish" (the account becomes ready, then back to the `return_url`) and "Stop halfway" (details not submitted, then back), and `GET /express/<account>` with the one line "Stripe's page for bank details".

Grandma: one card, one button, and each card says the one thing that is true now. Nothing asks for a bank number: Stripe does that. Coming back from Stripe half done lands on a card that says so and has the one button that finishes.

Look: `<main class="card">`; the button in each state is the form's one plain `<button>`; "Back to your games", "See your money" and "Add a game" stay links; the hints are ordinary text, not `note` (a money line is never a note); a refusal is `problem`. Nothing is `pay`.

- [ ] **Step 1 (red):**

```ts
test("a maker connects a bank and sees it connected", async ({ page }, testInfo) => {
  await addGame(page);                                           // slice 2's helper, with whatever it asks for: a signed-in maker with a game
  await page.goto("/make/bank");
  await expect(page.getByText("Ruken pays you through Stripe, straight to your bank.")).toBeVisible();
  await expectOneCard(page); await showTheOwner(page, testInfo, "connect your bank");
  await page.getByRole("button", { name: "Connect your bank" }).click();
  await page.getByRole("button", { name: "Finish" }).click();    // the stand-in's page
  await expect(page.getByText("Your bank is connected.")).toBeVisible();
  await expect(page.getByText("We pay on the 15th of each month, once you're owed $25 or more.")).toBeVisible();
  await showTheOwner(page, testInfo, "bank connected");
});
test("stopping halfway says so and offers to finish", async ({ page }) => { /* "Stop halfway" → "Stripe still needs a few things from you before we can pay you." and "Finish with Stripe" */ });
test("someone with no game is sent to add one first", async ({ page }) => { /* signUp only: no button, "Add a game first, then come back here to get paid." */ });
test("signed out, the bank screen asks for sign-in", async ({ page }) => { /* /make/bank → /sign-in?next=%2Fmake%2Fbank */ });
test("changing bank details opens Stripe's own page", async ({ page }) => {});
```

  Push. Expected: `browser` fails in `bank.test.ts`: 404 at `/make/bank`.
- [ ] **Step 2 (green):** the routes. Push. Expected: all pass. Branch E is ready to merge after M2's first step and after the Owner has seen its screens' screenshots and said "fine".

---

# Branch F: `slice-5/maker-money`

### Task 26: The look's `rows`, and what the maker's screens read

**Files:**
- Create: `src/features/money/views.ts`
- Modify: `src/lib/look.css`, `tests/support/look-tokens.ts` (`CLASSES`), `tests/lib/look.test.ts`, `src/features/money/money.ts`
- Test: `tests/features/money/views.test.ts`, `views.pg.test.ts`, `tests/lib/look.test.ts` (a case)

**The look.** One new class, `rows`: a list of lines, each with words on the left and an amount on the right. Markup: `<dl class="rows">` holding one `<div>` per line with a `<dt>` (the words) and a `<dd>` (the amount). The rule: each `<div>` is a row with the `<dd>` at the right edge, in tabular figures; rows are told apart by space, never by a line (design 5.8); a row with `class="total"` is in the 600 weight. It uses only the look's tokens. A statement is the first screen that lines up amounts, and the look has nothing for it.

**Interfaces:**
- Produces, pure, in `views.ts`:
  - `monthName(period: Period): string` ("November 2026").
  - `minutesWords(minutes: number): string` ("1 minute", "1,240 minutes").
  - `payLine(input: { owed: bigint; minimum: bigint; bank: BankState; payoutOn: DateText; payout: { state: "planned" | "approved" | "transferred" | "paid" | "failed"; sendCents: bigint; costCents: bigint; paidOn: DateText | null } | null }): string`, the first that applies:

    | When | Words |
    |---|---|
    | the payout was paid | We sent `<send>` to your bank on `<long date>`. |
    | the payout failed | Your bank sent the money back. Check your bank details, and we'll try again. |
    | a payout is planned, approved or on its way | We'll send `<send>` to your bank on `<long date>`. Stripe's cost of sending it, `<cost>`, comes out of what you're owed. |
    | nothing is owed, or less than nothing | Nothing is owed right now. |
    | owed is under the minimum | This is under `<minimum>`, so it carries over to next month. |
    | the bank is not ready | Connect your bank to be paid. |
    | otherwise | We'll send this to your bank on `<long date>`. |

    The cost sentence is left out when `costCents` is zero. Until branch G exists `payout` is always null.
- Produces, reading the database:
  - `makerMoney(deps: { db; clock }, userId: string): Promise<{ owed: bigint; bank: BankState; line: string; statements: { period: Period; name: string; earned: bigint }[] }>`: `owed` is the balance of `maker:<userId>:payable`; the statements newest first.
  - `statementOf(deps, userId: string, period: Period): Promise<{ name: string; finalOn: DateText; lines: { ref: string; words: string; amount: bigint }[]; earned: bigint; broughtForward: bigint; owed: bigint; line: string } | null>`: null unless this person has a statement for that month. Each line's words:

    | Line | Words |
    |---|---|
    | `play` | `<game's name>` · members played `<minutes words>` |
    | `bringing`, one member | For a member you brought to Ruken |
    | `bringing`, more | For `<n>` members you brought to Ruken |
    | `payout_cost` | Stripe's cost of sending your payout |
    | `correction` | the line's own note |

- [ ] **Step 1 (red):** `views.test.ts`: one case per row of both tables, with exact words; `monthName`; `minutesWords(1)`, `(1240)`. `views.pg.test.ts`: after the worked month is made final, maker X's `makerMoney` holds what the journal owes them and one statement; `statementOf` for another maker's month is null (Review Focus 15). The look test: `rows` is in `CLASSES`, has a rule, and the rule holds no colour that is not a token. Stubs. Push. Expected: `verify` fails in `views.test.ts` and the look case, `postgres` in `views.pg.test.ts`.
- [ ] **Step 2 (green):** the code and the rule. Push. Expected: all pass.

### Task 27: Your money, and a statement (`/make/money`, `/make/money/<month>`)

**Files:**
- Create: `src/routes/make/money/+page.server.ts`, `+page.svelte`, `src/routes/make/money/[period]/+page.server.ts`, `+page.svelte`
- Modify: `src/routes/make/+page.svelte` (one link under the games, "Your money", to `/make/money`), `tests/browser/support/game.ts` (a helper, `aFinalMonth(...)`, that pays, plays and runs the job with the clock moved, through the stand-ins)
- Test: `tests/browser/maker-money.test.ts`

Both need an account.

**`/make/money`:**

```
Your money

You're owed $41.20
We pay on the 15th of each month, once you're owed $25 or more.
Connect your bank to be paid.

[ Connect your bank ]

Statements
November 2026                    $41.20

Statements come on the 10th of each month, for the month before.
```

- "You're owed" is a `statement`; the next line is always there; the third is `payLine`. The button is there only while the bank is not `ready`, and goes to `/make/bank`.
- Each statement is a link to `/make/money/<month>`, in `rows`. With none: only the last line.

**`/make/money/2026-11`:**

```
November 2026
Final since 10 December 2026

Floor Fifty · members played 1,240 minutes          $31.10
For 3 members you brought to Ruken                  $10.10
Earned this month                                   $41.20
From before                                          $0.00
You're owed                                         $41.20

We'll send $38.85 to your bank on 15 December 2026. Stripe's cost of sending it, $2.35, comes out of what you're owed.

How this is worked out
Back to your money
```

- The lines and the three totals are one `rows` list; "You're owed" is its `total`. A line that takes money off shows a minus sign before the dollar sign (`−$2.35`), never brackets or red.
- "How this is worked out" goes to `/split` (Task 34; until that branch is merged the link is left out, with its test).
- Someone else's month, a month with no statement, or an address that is not a month (`isPeriod` in `load`): 404.

Grandma: the first screen answers one question, "how much, and when"; the statement reads top to bottom as a sum a person can check, and every number has words beside it that say what it counts. No table headings, no codes, no word a maker did not use.

Look: `<main class="card">` on both; "Connect your bank" is `class="button"`; the links stay links; no `<button>` on the statement at all.

- [ ] **Step 1 (red):**

```ts
test("a maker sees what they are owed and reads the statement", async ({ page }, testInfo) => {
  const month = await aFinalMonth(page);                         // a member brought by this maker pays and plays; the month is made final
  await page.goto("/make/money");
  await expect(page.getByText(/^You're owed \$\d+\.\d\d$/)).toBeVisible();
  await expect(page.getByText("We pay on the 15th of each month, once you're owed $25 or more.")).toBeVisible();
  await expectOneCard(page); await showTheOwner(page, testInfo, "your money");
  await page.getByRole("link", { name: month.name }).click();
  await expect(page.getByText(/members played \d+ minutes?/)).toBeVisible();
  await expect(page.getByText("For a member you brought to Ruken")).toBeVisible();
  await expect(page.getByText("You're owed")).toBeVisible();
  await showTheOwner(page, testInfo, "a statement");
});
test("under $25 says it carries over, and a maker with no bank is told to connect one", async ({ page }) => {});   // Review Focus 11
test("another maker cannot open this statement", async ({ page, browser }) => { /* 404 */ });                       // Review Focus 15
test("an address that is not a month is a missing page", async ({ page }) => { /* /make/money/2026-13 and /make/money/x: 404 */ });
test("with no statements yet, the screen says when they come", async ({ page }) => {});
```

  Push. Expected: `browser` fails in `maker-money.test.ts`: 404 at `/make/money`.
- [ ] **Step 2 (green):** the routes. Push. Expected: all pass. Branch F is ready to merge after the Owner has seen its screens' screenshots and said "fine".

---

# Branch G: `slice-5/payouts`

Does not start before the Owner's answer to question 1. The tasks below are written for the working answer, B. **If the Owner answers A** (take the real cost afterwards): `payoutCost` and `PAYOUT_COST_RULE` are not built, every `costCents` is zero and the whole of what is owed is sent; Task 31 posts each of Stripe's payout fees straight to the maker's account (a debit to `maker:<userId>:payable`, a credit to `platform:stripe_clearing`), where it is a `payout_cost` line on their next statement; and `payLine`'s cost sentence is never shown.

### Task 28: The payout plan

**Files:**
- Create: `prisma/migrations/<timestamp>_payouts/migration.sql`, `src/features/money/payout-id.ts`, `src/features/money/payout-plan.ts`
- Modify: `prisma/schema/money.prisma`, `prisma/schema/accounts.prisma`, `src/features/money/rules.ts`, `src/features/money/fees.ts` (`KnownIds.payouts` gains each `Payout`'s transfer and payout ids)
- Test: `tests/features/money/payout-id.test.ts`, `payout-plan.test.ts`, `tests/features/money/schema.pg.test.ts` (add cases)

**The tables**, from the old `PayoutRun` and `Payout`:

| Model | Columns |
|---|---|
| `PayoutRun` | `id`, `period` unique (a `LedgerPeriod`), `state PayoutRunState` default `draft`, `checkedById?`, `checkedAt?`, `approvedById?`, `approvedAt?`, `executedAt?`, `createdAt` |
| `Payout` | `id`, `runId` (a `PayoutRun`), `makerUserId` (a `User`, `onDelete: Restrict`), `payoutId` unique, `descriptor`, `owedCents BigInt`, `costCents BigInt`, `sendCents BigInt`, `state PayoutState` default `planned`, `skipReason PayoutSkipReason?`, `stripeTransferId?` unique, `stripePayoutId?` unique, `paidAt?`, `failedAt?`, `createdAt`; unique on (`runId`, `makerUserId`) |

Enums: `PayoutRunState { draft, approved, executed }`; `PayoutState { planned, approved, transferred, paid, failed, skipped }`; `PayoutSkipReason { below_minimum, bank_not_ready, nothing_owed }`. In the SQL, copied from the old migration and renamed: CHECK `Payout_payoutId_check` (`^PO-[0-9]{4}-[0-9]{4,}$`), `Payout_descriptor_check` (`'RUKEN ' || "payoutId"`), `Payout_amounts_check` (`"sendCents" > 0 AND "costCents" >= 0 AND "owedCents" = "sendCents" + "costCents"`), CHECK `PayoutRun_two_people_check` (`"approvedById" IS NULL OR "approvedById" <> "checkedById"`); the forward-only trigger on both (`guard_forward_only`, with these two tables' moves); and `Payout_amount_only_down` (`reject_payout_increase`: no amount of a payout ever goes up).

**Interfaces:**
- `payout-id.ts`, carried whole from `OLD/packages/ledger/src/payout-id.ts` with its test: `payoutId(period, position)` (`PO-YYMM-NNNN`), `payoutDescriptor(period, position)` (`RUKEN PO-YYMM-NNNN`, what the maker's bank shows).
- In `rules.ts`: `PAYOUT_COST_RULE = { readFrom: "stripe.com/connect/pricing, 2026-11-14", accountMonthCents: 200n, perPayoutCents: 25n, perPayoutBps: 25 }`, with the comment that this is Stripe's price list, that it is used only to hold a cost back before Stripe charges it, and that Task 31 corrects every payout to what Stripe really charged.
- `payout-plan.ts`, carried from `OLD/packages/ledger/src/payout-plan.ts` and `dispute.ts`'s `heldCents`, with `payout-plan.test.ts`:
  - `payoutCost(owed: bigint): { send: bigint; cost: bigint }`, new: `send` is the most that, with `accountMonthCents`, `perPayoutCents` and `perPayoutBps` of `send` (rounded up to a cent) added, is not more than `owed`; `cost` is `owed − send`. So the maker's bank gets `send`, and what was held covers Stripe's charge to the cent or by one cent more.
  - `interface PayoutCandidate { makerUserId: string; owed: bigint; questioned: readonly bigint[]; bankReady: boolean }`; `planPayouts(period, candidates): { payouts: { makerUserId; position; payoutId; descriptor; owed: bigint; cost: bigint; send: bigint }[]; skipped: { makerUserId; reason: PayoutSkipReason; available: bigint }[] }`: what can be paid is `owed` less what open questions hold (`heldCents`); the first reason that applies, in this order: `bank_not_ready`, `nothing_owed` (zero or less), `below_minimum` (under `PAYOUT_MINIMUM_CENTS`, before the cost); payees are numbered in account id order.
  - `recheckPayout(approvedOwed: bigint, now: PayoutCandidate): { pay: { owed; cost; send } } | { skip: PayoutSkipReason }`: the same rules on the payout day; the amount may only go down.
  - `postTransfer(makerUserId, payoutId, amounts: { owed; cost; send }): { key: string; lines: PostingLine[] }`: key `xfer:<payoutId>`; a debit of `owed` to the maker's account, a credit of `send` to `platform:stripe_clearing`, a credit of `cost` to `platform:payout_costs` (new: what was held back from payouts until Stripe takes its charge).
  - Trim: `locked`, `connect_unverified` as two flags, `strike_hold`.

- [ ] **Step 1 (red):** the carried cases under the new names, and:

```ts
it("holds back Stripe's cost and sends the rest", () => {
  expect(payoutCost(2500n)).toEqual({ send: 2269n, cost: 231n });    // 200 + 25 + 0.25% of 2269 (5.67, rounded up to 6)
  expect(payoutCost(4120n)).toEqual({ send: 3885n, cost: 235n });
});
it("never sends more than is owed, whatever the amount", () => { /* for owed from 2500n to 2600n: send + cost === owed, and 225n + roundedUp(send × 0.25%) <= cost */ });
it("pays at $25.00 and carries $24.99 forward", () => {                                   // Review Focus 11
  const plan = planPayouts("2026-11" as Period, [{ makerUserId: "a", owed: 2500n, questioned: [], bankReady: true }, { makerUserId: "b", owed: 2499n, questioned: [], bankReady: true }]);
  expect(plan.payouts).toMatchObject([{ makerUserId: "a", payoutId: "PO-2611-0001", descriptor: "RUKEN PO-2611-0001", owed: 2500n, send: 2269n }]);
  expect(plan.skipped).toEqual([{ makerUserId: "b", reason: "below_minimum", available: 2499n }]);
});
it("does not pay a maker whose bank is not ready, however much is owed", () => {});      // Review Focus 11
it("holds a questioned line out of the payout", () => { /* owed 8000n, questioned [3000n]: owed 5000n is planned */ });
it("lowers a payout on the day, never raises it", () => {                                 // Review Focus 13
  expect(recheckPayout(8000n, { makerUserId: "a", owed: 6000n, questioned: [], bankReady: true })).toMatchObject({ pay: { owed: 6000n } });
  expect(recheckPayout(8000n, { makerUserId: "a", owed: 9000n, questioned: [], bankReady: true })).toMatchObject({ pay: { owed: 8000n } });
  expect(recheckPayout(8000n, { makerUserId: "a", owed: 2000n, questioned: [], bankReady: true })).toEqual({ skip: "below_minimum" });
});
it("posts a transfer that adds up to zero", () => {});
```

  Schema cases: a payout whose three amounts do not add up rejects; a payout id of the wrong shape rejects; a run approved by the person who checked it rejects; an amount cannot go up; a state cannot go back. Stubs. Push. Expected: `verify` fails in the two unit files, `postgres` in the schema cases.
- [ ] **Step 2 (green):** the code and the migration. Push. Expected: all pass.

### Task 29: The payout run: drafted when the month is final, checked and approved by two people

**Files:**
- Create: `src/features/money/payouts.ts`
- Modify: `src/features/money/finalize.ts` (after `writeStatements`: `draftPayoutRun`), `src/features/money/views.ts` (`makerMoney` and `statementOf` pass the month's `Payout` to `payLine`)
- Test: `tests/features/money/payouts.pg.test.ts`, `tests/features/money/finalize.pg.test.ts` (add a case)

**Interfaces:**
- Produces, carried from `OLD/packages/core/src/money/payouts.ts` with `payouts.pg.test.ts`:
  - `draftPayoutRun(tx, period): Promise<{ payouts: string[] }>`: a candidate for every maker with a statement in the month (`owed` from the journal, `bankReady` from `BankAccount`, `questioned` empty until Task 35), `planPayouts`, one `PayoutRun` in `draft` and one `Payout` in `planned` for each payee. A maker who is skipped gets no row: their balance stays in the journal and carries forward.
  - `payoutCandidate(tx, makerUserId): Promise<PayoutCandidate>` and `owedForRun(tx, payout): Promise<bigint>` (the old `payableForRun`: what the maker is owed now, never more than this payout's `owedCents`, and never counting another run's payout that has not been sent).
  - `checkPayoutRun(deps: { db; clock }, input: { period; staffUserId }): Promise<void>`: a `draft` run with nobody's check yet gets `checkedById` and the clock's time.
  - `approvePayoutRun(deps, input: { period; staffUserId }): Promise<void>`: a checked `draft` run, approved by someone other than the checker (else `MoneyError("FORBIDDEN", "A second person approves a payout run.")`), becomes `approved` and its payouts `planned → approved`. The fresh code is checked by the route that calls this (Task 33), not here.
  - `payoutRunOf(db, period)`: what Task 33's screen reads: the run, its payouts with each maker's email, and the makers skipped with the reason (worked out again by `planPayouts`, since skipped makers have no row).
- Trim: `requireOwner` (the route's staff check and the code check replace it), strikes.

- [ ] **Step 1 (red):** the carried cases under the new names, and: making November final drafts one run with a payout for the maker owed $25 or more with a bank, and none for the maker under $25, the maker with no bank, and **the maker whose account was deleted** (their `BankAccount` is not ready; Review Focus 10); the checker cannot approve; an unchecked run cannot be approved; approving twice changes nothing; a run for a month with nobody to pay is drafted empty and can be approved. Stubs. Push. Expected: `postgres` fails in `payouts.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** carry, trim, and the call in `finalizePeriod`. Push. Expected: all pass.

### Task 30: Sending the payouts on the 15th

**Files:**
- Create: `src/features/money/payout-execution.ts`
- Modify: `src/features/money/stripe-port.ts`, `src/features/money/daily.ts`, `tests/support/fake-money-stripe.ts`, `tests/browser/support/fake-stripe-server.ts`
- Test: `tests/features/money/payout-execution.pg.test.ts`, `tests/features/money/stripe-port.test.ts` (add cases), `tests/features/money/daily.pg.test.ts` (add a case)

**Interfaces:**
- `MoneyStripe` gains, carried from `OLD/packages/billing/src/connect.ts` with their cases, idempotency keys and lookups as they are: `findTransfer(ref)`, `createTransfer(ref & { amount })` (key `xfer:<payoutId>`, group `PR-YYMM`, `metadata.payoutId`), `findPayout(ref)`, `findPayoutAttempt(ref & { attempt })`, `createPayout(ref & { amount; descriptor; attempt? })` (on the maker's account, key `po:<payoutId>`), where `ref` is `{ payoutId; stripeAccountId }`. New: `payoutOutcome(stripeAccountId, stripePayoutId): Promise<{ status: "pending" | "in_transit" | "paid" | "failed" | "canceled"; arrivalSec: number | null }>` (the payout read on the maker's account).
- Produces, carried from `OLD/packages/core/src/money/payout-execution.ts` with `payout-execution.pg.test.ts`:
  - `executePayouts(deps: { db; clock; stripe }): Promise<{ transferred: string[]; skipped: string[]; paidOut: string[]; errors: { payoutId: string; message: string }[]; executed: string[] }>`: for each `approved` run whose `payoutDate` has come (today's Chicago date), each `approved` payout: check again (`recheckPayout` with `owedForRun` and the bank as stored after a fresh `refreshBank`); move `send` to the maker's Stripe account, first asking Stripe whether an earlier run already did (`findTransfer`); in one transaction under `lockLedger`, post `postTransfer` into the open month and move the payout `approved → transferred`, storing the amounts actually used; then pay the maker's Stripe balance out to their bank (`findPayout`, then `createPayout`). One payout's error leaves it where it was for tomorrow's run and does not stop the others. A run is `executed` once none of its payouts is `approved`.
  - `settlePayouts(deps): Promise<{ paid: string[]; failed: string[]; retried: string[] }>`, new, in place of the old Connect webhook: every `transferred` payout with a `stripePayoutId` is read from Stripe: `paid` moves it to `paid` with the arrival date; `failed` or `canceled` moves it to `failed` with the clock's time. A `failed` payout is paid out again (attempt `2`, `3`, as carried) once `refreshBank` shows the maker's bank ready and checked after the failure: the money is still in the maker's Stripe balance, so only the payout is made again.
- `runMoneyJob` gains steps 11 and 12, `executePayouts` and `settlePayouts`, and the report gains both answers.
- The stand-ins gain transfers and payouts, with a way for a test to lose an answer (`failNextTransfer({ afterMaking: true })`) and to fail a payout.

- [ ] **Step 1 (red):** the carried cases under the new names, and:

```ts
it("sends nothing before the 15th, and sends on it", async () => { /* the clock on the 14th in Chicago: nothing; on the 15th: transferred and paid out, PO-2611-0001, the bank gets sendCents */ });
it("waits for the next business day when the 15th is not one", async () => {});
it("does not send twice when Stripe's answer was lost", async () => {                     // Review Focus 12
  stripe.failNextTransfer({ afterMaking: true });
  expect((await executePayouts(deps)).errors).toHaveLength(1);
  await executePayouts(deps);
  expect(stripe.transfers()).toHaveLength(1);
  expect(await balancesOf(prisma)).toMatchObject({ [`maker:${maker}:payable`]: 0n });
});
it("sends the lower amount when a chargeback came after the approval", async () => {      // Review Focus 13
  /* approved at 8000n owed; a chargeback lowers the maker's balance to 6000n: owedCents 6000n is sent, with its own cost */ });
it("skips a maker whose bank stopped being ready, and their money stays owed", async () => {});
it("marks a payout paid when Stripe says so, and failed when the bank sends it back", async () => {});
it("pays a failed payout out again once the maker has fixed their bank, and not before", async () => {});
it("keeps the books balanced, and never touches Ruken's half", async () => {              // Review Focus 17
  await expectBooksBalanced(prisma); /* platform:revenue:premium unchanged by a payout run */ });
```

  Stubs. Push. Expected: `postgres` fails in `payout-execution.pg.test.ts`, `verify` in the new port cases.
- [ ] **Step 2 (green):** carry and change. Push. Expected: all pass.

### Task 31: What Stripe really charged for sending

**Files:**
- Create: `src/features/money/payout-costs.ts`
- Modify: `src/features/money/daily.ts`, `src/features/money/statements.ts` (a `payout_cost` or `correction` entry on a maker's account in a month is a statement line)
- Test: `tests/features/money/payout-costs.pg.test.ts`

**Interfaces:**
- Produces:
  - `postPayoutCosts(deps: { db; clock }): Promise<{ posted: number }>`: each `FeePosting` of kind `payout` with no entry, under `lockLedger`: the cents it adds for that maker (rounded up once over the maker's rows, as Task 15 does per payment); one `payout_cost` entry (key `payoutfee:<feeRowId>`): a debit to `platform:payout_costs`, a credit to `platform:stripe_clearing`. The maker's account is not touched: their cost was held back when the payout was sent.
  - `correctPayoutCosts(deps): Promise<{ corrected: string[] }>`: for each `paid` payout sent 35 days ago or more with no correction yet: Stripe's real charge is the cents of the maker's `payout` fee rows whose `incurredAt` falls in the Chicago month the payout was sent in. When there are such rows and they differ from the payout's `costCents`: one `correction` entry (key `payoutfix:<payoutId>`) between `platform:payout_costs` and the maker's account for the difference, either way; it becomes a line on the maker's next statement with the note "Stripe's cost of sending your payout `<payoutId>` was `<real>`, not `<held>`." When there are no such rows (Stripe charged in a way that names nobody; M1 and the first payout show which), nothing is posted and Task 32's screen shows the payout under "Needs a person".
- `runMoneyJob` gains steps 13 and 14.

- [ ] **Step 1 (red):** Stripe's rows for a payout equal what was held: the held account ends at zero and the maker gets no line; Stripe charged 10 cents less: the maker is credited 10 cents on their next statement, with the note; 10 cents more: debited 10 cents; no rows after 35 days: no entry, and the payout is listed as unmatched; a second run posts nothing; the books balance and Ruken's half is unchanged. Stubs. Push. Expected: `postgres` fails in `payout-costs.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch G is ready to merge; it must be on `main` before 15 December.

---

# Branch H: `slice-5/admin-money`

### Task 32: The month, for staff (`/admin/money`)

**Files:**
- Create: `prisma/migrations/<timestamp>_money_job_runs/migration.sql`, `src/routes/admin/money/+page.server.ts`, `+page.svelte`
- Modify: `prisma/schema/money.prisma` (`MoneyJobRun`: `id`, `ranAt`, `report Json`, `ok Boolean`; added, never changed), `src/routes/jobs/money/+server.ts` (stores each run's report), `src/features/accounts/staff.ts` and `accounts.ts` (`MONEY_STAFF_ROLES: readonly StaffRole[] = ["owner", "finance"]`), `src/features/admin/staff-only.ts` (`staffOnly(caller, roles = GAME_STAFF_ROLES)`: a second, optional list; if slice 4 has already changed this function, use what is on `main` and add nothing), `src/features/money/views.ts`
- Test: `tests/features/money/views.pg.test.ts` (add cases), `tests/browser/admin-money.test.ts`

**Interfaces:**
- Produces, in `views.ts`: `monthSoFar(deps, period): Promise<{ name: string; stateWords: string; members: number; paid: bigint; tax: bigint; fees: bigint; makersHalf: bigint; rukensHalf: bigint; bonuses: bigint; byPlay: bigint; carry: bigint }>`: `paid`, `tax` and `fees` from the month's payments and their fee entries; `makersHalf`, `bonuses`, `byPlay` and `carry` from `poolFor` (a month not yet final) or its `PoolRun` and `PoolShare` rows (a final one); `rukensHalf` from the journal. And `needsAPerson(deps): Promise<string[]>`, the lines below, each only when it is true.

The screen, for staff with a role in `MONEY_STAFF_ROLES` (anyone else: 404):

```
Money

November 2026
Closed. Final on 10 December 2026.

Members who paid                         412
Paid, with tax                     $4,453.72
Tax                                  $337.84
Stripe's fees                        $289.10
Makers' half                       $1,913.39
Ruken's half                       $1,913.39
  To makers who brought members      $310.20
  Shared by play                   $1,603.19

Needs a person
3 fees from Stripe name no payment and no payout: Radar, $0.15.
1 fee from Stripe could not be read. November will not be final until the code can read it.
The daily job reported a problem on 9 December 2026: readReversals.

Payouts for November 2026
Earlier months
```

- State words: "Open. Closes on `<long date>`.", "Closed. Final on `<long date>`.", "Final since `<long date>`."
- The month shown is the newest that is not final, with the open one under it; "Earlier months" lists final months, each a link to the same screen for that month (`?month=2026-10`).
- "Needs a person" lines: unplaced fees of the last 62 days, by `product`, with their total; unreadable fees, with the month they hold up; the last job run that was not ok, with the steps named; payouts whose real cost was never matched (Task 31); a month due to be final that is not. With none: "Nothing needs a person."
- Under a final month's numbers, "Statements": one row per maker with a statement that month, their account's email and what they earned, from the `Statement` rows (design 5.5 lists statements among what staff see). It is a list only; staff read a maker's lines there, and nothing can be changed.
- "Payouts for `<month>`" links to Task 33's screen once that month's run exists.
- Every number is read from the ledger. The screen has no form.

Grandma (for staff): the same sum a maker's statement shows, for the whole month, top to bottom; whatever is wrong is said in one line each, in words.

Look: `<main class="card">`; the numbers in `rows`; the two halves' breakdown is two indented rows; links stay links; a "Needs a person" line is `problem`.

- [ ] **Step 1 (red):** `views.pg.test.ts`: the worked month's `monthSoFar` before and after it is final gives the same numbers; the two halves are equal to the cent or differ by the carried rounding only; each "Needs a person" line appears when its cause does and not otherwise. `admin-money.test.ts`: staff with `finance` see the screen (attached with `showTheOwner`); a `curator` and a member get 404; signed out: sign-in. Push. Expected: `browser` fails (404 at `/admin/money`), `postgres` in the new view cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 33: Checking and approving a payout run (`/admin/money/<month>`)

**Does not start until slice 4 is merged, and the coordinator has answered question 3.** Design 5.5: "money actions need a second person and a fresh code from an authenticator app". This task builds the second person (two different staff accounts, Task 29) and calls slice 4's check for the code. It needs from slice 4, by whatever names slice 4's plan gives them: (1) a function a form action calls with the request, which passes only when this staff session entered a code from its authenticator app within the last ten minutes, and otherwise sends the person to slice 4's code screen and back; (2) the two superadmin accounts of design 9. If slice 4 on `main` has no such function, stop and report: this plan builds none of it.

**Files:**
- Create: `src/routes/admin/money/[period]/+page.server.ts`, `+page.svelte`
- Test: `tests/browser/admin-money.test.ts` (add cases)

```
Payouts for November 2026
To be sent on 15 December 2026

maker@example.test        owed $41.20    Stripe's cost $2.35    to their bank $38.85
other@example.test        owed $80.00    Stripe's cost $2.45    to their bank $77.55

Not paid this month
third@example.test        owed $12.00    Under $25. It carries over.
fourth@example.test       owed $90.00    No bank connected yet.

To send in all            $116.40

[ These look right ]
```

- After "These look right" (`checkPayoutRun`): "Checked by `<email>` on `<long date>`. A second person approves." and, for any other staff account in `MONEY_STAFF_ROLES`, one button, "Approve payouts" (slice 4's code check, then `approvePayoutRun`). The checker sees no button.
- After approval: "Approved by `<email>`. These go out on `<long date>`." Then, as the job sends them, each line's last column reads "Sent on `<long date>`", "On its way" or "Sent back by the bank".
- A month with no run: 404.

Look: `<main class="card">`; each list in `rows`; "These look right" and "Approve payouts" are each the card's one plain `<button>` (never both on one screen); a refusal is `problem`. Not `pay`: the Blue button is for a member spending money.

- [ ] **Step 1 (red):** one staff account checks, a second approves with a fresh code, and the run reads "Approved by"; **the checker opening the screen again has no Approve button, and a forged post from them is refused with "A second person approves a payout run."**; **an approval with no fresh code is sent to slice 4's code screen and approves nothing** (Review Focus 14); a `curator` gets 404. Attach both states with `showTheOwner`. Push. Expected: `browser` fails in the new cases: 404.
- [ ] **Step 2 (green):** the route. Push. Expected: all pass. Branch H is ready to merge after the Owner has seen its screens; it must be on `main` before M3.

---

# Branch I: `slice-5/split-page`

### Task 34: How makers are paid (`/split`)

**Files:**
- Create: `src/features/money/library/split-example.json`, `src/routes/split/+page.server.ts`, `+page.svelte`
- Modify: `src/features/money/views.ts` (`splitExample()`, `splitMonths(deps)`), `src/routes/make/money/[period]/+page.svelte` (the link "How this is worked out"), `tests/browser/support/look.ts` (`CARD_SCREENS`)
- Test: `tests/features/money/views.test.ts` (add cases), `tests/browser/split.test.ts`

Design 6: "a public page shows the split with a worked example, and after each statement the pool, the number of members and what makers received in total, all read from the ledger". It needs no account.

```
How makers are paid

From each member's fee we first take off tax and Stripe's fees.
Half of what's left goes to Ruken and half to makers.
For a member's first 12 months, half of the makers' half goes to the maker who brought them to Ruken.
The rest is shared by how long that member played each game, counting up to 3 hours per game per day.
Free play, staff play and playing your own game don't count.

For example
A member pays                              $10.81
Tax                                        −$0.82
Stripe's fees                              −$0.73
What's left                                 $9.26
Ruken's half                                $4.63
Makers' half                                $4.63
  To the maker who brought them             $2.32
  A game they played for 2 hours            $1.54
  A game they played for 1 hour             $0.77

These amounts are an example. Tax and Stripe's fees are different for each payment.

Each month
November 2026: 412 members. Makers' half: $1,913.39.
```

- The five lines at the top are paragraph 5 of the maker agreement, version 1, word for word. A test reads `src/features/make/library/maker-agreement-v1.txt` and fails when the page and the paragraph differ.
- The example's inputs (what the member paid, the tax, the fees, the two play times) are the made-up values in `split-example.json`, which says in its first key that they are made up; every other number on the page is worked out from them by `poolContributions` and `allocateMakersPool`, so the example cannot drift from the rules.
- "Each month" has one line per final month, newest first, from `PoolRun`: its members and its `poolCents`. When part of a month carried over, the line adds: "`<carry>` of it carried into the next month, because nobody played." With no final month yet, the heading and its lines are left out.

Grandma: the rule in the five sentences makers already agreed to, then one payment followed all the way down, with the words beside every amount.

Look: `<main class="card">`, in `CARD_SCREENS`; the example and the months in `rows`; no button.

- [ ] **Step 1 (red):** `views.test.ts`: `splitExample()` gives the amounts above, and they add up (the two halves make what is left; the three shares make the makers' half). `split.test.ts`: the page shows the five sentences, matching the agreement's paragraph; the example's amounts; after a month is made final, its line; `expectOneCard` and `showTheOwner`. Push. Expected: `browser` fails (404 at `/split`), `verify` in the new view cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch I is ready to merge after the Owner has seen the screen.

---

# Branch J: `slice-5/questions`

After the first payout. A maker can ask about a line of a statement for 90 days after it was final; while the question is open, that line's amount is held out of their payout; staff answer in words within 10 business days. Staff type no amount: if a rule's code was wrong, the fix is a change to the code and a correction worked out by it, which is a later spec.

### Task 35: A maker asks about a line

**Files:**
- Create: `prisma/migrations/<timestamp>_statement_questions/migration.sql`, `src/features/money/questions.ts`, `src/routes/make/money/[period]/ask/[line]/+page.server.ts`, `+page.svelte`
- Modify: `prisma/schema/money.prisma`, `src/features/money/payouts.ts` (`payoutCandidate` fills `questioned` with the amounts of the maker's lines that have an open question), `src/routes/make/money/[period]/+page.svelte` (each line gains a quiet link, "Ask about this"; a line with an open question reads "You asked about this on `<long date>`. We'll answer by `<long date>`."; an answered one shows the answer under it)
- Test: `tests/features/money/questions.pg.test.ts`, `tests/browser/statement-questions.test.ts`

**The table**, from the old `Dispute`: `StatementQuestion`: `id`, `statementLineId` (a `StatementLine`), `makerUserId`, `words` (CHECK: 20 to 2,000 characters), `state QuestionState { open, answered }` default `open`, `answerBy`, `answer?`, `answeredById?`, `answeredAt?`, `createdAt`; a partial unique index: one open question per line; forward-only (`open → answered`).

**Interfaces:**
- Produces, from `OLD/packages/core/src/money/disputes.ts` (`openDispute`, `getDispute`) and `OLD/packages/ledger/src/dispute.ts` (`canDispute`) with their cases: `canAsk(finalOn: DateText, today: DateText): boolean` (pure, in `calendar.ts`: from the day it was final through the 90th day after); `askAbout(deps: { db; clock }, input: { makerUserId; statementLineId; words }): Promise<{ answerBy: DateText }>`: the line is on this maker's own statement (else `NOT_FOUND`), `canAsk` holds (else `MoneyError("TOO_LATE", "You can ask about a statement for 90 days after it's final.")`), no question is open on it, the words are 20 to 2,000 characters after trimming (else `MoneyError("INVALID", "Tell us what looks wrong, in a sentence or two.")`); `answerBy` is `answerBy(today)`.
- Trim: `upheld` and its correction (`reverseLineLines`, `platform:adjustments`, the adjustment and its second approval).

The screen:

```
Ask about this line

Floor Fifty · members played 1,240 minutes          $31.10

What looks wrong?
[                                            ]

[ Send question ]

Back to the statement
```

After sending, the statement shows the line with "You asked about this on 12 December 2026. We'll answer by 28 December 2026." Grandma: one box, one button, and the line being asked about is shown above the box so nobody has to remember it. Look: `<main class="card">`; the line in `rows`; the box is a `<textarea>` (slice 2 gave it the field rule); the form's one `<button>`.

- [ ] **Step 1 (red):** `questions.pg.test.ts`: each refusal with its words; one open question per line; another maker's line is `NOT_FOUND`; the 91st day refuses; **an open question holds its line out of the next payout plan and an answered one does not**. The journey: a maker asks, sees the "We'll answer by" line, and cannot ask twice. Stubs. Push. Expected: `postgres` and `browser` fail in the new files.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 36: Staff answer

**Files:**
- Create: `src/routes/admin/money/questions/+page.server.ts`, `+page.svelte`
- Modify: `src/features/money/questions.ts`, `src/routes/admin/money/+page.svelte` (a link, "Questions from makers (`<n>` open)")
- Test: `tests/features/money/questions.pg.test.ts` (add cases), `tests/browser/statement-questions.test.ts` (add cases)

**Interfaces:**
- Produces, from the old `listOpenDisputes` and `resolveDispute` with their cases: `openQuestions(db)`: oldest first, each with the maker's email, the month, the line's words and amount, the maker's words and the answer-by date; `answerQuestion(deps, input: { questionId; staffUserId; answer }): Promise<void>`: the answer is 1 to 2,000 characters after trimming (else "Write an answer the maker can read."); a maker cannot answer their own question (`FORBIDDEN`); the question becomes `answered` with who and when, which releases the hold.
- The screen, for `MONEY_STAFF_ROLES`: one card per open question (the oldest first, as slice 2's waiting list), with the line, the maker's words, "Answer by `<long date>`", one box and one button, "Send answer". With none: "No questions are waiting." The screen has no field for an amount.

- [ ] **Step 1 (red):** an answer is stored with who and when, and the maker's statement shows it under the line; an empty answer refuses; answering twice refuses; the hold is gone from the next payout plan; a `curator` gets 404. Push. Expected: `postgres` and `browser` fail in the new cases.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch J is ready to merge after the Owner has seen its screens.

---

# Branch K: `slice-5/real-site`

### Task 37: The first statement and the first payout, on the real site

**Files:**
- Modify: `docs/superpowers/progress.md`

Design 7.5: slice 5 ends with "the first statement is right". No code unless a step fails; a fix is its own small branch with its test first.

- [ ] **Step 1, on 8 December or the first day after it that branch D is on `main`:** the Owner runs M1's line once more and pastes the answer. Expected: `"closed":["2026-11"]`, no `problems`, and no `unreadable` or unexpected `unplaced` fee.
- [ ] **Step 2, on 10 December:** staff open `/admin/money`. Expected: "November 2026", "Final since 10 December 2026", "Nothing needs a person." Execution works November out by hand from Stripe's own dashboard exports for the month (the payments, their tax, the Fees report) and the play totals, with the method of Task 8's first comment, and compares to the cent: the makers' half, each maker's statement, Ruken's half. Any difference of a cent or more: stop and report with both numbers before anything is paid.
- [ ] **Step 3:** a maker (the Owner's own maker account for FloorFifty) opens `/make/money` and the November statement on a phone, and says each line makes sense without being told what it means. A line that needs explaining is a wording change, reported and fixed before the 15th.
- [ ] **Step 4, M3, between 10 and 14 December:** two staff accounts check and approve the November run (Task 33).
- [ ] **Step 5, on 15 December:** after the day's job, `/admin/money/2026-11` reads "Sent on 15 December 2026" for each payout, the amounts match Stripe's dashboard, and nothing was sent twice. In the days after, each reads as paid, and Stripe's Fees report shows what Stripe charged for sending (Task 31 then matches it; if it cannot, that is reported the same day).
- [ ] **Step 6:** tick the tracker: slice 5 is done when all of this is merged to `main`, green there, and the first statement and payout were right on the real site.

## Notes for the plans that follow

- **Free-play codes** (design 6) are not here. When they are built, play on a code is its own play basis in slice 2's `playBasis` and never reaches `PlayDay`, which reads `member` sessions only.
- **Sign in with Google** (design 2) changes nothing here: a member is an account.
- **Slice 3's feed order** adds up a week of members' beats on every open, and its notes say that if that is ever slow "the first thing to try is a sum kept per day". `PlayDay` is that sum, per day and game, already capped.
- **Slice 4's mails** could tell a maker a statement is ready; design 7.1's list of mails would need the Owner's words first.
- Worth the Owner's eye, left out on purpose: a daily comparison of Stripe's paid invoices with `MembershipPayment`, so a payment whose webhook never arrived is still found (slice 1's note; without it such a payment is in nobody's pool); a sweep of old `StripeFeeRow` and `PlayBeat` rows; tax forms for makers (Stripe can make them for Express accounts; that is a Stripe setting and a later spec); makers outside the United States (question 2); a maker's statement as a file to download; and what happens to money owed to an account that was deleted (it stays owed, on the books, and is never sent).
- The journal can answer any "why is this number what it is" by its entries: every entry has a key that names the Stripe id or the month it came from, and nothing is ever changed. A question that needs more than reading it is a sign something is missing from the screens, and worth reporting.
