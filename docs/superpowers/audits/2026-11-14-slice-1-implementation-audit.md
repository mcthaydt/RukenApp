# Slice 1 implementation audit (accounts and membership)

Date: 2026-11-14. Stage 5. Audited: `main` at `e328675` (branches A, B, C, D, L, E0, E, F, G, H and the Hyperdrive id, all merged). Read against `CLAUDE.md`, `AGENTS.md`, the design (`docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`), the plan (`docs/superpowers/plans/2026-11-13-slice-1-accounts-membership.md`), the three slice 1 plan audits and `progress.md`. No test was run in this session (CLAUDE.md); the code was read, and CI's own records were read through the GitHub API.

## Conclusion

Slice 1 is built as planned and is green on `main`: the last run on the up-to-date paywall branch, run 193 (id 43549286645, on `11fcc18`, whose tree is `main`'s), passed `verify`, `postgres` and `browser`. Every task from 1 to 30 and 32 to 37 is in the code, each Review Focus line has its test but one (finding 6), and the money rules hold: cents are `bigint`, payment and membership-start rows are added only (a trigger refuses UPDATE and DELETE), nobody types an amount, domain code reads time only through the injected clock, and money days are Chicago days.

Nothing found blocks launch. Five things should be fixed before the site takes money, and one more is a test gap:

- a deleted person's email, name and billing address stay in Ruken's database for ever, inside the stored Stripe events (1);
- a member whose card failed more than seven days ago is bounced off the paywall card with no word, which becomes a loop once slice 2's Play sends people there (2);
- a cancellation Stripe records only as `cancel_at` would show on `/me` as "Renews on …" (3);
- the S1 steps let the first deploy happen before S2, and the plan still says S2 comes before branch H merges in four places (4);
- `progress.md` says branches are open or in progress that merged hours ago (5);
- Review Focus 6's "payment rows stay after the daily job" has no test (6).

Counts: **0 block launch, 6 should fix, 9 notes.**

Still open, not defects: Task 20 step 3 (the schedule on the real Worker) and Task 31 (paying and cancelling on the real site) need the live site; the domain is bought by 18 November. Also open: Task 16 steps 5 and 6 (the first deploy, `/healthz`, a real sign-up), for the same reason.

Today's Owner decisions are decisions, not findings: the paywall card over the clip in later slices (design 5.2, 5.8); the Wada palette and 12px buttons (on `slice-1/wada-palette`, #42, so the token values in `look.css` still being the Card Table's is expected); S2 before the first deploy, not before H merges; Google sign-in after launch.

## Findings

### 1. A deleted person's email, name and address stay in the Stripe events Ruken keeps

Severity: **should fix**.

- Where: `src/features/membership/inbox.ts:26-47` (`storeStripeDelivery` keeps the whole event), `src/features/accounts/deletion.ts:97-138` (`purgeDueAccounts`).
- What is wrong: every verified Stripe event is stored whole in `WebhookInbox.payload` (`JSON.parse(JSON.stringify(event))`). A `checkout.session.completed` event carries `customer_details` (email, name, billing address); an `invoice.paid` event carries `customer_email`, `customer_name` and `customer_address`. The daily job removes the person's email, password, sessions and mail links and turns the `User` row into a tombstone, but never touches `WebhookInbox`, so the same email, name and address stay in Ruken's own database after the account is "deleted". Billing address collection is required at checkout (`checkout.ts:157`), so every member's address is in there.
- Evidence: the Owner's decision (progress.md, 2026-11-13): "a scheduled job removes the data afterwards"; the plan's own rule for Task 20: "Each later slice that adds a person's data adds its own removal here, with a test." Branch G added `WebhookInbox` after branch F's purge and added no removal. `tests/features/accounts/purge.pg.test.ts` has no case with an inbox row. (The Stripe customer itself staying in Stripe is already on the plan's "worth the Owner's eye" list; this is Ruken's own copy.)
- Fix, test first: either store only what the handlers and slice 5 read (the event's `id`, `type`, `created`, `livemode` and the object's ids and amounts), dropping the person's details before the row is written; or have the purge clear the personal fields of the inbox rows that name the person's subscription or customer. The first is smaller and keeps nothing to forget later. A `purge.pg.test.ts` case (or an `inbox.pg.test.ts` case, for the first fix) shows no row holds the deleted person's email afterwards.

### 2. A member whose card failed more than seven days ago is bounced off the paywall card with no word

