# Slice 5 (money), branches A to D: implementation audit

Stage 5, 2026-11-14. Audited `main` at `2e75bb3` (branches A to D merged as #80, #82, #83 and #84), and the refund-weight follow-up on `slice-5/refund-weight` at `88ee7d8` (pull request #86, which was still open, not merged, when this was written). It was read against design section 6, the slice 5 plan, its plan audit, `progress.md`, CLAUDE.md and AGENTS.md.

How it was checked: by reading every file in `src/features/money/`, the four money migrations, `prisma/schema/money.prisma`, the job route and the Worker's cron, and the names of the tests. No test, lint or typecheck ran here (CLAUDE.md: no local tests). The numbers in B1 were worked by hand from the code's own rules. No code was changed.

Counts: **1 blocks**, **4 should fix**, **12 notes**.

## Blocks

**B1. If a yearly payment is refunded before Stripe's later fee for it arrives, releases stop for that payment and for every yearly payment after it, every day.**

- Where: `src/features/money/fees.ts:197-201` and `:205-215`, `src/features/money/releases.ts:41-47` and `:82-91`, `src/features/money/reversal-posting.ts:150-161`.
- What happens, worked by hand. A $99 yearly payment, no tax, card fee 317 cents:
  - The makers' half is 4,791. Month 1 gets 400 and 4,391 goes to `premium:deferred`.
  - The member gets a full refund on day 2. The refund cancels all 4,391 still deferred (`reversals.ts:201-206`), so the payment has nothing left in deferred.
  - Stripe's Billing fee (about 70 cents) reaches the Fees report up to four days later. `postFeeEntry` works out each month's part with `feeParts` (35 cents from the makers' side). For every month that has not been released, it takes that part from `premium:deferred` (`fees.ts:199-201`). It takes 32 cents that this payment no longer has there. The account is shared by every payment, so nothing refuses it.
  - When month 2 opens, `releaseMonth` recomputes the parts with the fee included. The later months now add up to 4,359 cents, but 4,391 was cancelled. `cancelledMonths(parts, 4391)` throws "A chargeback can't cancel more than the payment deferred" (`reversal-posting.ts:160`).
  - That error escapes `releaseDueMonths`, which handles every yearly payment in one loop (`releases.ts:41-47`). So every yearly payment posted after this one is never released either. The same happens on every run, because the fee and the refund never change.
- What it costs:
  - Those members' months stay in `premium:deferred`, so their months' pools are made final short.
  - Meanwhile `membersOf` still counts those members' full weight.
  - The job reports the problem every day until the code changes.
  - Apart from that, a fee on a refunded payment still comes out of the makers' pools, and 32 cents of other payments' deferred money is used up.
- How likely: a refund in the first days after paying is the most common kind. A full chargeback in that window does the same.
- Not tested: `releases.pg.test.ts` and `fees.pg.test.ts` have "fee after payment" and "chargeback before release", but no case with a refund before a late fee.
- Fix (for the fixes stage):
  - Under the lock, a later fee should take from deferred only what is still set aside for that payment's months. This can be read the same way `reversals.ts:201-206` reads `deferredLeft`. What it cannot take from deferred should come from the open pool and from Ruken, like the rest of the fee.
  - `releaseMonth` should not fail all payments because of one. Either catch per payment and report it, or make `cancelledMonths` stop at what the parts allow.
  - Red cases: a full refund and then a Billing row; another yearly payment posted after it is still released.

## Should fix

**S1. A month is made final even when that day's run could not add up play, post payments, release months or post refunds.**

- Where: `src/features/money/daily.ts:104-155`. Only "closing the month" has `blocksTheRest`; "making the month final" runs after any other step fails. `src/features/money/finalize.ts:34-72` checks only the date, the order of months and unreadable fee rows.
- Evidence: `rollUpPlayDays` stops at the first day that throws (`play-rollup.ts:35-38`). If it throws on the run of the 10th, or has been failing since the 25th, `sharePool` shares the month on the `PlayDay` rows that exist. Members with missing days follow other members' play, or the money carries forward. The statements are then final. A failed release (B1) or a failed payment posting leaves the pool short in the same way. The test "carries on after a step that fails" (`tests/features/money/daily.pg.test.ts:86`) shows this is what the code is meant to do. No test shows a month staying open when play is missing.
- Fix: `finalizePeriod` refuses, in the step's own words, unless every day of the month has a `PlayDayRun`. The cheapest wider version is that "making the month final" does not run in a run where any step before it failed. Add a red case: the rollup fails on the 10th, and the month stays closed.

**S2. The "a final month takes no entry" rule can be got round with lines.**

- Where: `prisma/migrations/20261114140000_ledger/migration.sql:135-147`. The check `JournalEntry_open_period` is on `JournalEntry` only.
- Evidence: a pair of lines that add up to zero, inserted under an old entry of a final month, passes every trigger. `JournalLine_balances` sums the entry, and the entry still balances. No check looks at the period of the entry a new line belongs to. No code in the repository does this today, but the design's add-only guarantee (and the schema comment at `money.prisma:11`) says the database refuses it.
- Fix: a `BEFORE INSERT` trigger on `JournalLine` that refuses a line whose entry's period is final. It could go further and refuse any line whose entry was not made in the same transaction. Add one `schema.pg` case.

**S3. Stripe's secret key is sent to whatever file address the API answers with.**

- Where: `src/features/money/stripe-port.ts:183-187`, ruling (1) of branch C (`bindMoneyStripe` takes the key).
- Evidence: `readFeeReport` sends `Authorization: Bearer <secret key>` to `run.result.url` without checking the address. The address comes from the API whose base can be changed by `STRIPE_API_BASE`, which is set for the test stand-in. One wrong setting or one unexpected answer would hand the live key to another host.
- Fix: send the key only to `https://files.stripe.com/` when `STRIPE_API_BASE` is not set, and only to the stand-in's own host when it is. Add a unit case for a URL on another host.

**S4. The tracker says the wrong thing about slice 5.**

- Where:
  - `docs/superpowers/progress.md:17` says branch A is merged, "nothing else started", at 22%.
  - `:388` says "Branches and tasks (none started)".
  - `:402` says B is "ready to merge".
  - `:407` and `:418` say C and D are drafts.
- Evidence: `main` holds the merges of #82 (`d02ff70`), #83 (`c6b652d`) and #84 (`4848d9f`), which is 23 of 37 tasks (about 62%). CLAUDE.md: "'Done' means merged to main and green there… Never round up". It is also wrong the other way here: three merged branches are reported as not merged.
- Fix: the fixes stage updates those lines, including that no separate run on `main` exists for the merge commits, as was said for A.

## Notes

**N1. Q6, as built on #86, reads refunds as they stand when the month is made final, not when they happened.** This is said once, with the facts. The Owner's rule is not reopened.

- Where: `src/features/money/pool-run.ts:61-77` and `:119-132` on `slice-5/refund-weight`.
- (a) A refund made between the 1st and the 9th of December takes the member's November weight to nothing. The refund money comes out of December's pool (`reversals.ts:207`, the open month), not November's. So November's pool still holds that member's money and shares it by other members' play, and December's pool pays for the refund.
- (b) For a yearly payment, the weight is cut evenly over every month. The money is cut from the latest months first (`reversal-posting.ts:150-161`). After a half refund, months 2 to 6 hold the member's full part but weigh half. Months 7 to 12 hold nothing but still weigh half.
- Both follow the formula the Owner chose ("contribution × (gross − refunded or disputed) / gross"). Whether a refund's date should matter is the Owner's question, if they want it.

**N2. The minutes on a statement include play that earned nothing.**

- Where: `pool-run.ts:176-181` on main (`:211-214` on #86).
- `PoolShare.seconds` adds up the play of every member in `members`, including one whose weight is 0: a full refund under #86, or fees larger than the payment. A maker's statement (`statement.ts:122`) shows those minutes.

**N3. The bringing bonus counts Chicago months, not twelve months from the join.**

- Where: `bringing.ts:30`.
- It covers the month of the first join and the eleven after it, so a member who joins on 30 November brings their maker one day of November and eleven months after. This is the approved plan's wording (plan line 97). The design says "for a member's first 12 months". It is for the Owner to say if that is what they meant.

**N4. Two joins at the same moment are broken by database order.**

- Where: `pool-run.ts:67` (`findMany` with no `orderBy`) feeding `bringerOf`'s "the one given first" (`bringing.ts:20-25`).
- It is very unlikely. An `orderBy: { id: "asc" }` would make it certain.

**N5. Two database guarantees hold only because every writer takes the ledger lock first.**

- Where: the triggers `StripeFeeRun_no_overlap` (`20261114160000_fee_run_retry/migration.sql:7-24`) and `JournalEntry_open_period`.
- Both check and then insert under READ COMMITTED. Two transactions that skipped `lockLedger` could both pass. Every caller in the repository does take the lock (`fee-report.ts:105`, `finalize.ts:59` and the others).
- An exclusion constraint (`btree_gist`), or locking the `LedgerPeriod` row in the trigger, would make the database the guarantee. The add-only triggers also do not cover `TRUNCATE`.

**N6. Two runs at once can each start a Stripe report.**

- Where: `fee-report.ts:77-115`.
- `requestFeeReport` asks Stripe for a run before it takes the lock. Two runs at the same moment (the cron and a person by hand) both start one. The second insert is refused by the overlap trigger, so that run reports a problem under "asking Stripe for its fee report", and a Stripe report run is left unused. Nothing is posted twice.

**N7. Edge cases in reading refunds.**

- Where: `reversals.ts:25-26` and `:101-114`.
- A refund kept `pending` until more than 40 days past the newest reversal is never read.
- A refund that Stripe later marks failed stays a `refund` fact. Stripe returns that money to the balance, but the books never get it back.
- Both are rare for cards.

**N8. A fee row that names nothing is looked at again for only 62 days, then dropped without a word.**

- Where: `fees.ts:54` and `:66-67`.
- Branch H's "Needs a person" list (plan line 1498) shows unplaced rows of the last 62 days only. A payment stuck as `NotAtStripeYet` for longer would lose its later fees, and its makers' pool would not pay them.

**N9. Until branch H lands, nothing in the code notices missing Billing or Tax rows.**

- The plan audit's B3 check ("`<n>` payments have had no fee from Stripe's Billing for 10 days") is Task 32 (plan line 1498), in branch H. The first statement is final on 10 December, before H is due (15 December).
- Until then M1, which is still open in `progress.md`, is the only guard against Ruken's half quietly paying Billing and Tax.

**N10. The $25 minimum is not in branches A to D.**

- What is in A to D: the carry-forward of what a maker is owed (`statements.ts:27-31`, and the "$24.99" case in `statements.pg.test.ts:106`).
- What is not: the minimum itself. `PAYOUT_MINIMUM_CENTS` (`rules.ts:11`) is used only by `rules.test.ts` until branch G. That is in the plan, but by CLAUDE.md's "Build nothing ahead of its user" it is a constant with no user yet.

**N11. Making a month final runs in one 120-second transaction inside the Worker's request.**

- Where: `finalize.ts:26` and `:57-71`.
- The cron starts it (`wrangler.jsonc:20`, 09:17 UTC, which is 03:17 or 04:17 in Chicago). How long it takes at real size has not been measured.
- If the job fails on the 10th, the month becomes final on the next day's run. The design's "final on the 10th" would then slip by a day, and nothing tells the Owner except the Worker's failed run.

**N12. The deviations the sessions reported, checked for risk.**

- **Hand-written migrations** (B ruling 1, C, D): CI's drift check proves the Prisma-shaped parts. The CHECKs and triggers are proved by `schema.pg.test.ts`. Low risk. See S2 and N5 for the gaps the triggers leave.
- **The `StripeFeeRun` overlap trigger** (C ruling 2): it is correct while `lockLedger` is held (N5). Failed runs may overlap, as intended. `StripeFeeRun_forward_only` stops the interval columns from changing.
- **`bindMoneyStripe` takes the key** (C ruling 1): it is needed, because the file needs the key. See S3 for the address check.
- **Prettier run from outside the repository** (C ruling 8): it is the same version the repository pins (`package.json:36`, `"prettier": "3.9.9"`), so it formats exactly as CI checks. No risk to the code. It does stretch "no new tool".
- **Re-entrant lock** (D ruling 2): `pg_advisory_xact_lock` is re-entrant within one session. A Prisma interactive transaction keeps one connection, so `writeStatements` locking again inside `finalizePeriod` is safe.

## What was checked and found right

- **Whole cents and rounding.** All amounts are `bigint`, and no float touches money.
  - `poolContributions` (`pool-share.ts:37-53`) rounds the makers' half down, so the odd cent stays with Ruken (Owner, 2026-11-14).
  - The twelve months' odd cents go to the earliest months, through `lrr`'s key order.
  - `lrr` (`arithmetic.ts`) shares out exactly the total, with ties broken by key, so the order rows arrive in does not matter.
  - The chargeback cost's makers' half rounds half up. That is the carried rule, and the odd cent of a cost lands on the makers' side, never on Ruken's half.
- **Fees off the top before the split.**
  - The card fee is taken at posting (`payments.ts:73-79`).
  - Billing and Tax fees are taken from Stripe's Fees report (`fees.ts`). The fractions of a cent are added up per payment and rounded up once (`fees.ts:155-158`).
  - `feeParts` takes from each month exactly what it would have given up had the fee been known at posting, and Ruken takes the rest.
  - The card fee is not taken twice, because a row on the payment's own balance transaction is `counted`.
  - Credit-paid fees are skipped (Owner, "No, skip them"). Returned fees are kept and never posted.
- **The yearly spread.** One twelfth goes to the first month and eleven are deferred, released when each month opens (`releases.ts`).
  - A release is never taken back.
  - A month missed is released into the open month.
  - A won dispute's restored months are topped up under `:2`.
  - This all holds apart from B1.
- **The bringing bonus.**
  - It is half of the member's part before play is shared, from the first `MembershipStart` only.
  - There is none on yourself and none without a maker (`bringing.ts`).
  - Carried money is shared by play only and never feeds a bonus (`makers-pool.ts:64` and `:108`; Owner, "Only by play").
- **The 180-minute cap.** It applies per member, per game, per Chicago day, after two tabs are joined into one (`play-day.ts:47-68`).
  - A day is midnight to the next midnight in Chicago, so 23- and 25-hour days are whole days (`calendar.ts:213-215`).
  - The rollup reads sessions started up to 24 hours before the day's own start (`play-rollup.ts:73`; the plan audit's B2 is fixed).
  - It is tested for both clock changes (`play-day.test.ts:89`, `:104`; `play-rollup.pg.test.ts:175`).
- **What never counts.**
  - Only `member`-basis sessions count. `playBasis` (`src/features/play/may-play.ts:19-29`) gives a maker's own game, staff and free games their own basis.
  - Anyone with a staff assignment is also left out at rollup (`play-rollup.ts:74`).
  - Beta builds and free codes do not exist on `main` yet. Their plans must keep them off the `member` basis.
- **Refunds and disputes.**
  - The payment is undone in proportion, with its later fees (`reversals.ts:195-199`).
  - Deferred months are cancelled first, latest first.
  - What Stripe keeps is shared half and half.
  - A won dispute reverses the opened entry into the open month.
  - Standing disputes are read again by id (the plan audit's S7).
  - A lost dispute posts nothing more.
- **Statements.**
  - `owed` is the journal balance through the month.
  - `broughtForward + earned + sent = owed`.
  - Canonical JSON and its hash mean the same input gives the same bytes.
  - A statement is written once.
- **The ledger.**
  - Entries balance at commit (deferred constraint triggers).
  - Add-only triggers are on every fact table.
  - Months only move open, then closed, then final.
  - A repeated key with the same lines posts nothing, and with other lines it is refused (`journal.ts:83-113`).
  - Every writer takes `lockLedger`.
- **The daily job.**
  - It runs in a fixed order, and facts are read before closing.
  - Closing on the 8th and making final on the 10th happen at Chicago midnight (`periods.ts`, `finalize.ts`).
  - Months go in order, and each month is made final once.
  - A second run posts nothing ("does nothing the second time", `daily.pg.test.ts:66`).
- **The clock.** No domain code calls `Date.now()`. Every job takes `deps.clock`.
