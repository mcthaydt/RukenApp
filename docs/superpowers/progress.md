# Progress

The one record of where the work stands. Every session updates it as it works; the coordinator keeps the session list true. "Done" means merged to main and green there.

Design: `docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`, approved by the Owner on 2026-11-13.
Launch: Monday 30 November 2026, 11:00 CT.

## Overall: 7%

| # | Slice | State | Progress |
|---|---|---|---|
| 0 | Start: CLAUDE.md, AGENTS.md, the spec, this tracker, the app skeleton, the CI workflow | done (merged to main as `e8c55e2`, green) | 100% |
| 1 | Accounts and membership | Owner, 2026-11-13: Cloudflare instead of Netlify; the plan's revision is merged (#15) with the Owner's yes to its package list, and its plan audit with fixes (#19). Owner, 2026-11-13: the Card Table look on Ruken's own screens (design 5.8, #20); the plan has a branch for it, L `slice-1/look` (tasks 35 to 37), after branch D and before E0: merged (#22); its plan audit is on a branch (`audit/slice-1-look`), not done until merged and green. Execution: branch A (tasks 1 to 4) merged (#13); branch B (tasks 5 to 8) merged (#14); branch C (tasks 9 to 11) merged (#18). Branch D (screens, tasks 12 to 15) done on #21, not yet merged. L (the look) follows D, then E0 (Cloudflare) | 40% |
| 2 | Games and play | not started | 0% |
| 3 | The feed and the maker's page | not started | 0% |
| 4 | Submitting and the admin portal | not started | 0% |
| 5 | Money (after launch, before 10 December) | not started | 0% |

## Sessions

| Session | Stage | Branch | State |
|---|---|---|---|
| coordinator (`session_01HNdX7KQVAfWMSYYHFoo8iZ`) | all | — | running |
| merge (`session_01HNdX7LyTaPth3m82ZhbsXY`) | merges | — | running |
| plan, slice 1 (`session_01HNdX7HZoCEVyiEQJdDLJrW`) | 2 Plan | `plan/slice-1-accounts` | archived |
| plan, slice 1, updated to the revised design (`session_01HNdX7JH5Pn3ForHRsNX8Po`) | 2 Plan | `plan/slice-1-accounts` | archived; merged (#10) |
| plan audit, slice 1 | 3 Plan audit | `audit/slice-1-plan` | merged to main (pull request #12) |
| plan, slice 1, revised for Cloudflare (`session_01HNdX7LBVbQvxJYyJ29g61X`) | 2 Plan | `plan/slice-1-cloudflare` (pull request #15) | archived; merged to main (pull request #15) |
| plan audit, slice 1, Cloudflare revision (`session_01HNdX7JhDxq8Wks8Rcajo3A`) | 3 Plan audit | `audit/slice-1-cloudflare` | archived; merged (#19) |
| execution, slice 1 (`session_01HNdX7J8VTGzcZShtgMUqyv`) | 4 Execution | `slice-1/*` | archived (handed off at 90 minutes, after branch C) |
| execution, slice 1, second session (`session_01HNdX7MUtPbFudeSaJywXHC`) | 4 Execution | `slice-1/account-screens` and after | running |
| execution, slice 1, branch G (membership) (`session_01HNdX7LRjMhjdjX3L55msBT`) | 4 Execution | `slice-1/membership` | running (parallel with the second execution session; the Owner chose the parallel run, 2026-11-13) |
| plan, slice 1, the look (`session_01HNdX7Hzv3QVMVyjewBSg1u`) | 2 Plan | `plan/slice-1-look` | archived; merged (#22) |
| plan audit, slice 1, the look (`session_01HNdX7KyU3nkcc8rAByjXX3`) | 3 Plan audit | `audit/slice-1-look` (pull request #23) | done; merged to main (#23) |

## Slice 0: Start

- [x] The design and the workflow committed as the first commit (`697aacb`).
- [x] The Owner approved the design, 2026-11-13, with Netlify, Neon and Cloudflare (later the same day: Cloudflare instead of Netlify, design 7.3); payouts code after launch, before 10 December; FloorFifty as the one launch game.
- [x] AGENTS.md, from design section 3.
- [x] This tracker.
- [x] The app skeleton: one SvelteKit app at the old repository's pinned versions (Node 24.22.1, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Vite 8.3.3, TypeScript 6.0.3, Vitest 5.0.3, Playwright 1.63.0), a placeholder home page, and `tests/architecture.test.ts` for the layer rule.
- [x] The CI workflow: `verify` (lint, typecheck, unit tests, build) and `browser` (Playwright, phone and computer), on GitHub's runners.
- [x] The layer test seen failing in CI for the right reason (run 43484877992 on `216a512`: "src/stray.test.ts" in src/, and "accounts may only import features below it"; lint, typecheck and the browser job passed).
- [x] The layer test passing in CI once the break is removed.
- [x] Merged to main, green there (`e8c55e2`).

## Slice 1: Accounts and membership

Plan: `docs/superpowers/plans/2026-11-13-slice-1-accounts-membership.md`. It ends with: a stranger can sign up, pay and cancel.

Stages:

- [x] Plan written, and updated to the design as revised on 2026-11-13 (on `plan/slice-1-accounts`, pull request #10; not done until merged and green).
- [x] Plan audit: written, with the plan fixed (`docs/superpowers/audits/2026-11-13-slice-1-plan-audit.md`: 4 blocks execution, 19 should fix, 16 notes; all fixed in the plan but 6 notes that stay, each with its reason). Merged to main (pull request #12). No test ran in the audit session; the audit is a reading of the files.
- [x] Plan revised for Cloudflare (Owner, 2026-11-13: Cloudflare instead of Netlify): written from Cloudflare's, SvelteKit's, Prisma's, Stripe's and Resend's current pages and from the packages' own files; merged to main (pull request #15). No test ran in the plan session, and none of it has run on Cloudflare yet: Task 34's first green CI run is the first proof.
- [ ] Plan audit of the Cloudflare revision (`docs/superpowers/audits/2026-11-13-slice-1-cloudflare-plan-audit.md`), with the plan fixed: on a branch (`audit/slice-1-cloudflare`); not done until merged and green. No test ran in the audit session; it read the packages and built in a scratch folder outside the repository.
- [x] Plan for the look (design 5.8): branch L `slice-1/look`, tasks 35 to 37, added to the plan after branch D; Tasks 18, 19, 27, 29 and 30 say which of the look's classes their screens use. Merged to main (pull request #22). No test ran in the plan session; the two font tarballs were downloaded into a scratch folder outside the repository, and their integrity values, file sizes and SHA-256 checksums were measured there.
- [ ] Plan audit of the look (`docs/superpowers/audits/2026-11-13-slice-1-look-plan-audit.md`), with the plan fixed: 1 blocks execution, 8 should fix, 9 notes; all fixed in the plan but two notes that stay, each with its reason. The Owner's answer to its one question is in the plan (below). On its pull request (#23); not done until merged and green. No test ran in the audit session; the two font tarballs were downloaded again outside the repository, and every integrity value, size and checksum equals the plan's.
- [ ] Execution, branch by branch (below).
- [ ] Implementation audit.
- [ ] Fixes.

Resumed: the Owner's concept review is done; the plan audit is merged.

The Owner's decisions for this slice, 2026-11-13:

- [x] Age at sign-up: ask a date of birth; under 13 is refused; only the 18th birthday is stored.
- [x] Delete my account: the old 14-day wait; signing in undoes it; a scheduled job removes the data afterwards (first on Netlify; now a Cron Trigger on the Cloudflare Worker). Its own small branch.
- [x] Deploying: the Owner links the Netlify site to the repository; Netlify builds and publishes main after each merge and runs the migrations in its build. No CI workflow change for deploying. Now Cloudflare's Workers Builds in Netlify's place, with the migrations in its deploy command; still no CI workflow change.
- [x] Cloudflare instead of Netlify ("Thoughts on switching to Cloudflare and Cloudflare Pages instead of Netlify, that's what we're going with for the AutomataFramework", then "Cloudflare now" when told the cost). The app is a Cloudflare Worker; Neon stays, behind Hyperdrive; mail goes through Resend's HTTP API (a Call). The plan's section "Cloudflare instead of Netlify" has the choices and their sources.
- [x] The package list for Cloudflare, Owner, 2026-11-13: approved exactly: add `@sveltejs/adapter-cloudflare` 8.0.2 and `wrangler` 4.156.0 (both dev); remove `@sveltejs/adapter-netlify` 7.0.1, `nodemailer` 10.0.13 and `@types/nodemailer` 8.0.2.
- [x] Mail, Owner, 2026-11-13: Resend, through plain `fetch`.
- [x] The Hyperdrive id, Owner, 2026-11-13: committed in `wrangler.jsonc`.
- [x] Workers Paid, Owner, 2026-11-13: $5 a month is OK.
- [x] The look, Owner, 2026-11-13: "We can use the design present in the previous version as well", then yes to the Card Table design on Ruken's own screens (design 5.8).
- [x] Seeing the look before it merges, Owner, 2026-11-13: "Screenshots on the board". Branch L's journeys attach a phone and a computer screenshot of each screen; the `browser` job keeps its report on every run (one line in `ci.yml`, in a commit quoting those words); the Owner sees the screenshots from L's green run before L is marked ready, and looks again on the real site after Task 16.
- [x] The pip red, the coordinator's Call, 2026-11-13 (the Owner can overrule): `#c43b26`, paper text on it 4.57:1. The design sheet's `#c63c26` measures 4.48:1 with paper text. Design 5.8's table now says so.
- [x] main is protected: pull request only, `verify` and `browser` must pass on an up-to-date branch, merge commits only, merged branches deleted automatically.

The Owner's revised design, 2026-11-13, as this slice takes it:

- [x] The membership is $9.99 a month or $99 a year. No trials, no passes, no single games.
- [x] Which maker brought each member is recorded from launch day, from the link and never typed. This slice remembers the last arrival in a cookie only the server can write, carries it through Stripe on the checkout's own row, and stores it as one added-only `MembershipStart` row per completed checkout. The links themselves arrive in slices 2 and 3.
- [x] An arrival has no time limit; its time is still stored.
- [x] Only the first join counts: the bonus covers a person's first 12 months on Ruken, once. Every join is still recorded as it happened; slice 5 applies the rule.
- [x] No bonus on yourself: a maker who arrives through their own link gets none on their own membership. Recorded as it happened; slice 5 applies the rule.
- [x] The function that remembers an arrival stays in slice 1, though the links that call it arrive in slices 2 and 3.
- [x] Not in this slice: FloorFifty free on launch day, free-play codes, the play cap, the split and payouts. "Is this person a member" stays apart from "may this person play", so a free game fits later.

Branches and tasks. Each task is ticked with its two CI runs (the failing test, then green).

| Branch | Tasks | State |
|---|---|---|
| A `slice-1/database` | 1 Prisma, the accounts tables, Postgres in CI · 2 the clock · 3 safeNextPath, settings, work after the answer · 4 the rate limiter and the mailer | in progress (execution session). [x] Task 1 (CI runs 32 red, 33 green; the first red also showed one test passing for the wrong reason, so it was tightened and re-pushed). [x] Task 2 the clock (CI runs 35 red, 36 green; 10 tests). [x] Task 3 safeNextPath, settings, work after the answer (CI runs 38 red, 39 green; 25 tests). [x] Task 4 the rate limiter and the mailer (CI runs 41 red, 42 green; 10 tests). Branch A done, ready for review |
| B `slice-1/sign-in-rules` | 5 the sign-in pause · 6 the pause and limits as plugins · 7 the age check · 8 cookies and the mails | done on its pull request (#14), not yet merged. [x] Task 5 the sign-in pause (CI runs 44 red, 45 green; 6 + 11 tests). Order changed: Task 8 before Task 6, because the pause plugin sends the mail whose words Task 8 makes. [x] Task 8 cookies and the mails (CI runs 47 red, 48 green; 9 tests). [x] Task 6 the pause and limits as plugins (CI runs 49 red, 50 green). [x] Task 7 the age check (CI runs 51 red, 52 green; 11 tests). Branch B done, ready for review |
| C `slice-1/sign-in` | 9 better-auth, configured · 10 who sent this request · 11 the form actions and the services | merged (#18). [x] Task 9 better-auth configured (CI runs 62 red, 63 green). [x] Task 10 who sent this request (CI runs 64 red, 65 green; 8 + 2 tests). [x] Task 11 the form actions and the services (CI runs 68 red, 71 green; 48 + 1 tests; one lint fix between). Branch C done, ready for review |
| D `slice-1/account-screens` | 12 /api/auth and sign-out · 13 sign up · 14 sign in, forgot, new password · 15 /me | done on its pull request (#21), not yet merged (second execution session). [x] Task 12 the error page, /api/auth and sign-out (CI runs 73 red, 74 green; 1 unit + 4 browser failing for the expected reasons; the sign-in pause words are now one message). [x] Task 13 sign up (CI runs 75 red, 79 green; run 78 failed 4 of 10 journeys on the site's sign-up limit of 5 an hour per address, since every journey comes from one address: the journeys now clear the rate-limit counters before each one, and no limit is changed). [x] Task 14 sign in, forgot password, new password (CI runs 80 red, 82 green; 5 journeys on two devices). [x] Task 15 your account, /me (CI runs 83 red, 87 green; 3 journeys on two devices; the sign-up journey that lands on /me passed in the red run for the wrong reason, as the URL alone was checked, and /me answered 404 at that address). Branch D done, ready for review |
| L `slice-1/look` | 35 the tokens and the fonts · 36 the felt, the type, fonts from our own address · 37 the card, the fields and the buttons on every screen | not started; starts after branch D |
| E0 `slice-1/cloudflare` | 32 mail over HTTP, settings that say Cloudflare · 33 the platform, and work after the answer · 34 the site runs on Workers (one database client per request, the journeys in `wrangler dev`, `/healthz`) | not started; the package list is approved (Owner, 2026-11-13); starts after branch L |
| E `slice-1/deploy` | 16 the site on its real address | not started; waits for branch E0 |
| F `slice-1/delete-account` | 17 asking to be deleted, and undoing it · 18 signing in undoes it · 19 the delete screens · 20 the daily job (a Cron Trigger) | not started |
| G `slice-1/membership` | 21 the membership tables · 22 prices and joining · 23 the membership rules and the arrival cookie · 24 reading and ending a subscription · 25 the webhook · 26 the membership service | in progress (branch G's own session; it needs only A to D). [x] Task 21 the membership tables (CI runs 97 red, 99 green; 8 tests). [x] Task 22 prices and joining (CI runs 101 red, green run: see the next commit; the carried checkout tests, 2 new stripe-client cases and 3 for the new prices). `PremiumPlan` is defined in `plans.ts` (Task 23's reducer re-exports it), because Task 22 needs it a task before the reducer exists. `stripe` 22.6.2 added to `package.json` (it is on the plan's list). Task 23's `longDate` re-export waits for branch F's Task 19 |
| H `slice-1/paywall` | 27 the stand-in Stripe and the paywall card · 28 the webhook route · 29 coming back from paying · 30 membership on /me, cancelling, deleting · 31 paying and cancelling on the real site | not started |

The Owner's own tasks, and where execution stops for each:

- [ ] S1, asked for at Task 16 step 3, in two parts (the plan's numbered steps). Part one: Cloudflare's Workers Paid plan and the site's domain on that account; the Neon database; a Hyperdrive configuration in front of it with caching off; its id said to the coordinator, which goes into `wrangler.jsonc`. Part two: a Resend account with the domain verified and a sending key; an empty Worker named `ruken`; its secrets `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `JOBS_SECRET`, `MAIL_FROM`, `RESEND_API_KEY`, each of type Secret; the site's address as its custom domain; the Worker connected to this repository (build `pnpm build`, deploy `pnpm run deploy`, preview builds left off, the build secret `DIRECT_DATABASE_URL`). Branch F goes on meanwhile.
- [ ] S2, asked for at Task 21, needed before branch H merges: Stripe test mode: Stripe Tax on with one registration, the customer portal with cancelling at the period end, the webhook endpoint at the API version `stripe` 22.6.2 pins; `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_LIVE=false` as secrets on the Worker in Cloudflare.
- [ ] S3, after Task 31 step 2: Stripe live mode, real terms and privacy text, and the Owner's own payment with a real card. Not a condition for starting slice 2.

Found while planning:

- Cloudflare: three things could not be settled by reading and are settled by Task 34's CI run: whether the build carries Prisma's WebAssembly into the Worker, whether the visitor's address is available under `wrangler dev`, and whether pnpm installs Wrangler's runtime whole. Each has a stop rule in the task. The plan audit found that Vite's build cannot carry the WebAssembly on its own; Task 34 now has a small Vite plugin that hands it to Wrangler (it worked in a scratch build, not yet in CI).
- Cloudflare: Workers do not let one request use a database connection another opened, so `prisma()` becomes one client per request (Task 34). The journeys move from `vite preview` (Node) to `wrangler dev` (the Workers runtime), so CI tests what the real site runs.
- Cloudflare: the SvelteKit adapter has no daily-job handler, so a ten-line file wraps the built site and adds one (Task 20).
- Cloudflare: Resend's free plan caps mails per day; the Owner decides before launch.
- The look: the fonts are three `.woff2` files copied from the `@fontsource/young-serif` 5.3.0 and `@fontsource/schibsted-grotesk` 5.3.0 npm tarballs (76,516 bytes together), with their licences and a `sources.json` of checksums beside them in `static/fonts/`. Neither package is a dependency. The old repository served variable `.ttf` files; the google/fonts repository has no `.woff2`.
- The look: the delete screens, `/goodbye`, the paywall card and `/join/done` are built after branch L, so their own tasks carry the look's classes; branch L restyles only what branches A to D built.
- The look is checked in CI by values (colours, sizes, fonts, requests, contrast), not by eye. The Owner's first look is on the real site after Task 16.
- The old repository's terms and privacy pages are outlines marked "draft", waiting for counsel. They are not carried in this slice.
- The membership product and its prices are made in Stripe by the carried code, so the Owner types no price into Stripe.
- The carried code refuses to charge when Stripe already holds a price under its lookup key at another amount. A Stripe account that ran the old code holds the old $7.99 and $79 prices, so the new prices and their product get new names (`ruken_membership_monthly`, `ruken_membership_annual`, `ruken_membership`). The old product and prices stay in that account, unused; archiving them there is the Owner's.

Notes for later slices:

- Prisma, Postgres and a Postgres job in CI arrive with slice 1, when the first table does. Adding that job changes `ci.yml`, which needs the Owner's words quoted in the commit; design 7.4 is those words.
- `src/index.ts` from CLAUDE.md's structure is not made: an app has no public surface for others to import. Routes in `src/routes/` reach features through their entry files.
- Testing Library and jsdom arrive with the first component test.