Severity: **should fix** (before slice 2's Play button sends people to `/join`).

- Where: `src/routes/join/+page.server.ts:35` and `:67`, `src/features/membership/service.ts:176-179`.
- What is wrong: for a `past_due` membership past its seven days, `premiumAccess` answers false, so `/join` shows "Join Ruken to play" and "Continue to payment". Pressing it, `startCheckout` finds a membership that has not `ended` and throws `ALREADY_MEMBER`, and the action redirects to `next` with nothing said. From `/join` alone that lands on `/`. From slice 2's Play (`/join?next=/g/<game>/play`) the game page sends a non-member back to `/join`: the person goes round in a loop, and is never told their card failed or where to fix it. The same silent bounce happens to a `canceling` member in the moments after their period ends and before Stripe's `customer.subscription.deleted` arrives.
- Evidence: design 5.2 and the drunk grandma test ("a plain way back when something fails"); `membershipLine` already has the right words for `/me` ("We couldn't charge your card, so your membership is paused. Update your card to play again.") but `/join` never shows them.
- Fix, test first: `/join`'s `load` asks for the whole `view` rather than `isMember`; when the state is `past_due` and the person is not a member, the card shows `/me`'s paused line and one plain "Update card" button that opens Stripe's portal (the same `portal` action `/me` has, returning to `next`), instead of the price and "Continue to payment". A journey cannot reach `past_due` (the stand-in has no failing card), so cover the choice with a unit case on whatever pure function picks the card's content, as Task 30 did with `membershipLine`. For the `canceling`-past-its-end moment, the action can say "Your membership has just ended. Try again in a minute." rather than redirect.

### 3. A cancellation that Stripe records as `cancel_at` reads as "Renews on …"

Severity: **should fix** (cheap; confirm against Stripe in Task 31 step 2).

- Where: `src/features/membership/reducer.ts:84` and `:98`; `src/features/membership/service.ts:135-136`; `src/features/membership/format.ts:25-28`.
- What is wrong: the reducer makes a membership `canceling` only when `cancel_at_period_end` is true. A running subscription with a future `cancel_at` and `cancel_at_period_end: false` is stored as `active` with a `cancelAt`; `view` then gives `renewsAt` and no `endsAt`, and `/me` says "You're a member. $9.99 a month. Renews on …" to someone who has cancelled. Recent Stripe API versions can express "cancel at the end of the period" as `cancel_at` (the `min_period_end` and `max_period_end` options), and the portal's behaviour on the pinned version `2026-08-26.dahlia` was not checked by the plan, by its audits, or by me (no network read of Stripe's changelog here). The stand-in sets both fields (`tests/browser/support/fake-stripe-server.ts:543-544`), so CI cannot tell.
- Evidence: the code paths above; design 8 "A member can cancel", which the Owner checks on the real site.
- Fix, test first: a `reducer.test.ts` case for an `active` snapshot with `cancelAtMs` set and `cancelAtPeriodEnd` false, expecting `canceling`; then `state: snapshot.cancelAtPeriodEnd || snapshot.cancelAtMs !== null ? "canceling" : "active"`. Task 31 step 2 then confirms on Stripe's real portal that `/me` says "Your membership ends on …".

### 4. The first deploy can happen before S2, and the plan still says "S2 before H merges"

Severity: **should fix** (in the plan and the Owner's steps, before S1 part two is sent).

- Where: the plan's "Where execution stops", S1 step 9; plan lines 138, 1784 (Task 21's first line), 2257 (Task 30 step 2) and 2263 (Task 31 step 1).
- What is wrong: the coordinator's decision of 2026-11-14 is "S2 before the first deploy". S1 step 9 (connect the Worker to the repository) can start a build of `main` at once, and the plan says so ("if connecting starts a build at once…"). `main` now holds branch H, so a deploy without S2's three secrets answers 500 on `/me`, `/me/delete`, signed-in `/join` and `/webhooks/stripe`: `createMembershipServices` refuses to start without `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_LIVE` (`src/features/membership/services.ts:85-90`), and `/me`'s `load` asks it (`src/routes/me/+page.server.ts:21`). S2 itself needs S1 step 6 (the Worker, for its secrets) and the site's address (the webhook endpoint), so the order that works is S1 steps 1 to 8, then S2, then S1 step 9. Separately, pull request #37 changes S2's heading but leaves the four plan lines above saying H waits for S2, which now contradicts both the tracker and what happened (H merged without S2).
- Fix: in the plan, S1 step 9 starts "Only after S2 is done:", and the four lines are brought in line with #37 (done on #37 or right after it). No code changes.

