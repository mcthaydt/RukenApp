# Slice 5 plan audit: money

Date: 2026-11-14. Stage 3 (plan audit), on branch `audit/slice-5-plan`.

What was audited: `docs/superpowers/plans/2026-11-14-slice-5-money.md` on branch `plan/slice-5` at `4caaba7` (pull request #55, not merged; the plan file is the same as at `940db37`). It was read against `CLAUDE.md`, `AGENTS.md`, the design (`docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`, sections 5.5, 6, 7.1, 7.2, 7.5), the plans of slices 1, 2 and 3, the earlier audits, `docs/superpowers/progress.md` (both `main` and the plan branch), and the code on `main` at `527bca3`.

What was run, and what was not:

- No test was run (CLAUDE.md: tests run only on GitHub's runners). This audit is a reading of files. Nothing in the plan, the code or CI was changed; a follow-up pull request writes the fixes and the answers of 2026-11-14 into the plan.
- `stripe` 22.6.2, the version in `package.json`, was downloaded with `npm pack` into a scratch folder outside the repository, and its type files were read: `Reporting/ReportRuns.d.ts`, `Reporting/ReportTypes.d.ts`, `BalanceSettings.d.ts`, `Transfers.d.ts`, `Accounts.d.ts`, `Refunds.d.ts`, `Disputes.d.ts`.
- Stripe's page on the Fees report (https://docs.stripe.com/reports/all-fees) was fetched and read in full, including its column tables.
- The old repository was cloned read-only at `188e8a07546ba19c431468ddf2624e3cc4173d4e` (not registered as a repository root). Each of the 32 files the plan carries exists at the path it names; `pct` rounds half up, and the old calendar's function names are the ones the plan renames.
- Not checked: what Stripe's report rows look like for Billing and Tax fees on Ruken's live account (needs the live key; that is the Owner's), and the maker agreement's text: `src/features/make/library/maker-agreement-v1.txt` is on no branch yet. Its paragraphs 5 and 6 were checked as the coordinator's brief states them.

Counts: **3 block launch, 11 should fix, 11 notes.**

## The answers of 2026-11-14, against the plan

- **Payout cost: "Hold back, fix later"** (Owner). This is the plan's working answer B (Tasks 28, 31). The plan's text for answer A ("If the Owner answers A…", branch G's preface; Task 25's conditional line) can go. One part of the Owner's words is not met as written: "correct to Stripe's real charge on the next statement" (S2).
- **Banks: "US only for now"** (Owner). The plan's working answer A: `country: "US"` (Task 24) and the line on the first card (Task 25). Matches.
- **Second person and code: slice 4's, named by slice 5; the payout-approval branch waits for slice 4** (coordinator). The plan's working answer A (Task 33 and branch H). Matches. Slice 4's plan must now carry the two pieces Task 33 names (a fresh-code check a form action calls; two superadmins), or the 15 December payout cannot be approved (S11).

## Findings

Severity is one of: **blocks launch** (money comes out wrong, or a date cannot be met, as written), **should fix** (wrong, unsafe or inconsistent, but a careful executor might get around it), **note**.

### Blocks launch

**B1. On the 15th Ruken's Stripe balance may hold nothing to send.**
- Where: Task 30 (`executePayouts`), M2, "What the Owner holds".
- Evidence: a transfer to a connected account is paid from the platform's available balance. A Stripe account pays its balance out to its own bank automatically by default, so the money members paid in November is in the Owner's bank by 15 December, and every transfer fails for lack of funds. Nothing in the plan reads the balance or sets the platform's own payout schedule. `stripe` 22.6.2 has `balanceSettings` with `payments.payouts.schedule.interval` and `minimum_balance_by_currency` (`BalanceSettings.d.ts`, lines 46, 174, 215), so the setting can be made by command.
- Fix:
  1. Task 30: before any transfer, `MoneyStripe.availableUsd()` (`stripe.balance.retrieve()`); when it is less than the run's total `send`, send nothing, report it under `problems`, and add the "Needs a person" line "Stripe's balance is $X, and this month's payouts need $Y." A red case for it.
  2. An Owner step, M2b, before branch G is marked ready: one Mac zsh line that keeps enough on the balance. The choice (a manual or monthly schedule for Ruken's own payouts, or a minimum balance) is the Owner's; ask it now, with the line for each, checked against Stripe's API reference for `balance_settings` at execution.

**B2. Play after midnight is lost from the pay.**
- Where: Task 18 (`rollUpPlayDays`).
- Evidence: a day reads "every `member` session … that started within 24 hours before the day's end". A session lives 24 hours (`PLAY_SESSION_LIFE_MS`, slice 2 plan, Task 17) and can beat into the next day, so a session started at 23:55 on the 5th is not read for the 6th. Task 6's own test (`cuts a session at Chicago midnight`: 300 seconds on each day) shows that play must count. On a 25-hour day, 24 hours before the end is 01:00, so sessions started between 00:00 and 01:00 that day are missed too. 1 November 2026 was such a day; 7 November 2027 is the next. The plain midnight case would fail Task 18's own red test; the clock-change case has no rollup test, so it would ship.
- Fix: read sessions that started in `[startOfDayMs(day) − PLAY_SESSION_LIFE_MS, startOfDayMs(addDays(day, 1)))` (import the constant from `play.ts` with the other two), with beats in the day. Add a Task 18 case for the 25-hour day: a session started at 00:30 on 7 November 2027 is counted.

**B3. If Stripe's Billing or Tax fees are not in the report at all, nothing notices, and Ruken's half pays them.**
- Where: "Found while planning" 1 and 5, M1, Task 15.
- Evidence: Stripe's page says the report "excludes … fees that Stripe invoices after you use a service", and `settled_via` can be `invoice`. A report dated by balance transaction has no row for a fee that never touched the balance. M1 stops only on an `unplaced` row or a failed run. A missing fee raises neither, so makers would get half of a total that still includes Billing and Tax. Design 6 takes those fees off the top, and "Ruken's half is never reduced to pay makers".
- Fix: M1's expected answer must also show, for the payments in the stretch, `payment` rows whose `product` names Billing and Tax, at least one of each per payment. If there are none, stop and ask the Owner. The job report's `fees` list already counts by product, so this needs no code. Add a "Needs a person" line for a posted payment that has had no Billing row for 10 days.

### Should fix

**S1. A deleted maker's money would be sent.**
- Where: Tasks 24, 29; "Notes for the plans that follow".
- Evidence: `purgeDueAccounts` (`src/features/accounts/deletion.ts`) clears sessions, accounts and the person's details. It does not touch a `BankAccount`, and Stripe's account stays active, so `bankReady` stays true. Task 29 expects the deleted maker's "`BankAccount` is not ready", but nothing makes it so. The Notes say money owed to a deleted account "is never sent".
- Fix: a skip reason `account_closed` in `planPayouts` and `recheckPayout` when `User.status` is not `active` (both `pending_deletion` and `deleted`), checked before the bank. Admin words: "Account deleted. Kept on the books." Task 29's case asserts that reason.

**S2. Stripe's real payout charge lands on the statement after next, not "the next statement".**
- Where: Task 31 (`correctPayoutCosts`).
- Evidence: the correction waits 35 days, so a payout sent on 15 December is corrected on about 19 January. That posts into January, which is final on 10 February. The December statement (final 10 January) is the next one. The match also looks only at fee rows whose `incurredAt` falls in the month the payout was sent. Stripe may charge the monthly active-account fee at the month's end, or on the 1st after it. And a payout sent again (attempt 2) can fall in a later month.
- Fix: match rows by the ids the payout made (`stripeTransferId`, `stripePayoutId`, attempts), plus the maker's account id for the active-account fee. Correct on the run of the 8th, before closing, into the month the payout was sent, so it is on the next statement. Rows that arrive later are corrected on the following 8th, with a red case.

**S3. After a payout, the maker's screens stop showing what was sent and what it cost.**
- Where: Tasks 22, 26, 27.
- Evidence: Agreement section 6: the cost comes out of the payout "and is shown". Under "hold back", the cost appears only in `payLine` while the payout is planned. Once it is paid, the line is "We sent `<send>` to your bank on `<date>`." with no cost. The statement has no line for money sent: the next month reads "From before $0.00" after a month that ended "You're owed $41.20", which a person cannot check as a sum. The "otherwise" row says "We'll send this to your bank", but less than "this" is sent. And "Your bank sent the money back. Check your bank details…" offers no way to do so, because the bank button shows only while the bank is not ready.
- Fix:
  - Add `StatementLineSource.transfer`. The statement of the month a payout was sent gets two lines: "Sent to your bank on 15 December 2026 −$38.85" and "Stripe's cost of sending it −$2.35".
  - The paid line: "We sent $38.85 to your bank on 15 December 2026. Stripe's cost of sending it, $2.35, came out of what you were owed."
  - The otherwise line: "We'll send this to your bank on `<date>`, less Stripe's cost of sending it."
  - The failed line gets the link "Change your bank details" (the `change` action).
  - Cases in `views.test.ts` for each.

**S4. The admin screen's two halves will not be equal.**
- Where: Tasks 3, 32.
- Evidence: `postPaymentPaid` credits `platform:revenue:premium` with 530 on a payment whose makers' half is 469, because the card fee (61) sits in `platform:processor_fees`, "as carried". `monthSoFar.rukensHalf` is "from the journal", and Task 32 expects both halves "equal to the cent or differ by the carried rounding only". Read as one account's balance, it is off by every card fee.
- Fix: define `rukensHalf` as `revenue:premium` less the month's `processor_fees` (or as paid − tax − fees − makers' half), and say so in Task 32. Task 8's check ("revenue holds at least … what was left … less each payment's makers' half") should use the same definition, written out once.

**S5. The report's times are text with no zone, and the plan does not say how to read them.**
- Where: Tasks 4, 15, 23.
- Evidence: `ReportRunCreateParams.parameters.timezone` "Defaults to `Etc/UTC`. The output timezone for all timestamps in the report" (`ReportRuns.d.ts`, line 94). Task 15 picks a fee's month from `incurredAt`, and Task 23 picks it from the balance-transaction time, both kept as text. `Date.parse` reads a date-time with no offset as local time, which differs between Node and a Worker.
- Fix: send `timezone: "Etc/UTC"` explicitly in `startFeeReport`. Add `reportTimeMs(text)` in `fee-rows.ts`: Temporal `PlainDateTime.from(text)` in UTC, null when it cannot be read (then the row is `unreadable`). A red case for 2026-12-01 04:30 UTC, which is November in Chicago.

**S6. One negative fee row would stop the month from being final.**
- Where: Task 4 (`microCentsOf` refuses `-`), Tasks 15 and 23, Review Focus 4.
- Evidence: an unreadable row of the month blocks `finalizePeriod` until the code changes. Stripe's page lists `settled_via` values that include `credit` and `multiple`, and nothing in it rules out a negative row (a returned or credited fee). Such a row on 9 December makes the 10 December statement late.
- Fix: read a leading minus sign. A negative `payment` row lowers the payment's rounded-up total, posted as a negative `feeParts` (the same rule run the other way), or, more simply, is kept and shown under "Needs a person" without blocking. Keep blocking only for text that is not a number, or a currency that is not USD. Red cases for both.

**S7. A dispute decided long after it opened is never seen.**
- Where: Task 17 (`readReversals`).
- Evidence: disputes are listed with `created ≥` 40 days before the newest `StripeReversal`. A dispute can take more than 60 days to decide. Once any newer refund or dispute is stored, an older open dispute falls outside the window, so its `won` never posts, and the money it gave back never returns to the pool.
- Fix: each run also retrieves, by id, every dispute with a `chargeback_opened` row and no `won` or `lost` row. Add a red case: a dispute opened 70 days ago is won after a newer refund was stored.

**S8. Money carried from a month with no play is partly paid out as bringing bonuses.**
- Where: Tasks 7 and 21; the Call "the play part carries into the next month's pool".
- Evidence: `postPoolCarry` moves the carry into next month's pool account, and `allocateMakersPool` splits that whole pool by the next month's weights, bring keys included. So about half of a carried play part goes to makers who brought the next month's members, not to play. November 2026 is that month: the only game at launch is free (design 6), so all of November's play part carries into December.
- Fix (a question for the coordinator and the Owner, with a recommendation): (A, recommended) keep the carry apart in `MemberMonth` terms. `sharePool` adds it to the idle total, so it is shared by play only. (B) Accept it as written, and say so on `/split`.

**S9. The odd cent goes to makers, which takes it from Ruken's half.**
- Where: Task 2 ("gives makers the odd cent, as the carried rule does"), Review Focus 17.
- Evidence: `pct` rounds half up. On 927 cents left, makers get 464 and Ruken 463. Design 6 says "Ruken's half is never reduced to pay makers", and Review Focus 17 says "Ruken's revenue is never less than its half". That is false by half a cent on every odd payment.
- Fix: round the makers' half down (`left / 2n`), and change the two Task 2 and Task 3 numbers it moves. Or keep the carried rule and remove Review Focus 17's claim. This is a Call the Owner can overrule; recommend rounding down.

**S10. The Owner's step M1 is PowerShell; the Owner works on a Mac.**
- Where: "Where execution stops", M1 and the preface ("Each line is one command for Windows PowerShell").
- Evidence: `progress.md` (slice 2) says the Owner's commands are sent "for the Owner's Mac (zsh)", and the coordinator's brief asks for Mac zsh one-liners with no checkout assumed.
- Fix: M1 step 1 and step 2 become:
  `read -rs "s?JOBS_SECRET: "; echo; curl -sS -X POST -H "Authorization: Bearer $s" https://SITE/jobs/money; echo; unset s`
  This needs no checkout. SITE is the site's public address and can be written in the plan. M2 stays a website step: no command turns Connect on.

**S11. The dates rest on steps that the plan asks for late.**
- Where: "The dates", M1, M2, "What this plan relies on".
- Evidence:
  - Execution starts only when slice 4 is merged and green, and slice 4 has no plan.
  - Branches A to D are 23 tasks of two pushes each, and must land before 10 December.
  - M1, the first real read of Billing and Tax rows, is asked only after branch C is merged, days before 10 December. If those rows are `unplaced` (B3), the Owner's decision comes too late.
  - M2 (Connect's platform setup, which Stripe reviews) is asked when branch D starts.
- Fix:
  - Ask for M1's discovery now. The Owner downloads Reports → All fees → Itemized for November so far from the dashboard (a website step: no Stripe CLI is assumed) and sends only the `product`, `feature_name`, `incurred_by_type` and `settled_via` columns.
  - Ask for M2 now.
  - Name the latest day slice 4 must be green for the dates to hold (1 December at the latest), and ask the coordinator whether branches A and B (pure functions and tables, nothing of slice 4) may start before it if slice 4 slips.
  - Slice 4's plan must name the fresh-code check and the two superadmins (the coordinator's answer).

### Notes

**N1. Staff who are not game staff count as members when they pay.** Slice 2 records `staff` only for `owner`, `head_curator` and `curator` (`GAME_STAFF_ROLES`); a `finance`, `support` or `moderator` staffer with a membership plays as `member`. The agreement excludes "staff play". Ask the coordinator whether that is staff play. If yes, `rollUpPlayDays` skips users with any `StaffAssignment`, read on the day.

**N2. The report's interval limits.** `ReportRuns.d.ts` says `interval_start` is "1 second after `data_available_start`" and `interval_end` "1 second before … `data_available_end`". Task 14 asks for the exact ends. Read it once in test mode, as Task 24 does for Connect's error, and clamp by a second if Stripe refuses.

**N3. The first stretch asks for everything since the account began.** If Ruken's Stripe account is older than the site, the first run stores years of rows, and "Needs a person" lists them as unplaced for 62 days. Start the first stretch at the oldest `MembershipPayment.paidAt` less one day, never before `data_available_start`.

**N4. The admin screen shows code names.** "The daily job reported a problem on 9 December 2026: readReversals." Give each step a name in words ("reading refunds and chargebacks from Stripe") in `daily.ts`, and show those.

**N5. Test helpers' shapes.** Slice 2's `addGame` takes a `browser`, not a `page` (slice 2 plan, Task 30). Task 25 calls `addGame(page)`. `signInAsStaff` grants `curator`, so Task 32's `finance` staff need `grantStaffRole(email, "finance")`.

**N6. The first payout depends on the Owner's legal texts.** Connect in live mode waits for the lawyer's maker agreement and the privacy text ("What the Owner holds"). Task 37 step 5 expects payouts on 15 December regardless. State there that, without the texts, makers see "Payouts aren't open yet", their money carries, and that is not a failure of the slice.

**N7. Write the answers in.** The follow-up pull request should move the three questions from "Asked … not yet answered" to answered, with the words above. It should delete the answer-A text in branch G's preface and in Tasks 24 and 25, and the conditions in branch E and branch G's "Does not start before…".

**N8. The `/split` page's five sentences are written before the agreement exists.** Task 34's test makes the page match paragraph 5 of the file, so the file wins. The plan's five lines are a placeholder until the coordinator supplies the text, and the plan should say so.

**N9. A balance below zero.** A correction (S2) can leave a maker owing. `/make/money` would then read "You're owed −$0.10". Words for that case: "Nothing is owed right now. Stripe's charge was 10¢ more than we held back; it comes off your next earnings."

**N10. Fees paid with Stripe's credits.** A row with `settled_via: credit` cost Ruken no money. Taking it off the top lowers the makers' half for a fee nobody paid. Ask the Owner whether credit-paid fees come off the top. Until then, treat them like `counted`.

**N11. A test-mode site.** "Certain report types require a live-mode API key." A deployment on a test key would fail `requestFeeReport` every day, and the worker would mark every run failed. If any such deployment exists, skip the two report steps when `stripeKeyMode` is `test`, and say so in the report.

## What was checked and found right

- **Money rules against agreement paragraphs 5 and 6 and design 6:**
  - tax and every Stripe fee come off the top, per payment;
  - half and half;
  - the bonus is half of the member's part, for the first join's month and the eleven after it, never for yourself and never for a later join (Task 5);
  - the rest goes by play, capped at 10,800 seconds per member, game and day, by the Chicago day;
  - free, staff (see N1) and own-game play are excluded through slice 2's `PlayBasis`;
  - final on the 10th; paid on the 15th or the next business day;
  - the $25 minimum is checked before the cost, and smaller amounts carry;
  - the cost is held back from the payout (but see S2 and S3).
- **Payouts and bonuses come only from the makers' half.** Bonuses are weights inside `allocateMakersPool` over the pool account. Transfers debit `maker:<id>:payable` only. Nothing credits a maker from `platform:revenue:premium`.
- **Rounding never pays more than exists.** `lrr` shares the pool to the cent. `payoutCost` never sends more than is owed. `Payout_amounts_check` and `Payout_amount_only_down` guard the table.
- **Every worked number was recomputed by hand and is right:**
  - Task 2: 463, 464, and the yearly 397 × 5 + 396 × 7 = 4,757.
  - Task 3: 1,020 / 61 / −82 / −469 / −530, and `feeParts` 6/6, 0/1, 0/5.
  - Task 7: 232/154/77, 309/154, 200/600, 232/231, 463 carry, and 116/77/39.
  - Task 15: 7 + 5 cents from 0.06993 + 0.04995, the pool to 463.
  - Task 28: 2,269/231 and 3,885/235; Task 33's 7,755/245 and $116.40; Task 27's $38.85/$2.35.
  - The split page's $9.26, $4.63, $2.32, $1.54, $0.77; Task 32's $4,453.72 − $337.84 − $289.10 = 2 × $1,913.39 and $310.20 + $1,603.19.
- **Dates in America/Chicago:**
  - `periodOf` and `startOfDayMs` at 06:00 and 05:00 UTC;
  - close at `2026-12-08T06:00:00Z`;
  - 15 May 2027 is a Saturday, and 15 February 2027 is Washington's Birthday;
  - 14 March and 7 November 2027 are the clock-change Sundays;
  - 15 December 2026 is a Tuesday;
  - the job at 09:17 UTC (`wrangler.jsonc`: `17 9 * * *`) is the small hours in Chicago.
- **Stripe, against `stripe` 22.6.2 and Stripe's page:**
  - the report type `all_fees.balance_transaction_created.itemized.2` exists;
  - all thirteen `FEE_COLUMNS` are its columns (`balance_transaction_id`, `balance_transaction_created`, `fee_transaction_id`, `incurred_by`, `incurred_by_type`, `incurred_at`, `product`, `feature_name`, `fee_description`, `amount`, `tax`, `currency`, `settled_via`), with `amount` and `tax` in major units;
  - "within 96 hours" is quoted right;
  - `reportRuns.create` takes `report_type` and `parameters.{interval_start, interval_end, columns, timezone}`;
  - `reportTypes.retrieve` answers `data_available_start` and `data_available_end`;
  - a run has `status` and `result` (a File);
  - `refunds.list` and `disputes.list` take `created`, and a dispute has `balance_transactions`;
  - `transfers.create` takes `transfer_group`;
  - `accounts.createLoginLink` exists.
- **The month closing on the 8th** leaves room for the report's lag, even with collection a day after the request: a fee on a 30 November payment is on the balance by 2 December (standalone fees: 36 hours), in the data by 6 December, requested on that day's run and stored by the 7th's.
- **Slice 1 and slice 2 interfaces on `main` or in slice 2's plan, by name:**
  - `MembershipPayment` (with `cardFeeCents` only the card fee, as its comment says);
  - `MembershipStart` with `broughtByUserId`;
  - `membershipServices`, `createStripe`, `stripeKeyMode`;
  - `dollars`, `longDate` (exported by `membership.ts`);
  - `reject_append_only_change`;
  - `Clock`, `systemClock`, `CALENDAR_ZONE`, `chicagoDayOf`, `TestClock`, `startTestDatabase`, `requireEnv`, `optionalEnv`, `hasJobSecret`, `prisma()`;
  - `purgeDueAccounts`, which keeps the `User` row;
  - `Game` (`makerUserId`, `name`, `slug`, `publicId`);
  - `StaffRole` with `owner` and `finance`;
  - `Caller.staffRoles`, `RateLimiter`;
  - `invoiceCardFee`'s walk (`subscription.ts`);
  - `cloudflare/worker.js`'s knock on `/jobs/purge-accounts`;
  - slice 2's `PlaySession`, `PlayBeat`, `PlayBasis`, `countedMs`, `LONGEST_COUNTED_GAP_MS`, `staffOnly`, `GAME_STAFF_ROLES`, `addGame`, `signInAsStaff`;
  - slice 3's `RESERVED_HANDLES` holds `split`.
  - `MembershipServices` does not hold `stripe` today; Task 13 adds it, as it says.
- **No new package:** CSV, decimal parsing and Temporal are covered without one, and `money` is already in `FEATURE_ORDER`, between `play` and `pages`.
- **Drunk-grandma accounts:** every maker screen (`/make/bank`, its four cards; `/make/money`; a statement; the question box) has one card, one action and words beside every number, apart from S3 and N9. The staff screens apart from N4. `/split` apart from N8.
