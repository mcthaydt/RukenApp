# Progress

The one record of where the work stands. Every session updates it as it works; the coordinator keeps the session list true. "Done" means merged to main and green there.

Design: `docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`, approved by the Owner on 2026-11-13.
Launch: Monday 30 November 2026, 11:00 CT.

## Overall: 5%

| # | Slice | State | Progress |
|---|---|---|---|
| 0 | Start: CLAUDE.md, AGENTS.md, the spec, this tracker, the app skeleton, the CI workflow | done (merged to main as `2a226c1`, green) | 100% |
| 1 | Accounts and membership | plan on a branch (`plan/slice-1`); paused by the Owner before the plan audit | 5% |
| 2 | Games and play | not started | 0% |
| 3 | The feed and the maker's page | not started | 0% |
| 4 | Submitting and the admin portal | not started | 0% |
| 5 | Money (after launch, before 10 December) | not started | 0% |

## Sessions

| Session | Stage | Branch | State |
|---|---|---|---|
| coordinator | all | — | running |
| merge (`session_01HNdX7LPj3vv1S8QmWH2w2e`) | merges | — | running |
| plan, slice 1 (`session_01HNdX7HZoCEVyiEQJdDLJrW`) | 2 Plan | `plan/slice-1` | running |

## Slice 0: Start

- [x] The design and the workflow committed as the first commit (`1fbe65a`).
- [x] The Owner approved the design, 2026-11-13, with Netlify, Neon and Cloudflare; payouts code after launch, before 10 December; FloorFifty as the one launch game.
- [x] AGENTS.md, from design section 3.
- [x] This tracker.
- [x] The app skeleton: one SvelteKit app at the old repository's pinned versions (Node 24.22.1, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Vite 8.3.3, TypeScript 6.0.3, Vitest 5.0.3, Playwright 1.63.0), a placeholder home page, and `tests/architecture.test.ts` for the layer rule.
- [x] The CI workflow: `verify` (lint, typecheck, unit tests, build) and `browser` (Playwright, phone and computer), on GitHub's runners.
- [x] The layer test seen failing in CI for the right reason (run 43484877992 on `e81db50`: "src/stray.test.ts" in src/, and "accounts may only import features below it"; lint, typecheck and the browser job passed).
- [x] The layer test passing in CI once the break is removed.
- [x] Merged to main, green there (`2a226c1`).

## Slice 1: Accounts and membership

Plan: `docs/superpowers/plans/2026-11-13-slice-1-accounts-membership.md`. It ends with: a stranger can sign up, pay and cancel.

Stages:

- [x] Plan written (on `plan/slice-1`; not done until merged and green).
- [ ] Plan audit.
- [ ] Execution, branch by branch (below).
- [ ] Implementation audit.
- [ ] Fixes.

Paused (Owner, 2026-11-13, through the coordinator): no plan audit and no execution starts until the Owner has gone over the concept itself. The design may change, and this plan with it.

The Owner's decisions for this slice, 2026-11-13:

- [x] Age at sign-up: ask a date of birth; under 13 is refused; only the 18th birthday is stored.
- [x] Delete my account: the old 14-day wait; signing in undoes it; a scheduled job on Netlify removes the data afterwards. Its own small branch.
- [x] Deploying: the Owner links the Netlify site to the repository; Netlify builds and publishes main after each merge and runs the migrations in its build. No CI workflow change for deploying.
- [x] main is protected: pull request only, `verify` and `browser` must pass on an up-to-date branch, merge commits only, merged branches deleted automatically.

Branches and tasks. Each task is ticked with its two CI runs (the failing test, then green).

| Branch | Tasks | State |
|---|---|---|
| A `slice-1/database` | 1 Prisma, the accounts tables, Postgres in CI · 2 the clock · 3 safeNextPath, settings, work after the answer · 4 the rate limiter and the mailer | not started |
| B `slice-1/sign-in-rules` | 5 the sign-in pause · 6 the pause and limits as plugins · 7 the age check · 8 cookies and the mails | not started |
| C `slice-1/sign-in` | 9 better-auth, configured · 10 who sent this request · 11 the form actions and the services | not started |
| D `slice-1/account-screens` | 12 /api/auth and sign-out · 13 sign up · 14 sign in, forgot, new password · 15 /me | not started |
| E `slice-1/deploy` | 16 the site on its real address | not started |
| F `slice-1/delete-account` | 17 asking to be deleted, and undoing it · 18 signing in undoes it · 19 the delete screens · 20 the daily job | not started |
| G `slice-1/membership` | 21 the membership tables · 22 prices and joining · 23 the membership rules · 24 reading and ending a subscription · 25 the webhook · 26 the membership service | not started |
| H `slice-1/paywall` | 27 the stand-in Stripe and the paywall card · 28 the webhook route · 29 coming back from paying · 30 membership on /me, cancelling, deleting · 31 paying and cancelling on the real site | not started |

The Owner's own tasks, and where execution stops for each:

- [ ] S1, before Task 16 step 3: the Neon database; the Netlify site linked to this repository; a mail service with SMTP and a from-address; the site's address; the settings `DATABASE_URL`, `DIRECT_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SMTP_URL`, `MAIL_FROM`, `JOBS_SECRET` in Netlify.
- [ ] S2, before Task 31 step 2: Stripe test mode: Stripe Tax on, the customer portal on with cancelling allowed, the webhook endpoint; `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_LIVE=false` in Netlify.
- [ ] S3, after Task 31 step 2: Stripe live mode, real terms and privacy text, and the Owner's own payment with a real card. Not a condition for starting slice 2.

Found while planning:

- The old repository's terms and privacy pages are outlines marked "draft", waiting for counsel. They are not carried in this slice.
- The Premium product and its prices are made in Stripe by the carried code, so the Owner types no price into Stripe.

Notes for later slices:

- Prisma, Postgres and a Postgres job in CI arrive with slice 1, when the first table does. Adding that job changes `ci.yml`, which needs the Owner's words quoted in the commit; design 7.4 is those words.
- `src/index.ts` from CLAUDE.md's structure is not made: an app has no public surface for others to import. Routes in `src/routes/` reach features through their entry files.
- Testing Library and jsdom arrive with the first component test.