### 5. `progress.md` says merged branches are open or in progress

Severity: **should fix** (tracker; "Report what you ran … Never round up", and "the coordinator keeps the session list true").

- Where: `docs/superpowers/progress.md`, slice 1.
- What is wrong, as of `main` at `e328675`:
  - the slice table's row 1 says "Branch L (the look, tasks 35 to 37) in progress" and 40%, though A to H are merged;
  - the branch table says A "in progress … ready for review", B "done on its pull request (#14), not yet merged", L "in progress (second execution session)", E0 "done on its pull request (#31), not yet merged", G "done on its pull request (#26), not yet merged", F and H "not yet merged" / "in progress" (#37 corrects F and H only);
  - the stage list leaves "Plan audit of the Cloudflare revision" and "Plan audit of the look" unticked, "on a branch … not done until merged", though both merged (#19, #23);
  - the session list has both execution sessions "running" and the plan audit row's wording for slice 1 stale;
  - "The look fixes" item is unticked though the Owner said "fine" and L merged (#25);
  - "Overall: 7%".
- Fix: the coordinator (or the fixes stage, in its first commit) sets each row from the merge commits: A #13, B #14, C #18, D #21, L #25, E0 #31, E #33, F #35, G #26, H #36, the id #38. This audit only updates the stage list's "Implementation audit" line.

### 6. Review Focus 6 has no test for "the payment rows stay after the daily job"

Severity: **should fix** (test gap; the behaviour is right today).

- Where: `tests/features/accounts/purge.pg.test.ts` (five cases, none with membership rows).
- What is wrong: Review Focus 6 says the payment rows stay "also after the daily job has removed their details (Task 20, Task 30)". Today the purge only updates the `User` row, and `MembershipPayment`, `MembershipStart`, `PremiumMembership`, `BillingCustomer` and `CheckoutIntent` all reference `User` with `ON DELETE RESTRICT`, so they stay. Nothing pins that: a later slice that makes the purge delete the user, or delete the person's rows, fails only at run time on the append-only trigger, inside the daily job.
- Fix: one `purge.pg.test.ts` case: a member with a payment, a membership start and a membership row asks to be deleted, 15 days pass, the purge answers 1, and every one of those rows is still there and unchanged. It goes with finding 1's test.

## Notes

1. `src/features/membership/sync.ts:14` names "`reduceMembership` in @ruken/billing", the old repository's package. The plan's rule for carried files is to drop such references. Say "reducer.ts".
2. `src/features/.gitkeep` and `src/lib/.gitkeep` are left in folders that now hold files.
3. `src/features/membership/format.ts:34`: the `canceling` line with no end date reads "Your membership is ending. You can play until then." "then" points at nothing. The reducer always sets `cancelAt` for `canceling`, so it is not reached today; if finding 3 changes the reducer, make the line "Your membership is ending." or drop the branch.
4. Someone who signs in after their 14 days but before the daily job runs (a window of up to a day) signs in "successfully" and lands signed out with no words (`deletion.ts:70-87`, `handle.ts:46`). The plan accepts it; it fails the grandma test for that person. A line on the sign-in page ("This account is being deleted.") would cost a lookup on a failed state; leave it unless the Owner wants it.
5. `src/features/membership/stripe-port.ts:43-51` caches the price lookup's promise for the life of the Worker. If two checkouts start at once on a fresh Worker, the second awaits a promise whose Stripe calls belong to the first request; Workers can cancel those when the first request ends. Rare (the first seconds after a deploy) and the person can press again; caching the resolved ids only, not the pending promise, removes it.
6. `src/routes/me/delete/+page.server.ts:28-36`: if `endNow` succeeds and `requestDeletion` then fails, the membership has ended and the account is not deleted; the page says "Something went wrong". Pressing again works (endNow answers "none"). Acceptable; the order is the plan's.
7. `src/routes/webhooks/stripe/+server.ts:14` builds the membership services before checking the signature, so on a site with no Stripe settings an unsigned post gets 500, not 400. Harmless once S2 is done.
8. The placeholder home page offers a signed-in person no way on (`src/routes/+page.svelte:18-20`: "Sign in" is hidden and nothing replaces it). The feed replaces the page in slice 3 and the Owner said the account screens get no more polish, so nothing to do now; slice 3's plan should give a signed-in person a way to `/me`.
9. `/join`'s "Not now" always goes to `/` (the plan says so for this slice). Slice 2's plan should send it back to the clip the person tapped once there is one.

## The plan, task by task

| Task | In the code | Remark |
|---|---|---|
| 1 Prisma, accounts tables, Postgres in CI | yes | CHECKs and partial index in the migration; `postgres` job runs `pnpm test:pg` |
| 2 the clock | yes | `systemClock` is the only `Date.now()` in `src/` |
| 3 safeNextPath, settings, work after the answer | yes | changed by Tasks 32 and 33 as planned |
| 4 rate limiter, mailer | yes | mailer replaced by Resend (Task 32) |
| 5 to 8 sign-in rules, age, cookies, mails | yes | mail words as planned; pause mail has no "sign-in link" or "passkey" |
| 9 better-auth | yes | `status` additional field kept; `session.create.after` added back by Task 18 |
| 10 who sent this request | yes | non-`active` accounts are `none`; `/healthz` skips the lookup |
| 11 form actions, services | yes | words as planned |
| 12 to 15 screens | yes | `/me`'s confirm line is "Confirm your email. We sent you a link." (the Owner's look fix "the email printed once", 14 November) |
| 35 to 37 the look | yes | token values are the Card Table's; the Wada palette is #42 (Owner, 2026-11-14) |
| 32 to 34 Cloudflare | yes | one client per request; the Workers-wasm plugin; `wrangler dev` journeys |
| 16 deploy command | steps 1, 2 and 4 | steps 3, 5 and 6 wait for S1 and the domain |
| 17 to 20 deletion | yes | step 3 of Task 20 waits for the live site; findings 1 and 6 |
| 21 to 26 membership | yes | append-only trigger; arrival sealed and checked; findings 2 and 3 |
| 27 to 30 paywall | yes | one `pay` button; `refreshAll` for the deprecated `invalidateAll` (reported) |
| 31 real site | no | waits for S2, a deploy and the Owner |

## What I checked

- Every file under `src/`, `cloudflare/worker.js`, `wrangler.jsonc`, `.env.example`, the membership migration's hand-written SQL, and the CI and auto-merge workflows.
- The layer rule by reading: no test under `src/`; routes import features only through `accounts.ts` and `membership.ts`; `accounts` imports nothing from `membership`; `membership` imports `accounts` only through its entry.
- The AGENTS.md rules: money in `bigint` cents (`plans.ts`, `payments.ts`, `subscription.ts`, `format.ts`); ledger facts added only (the trigger on `MembershipPayment` and `MembershipStart`); nobody types a fact (prices from constants, amounts from Stripe, the arrival sealed by the server, no form field for either); the injected clock (only `systemClock` reads `Date.now()`, and the routes that need time take it from the services or `systemClock` at the edge); Chicago days (`chicagoDayOf`, `longDay`).
- The words of every screen and mail against the plan and the grandma test: sign-up, sign-in, forgot and new password, `/me` in each membership state, `/me/delete` (member and staff), `/goodbye`, `/join` (signed out, signed in, member, refusals), `/join/done` (both states), the error page, the four mails.
- That each Review Focus line has its test, by name (all but 6, finding 6).
- CI on `main`: run 193's three jobs, step by step. The CI run list for every slice 1 branch against progress.md's cited red and green runs; the jobs of runs 105, 106, 114 and 163, the ones progress.md names as red runs that the run list shows as cancelled or as lint failures (106: `verify` failed at `pnpm test`; 163: `postgres` failed at `pnpm test:pg`; 105 and 114 failed lint, as progress.md says).
- Pull request #37's diff, for finding 4.

## What I could not check

- No test, lint, typecheck or build was run here (CLAUDE.md). Behaviour is read from the code and from CI's results.
- The carried files were not compared line by line with `RukenAppFailed` (not attached in this session); "carried whole" is taken from the tests and the plan audits.
- The look's screenshots in the `playwright-report` artifacts were not opened; the look is changing on #42.
- Stripe's portal behaviour on API `2026-08-26.dahlia` (finding 3), and anything on the real site: Task 16 steps 5 and 6, Task 20 step 3, Task 31.
- CI runs before run 99 (Tasks 1 to 15) were read only in the run list, not job by job.
