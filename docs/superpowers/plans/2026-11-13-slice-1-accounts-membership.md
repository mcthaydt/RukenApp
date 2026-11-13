# Slice 1: Accounts and Membership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stranger can sign up, pay and cancel, on a real address.

**Architecture:** One SvelteKit app. Two features, `accounts` (sign-in, sessions, staff roles, delete my account) and `membership` (checkout, Stripe webhooks, "is this person a member"), hold server code only; the screens are thin routes in `src/routes/` that call a feature's entry file. Sign-in, sessions and the Stripe code are copied file by file from RukenAppFailed and trimmed; the database is Postgres 16 through Prisma.

**Tech Stack:** Node 24.22.1, pnpm 10.34.6, SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0, Postgres 16, better-auth 1.7.7, Stripe 22.6.2, nodemailer 10.0.13, Vitest 5.0.3, Playwright 1.63.0. Netlify, Neon.

**Spec:** `docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md` (sections 5.2, 5.5 "Authority", 5.6, 6 "What players buy" and "Bringing a member", 7.1 to 7.4, 8, 9), as revised by the Owner on 2026-11-13. Read it with `CLAUDE.md` and `AGENTS.md`.

**Old repository:** `mcthaydt/RukenAppFailed` at commit `188e8a07546ba19c431468ddf2624e3cc4173d4e`, written below as `OLD/`. Attach it read-only (`add_repo`, access "read") and clone it beside this repository. Do not register it as a repository root: its CLAUDE.md and AGENTS.md are the old rules and do not apply.

## Global Constraints

- No session runs tests, lint or typecheck itself. Push, then read the result of CI on the pull request (CLAUDE.md, Owner 2026-11-13).
- Every task is test-first, and the failing test is seen failing in CI on the branch before the code that passes it is pushed ("How a task runs", below).
- Dependencies are added only at the old repository's pinned versions, and only these: `prisma` 7.10.0, `@prisma/client` 7.10.0, `@prisma/adapter-pg` 7.10.0, `pg` 8.23.1, `@types/pg` 8.23.1, `better-auth` 1.7.7, `stripe` 22.6.2, `nodemailer` 10.0.13, `@types/nodemailer` 8.0.2, `@js-temporal/polyfill` 0.5.1 (the carried clock, `TestClock` and the age check are written in Temporal; Node 24 has no Temporal of its own). Anything else needs the Owner's words: stop and report.
  - The two security pins the old repository kept for Prisma 7.10's command-line tool are carried into `pnpm-workspace.yaml` as `overrides` with their comment: `"@prisma/config>deepmerge-ts": 8.0.2` and `"prisma>mysql2": 3.24.5`. They pin what Prisma already pulls in; they add no package.
  - Not added though the old repository had them: zod (settings are read by a small function), cuid2 (ids made in code use `randomUUID()` from `node:crypto`; Prisma's own `@default(cuid(2))` needs no package), Testcontainers (CI's Postgres is a service container), pg-boss, Testing Library and jsdom (screens are checked in Playwright this slice).
- `.github/workflows/ci.yml` changes in exactly one commit of this slice (Task 1). Its message quotes the Owner (the text is in Task 1).
- This repository is public. No secret, real address, customer data, old plan or old history goes in. Every credential is typed by the Owner into Netlify's settings. Test values in the repository are plainly fake (`sk_test_fake`, `whsec_test_fake`).
- Money is whole cents as `bigint`. Nobody types a fact: every amount, tax, fee and date about a payment is read from Stripe.
- Time comes from an injected `Clock`. Feature code never calls `Date.now()` or `new Date()` with no argument.
- Features hold server code only this slice, and import only features below them: `accounts` imports no feature; `membership` may import `accounts`. Shared helpers with no feature logic go in `src/lib/`; a rule or key that belongs to one feature (like the checkout-start limit) lives in that feature, not in `src/lib/`. Tests live only in `tests/`, mirroring `src/`. Routes and `src/hooks.server.ts` reach a feature only through its entry file (the layer test checks every file under `src/`), so everything a route or the hook uses is re-exported there.
- Comments say why. When a file is copied, references to the old plans are removed from its comments (`M7.3 spec §5`, `audit U08-4`, `P3 §3.4`, `R-80`, `N7`, Figma page numbers), and the reason itself is kept.
- The price is $9.99 a month or $99 a year, tax added by Stripe (`PREMIUM_PRICES_CENTS = { monthly: 999n, annual: 9900n }`). No trials (`PREMIUM_TRIAL_DAYS = 0`), no day or week passes, no buying single games.
- Which maker brought a member is a fact from the link they arrived through. No screen, form or query parameter lets a person say it.
- Every screen and message passes the drunk grandma test. The words in this plan are the words to ship; a change to them is a deviation to report.

## How a task runs

Each task is two pushes, so each red-then-green round is short.

1. **Red.** Commit the test, plus a stub for every new export it imports. A stub has the final signature and the body `throw new Error("not built yet")`, so lint and typecheck pass and the test step itself is what fails. Push. Read CI. The task says which job fails and with what; if it fails any other way, stop and report.
2. **Green.** Replace the stubs with the code. Push. Read CI: every job passes.
3. Tick the task in `docs/superpowers/progress.md`, with the two CI run numbers, in the green commit or the next one. Send the coordinator the one line CLAUDE.md asks for.

CI runs on pull requests. So the first push of a branch is followed at once by opening its pull request (title: the branch's name in words). If GitHub refuses, stop and report.

A red commit is never merged: the merge session merges a branch only when its last commit is green.

**Carrying a file** means: copy it from `OLD/` to the new path; rewrite its imports to the new paths; remove what the task lists under "Trim"; remove old-plan references from comments; change nothing else. Its tests are carried the same way, keeping only the cases for what is kept. A carried test file named `*.pg.test.ts` needs Postgres; replace the old `startTestDatabase`/Testcontainers set-up with `startTestDatabase()` from `tests/support/database.ts` (Task 1).

## Branches

Eight branches, in this order. Each starts from `main` only after the one before it is merged and green, and each is small enough to review in one sitting.

`main` is protected (Owner, 2026-11-13): it changes only by pull request, `verify` and `browser` must pass on a branch that is up to date with `main`, merges are merge commits, and a merged branch is deleted automatically. Nothing is pushed straight to `main`. Before the last push of a branch, merge `main` into it if `main` has moved (a pushed branch is never rebased: no force-push). The `postgres` job arrives in Task 1; ask the coordinator to have it required too once branch A is merged.

| # | Branch | Tasks | Ends with |
|---|---|---|---|
| A | `slice-1/database` | 1 to 4 | Prisma, the accounts tables, a Postgres job in CI, the shared helpers |
| B | `slice-1/sign-in-rules` | 5 to 8 | the sign-in guards, limits, age check, cookies and mails, each tested alone |
| C | `slice-1/sign-in` | 9 to 11 | better-auth configured, the request hook, the form actions |
| D | `slice-1/account-screens` | 12 to 15 | sign up, sign in, reset and /me, in a real browser |
| E | `slice-1/deploy` | 16 | the site on its real address; a person signs up there |
| F | `slice-1/delete-account` | 17 to 20 | delete my account: the 14-day wait, undone by signing in, finished by a daily job |
| G | `slice-1/membership` | 21 to 26 | the membership tables and the Stripe code, tested without a browser |
| H | `slice-1/paywall` | 27 to 31 | the paywall card, paying, cancelling, in a real browser and on the real site |

## Where execution stops and waits for the Owner

The execution session reports to the coordinator and asks for each of these with the exact steps below. It does not work around a missing credential. A stop holds only the check that needs it: the next branch starts as soon as the branch before it is merged and green (a stop's own step is done when the Owner says "done"). The one hard wait is S2: branch H is not merged until S2 is done, because once it is on `main` the real site's `/me` and `/join` need the Stripe settings.

**S1, asked for at Task 16 step 3. The Owner, in each service's own settings, never in the repository:**

1. Neon: make a project with Postgres 16, in AWS US East (Ohio), the region Netlify runs its functions in by default. From its "Connect" panel copy two addresses: the pooled one (its host has `-pooler` in it) and the direct one (no `-pooler`).
2. Netlify: "Add new site" → "Import an existing project" → GitHub → `mcthaydt/RukenApp`, branch `main`. Leave the build command and folder empty: `netlify.toml` sets them.
3. Netlify, Site configuration → Build & deploy → Continuous deployment: set **Deploy Previews to "Don't deploy pull requests"** and **Branch deploys to "Deploy only the production branch"**. Netlify's build runs the migrations against the one real database, so a pull request's preview would change the real database before that pull request is merged.
4. The site's address: in Netlify, Domain management → add the address and make it the primary domain (Netlify then sends the other spelling, with or without `www`, to it); point the address's DNS at Netlify as Netlify shows; wait for the https certificate.
5. A mail service that offers SMTP: verify the address's domain with it (the SPF and DKIM records it gives, in the address's DNS), so the mails do not land in spam. Note its SMTP address as one line, `smtps://<user>:<password>@<host>:465`.
6. Netlify, Site configuration → Environment variables, each with scope "All scopes" (the build runs the migrations and the daily job reads its secret, so builds and functions both need them):
   - `DATABASE_URL`: Neon's pooled address. `DIRECT_DATABASE_URL`: Neon's direct address.
   - `BETTER_AUTH_SECRET`: a long random value (a password manager's generator, 40 characters or more). `JOBS_SECRET`: a second, different one (the daily job shows it to the site, Task 20).
   - `BETTER_AUTH_URL`: the primary address with `https://` and no trailing slash.
   - `SMTP_URL`: the line from step 5. `MAIL_FROM`: `Ruken <hello@your-domain>`, on the verified domain.
7. Netlify, Deploys → "Trigger deploy". Say "done" to the coordinator.

**S2, asked for when branch G starts (Task 21), needed before branch H merges. The Owner, in Stripe test mode:**

1. Settings → Tax: set the origin address, set the default tax behaviour to "exclusive", and add at least one registration (the Owner's own state is enough for testing), so a test invoice shows tax.
2. Settings → Billing → Customer portal: turn on "Cancel subscriptions", "at the end of the billing period"; leave "Update payment methods" on; turn off "Switch plans". Save, and activate the test-mode portal.
3. Developers → Webhooks → Add endpoint: `https://<site>/webhooks/stripe`, with the API version the execution session gives (the version the `stripe` package pins, read from `node_modules/stripe`; the handlers read event fields in that version's shape), for the events listed in Task 25. Copy its signing secret.
4. Developers → API keys: copy the test secret key (`sk_test_…`).
5. Netlify environment variables, scope "All scopes": `STRIPE_SECRET_KEY` (step 4), `STRIPE_WEBHOOK_SECRET` (step 3), `STRIPE_LIVE` = `false`. Trigger a deploy. Say "done".

**S3, at Task 31 step 3, when the Owner decides the site may take real money:** the same five steps in Stripe **live mode**, with the live key (`sk_live_…`) and `STRIPE_LIVE` = `true`; the site refuses to start if the key's mode and `STRIPE_LIVE` disagree (Task 26). Real terms and privacy text first. Paying once with a real card and cancelling is the Owner's own check (design 8).

The membership product and its two prices are not typed into Stripe by anyone: the carried code finds or makes them from the constants the first time someone checks out. They are made under new names (Task 22), so a Stripe account that still holds the old product and its old prices is left alone and never charged from.

## The Owner's decisions, and the Calls in this plan

- **Owner, 2026-11-13** (answers relayed by the coordinator):
  1. Age: sign-up asks a date of birth. Under 13 is refused; only the 18th birthday is stored (Tasks 7, 11, 13).
  2. Delete my account: the old 14-day wait. Signing in during the 14 days undoes it, and a scheduled job on Netlify removes the data afterwards. It is its own small branch (F, Tasks 17 to 20), using Netlify's own scheduled functions. If that turns out to need a dependency or tool the old repository did not pin, stop and ask.
  3. Deploy: the Owner links the Netlify site to the repository, and Netlify builds and publishes `main` after each merge, running the migrations in its build. No CI workflow change for deploying (Task 16).
  4. `main` is protected, as described under "Branches".
  5. The Calls below were put to the Owner and not overruled. They stay Calls.
- **Owner, 2026-11-13, the design revised** (sections 5.2, 6 and 8):
  1. The membership is $9.99 a month or $99 a year. No trials, no day or week passes, no buying single games (Task 22).
  2. From launch day Ruken records which maker brought each member. A member is brought by a maker when their last arrival before paying was through that maker's page or one of that maker's game links. It is a fact from the link, never typed (Tasks 21, 23, 26, 27, 29; "Bringing a member", below).
  3. An arrival has no time limit: the last arrival before paying counts, and its time is still stored. So the cookie lasts as long as a browser keeps one (Task 23).
  4. Only the first join counts: the bonus covers a person's first 12 months on Ruken, once, for the maker who brought their first membership. A later join through another maker starts nothing new. This slice still records every join as it happened; slice 5 applies the rule.
  5. No bonus on yourself: a maker who arrives through their own link and pays gets no bonus on their own membership. This slice still records it as it happened; slice 5 applies the rule.
  6. `arrival.remember` stays in this slice though its first caller arrives later, so the cookie's format lives in one place (answered through the coordinator).
  7. Not in this slice, and nothing here stands in their way: FloorFifty free on launch day, free-play codes, the 180-minute cap, the split and the payout rules ("Notes for the plans that follow").
- **Calls** (the Owner can overrule):
  - A member who asks to delete their account has their membership ended in Stripe at once, with no refund, so they are never charged while the account waits to be deleted. Signing in again brings back the account, not the membership (Task 30).
  - Carried from the old sign-in: email and password, the confirm-your-email mail, password reset by mail, the rate limits, the one-hour pause after ten wrong passwords, the rolling 30-day session. Not carried: passkeys, sign-in by emailed link, Apple, Google, Microsoft and GitHub sign-in, Cloudflare Turnstile, the breached-password check, anonymous visitor ids, embeds, the staff command-line token, localization, telemetry and consent.
  - Sign-up asks for an email and a password (and the date of birth). No name and no handle: the handle arrives with the maker's page in slice 3.
  - A Stripe webhook is handled in the request that receives it. A failure answers 500 and Stripe sends it again. The old queue and worker are not carried.
  - Slice 1 has no ledger (slice 5). Each paid invoice is one added-only `MembershipPayment` row, and every verified Stripe event is kept in `WebhookInbox`, so slice 5 can post them. Dispute and refund events are kept and not acted on yet.
  - Ruken sends no receipt and no failed-payment mail; Stripe sends receipts (design 7.1). A failed payment keeps the old rule: seven days of access from the first failure, never past the paid period.
  - Staff roles this slice are the `StaffAssignment` table and `staffRolesOf`. Nothing grants a role until slice 4 brings the portal and the two-superadmin rule.
  - Bringing a member, the smallest thing this slice needs so the fact is not lost:
    - **Remembered** in one cookie, `rk_arrival`, that only the server can write: the maker's account id, the path of the link and the server's time, sealed with a keyed hash so a value changed by hand is ignored. Each new arrival replaces the last one, so the cookie always holds the last arrival. It lives in the browser through sign-up, because sign-up never touches it.
    - **Carried through Stripe** on the server, not in the browser: when the person presses "Continue to payment", the arrival is read from the cookie and written on that checkout's `CheckoutIntent` row. Nothing about it is sent to Stripe, and paying does not depend on the cookie still being there.
    - **Stored with the membership** as one added-only `MembershipStart` row per completed checkout, written in the same step that marks the checkout completed. A member nobody brought gets a row with no maker, so that is a recorded fact too. Rows are never changed or deleted, like payment rows.
    - The cookie lasts 400 days, the longest a browser keeps one, and the row keeps the arrival's time (Owner's decision 3: no time limit).
    - This slice records and judges nothing. Every join is recorded as it happened, also a maker's own and a second join; the Owner's rules for them (decisions 4 and 5) are applied by slice 5, which reads these rows.
    - The maker's page and the game links arrive in slices 2 and 3. Their routes call `arrival.remember` (Task 26); until then nothing in the app writes the cookie, and this slice's tests write it themselves. That one function is built ahead of its caller on purpose, so the format lives in one place (decision 6).
    - Someone who arrives on one device and pays on another has no arrival on the paying device, and no maker is recorded.
    - "Before paying" is read as "when the person pressed Continue to payment". A person who opens one checkout, lands on another maker's link in a second tab, and then pays in the first tab, is recorded with the first maker. Reading the cookie later, on the way back from Stripe, would not be better: by then the person may be on another device or have no cookie.
  - The old terms and privacy pages are not carried: in the old repository they are outlines marked "draft", waiting for counsel. Real text is the Owner's, and should exist before S3.

## File map

```
prisma.config.ts                         where Prisma finds the schema and the database
prisma/schema/base.prisma                generator and datasource
prisma/schema/accounts.prisma            accounts' tables
prisma/schema/membership.prisma          membership's tables            (branch G)
prisma/migrations/                       SQL, made by `prisma migrate diff`, never by hand except CHECKs
netlify.toml                             build command, Node version, the daily job's schedule (branches E, F)
netlify/functions/purge-accounts.mjs     the daily job: it only calls the site's own job address (branch F)
.env.example                             every setting's name, with fake values
src/lib/clock.ts                         Clock, systemClock, CALENDAR_ZONE, chicagoDayOf
src/lib/long-date.ts                     longDay, longDate: a Chicago day in words   (branch F)
src/lib/safe-next.ts                     safeNextPath
src/lib/server/db.ts                     the Prisma client
src/lib/server/env.ts                    requireEnv, optionalEnv
src/lib/server/mail.ts                   Mailer, the SMTP mailer, mailFailureCode
src/lib/server/rate-limit.ts             RateLimiter on the RateLimit table
src/lib/server/background.ts             work that runs after the answer
src/hooks.server.ts                      the request hook
src/app.d.ts                             App.Locals.caller
src/features/accounts/
  accounts.ts          entry
  caller.ts            the Caller type
  sign-in-guard.ts     the pause rule and the address hash (pure)
  sign-in-guards.ts    the pause counts in SignInGuard
  sign-in-pause-plugin.ts   the pause as a better-auth plugin
  auth-limits-plugin.ts     the per-address rate limits
  age.ts               the 13-and-up check
  cookies.ts           cookie names and options
  mails.ts             the words of the four mails
  auth.ts              better-auth, configured
  handle.ts            who sent this request
  staff.ts             staffRolesOf
  forward.ts           /api/auth to better-auth
  forms.ts             the form actions
  pages.ts             signedInRedirect, signedInOnly
  deletion.ts          requestDeletion, restoreOnSignIn, purgeDueAccounts   (branch F)
  services.ts          everything above, built once from the settings
src/features/membership/                 (branch G)
  membership.ts        entry
  plans.ts             the prices
  stripe-client.ts     createStripe, checkoutExpiry
  checkout.ts          the product, the prices, the Checkout session
  subscription.ts      reading and ending a subscription, the paid invoice, the portal link
  reducer.ts           reduceMembership (pure)
  access.ts            premiumAccess (pure)
  stripe-port.ts       PremiumStripe: everything asked of Stripe, as one interface
  sync.ts              keeps PremiumMembership in step with Stripe
  payments.ts          one MembershipPayment row per paid invoice
  webhook.ts           verifyStripeWebhook
  inbox.ts             WebhookInbox: store, then handle once
  events.ts            which event does what
  service.ts           startCheckout, view, portal, endNow, the webhook handlers
  format.ts            a price and a date in words
  arrival.ts           the last arrival through a maker's link: sealing and opening the cookie (pure)
  services.ts          built once from the settings
src/routes/
  +error.svelte                          every failure's page, with a way back
  +layout.server.ts  +layout.svelte      the welcome-back line   (branch F)
  healthz/+server.ts                     (branch E)
  api/auth/[...path]/+server.ts
  sign-up/  sign-in/  sign-out/  forgot-password/  reset-password/
  me/
  me/delete/  goodbye/  jobs/purge-accounts/+server.ts     (branch F)
  join/  join/done/                      (branch H)
  webhooks/stripe/+server.ts             (branch H)
tests/support/database.ts                a fresh migrated database per test file
tests/support/test-clock.ts              a clock tests can set
tests/support/capture-mailer.ts          a Mailer that keeps what it was given
tests/support/fake-premium-stripe.ts     a PremiumStripe that remembers state (branch G)
tests/browser/support/fake-stripe-server.ts   a stand-in Stripe over HTTP (branch H)
tests/browser/support/account.ts         signUp(page) for journeys
tests/browser/support/database.ts        the app's database, for the one journey that must read a row (branch H)
tests/lib/…  tests/features/accounts/…  tests/features/membership/…   mirror src/
tests/browser/*.test.ts                  the journeys
```

## Review Focus

Each line names an input the design implies and no ordinary test would meet. Each has its test in the task named.

1. Stripe sends the same event twice, or `invoice.paid` before `checkout.session.completed`: one membership, one payment row (Task 25, Task 26).
2. A person double-clicks "Continue to payment", or has two tabs: one open checkout, never two paid (Task 26).
3. `?next=https://evil.example` or `?next=//evil.example` on sign-in, sign-up or the paywall: the person lands on `/`, never off the site (Task 3, Task 13, Task 27).
4. A request to `/webhooks/stripe` with no signature, a wrong one, or a body changed after signing: 400, and nothing is stored (Task 28).
5. A member whose card fails: still a member for seven days from the first failure and never past the paid period; then not (Task 23).
6. A person with a running membership asks to delete their account: Stripe stops charging them at once, and the payment rows stay, also after the daily job has removed their details (Task 20, Task 30).
7. The old session cookie of an account that signed out, is waiting to be deleted, or is deleted: treated as signed out at once (Task 10, Task 19).
8. Anyone on the internet calls the daily job's address without the secret: 404, and nothing is removed (Task 20).
9. An arrival cookie that was changed by hand, names an account that does not exist, or is missing: the person still pays and becomes a member, and no maker is recorded (Task 23, Task 26).
10. A person arrives through one maker's link, starts paying, comes back, arrives through another maker's link and pays: the second maker is recorded, once (Task 26).

---

# Branch A: `slice-1/database`

### Task 1: Prisma, the accounts tables, and Postgres in CI

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `vite.config.ts`, `playwright.config.ts`, `.gitignore`, `.prettierignore`, `eslint.config.js`
- Create: `prisma.config.ts`, `prisma/schema/base.prisma`, `prisma/schema/accounts.prisma`, `prisma/migrations/<timestamp>_accounts/migration.sql`, `prisma/migrations/migration_lock.toml`, `src/lib/server/db.ts`, `tests/support/database.ts`, `.env.example`
- Test: `tests/lib/server/migrations.pg.test.ts`

**Interfaces:**
- Produces:
  - `createPrismaClient(databaseUrl: string, options?: { poolMax?: number }): PrismaClient`, `poolMaxFromEnv(source, fallback: number): number`, and `prisma(): PrismaClient` (process-wide, made on first use from `DATABASE_URL`, pool size from `DATABASE_POOL_MAX`, fallback 3) in `src/lib/server/db.ts`. `PrismaClient` and the enums are re-exported from there. Carried from `OLD/packages/db/src/client.ts`.
  - `startTestDatabase(): Promise<{ url: string; prisma: PrismaClient; stop(): Promise<void> }>` in `tests/support/database.ts`. It reads `TEST_DATABASE_URL`, makes a database named `ruken_test_<16 random hex>`, runs `prisma migrate deploy` on it (the real CLI, through `execFileSync`, with `DATABASE_URL` and `DIRECT_DATABASE_URL` set to the new database), and `stop()` disconnects and drops it. A missing `TEST_DATABASE_URL` throws "TEST_DATABASE_URL is not set. These tests run in CI's postgres job."
  - Scripts: `"generate": "prisma generate"`, `"test:pg": "pnpm generate && svelte-kit sync && vitest run --project postgres"`. `lint`, `typecheck`, `test`, `build` and `test:browser` each start with `pnpm generate &&` (`test:browser` too: Playwright loads the journey files, and from Task 29 their support code imports the generated client, before its web server builds anything). `test` becomes `vitest run --project unit`.
  - Vitest projects in `vite.config.ts`: `unit` (`tests/**/*.test.ts`, excluding `tests/browser/**` and `**/*.pg.test.ts`) and `postgres` (`tests/**/*.pg.test.ts`, `testTimeout: 30_000`, `hookTimeout: 120_000`).
  - The generated client goes to `src/lib/server/generated/prisma` (`provider = "prisma-client"`), which is ignored by git, Prettier and ESLint.

**The tables** (`prisma/schema/accounts.prisma`), carried from `OLD/packages/db/prisma/schema.prisma` lines 27 to 306, trimmed:

| Model | Columns |
|---|---|
| `User` | `id` (cuid(2)), `name`, `email` unique, `emailVerified` default false, `image?`, `status UserStatus` default `active`, `adultOn Date?`, `createdAt`, `updatedAt` |
| `Session` | `id`, `token` unique, `expiresAt`, `ipAddress?`, `userAgent?`, `userId` (cascade), `createdAt`, `updatedAt`; index on `userId` |
| `Account` | as carried (lines 214 to 232) |
| `Verification` | as carried (lines 234 to 244) |
| `StaffAssignment` | as carried (lines 246 to 256) |
| `RateLimit` | as carried (lines 282 to 287) |
| `SignInGuard` | as carried (lines 299 to 306), with its two CHECK constraints in the migration SQL |
| `DeletionRequest` | as carried (lines 1113 to 1123), with the two hand-written pieces from its old migration (`OLD/packages/db/prisma/migrations/20261014100000_m4_player_pages/migration.sql`, lines 104 and 106): CHECK `DeletionRequest_window_check` (`purgeAfter` after `requestedAt`) and the partial unique index `DeletionRequest_open_key` (at most one open request, not cancelled and not purged, per user) |

Enums: `UserStatus { active, pending_deletion, deleted }`, `StaffRole` as carried (`owner, curator, support, moderator, head_curator, finance`).

Trim: `displayName`, `handle`, `twoFactorEnabled`, `Session.audience`, `Session.stepUpAt`, `SessionAudience`, the `disabled` status, `DeveloperToken`, `Device`, and every relation to a table not listed. Slice 4 adds what the admin portal needs.

- [ ] **Step 1 (red): the CI job, the tooling, the schema and the failing test.** One commit holds the dependencies, the scripts, the Vitest projects, `prisma.config.ts`, `base.prisma`, `accounts.prisma` (the tables below), `db.ts`, `tests/support/database.ts`, `.env.example`, the CI change and this test. There is no migration yet: the migration is the code that makes these tests pass. (The schema comes in this commit, not the next, because `prisma generate` makes no client from a schema with no models, and `db.ts` imports the client, so lint, typecheck and the build would fail for the wrong reason.)

```ts
// tests/lib/server/migrations.pg.test.ts
describe("migrations on a clean Postgres 16", () => {
  it("make the accounts tables", async () => {
    const tables = await tableNames(database.prisma); // names from information_schema.tables, schema public
    expect(tables).toEqual(expect.arrayContaining(
      ["User", "Session", "Account", "Verification", "StaffAssignment", "RateLimit", "SignInGuard", "DeletionRequest"]));
  });
  it("match the schema, so the generated client and the database agree", () => {
    // `prisma migrate diff` from the migrated database to prisma/schema, with --exit-code: 0 means no difference.
    expect(schemaDriftExitCode(database.url)).toBe(0);
  });
  it("refuse a SignInGuard row whose emailHash is not 64 lower-case hex characters", async () => {
    await expect(database.prisma.$executeRaw`INSERT INTO "SignInGuard" ("emailHash", failures, "windowStartedAt", "updatedAt")
      VALUES ('nope', 1, now(), now())`).rejects.toThrow();
  });
});
```

  For `schemaDriftExitCode`, read `pnpm exec prisma migrate diff --help` at 7.10.0 for the exact flag names and follow `OLD/packages/db/src/migrations.pg.test.ts`, second test.

  `prisma.config.ts` is carried from `OLD/packages/db/prisma.config.ts` with `schema: "prisma/schema"` and `datasource: { url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "" }` (Neon's pooled address cannot run migrations; the direct one can).

  The CI change, in `.github/workflows/ci.yml`:
  - a new job `postgres` ("tests against a real Postgres"), same checkout, pnpm, Node and install steps as `verify`, with `services: postgres:` (`image: postgres:16`, `env: POSTGRES_PASSWORD: postgres`, a `pg_isready` health check, port 5432) and `env: TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres`, running `pnpm test:pg`, `timeout-minutes: 15`;
  - the same service and `TEST_DATABASE_URL` on the `browser` job, because from Task 12 the journeys need a database;
  - the header comment's line "Tests against a real Postgres join when the database arrives in slice 1" becomes "Tests against a real Postgres run in the postgres job."
  - `permissions` and `on` do not change. No secret is used.

  The password `postgres` is the throwaway container's, not a credential.

  `playwright.config.ts`: `webServer.command` becomes `pnpm exec prisma migrate deploy && pnpm build && pnpm preview --port 4173 --strictPort`, with `webServer.env` passing `DATABASE_URL` and `DIRECT_DATABASE_URL` (both from `process.env.TEST_DATABASE_URL`), and `timeout: 180_000`.

  Commit message, exactly:

```
CI: tests against a real Postgres, as its own job and for the browser journeys

Owner, 2026-11-13 (design 7.4): "we don't run local tests, we do it all in gh cloud runners."
Design 7.4, approved by the Owner on 2026-11-13: "One CI workflow on GitHub-hosted Ubuntu runners:
lint, typecheck, unit tests, tests against a real Postgres, and Playwright in a real browser for the
journeys in section 8."

Adds Prisma 7.10.0 and pg 8.23.1 at the old repository's pins, and the first failing database test.
```

- [ ] **Step 2: push, open the pull request, read CI.** Expected: `verify` and `browser` pass. `postgres` fails all three tests in `migrations.pg.test.ts`: "make the accounts tables" (the array has none of them), the drift test (the schema has tables the empty database lacks) and the SignInGuard test (the table does not exist). If `postgres` fails before reaching the tests, that is the wrong reason: fix the set-up first.
- [ ] **Step 3 (green): the migration.** Make the SQL without a database: `pnpm exec prisma migrate diff` from empty to `prisma/schema`, as a script, into `prisma/migrations/<UTC yyyymmddhhmmss>_accounts/migration.sql`. Append by hand the two `SignInGuard` CHECK constraints (`OLD/packages/db/prisma/migrations/20261023020500_n7_auth_hardening/migration.sql`, from line 21) and the `DeletionRequest` CHECK and partial unique index (see the table above), each copied from the old migration that made it. Add `migration_lock.toml` (`provider = "postgresql"`). Running `prisma migrate diff` and `prisma generate` is not running a test, and is allowed.
- [ ] **Step 4: push, read CI.** Expected: all three jobs pass.
- [ ] **Step 5: tick the task in progress.md.**

### Task 2: The clock

**Files:**
- Create: `src/lib/clock.ts`, `tests/support/test-clock.ts`
- Test: `tests/lib/clock.test.ts`

**Interfaces:**
- Produces: `interface Clock` (`now(): Temporal.Instant`, `epochMs(): number`) and `systemClock: Clock` in `src/lib/clock.ts`, carried from `OLD/packages/core/src/clock/index.ts` and `system.ts`, with `@js-temporal/polyfill`. Also there, from `OLD/packages/core/src/clock/zone.ts`: `CALENDAR_ZONE = "America/Chicago"` and `chicagoDayOf(epochMs): string` (`YYYY-MM-DD`), because the carried age check (Task 7) asks for today's Chicago day and the goodbye page (Task 19) names a Chicago day. `TestClock` in `tests/support/test-clock.ts`, carried from `OLD/packages/core/src/clock/testing.ts`: `new TestClock(start)`, `now()`, `epochMs()`, `set(at)`, `advance(by: Temporal.DurationLike | number)` (a number is milliseconds).
- Trim: `TimerClock`, `TimerHandle` and the timer methods (and `TestClock`'s pending timers), since no carried file in this plan uses them; `chicagoDayStart` (slice 5 carries it with the money dates).

- [ ] **Step 1 (red):** carry `OLD/packages/core/src/clock/system.test.ts` to `tests/lib/clock.test.ts`, keeping the case "epochMs agrees with now within a few milliseconds"; carry the `chicagoDayOf` cases of `OLD/packages/core/src/clock/zone.test.ts`. Stub `systemClock` and `chicagoDayOf` so each throws "not built yet". Commit, push.
- [ ] **Step 2: read CI.** Expected: `verify` fails at `pnpm test`, in `clock.test.ts`, with "not built yet".
- [ ] **Step 3 (green):** carry the clock. Commit, push. Expected: all jobs pass.

### Task 3: safeNextPath, settings, and work after the answer

**Files:**
- Create: `src/lib/safe-next.ts`, `src/lib/server/env.ts`, `src/lib/server/background.ts`
- Test: `tests/lib/safe-next.test.ts`, `tests/lib/server/env.test.ts`, `tests/lib/server/background.test.ts`

**Interfaces:**
- Produces:
  - `safeNextPath(raw: string | null | undefined): string`, carried whole from `OLD/packages/core/src/identity/safe-next.ts` with `safe-next.test.ts`.
  - `requireEnv(name: string, source?: Record<string, string | undefined>): string` (throws `Missing setting ${name}. Set it in Netlify's environment settings.` when unset or empty) and `optionalEnv(name, source?): string | undefined` (empty counts as unset). `source` defaults to `process.env`.
  - `keepBackgroundWorkAlive: Handle` and `runAfterAnswer: RunInBackground`, with `type RunInBackground = (task: () => Promise<void>) => void` declared here. Carried whole from `OLD/apps/web/src/lib/server/auth/background.ts` with `background.test.ts`.

- [ ] **Step 1 (red):** the three test files and stubs. New tests for `env.ts`:

```ts
it("returns a set value", () => expect(requireEnv("A", { A: "x" })).toBe("x"));
it("names the missing setting and where to set it", () =>
  expect(() => requireEnv("SMTP_URL", {})).toThrow("Missing setting SMTP_URL. Set it in Netlify's environment settings."));
it("treats an empty value as missing", () => expect(() => requireEnv("A", { A: "" })).toThrow());
it("optionalEnv answers undefined for unset or empty", () => {
  expect(optionalEnv("A", {})).toBeUndefined();
  expect(optionalEnv("A", { A: "" })).toBeUndefined();
});
```

  Review Focus 3 is pinned by the carried cases for `https://evil.example`, `//evil.example`, a backslash and a control character; check they are all in the carried file and add any that is missing.
- [ ] **Step 2: read CI.** Expected: `verify` fails at `pnpm test` in the three files with "not built yet".
- [ ] **Step 3 (green):** the code. Push. Expected: all jobs pass.

### Task 4: The rate limiter and the mailer

**Files:**
- Create: `src/lib/server/rate-limit.ts`, `src/lib/server/mail.ts`, `tests/support/capture-mailer.ts`
- Test: `tests/lib/server/rate-limit.pg.test.ts`, `tests/lib/server/mail.test.ts`

**Interfaces:**
- Produces:
  - `interface RateLimitRule { max: number; windowMs: number }`, `type RateLimitResult`, `interface RateLimiter { hit(key, rule): Promise<RateLimitResult> }`, `createRateLimiter(prisma: PrismaClient, clock: Clock): RateLimiter`, and `RATE_LIMIT_ROWS_KEPT_MS` (the limiter refuses a rule with a longer window). Carried from `OLD/packages/core/src/runtime/rate-limit.ts` with `rate-limit.pg.test.ts`, without its two `RATE_LIMITS` cases. Trim: `RATE_LIMITS` and `checkoutStartKey`: they are membership's own rule and key, carried into `src/features/membership/service.ts` in Task 26 (`CHECKOUT_STARTS_PER_USER = { max: 10, windowMs: 60_000 }`, `checkoutStartKey(userId)`). The row id comes from `randomUUID()`.
  - `interface MailMessage { to; subject; text }`, `interface Mailer { send(message): Promise<boolean> }`, `createSmtpMailer(options: { from: string; allowlist: string | undefined; transport: Transporter }): Mailer`, `smtpTransport(smtpUrl: string): Transporter`, `mailFailureCode(error: unknown): string`. Carried from `OLD/packages/core/src/mail/mailer.ts` with its `mailer.test.ts`, and `mailFailureCode` from `OLD/apps/web/src/lib/server/auth/mailer.ts` with the two `mailFailureCode` cases of `OLD/apps/web/src/lib/server/auth/mailer.test.ts`. Trim: `headers`, Mailpit, the capture endpoint.
  - One addition: `smtpTransport("test:")` returns nodemailer's `jsonTransport`, which sends nothing. CI's browser journeys use it; the comment says so.
  - `createCaptureMailer(): Mailer & { sent: MailMessage[] }` in `tests/support/capture-mailer.ts`.

- [ ] **Step 1 (red):** carried tests, stubs, and one new test: `it("sends nothing over the network for the test: address", …)` asserting `await createSmtpMailer({ from: "a@b.test", allowlist: undefined, transport: smtpTransport("test:") }).send(message)` resolves `true`. Push.
- [ ] **Step 2: read CI.** Expected: `verify` fails in `mail.test.ts`, `postgres` fails in `rate-limit.pg.test.ts`, both with "not built yet".
- [ ] **Step 3 (green):** the code. Push. Expected: all jobs pass. Branch A is ready to merge.

---

# Branch B: `slice-1/sign-in-rules`

### Task 5: The sign-in pause

**Files:**
- Create: `src/features/accounts/sign-in-guard.ts`, `src/features/accounts/sign-in-guards.ts`
- Test: `tests/features/accounts/sign-in-guard.test.ts`, `tests/features/accounts/sign-in-guards.pg.test.ts`

**Interfaces:**
- Produces, carried whole from `OLD/packages/core/src/identity/sign-in-guard.ts` and `sign-in-guards.ts` with their tests: `SIGN_IN_FAILURE_LIMIT = 10`, `SIGN_IN_WINDOW_MS`, `SIGN_IN_PAUSE_MS` (one hour each), `hashSignInEmail(email, secret): string`, `isSignInPaused(state, now)`, `interface SignInGuards { db; clock; secret }`, `isSignInPausedFor`, `reserveSignInAttempt`, `recordWrongPassword`, `releaseSignInAttempt`, `clearSignInFailures`.
- Trim: `sweepSignInGuards` (there is no job to run it; an expired row is overwritten by the next failure).

- [ ] **Step 1 (red):** carried tests and stubs. Push. Expected: `verify` fails in `sign-in-guard.test.ts`, `postgres` in `sign-in-guards.pg.test.ts`, with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 6: The pause and the per-address limits as better-auth plugins

**Files:**
- Create: `src/features/accounts/sign-in-pause-plugin.ts`, `src/features/accounts/auth-limits-plugin.ts`
- Test: `tests/features/accounts/sign-in-pause-plugin.test.ts`, `tests/features/accounts/auth-limits-plugin.test.ts`

**Interfaces:**
- Consumes: Task 4's `RateLimiter`, Task 5's guards, `Mailer`, `RunInBackground`.
- Produces: `SIGN_IN_PAUSED`, `signInPausePlugin(options: { guards; prisma; mailer; log; runInBackground }): BetterAuthPlugin` (the two old files, `OLD/packages/core/src/identity/sign-in-pause-plugin.ts` and `OLD/apps/web/src/lib/server/auth/sign-in-pause-plugin.ts`, merged into one, since there is one app now); `RATE_LIMITED`, `authLimitsPlugin(options: { limiter; secret; clientIpHeader }): BetterAuthPlugin` from `OLD/apps/web/src/lib/server/auth/auth-limits-plugin.ts`. Tests from the files beside each.
- Trim: the `/sign-in/magic-link` entry of `LIMITS`. The pause notice mail's words come in Task 8; here the plugin takes a `mailer` and the test checks one mail goes to the account's own address.

- [ ] **Step 1 (red):** carried tests and stubs. Push. Expected: `verify` fails in both files with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 7: The age check

Owner, 2026-11-13: sign-up asks a date of birth, refuses under 13 and stores only the 18th birthday.

**Files:**
- Create: `src/features/accounts/age.ts`
- Test: `tests/features/accounts/age.test.ts`, `tests/features/accounts/age.pg.test.ts`

**Interfaces:**
- Produces, carried from `OLD/packages/core/src/identity/age.ts` with both tests: `interface BirthDate { year; month; day }`, `type AgeCheck` (`adult | minor | under13 | invalid`), `ageCheck(date: BirthDate, clock: Clock): AgeCheck`, `setBirthDate(db, clock, input: { userId; date }): Promise<{ minor: boolean }>` (stores only the 18th birthday in `User.adultOn`), `AgeError`.
- Trim: `isMinor`, `isMinorOn` (nothing reads them this slice). `ageCheck` keeps its Temporal calendar maths and reads today's Chicago day through `chicagoDayOf` from `src/lib/clock.ts` (Task 2).

- [ ] **Step 1 (red):** carried tests and stubs. Push. Expected: `verify` fails in `age.test.ts`, `postgres` in `age.pg.test.ts`, with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 8: Cookies and the words of the mails

**Files:**
- Create: `src/features/accounts/cookies.ts`, `src/features/accounts/mails.ts`
- Test: `tests/features/accounts/cookies.test.ts`, `tests/features/accounts/mails.test.ts`

**Interfaces:**
- Produces:
  - `interface CookiePolicy { secure: boolean; sessionCookieName: string }`, `cookiePolicy(webOrigin: string): CookiePolicy` (`__Host-rk_session` on https, `rk_session` on http), `copyAuthCookies(cookies, setCookieLines)`. Carried from `OLD/apps/web/src/lib/server/auth/cookies.ts` with `cookies.test.ts`. Trim: the anonymous and embed cookies.
  - `verificationMessage(to, url)`, `passwordResetMessage(to, url)`, `passwordChangedMessage(to)`, `signInPausedMessage(to)`: each returns a `MailMessage`. Carried from `OLD/apps/web/src/lib/server/auth/mailer.ts`. Trim: `magicLinkMessage`.

**The words.** The first three are carried unchanged. The fourth loses its mention of the sign-in link and passkeys:

```
Subject: Password sign-in on your Ruken account is paused

Someone tried to sign in to your Ruken account with the wrong password ten times in an hour. So we paused password sign-in for an hour.

You can still choose a new password with "Forgot your password?" on the sign-in page.

If that was you, wait an hour and try again. If it wasn't, we suggest you choose a new password.
```

Grandma: each mail says what it is, gives the one link, says how long it lasts, and says what to do if it was not expected.

- [ ] **Step 1 (red):** carried cookie tests; a new `mails.test.ts` asserting each subject, that each link mail contains its `url` on a line of its own, and that `signInPausedMessage` contains neither "sign-in link" nor "passkey". Stubs. Push. Expected: `verify` fails in both files with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. Branch B is ready to merge.

---

# Branch C: `slice-1/sign-in`

### Task 9: better-auth, configured

**Files:**
- Create: `src/features/accounts/auth.ts`
- Test: `tests/features/accounts/auth.pg.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 8.
- Produces, carried from `OLD/apps/web/src/lib/server/auth/auth.ts`:
  - `CLIENT_IP_HEADER = "x-ruken-client-ip"`, `PUBLIC_ROUTE_HEADER = "x-ruken-public-route"`
  - `interface AuthOptions { prisma; secret; baseURL; mailer; cookies: CookiePolicy; clock?; log?; runInBackground? }`
  - `createAuth(options: AuthOptions)`, `type Auth`
  - `interface SessionInfo { sessionId: string; userId: string; userStatus: string; setCookies?: string[] }`, `sessionInfo(auth: Auth, headers: Headers): Promise<SessionInfo | null>`
- Kept exactly as carried: `basePath: "/api/auth"`; `trustedOrigins` (our own origin only); `telemetry` off; reset tokens stored hashed; passwords 10 to 128 characters; `autoSignIn`; reset link one hour, every session revoked on reset, `onPasswordReset` lifting the pause and mailing the notice; verification mail on sign-up, one day; session 30 days, refreshed daily, no cookie cache; the `rateLimit` block; `advanced` (ids from the database, exact cookie names, client address from `CLIENT_IP_HEADER`); the `before` hook that answers `NOT_FOUND` to `/sign-up/email` arriving through the public route; `authLimitsPlugin` then `signInPausePlugin`; `mailLater`.
- Kept, though easy to cut by mistake: `user.additionalFields.status` (`input: false`). `sessionInfo` reads `user.status` through it, and without it every account reads as not `active`, so the hook (Task 10) would treat everyone as signed out.
- `log` defaults to one `console.warn` line; callers pass only codes, never an address (`mailFailureCode`).
- Trim: passkeys, magic link, social providers and Apple's origin, account linking, Turnstile, the breached-password plugin, `displayName` and the text filter (the `user.create.before` hook and the `displayName` additional field go), `audience` (the session's additional field goes), anonymous devices, the passkey cookie name, and the `session.create.after` hook (Task 18 brings back its "welcome back" half, with the 14-day wait). The rate-limit rules for `/sign-in/social` and `/sign-in/magic-link` go.

- [ ] **Step 1 (red):** carry `OLD/apps/web/src/lib/server/auth/auth.pg.test.ts`, keeping these groups and dropping the rest: "sign-up with email and password" (the cases at old lines 141, 154 and 172, with `displayName` and audience assertions removed), "sign-in with email and password" (210, 216, 231, and 195 without the device assertion), "session cookie on https", "email verification", "password reset" (all but the breached-password case at 694, which keeps its short-password half), "account sign-in pause" (all; in the case at 997 keep only the reset request), "mail after the answer" (both cases, 1123 and 1154), and "sessionInfo" (both cases, 1187 and 1191: the second is the only test of the rolling 30-day cookie). Mail is a `createCaptureMailer()`. Stub `createAuth` and `sessionInfo`. Push.
- [ ] **Step 2: read CI.** Expected: `postgres` fails in `auth.pg.test.ts` with "not built yet"; `verify` and `browser` pass.
- [ ] **Step 3 (green):** the code. Push. Expected: all pass.

### Task 10: Who sent this request

**Files:**
- Create: `src/features/accounts/caller.ts`, `src/features/accounts/staff.ts`, `src/features/accounts/handle.ts`
- Test: `tests/features/accounts/handle.test.ts`, `tests/features/accounts/staff.pg.test.ts`

**Interfaces:**
- Produces:
  - `type Caller = { kind: "user"; userId: string; sessionId: string; staffRoles: StaffRole[] } | { kind: "none" }` in `caller.ts`.
  - `staffRolesOf(db: PrismaClient, userId: string): Promise<StaffRole[]>` from `OLD/packages/core/src/identity/staff.ts`. Trim: `isStaff` (nothing in this slice reads it; slice 4 brings it with the portal), `grantablePermissions`, `DeveloperPermission`.
  - `interface HandleDeps { cookies: CookiePolicy; getSession(headers): Promise<SessionInfo | null>; staffRolesOf(userId): Promise<StaffRole[]> }`, `createHandle(getDeps: () => HandleDeps): Handle` from `OLD/apps/web/src/lib/server/auth/handle.ts`. It sets `event.locals.caller`.
- Trim from `handle.ts`: the `Authorization` header and developer tokens, embeds, anonymous ids, the audience check, the automation prefix, the desktop pairing path, `/readyz`. Kept: only an `active` user is a `user` caller; the refreshed session cookie is copied on, except on `/api/auth/` routes; `/healthz` skips the caller check and answers as `none` (Task 16), so it reports the database even when a sign-in setting is missing. Carry the matching `handle.test.ts` case.

- [ ] **Step 1 (red):** carry the matching cases of `handle.test.ts`: a signed-in session gives a `user` caller with its staff roles; no session gives `none`; a refreshed cookie is copied; not on `/api/auth/…`. Add, for Review Focus 7:

```ts
it.each(["pending_deletion", "deleted"])("treats a session whose account is %s as signed out", async (userStatus) => {
  const event = eventWith({ session: { sessionId: "s1", userId: "u1", userStatus } });
  await handle({ event, resolve });
  expect(event.locals.caller).toEqual({ kind: "none" });
});
```

  `staff.pg.test.ts`: `staffRolesOf` answers `[]` for a person with no row and `["owner"]` after one `StaffAssignment` row is inserted. Stubs. Push. Expected: `verify` fails in `handle.test.ts`, `postgres` in `staff.pg.test.ts`, with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 11: The form actions and the services

**Files:**
- Create: `src/features/accounts/forward.ts`, `src/features/accounts/forms.ts`, `src/features/accounts/pages.ts`, `src/features/accounts/services.ts`, `src/features/accounts/accounts.ts`
- Modify: `src/hooks.server.ts` (create), `src/app.d.ts`, `.env.example`
- Test: `tests/features/accounts/forms.test.ts`, `tests/features/accounts/forward.test.ts`, `tests/features/accounts/pages.test.ts`, `tests/features/accounts/services.test.ts`

**Interfaces:**
- Produces:
  - `forwardToAuth(handler, request, clientAddress): Promise<Response>` and `type AuthHandler`, from `OLD/…/auth/forward.ts`. Trim: `authRoute` and the social callback check.
  - From `OLD/…/auth/forms.ts`: `FORM_MESSAGES`, `interface FormDeps { handler: AuthHandler; baseURL: string; cookies: CookiePolicy }`, `interface SignUpDeps extends FormDeps { clock: Clock; setBirthDate(userId: string, date: BirthDate): Promise<unknown> }`, `type FormEvent`, `interface AuthFormData { email?; month?; day?; year?; tooYoung?; error?; sent?; token?; linkInvalid? }`, and the actions `signInWithPassword`, `signUpWithPassword`, `requestPasswordReset`, `resetPassword`, `resendVerification(event, deps, email)`, `signOut`, plus `readForm`, `callAuth`, `birthDateOf`.
  - `signedInRedirect(caller: Caller, url: URL): { next: string }`, `signedInOnly(caller, url): { userId: string; next: string }` from `OLD/…/auth/pages.ts`.
  - `createAuthServices(source: Record<string, string | undefined>): AuthServices` and `authServices(): AuthServices` (process-wide, `createAuthServices(process.env)` on first use), where `AuthServices = { prisma; clock; cookies; mailer; auth; handleDeps; formDeps; signUpDeps }`, from `OLD/…/auth/services.ts`, reading `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SMTP_URL`, `MAIL_FROM` with `requireEnv` and `MAIL_ALLOWLIST` with `optionalEnv`. The tests build with `createAuthServices`, as the old ones did.
  - `accounts.ts` re-exports what routes, the hook and `membership` need: `authServices`, `createHandle`, the form actions and `readForm`, `forwardToAuth`, `signedInRedirect`, `signedInOnly`, `staffRolesOf`, `type Caller`, `FORM_MESSAGES`. Tasks 17 to 20 add theirs (`requestDeletion`, `WELCOME_BACK_COOKIE`, `purgeDueAccounts`, `DELETION_WAIT_DAYS`).
  - `src/hooks.server.ts`: `export const handle = sequence(keepBackgroundWorkAlive, createHandle(() => authServices().handleDeps))`. `App.Locals` gains `caller: Caller`. SvelteKit's own cross-site form check stays on.
- Trim from `forms.ts`: `requestMagicLink`, Turnstile, the breached-password branches, the name, the handle and its checks, the text filter, the passkey offer, the under-18 page, the anonymous id and the consent cookie in `signOut`, `provider`. `signUpWithPassword` sends better-auth `{ name: "Player", email, password }` and, on success, calls `deps.setBirthDate(user.id, date)` then redirects to `safeNextPath(form.next)`. `resendVerification` uses `callbackURL: "/me"`. The sign-in and sign-up forms post `next` in a hidden field, from the page's checked `next`.

**The words** (`FORM_MESSAGES`), carried and trimmed:

| Key | Words |
|---|---|
| `wrongPassword` | That email and password don't match. Try again, or reset your password. |
| `rateLimited` | Too many tries. Wait a few minutes, then try again. |
| `signInPaused` | Password sign-in is paused for that email after too many tries. Reset your password, or try again in an hour. |
| `failed` | Something went wrong on our side. Try again in a moment. |
| `emailMissing` | Enter your email address. |
| `passwordLength` | Use a password of 10 to 128 characters. |
| `accountExists` | There's already an account with that email. Sign in instead. |
| `birthDateInvalid` | Enter your date of birth as a month, day and year. |
| `passwordsDiffer` | The two passwords don't match. Type the same one twice. |

- [ ] **Step 1 (red):** carry the kept cases of `forms.test.ts`, `forward.test.ts`, `pages.test.ts` and `services.test.ts`. Add to `forms.test.ts`:

```ts
it("sends a person back to / when next points off the site", async () => {
  const result = signInWithPassword(eventWithForm({ email: "a@b.test", password: "long enough pw", next: "https://evil.example" }), okDeps);
  await expect(result).rejects.toMatchObject({ status: 303, location: "/" });
});
it("refuses an under-13 date before any account is made", async () => {
  const handler = vi.fn();
  const result = await signUpWithPassword(eventWithForm({ email: "a@b.test", password: "long enough pw", ...dateOfAge(12) }), { ...signUpDeps, handler });
  expect(result).toMatchObject({ status: 400, data: { tooYoung: true } });
  expect(handler).not.toHaveBeenCalled();
});
```

  and to `services.test.ts`: building the services with `SMTP_URL` unset throws "Missing setting SMTP_URL". Stubs. Push. Expected: `verify` fails in the four files with "not built yet".
- [ ] **Step 2 (green):** the code, the hook, `app.d.ts`, and the new names in `.env.example` with fake values. Push. Expected: all pass, including `tests/architecture.test.ts` and the existing home-page journey (the hook now runs on every request, so the `browser` job's `webServer.env` in `playwright.config.ts` gains `BETTER_AUTH_SECRET: "test-only-secret-not-used-anywhere-real"`, `BETTER_AUTH_URL: "http://localhost:4173"`, `SMTP_URL: "test:"`, `MAIL_FROM: "Ruken <hello@ruken.test>"`). Branch C is ready to merge.

---

# Branch D: `slice-1/account-screens`

Every task here is a journey first. Journeys run on `phone` and `computer`. `tests/browser/support/account.ts` gives `signUp(page): Promise<{ email: string; password: string }>`, which fills the sign-up form with a fresh address (`journey+<random>@ruken.test`), the password `a long enough password` and a birth date thirty years before today, and waits for the page it lands on. A journey waits on what the page shows, never on a sleep.

### Task 12: `/api/auth` and sign-out

**Files:**
- Create: `src/routes/api/auth/[...path]/+server.ts`, `src/routes/sign-out/+page.server.ts`, `src/routes/+error.svelte`, `tests/browser/support/account.ts`
- Test: `tests/browser/auth-route.test.ts`, `tests/browser/error-page.test.ts`

**The error page** (`+error.svelte`), the first screen a person can reach this slice and the one every failure lands on. A missing page: heading "We can't find that page." Anything else: heading "Something went wrong on our side." and the line "Try again in a moment." Both end with one link, "Back to Ruken", to `/`. It never shows the error's own text.

Grandma: it says in one line what happened and gives one way back.

- [ ] **Step 1 (red):** `error-page.test.ts`: `/no-such-page` shows the heading "We can't find that page." and a link "Back to Ruken" to `/`. And:

```ts
test("the sign-in service answers on our own address", async ({ request }) => {
  const response = await request.get("/api/auth/ok");
  expect(response.status()).toBe(200);
});
test("an account cannot be made around the sign-up form", async ({ request }) => {
  const response = await request.post("/api/auth/sign-up/email", {
    data: { name: "x", email: "around@ruken.test", password: "a long enough password" } });
  expect(response.status()).toBe(404);
});
```

  Push. Expected: `browser` fails: both requests answer SvelteKit's 404 page for the first test (not 200); the second already answers 404, so it passes for the wrong reason until the route exists. That is acceptable only because the first test is the red one; say so in the report line. `error-page.test.ts` fails: SvelteKit's own page has no such heading.
- [ ] **Step 2 (green):** `+server.ts` exports `GET` and `POST`, each `forwardToAuth(authServices().auth.handler, event.request, event.getClientAddress())`. `sign-out/+page.server.ts` has one default action, `signOut`. `+error.svelte` reads `page.status`. Push. Expected: all pass.

### Task 13: Sign up

**Files:**
- Create: `src/routes/sign-up/+page.server.ts`, `src/routes/sign-up/+page.svelte`
- Test: `tests/browser/sign-up.test.ts`

**The screen.** Plain HTML form, so it works before any script loads.

```
Create your account

Email            [                    ]
Password         [                    ]
                 At least 10 characters.
When were you born?
  Month [  ]  Day [  ]  Year [    ]
  We only check that you're 13 or older. We don't keep your birthday.

[ Create account ]

Already have an account? Sign in
```

Under 13, the form is replaced by: heading "Ruken isn't for you yet." and the line "Come back when you're 13." (carried words), then one link, "Back to Ruken", to `/`.

Grandma: one button. Each field says what goes in it. A refusal sits above the button, says what to fix, and keeps what was typed (not the password). "Sign in" is the way back for someone who already has an account. The link to sign-in carries `next` along.

- [ ] **Step 1 (red):**

```ts
test("a stranger makes an account and lands signed in", async ({ page }) => {
  await page.goto("/sign-up?next=/me");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Email").fill(freshEmail());
  await page.getByLabel("Password").fill("a long enough password");
  await fillBirthDate(page, yearsAgo(30));
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/me");
});
test("a short password says what to fix and keeps the email", async ({ page }) => { /* "Use a password of 10 to 128 characters." */ });
test("an address that already has an account is sent to sign in", async ({ page }) => { /* "There's already an account with that email. Sign in instead." */ });
test("someone under 13 is told to come back", async ({ page }) => { /* heading "Ruken isn't for you yet.", link "Back to Ruken" */ });
test("next pointing off the site lands on the home page", async ({ page }) => { /* /sign-up?next=https://evil.example → toHaveURL("/") */ });
```

  The first test's last line needs `/me`, which arrives in Task 15; until then assert `await expect(page).toHaveURL("/")` with `next` left off, and switch to `/me` in Task 15. Push. Expected: `browser` fails in `sign-up.test.ts`: no "Create your account" heading (404).
- [ ] **Step 2 (green):** `load` is `signedInRedirect(locals.caller, url)`; the default action is `signUpWithPassword(event, authServices().signUpDeps)`. Push. Expected: all pass.

### Task 14: Sign in, forgot password, new password

**Files:**
- Create: `src/routes/sign-in/+page.server.ts`, `+page.svelte`; `src/routes/forgot-password/+page.server.ts`, `+page.svelte`; `src/routes/reset-password/+page.server.ts`, `+page.svelte`
- Test: `tests/browser/sign-in.test.ts`

**The screens.**

```
Sign in                                  Forgot your password?

Email     [              ]               Enter your email and we'll send a link
Password  [              ]               to choose a new one.

[ Sign in ]                              Email  [              ]
                                         [ Send the link ]
Forgot your password?
New here? Create an account              Back to sign in
```

After "Send the link": heading "Check your email", then "If {email} has an account, we sent a link. It works once, for an hour.", then "Back to sign in". The same words whether or not the address has an account.

```
Choose a new password

New password    [              ]
Type it again   [              ]

[ Save password ]
```

A link that is expired, used or made up shows instead: "That link has expired or was already used." and one button-styled link, "Send a new link", to `/forgot-password`. After saving, the person is on `/sign-in` with the line "Your password is updated. Sign in with it."

Grandma: one button per screen; every dead end names the next step (reset, or a new link); nothing tells a stranger whether an address has an account.

- [ ] **Step 1 (red):**

```ts
test("a person signs in with their password", async ({ page }) => { /* signUp, sign out through POST /sign-out, then fill and click "Sign in"; toHaveURL("/") */ });
test("a wrong password says so and offers the reset", async ({ page }) => {
  /* expects "That email and password don't match. Try again, or reset your password." and a link "Forgot your password?" */ });
test("asking for a reset answers the same for any address", async ({ page }) => {
  /* an address with no account: heading "Check your email", text "If nobody@ruken.test has an account, we sent a link. It works once, for an hour." */ });
test("a made-up reset link offers a new one", async ({ page }) => {
  /* /reset-password?token=nope → fill both fields, Save → "That link has expired or was already used." and link "Send a new link" */ });
```

  The mailed link itself is covered by Task 9's database tests, since CI's journeys send no mail. Push. Expected: `browser` fails in `sign-in.test.ts`: no "Sign in" button (404).
- [ ] **Step 2 (green):** routes as in `OLD/apps/web/src/routes/(auth)/sign-in`, `forgot-password` and `reset-password` (`+page.server.ts` files), without the magic-link and social actions. Push. Expected: all pass.

### Task 15: Your account (`/me`)

**Files:**
- Create: `src/routes/me/+page.server.ts`, `src/routes/me/+page.svelte`
- Modify: `tests/browser/sign-up.test.ts` (the first test now uses `?next=/me`)
- Test: `tests/browser/me.test.ts`

**The screen** (the membership lines arrive in Task 30; saved and following arrive in slice 3):

```
Your account

you@example.com
  Confirm your email. We sent a link to you@example.com.   [ Send it again ]

[ Sign out ]
```

The "Confirm your email" line shows only while the address is unconfirmed; after "Send it again" it reads "Sent. Check your email." Signed out, `/me` goes to `/sign-in?next=/me`.

Grandma: the page says who is signed in; "Sign out" is the one button; the quiet "Delete my account" link arrives in Task 19, with the page it leads to.

- [ ] **Step 1 (red):**

```ts
test("a signed-out person is sent to sign in, and comes back", async ({ page }) => { /* goto /me → toHaveURL("/sign-in?next=%2Fme") */ });
test("the page shows the person's email and signs them out", async ({ page }) => {
  const { email } = await signUp(page);
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/me");
  await expect(page).toHaveURL(/\/sign-in/);
});
test("an unconfirmed address can ask for the link again", async ({ page }) => { /* click "Send it again" → "Sent. Check your email." */ });
```

  Push. Expected: `browser` fails in `me.test.ts`: 404 at `/me`.
- [ ] **Step 2 (green):** `load` uses `signedInOnly`, then reads the user's `email` and `emailVerified`. Actions: `resend` (`resendVerification` with the email read from the database, never the form). The sign-out button posts to `/sign-out`. Push. Expected: all pass.

Branch D is ready to merge.

---

# Branch E: `slice-1/deploy`

### Task 16: The site on its real address

Owner, 2026-11-13: the Owner links the Netlify site to the repository; Netlify builds and publishes `main` after each merge and runs the migrations in its build.

**Files:**
- Create: `netlify.toml`, `src/routes/healthz/+server.ts`
- Modify: `.env.example`, `docs/superpowers/progress.md`
- Test: `tests/browser/healthz.test.ts`, `tests/netlify.test.ts`

**Interfaces:**
- Produces: `GET /healthz` answers 200 `ok` after one `SELECT 1` through `prisma()`, and 503 `database` when that fails. It tells a person, after a deploy, that the site reaches its database.
- `netlify.toml`:

```toml
# Netlify builds and publishes main after each merge. Every credential is one of the site's environment
# variables in Netlify, never this file. The migrations run first, so the code never meets an older database.
[build]
  command = "pnpm exec prisma migrate deploy && pnpm build"
  publish = "build"

[build.environment]
  NODE_VERSION = "24.22.1"
```

- [ ] **Step 1 (red):** `healthz.test.ts`: `GET /healthz` answers 200 with the text `ok`. `tests/netlify.test.ts` (a unit test that reads the file as text): the build command contains `prisma migrate deploy` before `pnpm build`, `NODE_VERSION` equals the contents of `.nvmrc`, and the file contains none of `postgres://`, `postgresql://`, `sk_`, `whsec_`, `smtp://`, `smtps://`. Push. Expected: `browser` fails in `healthz.test.ts` (404); `verify` fails in `netlify.test.ts` (no such file).
- [ ] **Step 2 (green):** the route and the file. Check the publish folder against what `@sveltejs/adapter-netlify` 7.0.1 writes with this project's `vite.config.ts` (read the adapter's README in `node_modules`); if it is not `build`, use what the adapter says and report the deviation. Push. Expected: all pass. The branch merges.
- [ ] **Step 3: STOP S1.** Send the coordinator the S1 steps ("Where execution stops", above) word for word, for the Owner. Branch F starts meanwhile; steps 4 and 5 wait for the Owner's "done".
- [ ] **Step 4: after the Owner's "done".** Ask the coordinator for the site's address (it is not written in the repository). Fetch `<site>/healthz` and expect `ok`. A person (the Owner, or the coordinator with the Owner) signs up on the real site, gets the confirmation mail, follows its link, signs out and signs in. Record in progress.md what was checked, by whom and when; do not record the address or any email address.
- [ ] **Step 5:** if `/healthz` or the sign-up fails, report what the page and Netlify's deploy log say. Do not start a fourth fix (CLAUDE.md, Pace).

---

# Branch F: `slice-1/delete-account`

Owner, 2026-11-13: "Delete my account" is the old 14-day wait. Signing in during the 14 days undoes it, and a scheduled job on Netlify removes the data afterwards.

### Task 17: Asking to be deleted, and undoing it

**Files:**
- Create: `src/features/accounts/deletion.ts`
- Modify: `src/features/accounts/accounts.ts`
- Test: `tests/features/accounts/deletion.pg.test.ts`

**Interfaces:**
- Produces, carried from `OLD/packages/core/src/account/deletion.ts` with the matching cases of `deletion.pg.test.ts`:
  - `DELETION_WAIT_DAYS = 14`
  - `requestDeletion(deps: { prisma: PrismaClient; clock: Clock }, userId: string): Promise<{ purgeAfter: Date } | "staff">`. In one transaction: an open request answers its own date; otherwise it adds a `DeletionRequest` (`purgeAfter` = now + 14 days), sets the user to `pending_deletion` and deletes every `Session` row. A person with a `StaffAssignment` gets `"staff"` and nothing changes. Two requests at the same moment: the partial unique index lets one in and the other answers the winner's date (carried).
  - `restoreOnSignIn(prisma: PrismaClient, clock: Clock, userId: string): Promise<boolean>`, whole.
- Trim: the studio check, the audit rows (the audit trail arrives with the admin portal in slice 4), the per-person rate limit (asking twice already changes nothing), `AccountError` (the staff case is the return value).

- [ ] **Step 1 (red):** carried cases: asking sets the date 14 days out, marks the account and deletes its sessions; asking twice answers the first date; two at once leave one open request; staff are refused; `restoreOnSignIn` within the 14 days answers true and makes the account `active`; after the 14 days it answers false and changes nothing; with nothing waiting it answers false. Stubs. Push. Expected: `postgres` fails in `deletion.pg.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 18: Signing in undoes it

**Files:**
- Modify: `src/features/accounts/auth.ts`, `src/features/accounts/cookies.ts`
- Create: `src/routes/+layout.server.ts`, `src/routes/+layout.svelte`
- Test: `tests/features/accounts/auth.pg.test.ts` (add a group)

**Interfaces:**
- Consumes: `restoreOnSignIn` (Task 17).
- Produces: in `createAuth`, the `databaseHooks.session.create.after` hook from `OLD/apps/web/src/lib/server/auth/auth.ts` (old lines 384 to 406), without the device claim: it calls `restoreOnSignIn`, and when that answers true sets the cookie `WELCOME_BACK_COOKIE = "rk_welcome_back"` (in `cookies.ts`; value `"1"`, `WELCOME_BACK_MAX_AGE_SECONDS` = 5 minutes as carried from `OLD/apps/web/src/lib/account/welcome-back.ts`, long enough to survive the sign-in redirect; `httpOnly: true`, `sameSite: "lax"`, `secure` from the cookie policy). `copyAuthCookies`'s comment, which names this cookie as the one sent without HttpOnly, is corrected. The root layout's server `load` reads that cookie, deletes it, and returns `{ welcomeBack: boolean }`; the layout shows the line below once, in a `role="status"` paragraph above the page.
- Changed from the old code: the flag is read on the server, not by a page script, so the cookie can be HttpOnly and `OLD/apps/web/src/lib/account/welcome-back.ts` is not carried.

**The words:** "Welcome back. Your account will not be deleted."

Grandma: the person did the natural thing (signed in) and is told, once, in one line, that it worked.

- [ ] **Step 1 (red):** carry the group "signing in while a deletion waits" from `OLD/apps/web/src/lib/server/auth/auth.pg.test.ts` (old lines 320 to 360): within the 14 days sign-in restores the account and sets the cookie; after the 14 days the session resolves to an account that is not `active` and no cookie is set; an ordinary sign-in sets no cookie. Push (the hook does not exist yet, so no stub is needed). Expected: `postgres` fails in that group: the account is still `pending_deletion` after sign-in.
- [ ] **Step 2 (green):** the hook and the layout. Push. Expected: all pass. The line itself is checked in Task 19's journey.

### Task 19: The delete screens

**Files:**
- Create: `src/routes/me/delete/+page.server.ts`, `src/routes/me/delete/+page.svelte`, `src/routes/goodbye/+page.server.ts`, `src/routes/goodbye/+page.svelte`, `src/lib/long-date.ts`
- Modify: `src/routes/me/+page.svelte` (the "Delete my account" link, under "Sign out")
- Test: `tests/browser/delete-account.test.ts`, `tests/lib/long-date.test.ts`

**The screens.**

```
Delete your account?

We'll sign you out everywhere now, and delete your account in 14 days.
Changed your mind? Sign in before then and nothing is deleted.

[ Delete my account ]

Keep my account
```

For staff, in place of the button: "Staff accounts are removed by another staff member." Afterwards, `/goodbye?on=<yyyy-mm-dd>`, where the day is `chicagoDayOf(purgeAfter)`:

```
You're signed out.

Your account will be deleted on Friday, November 27.
Changed your mind? Sign in before then.

Back to Ruken
```

The date is a Chicago calendar day in words: weekday, month, day. Put the small formatter in `src/lib/long-date.ts` here with a unit test, and have Task 23's `format.ts` re-export it: `longDay(day: string): string | null` writes a `YYYY-MM-DD` day (null for text that is not a real day), formatting it as that calendar day and never through an instant, so a day cannot slip to the one before; `longDate(at: Date): string` is `longDay(chicagoDayOf(at.getTime()))`, for the instants on `/me`. `/goodbye` passes `on` to `longDay` and shows the page without the date line when it answers null.

Grandma: the page says what happens now and what happens later, in two lines, and how to undo it; "Keep my account" is the way back.

- [ ] **Step 1 (red):**

```ts
test("a person asks to be deleted, is signed out, and is told the date", async ({ page }) => {
  const { email, password } = await signUp(page);
  await page.goto("/me");
  await page.getByRole("link", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Delete your account?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "You're signed out." })).toBeVisible();
  await expect(page.getByText(/^Your account will be deleted on \w+, \w+ \d+\.$/)).toBeVisible();
  await page.goto("/me");
  await expect(page).toHaveURL(/\/sign-in/);                       // Review Focus 7
});
test("signing in again within the 14 days undoes it, and says so once", async ({ page }) => {
  /* …ask to be deleted, then sign in with the same email and password with next=/me */
  await expect(page.getByText("Welcome back. Your account will not be deleted.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Welcome back. Your account will not be deleted.")).toHaveCount(0);
});
test("Keep my account goes back and deletes nothing", async ({ page }) => { /* link → /me, still signed in */ });
```

  Plus `tests/lib/long-date.test.ts`: `longDate(new Date("2026-12-15T03:00:00Z"))` is `"Monday, December 14"` (still the 14th in Chicago); `longDay("2026-11-27")` is `"Friday, November 27"` (not the 26th, whatever the server's zone); `longDay("2026-02-30")` and `longDay("soon")` are null. Stub `longDay` and `longDate`. Push. Expected: `browser` fails in `delete-account.test.ts` (no "Delete my account" link on `/me`); `verify` fails in `long-date.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the routes. The action calls `requestDeletion`, then redirects to `/goodbye?on=` + `chicagoDayOf(purgeAfter.getTime())`. Push. Expected: all pass.

### Task 20: The daily job that finishes it

**Files:**
- Modify: `src/features/accounts/deletion.ts`, `src/features/accounts/accounts.ts`, `netlify.toml`, `playwright.config.ts`, `.env.example`
- Create: `src/routes/jobs/purge-accounts/+server.ts`, `netlify/functions/purge-accounts.mjs`
- Test: `tests/features/accounts/purge.pg.test.ts`, `tests/browser/purge-job.test.ts`, `tests/netlify.test.ts` (add cases)

**Interfaces:**
- Produces:
  - `purgeDueAccounts(deps: { prisma: PrismaClient; clock: Clock }): Promise<number>`: for every open `DeletionRequest` whose `purgeAfter` has passed, in one transaction per account: delete the person's `Session`, `Account` and `Verification` rows (`Verification` where `identifier` or `value` is the email, as the old purge did, or `value` is the user's id, which is what a password-reset row holds); set the `User` row to `status: "deleted"`, `email: "deleted-<id>@deleted.invalid"`, `name: "Deleted"`, `emailVerified: false`, `image: null`, `adultOn: null`; set the request's `purgedAt`. It answers how many accounts it finished. The `User` row itself stays, so payment rows that point at it stay true. This is new and small; `OLD/packages/core/src/account/purge.ts` removed data from some thirty tables this app does not have, and is not carried. Each later slice that adds a person's data adds its own removal here, with a test.
  - `POST /jobs/purge-accounts`: answers 404 unless the request has `Authorization: Bearer <JOBS_SECRET>` (compared with `timingSafeEqual` from `node:crypto`); with it, runs `purgeDueAccounts` and answers 200 `{ "purged": <count> }`. 404, not 401, so the address looks like any address the site does not have.
  - `netlify/functions/purge-accounts.mjs`: a Netlify scheduled function with no imports. It POSTs to `${process.env.URL}/jobs/purge-accounts` with the secret from `process.env.JOBS_SECRET` and throws when the answer is not 200, so a failed run shows as failed in Netlify. It holds no logic, because Netlify bundles this folder on its own and cannot see the app's code. `netlify.toml` gains:

```toml
# Once a day. The function only knocks on the site's own job address; the work is in the app.
[functions."purge-accounts"]
  schedule = "@daily"
```

  Before writing it, read Netlify's current page on scheduled functions and check three things: the schedule may be set in `netlify.toml` this way, `URL` is given to functions, and a function with no imports needs no package. If any needs a package or tool, stop and report (Owner: no dependency the old repository did not pin).

- [ ] **Step 1 (red):** `purge.pg.test.ts`:

```ts
it("leaves an account alone until its 14 days are over", async () => { /* clock at day 13: answers 0, the row is unchanged */ });
it("removes the email, the password and the sessions, keeps the row, and marks the request done", async () => {
  clock.advance(15 * DAY_MS);                    // TestClock.advance takes milliseconds
  expect(await purgeDueAccounts(deps)).toBe(1);
  expect(await prisma.user.findUniqueOrThrow({ where: { id } }))
    .toMatchObject({ status: "deleted", email: `deleted-${id}@deleted.invalid`, name: "Deleted", adultOn: null });
  expect(await prisma.account.count({ where: { userId: id } })).toBe(0);
  expect(await prisma.verification.count({ where: { OR: [{ identifier: email }, { value: email }, { value: id }] } })).toBe(0);
  expect((await prisma.deletionRequest.findFirstOrThrow({ where: { userId: id } })).purgedAt).not.toBeNull();
});
it("does nothing the second time", async () => { /* answers 0 */ });
it("skips a request that signing in cancelled", async () => { /* restoreOnSignIn on day 3, clock to day 15: answers 0, still active */ });
it("lets the same address sign up again afterwards", async () => { /* a new User with the old email can be made */ });
```

  `purge-job.test.ts` (Review Focus 8): `POST /jobs/purge-accounts` with no header answers 404; with a wrong secret 404; with `Bearer test-only-jobs-secret` 200 and a body with a number `purged`; `GET` answers 405 or 404. `playwright.config.ts` passes `JOBS_SECRET: "test-only-jobs-secret"`. `tests/netlify.test.ts`: the file names the `purge-accounts` schedule, `netlify/functions/purge-accounts.mjs` exists, contains no `import`, and contains the text `process.env.JOBS_SECRET` and no literal secret. Stub. Push. Expected: `postgres` fails in `purge.pg.test.ts` ("not built yet"); `browser` fails in `purge-job.test.ts` (the secret request gets 404); `verify` fails in `netlify.test.ts`.
- [ ] **Step 2 (green):** the code. Push. Expected: all pass. The branch merges.
- [ ] **Step 3: on the real site, once S1 is done.** `JOBS_SECRET` was set at S1. After Netlify's next deploy, ask the coordinator to have the Owner (or whoever has the Netlify account) confirm that the function is listed as scheduled and that its first run shows 200 in Netlify's function log. Record in progress.md what was seen, by whom and when. If the function is not listed, report what Netlify shows; do not start a fourth fix.

---

# Branch G: `slice-1/membership`

### Task 21: The membership tables

First, before any code: send the coordinator the S2 steps ("Where execution stops", above) word for word, with the API version that `stripe` 22.6.2 pins (read it from the package itself, for example its `apiVersion` file once Task 22 adds it; if that is the first moment it can be read, send S2 with Task 22's red push), for the Owner. Branch H does not merge until S2 is done.

**Files:**
- Create: `prisma/schema/membership.prisma`, `prisma/migrations/<timestamp>_membership/migration.sql`
- Modify: `prisma/schema/accounts.prisma` (the `User` relations)
- Test: `tests/features/membership/schema.pg.test.ts`

**The tables**, carried from `OLD/packages/db/prisma/schema.prisma` (lines 948 to 1010, 1297 to 1310, 1736 to 1790), trimmed:

| Model | Columns |
|---|---|
| `BillingCustomer` | as carried: `id`, `userId` unique, `stripeCustomerId` unique, `createdAt` |
| `PremiumMembership` | as carried without `dunningStep`: `id`, `userId` unique, `stripeSubscriptionId` unique, `plan PremiumPlan`, `state PremiumState`, `currentPeriodEnd`, `cancelAt?`, `pastDueSince?`, `createdAt`, `updatedAt` |
| `CheckoutIntent` | `id`, `userId`, `plan PremiumPlan`, `stripeCheckoutSessionId` unique, `returnTo`, `state CheckoutState` default `open`, `completedAt?`, `createdAt`, `updatedAt`; index on `userId`. New: `broughtByUserId?`, `arrivalPath?`, `arrivedAt?`, the arrival as it stood when this checkout started |
| `WebhookInbox` | as carried without `source` and `signatureOk` (only verified Stripe events are stored): `id`, `deliveryId` unique, `payload Json`, `receivedAt`, `processedAt?`, `error?`, `createdAt`, `updatedAt` |
| `MembershipPayment` | new. `id`, `stripeInvoiceId` unique, `userId`, `stripeSubscriptionId`, `plan PremiumPlan`, `periodStart`, `paidAt`, `grossCents BigInt`, `taxCents BigInt`, `cardFeeCents BigInt`, `createdAt`. No `updatedAt`: a row is added and never changed. `cardFeeCents` is only the card fee on the payment's own balance transaction (what the carried `readPaidPremiumInvoice` reads); Stripe's Billing and Tax fees are not on that transaction, so the name says which fee it is, and slice 5 finds the others. |
| `MembershipStart` | new. `id`, `checkoutIntentId` unique, `userId`, `stripeSubscriptionId`, `plan PremiumPlan`, `startedAt`, `broughtByUserId?` (a `User`), `arrivalPath?`, `arrivedAt?`, `createdAt`; index on `userId` and on `broughtByUserId`. No `updatedAt`: a row is added and never changed. One row per completed checkout: who started paying, when, and which maker's link they last arrived through, if any. |

Enums: `PremiumPlan { monthly, annual }`, `PremiumState { active, past_due, canceling, ended }`, `CheckoutState` as carried.

In the migration SQL, by hand: CHECK `MembershipPayment_amounts_check` (`"grossCents" > 0 AND "taxCents" >= 0 AND "cardFeeCents" >= 0`), CHECK `MembershipStart_arrival_check` (`"broughtByUserId"`, `"arrivalPath"` and `"arrivedAt"` are all null or all set), and a trigger that rejects UPDATE and DELETE on `MembershipPayment` and on `MembershipStart`, copied from the old append-only trigger: the function `reject_append_only_change()` and its `CREATE TRIGGER … BEFORE UPDATE OR DELETE` lines, `OLD/packages/db/prisma/migrations/20261007000000_m1_hosting/migration.sql` lines 587 to 602.

- [ ] **Step 1 (red):**

```ts
it("makes the membership tables", async () => { /* arrayContaining the six names */ });
it("refuses to change or delete a payment row", async () => {
  await insertPayment(prisma, { stripeInvoiceId: "in_1", grossCents: 999n });
  await expect(prisma.$executeRaw`UPDATE "MembershipPayment" SET "grossCents" = 1`).rejects.toThrow();
  await expect(prisma.$executeRaw`DELETE FROM "MembershipPayment"`).rejects.toThrow();
});
it("refuses a payment of nothing", async () => { /* grossCents 0n rejects */ });
it("keeps one row per Stripe invoice", async () => { /* a second in_1 rejects */ });
it("refuses to change or delete a membership start", async () => {
  await insertStart(prisma, { checkoutIntentId: "c1", broughtByUserId: maker.id, arrivalPath: "/g/a-game", arrivedAt });
  await expect(prisma.$executeRaw`UPDATE "MembershipStart" SET "broughtByUserId" = NULL, "arrivalPath" = NULL, "arrivedAt" = NULL`).rejects.toThrow();
  await expect(prisma.$executeRaw`DELETE FROM "MembershipStart"`).rejects.toThrow();
});
it("refuses half an arrival", async () => { /* broughtByUserId set, arrivalPath and arrivedAt null: rejects */ });
it("keeps one membership start per checkout", async () => { /* a second c1 rejects */ });
```

  Push. Expected: `postgres` fails in `schema.pg.test.ts`: the tables do not exist.
- [ ] **Step 2 (green):** the schema and the migration. Make the SQL with `prisma migrate diff` from the schema folder as it is on `main` (copy it to a scratch folder with `git show`) to the new one. Push. Expected: all pass, including Task 1's drift test.

### Task 22: The prices and the Stripe calls for joining

**Files:**
- Create: `src/features/membership/plans.ts`, `stripe-client.ts`, `checkout.ts`
- Test: `tests/features/membership/plans.test.ts`, `stripe-client.test.ts`, `checkout.test.ts`

**Interfaces:**
- Produces:
  - `PREMIUM_PRICES_CENTS`, `PREMIUM_TRIAL_DAYS` from `OLD/packages/billing/src/plans.ts` with `plans.test.ts`. Changed: the prices are `{ monthly: 999n, annual: 9900n }` (the old file says `799n` and `7900n`); the carried tests' expected amounts change with them.
  - `createStripe(options: { secretKey: string; apiBase?: string }): Stripe` and `checkoutExpiry(nowMs): number`, `interface CheckoutStarted { id; url }` from `OLD/packages/billing/src/stripe.ts`. `apiBase` (for example `http://127.0.0.1:12111`) replaces `mockPort`: it points the SDK at CI's stand-in. Trim: store prices, one-time checkout, tips, `readCardFee`, the tax code for tips.
  - From `OLD/packages/billing/src/premium.ts` with `premium.test.ts`, whole: `PREMIUM_PRODUCT_ID`, `PREMIUM_TAX_CODE`, `PREMIUM_LOOKUP_KEYS`, `interface PremiumPrices`, `ensurePremiumPrices(stripe)`, `isMissing(error)`, `createBillingCustomer(stripe, input)`, `premiumCheckoutExpiry(nowMs)`, `interface PremiumCheckoutInput`, `startPremiumCheckoutSession(stripe, input)`, `closeCheckoutSession(stripe, sessionId)`. Three changes, all because the price changed. The carried code refuses to charge when it finds a price under its lookup key at a different amount ("a changed price needs a new lookup key"), and a Stripe account that ran the old code already holds the old prices. So: `PREMIUM_LOOKUP_KEYS` is `{ monthly: "ruken_membership_monthly", annual: "ruken_membership_annual" }`; `PREMIUM_PRODUCT_ID` is `"ruken_membership"`; and a product made by the code is named "Ruken membership". The check itself (`isTheRulesPrice`) is kept whole. Add to `checkout.test.ts`: prices are looked up under the two new keys and made at 999 and 9900 cents; a price found under a new key at 799 cents throws.
- Not carried: `premium.stack.test.ts` and stripe-mock.

- [ ] **Step 1 (red):** carried tests and stubs; `stripe-client.test.ts` asserts a client built with `apiBase: "http://127.0.0.1:12111"` sends to that host and port over http (read the options the SDK keeps; its type definitions in `node_modules/stripe` show how. The old `stripe.test.ts` has no such case, so this one is new). Push. Expected: `verify` fails in the three files with "not built yet" (`plans.test.ts` fails on the missing values).
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 23: The membership rules and the arrival cookie (pure)

**Files:**
- Create: `src/features/membership/reducer.ts`, `access.ts`, `format.ts`, `arrival.ts`
- Test: `tests/features/membership/reducer.test.ts`, `access.test.ts`, `format.test.ts`, `arrival.test.ts`

**Interfaces:**
- Produces:
  - `type PremiumPlan`, `type MembershipState`, `interface SubscriptionSnapshot`, `interface MembershipRow` (without `dunningStep`), `reduceMembership(previous, snapshot, observedAtMs): MembershipRow | null` from `OLD/packages/billing/src/membership.ts` with `membership.test.ts`. Trim: `dunningStep` from the type, the reducer and the tests' expected rows; nothing else.
  - `PAST_DUE_GRACE_MS` (seven days), `interface AccessFields`, `pastDuePausesAt(membership): Date`, `premiumAccess(membership: AccessFields | null, nowMs: number): boolean` from `OLD/packages/core/src/premium/access.ts` with `access.test.ts`. Trim: `hasPremium`, `premiumAmong` and grants (Task 26 reads the row itself).
  - `dollars(cents: bigint): string` (`999n` → `"$9.99"`, `9900n` → `"$99"`) and `longDate`, re-exported from `src/lib/long-date.ts` (Task 19). `dollars` is new and small; see `OLD/apps/web/src/lib/premium/format.ts` for the old shapes.
  - New, in `arrival.ts`, with `node:crypto` only:
    - `interface Arrival { makerUserId: string; path: string; atMs: number }`: the maker whose link it was, the link's path on Ruken (`/g/<game>` or `/<handle>`), and the server's time.
    - `ARRIVAL_COOKIE = "rk_arrival"`, `ARRIVAL_MAX_AGE_SECONDS = 34_560_000` (400 days, the longest a browser keeps a cookie).
    - `sealArrival(arrival: Arrival, secret: string): string`: `<payload>.<mac>`, where the payload is the arrival as JSON in base64url and the mac is HMAC-SHA256 over `"ruken-arrival-v1:" + payload` with the secret, in base64url. The fixed prefix keeps this use of the secret apart from every other.
    - `openArrival(value: string | undefined, secret: string): Arrival | null`: null for no value, a value without exactly one dot, a mac that does not match (compared with `timingSafeEqual`), JSON that does not parse, a `makerUserId` that is not a string of 1 to 64 characters, a `path` that does not start with `/` or is longer than 200 characters, or an `atMs` that is not a whole number above zero. It never throws.

- [ ] **Step 1 (red):** carried tests; `format.test.ts` with the two `dollars` values above, and `dollars(123456n)` → `"$1,234.56"`. `arrival.test.ts`, for Review Focus 9:

```ts
const arrival = { makerUserId: "maker-1", path: "/g/a-game", atMs: 1_800_000_000_000 };
it("opens what it sealed", () => { expect(openArrival(sealArrival(arrival, "s"), "s")).toEqual(arrival); });
it("ignores a value sealed with another secret", () => { expect(openArrival(sealArrival(arrival, "other"), "s")).toBeNull(); });
it("ignores a payload changed after sealing", () => {
  const [, mac] = sealArrival(arrival, "s").split(".");
  const forged = Buffer.from(JSON.stringify({ ...arrival, makerUserId: "maker-2" })).toString("base64url");
  expect(openArrival(`${forged}.${mac}`, "s")).toBeNull();
});
it.each([undefined, "", "no-dot", "a.b.c", "!!.!!"])("ignores %j", (value) => { expect(openArrival(value, "s")).toBeNull(); });
it("ignores a sealed value of the wrong shape", () => {
  expect(openArrival(sealArrival({ ...arrival, path: "https://evil.example" }, "s"), "s")).toBeNull();
  expect(openArrival(sealArrival({ ...arrival, makerUserId: "" }, "s"), "s")).toBeNull();
  expect(openArrival(sealArrival({ ...arrival, atMs: Number.NaN }, "s"), "s")).toBeNull();
});
```

  Review Focus 5 is pinned by `access.test.ts`'s past-due cases: confirm the carried file has "still a member six days after the first failure", "not a member at seven days" and "never past the period end", and add any that is missing. Stubs. Push. Expected: `verify` fails in the four files with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 24: Reading and ending a subscription

**Files:**
- Create: `src/features/membership/subscription.ts`, `stripe-port.ts`, `tests/support/fake-premium-stripe.ts`
- Test: `tests/features/membership/subscription.test.ts`

**Interfaces:**
- Produces, from `OLD/packages/billing/src/subscription.ts` with the matching cases of `subscription.test.ts`: `interface PremiumSubscription`, `premiumSubscriptionOf(subscription)`, `readSubscription(stripe, id)`, `cancelSubscriptionNow(stripe, id)`, `voidPayableInvoices(stripe, id)`, `interface PaidPremiumInvoice`, `readPaidPremiumInvoice(stripe, invoiceId)`, and `createPortalLink(stripe, customerId, returnUrl): Promise<string>`.
- Changed: `createPortalLink` is the old `createCardPortalLink` without `flow_data`, so Stripe's portal opens whole and the member can cancel there (design 5.6). Its test asserts the call has `customer` and `return_url` and no `flow_data`.
- Trim: `setCancelAtPeriodEnd`, `switchToAnnual`, `readPremiumBilling`, `listPaidPremiumInvoices`, `readInvoiceForPayment` and their types.
- `interface PremiumStripe` and `bindPremiumStripe(stripe): PremiumStripe` from `OLD/packages/billing/src/premium-stripe.ts`, with these methods only: `prices()`, `createCustomer`, `startCheckout`, `closeCheckout`, `subscription`, `cancelNow`, `voidPayableInvoices`, `portalLink(customerId, returnUrl)`, `paidInvoice`.
- `FakePremiumStripe` in `tests/support/fake-premium-stripe.ts`: the `FakeStripe` class from the top of `OLD/packages/core/src/premium/service.pg.test.ts` (old lines 21 to 135), cut to the methods above. It remembers subscriptions and invoices so database tests can drive them.

- [ ] **Step 1 (red):** carried tests and stubs. Push. Expected: `verify` fails in `subscription.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 25: The webhook: verify, store, handle once

**Files:**
- Create: `src/features/membership/webhook.ts`, `inbox.ts`, `events.ts`
- Test: `tests/features/membership/webhook.test.ts`, `inbox.pg.test.ts`, `events.test.ts`

**Interfaces:**
- Produces:
  - `WEBHOOK_TOLERANCE_SECONDS = 300`, `verifyStripeWebhook(delivery: { payload; signature; secret; nowMs }): Stripe.Event` from `OLD/packages/billing/src/webhook.ts` with `webhook.test.ts`, whole.
  - `storeStripeDelivery(db, event, receivedAtMs): Promise<string>`, `processStripeDelivery(deps: { db; clock; live: boolean; handle(event): Promise<void> }, inboxId): Promise<"processed" | "already_processed" | "livemode_mismatch">` from `OLD/packages/core/src/billing/webhook-inbox.ts` with the matching cases of `webhook-inbox.pg.test.ts`. Trim: the job name and retry policy, `retryStaleStripeDeliveries` and its constants.
  - `interface StripeEvent`, `interface MembershipEventHandlers { completeCheckout(input: { stripeCheckoutSessionId; subscriptionId; atMs }): Promise<unknown>; expireCheckout(stripeCheckoutSessionId: string): Promise<unknown>; syncSubscription(subscriptionId, observedAtMs): Promise<SyncOutcome>; recordInvoicePaid(invoiceId): Promise<InvoicePaidOutcome>; report(problem: Error): void }`, `handleStripeEvent(handlers, event): Promise<void>` from `OLD/packages/core/src/billing/stripe-events.ts` with the matching cases of `stripe-events.test.ts`.
- The events acted on (also the list the Owner gives Stripe at S2): `checkout.session.completed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Also asked of Stripe and only kept, for slice 5: `charge.dispute.created`, `charge.dispute.closed`, `charge.refunded`. Any other type is kept and does nothing.
- `handleStripeEvent` calls `report` for the outcomes a person must see, with these messages: `second_subscription` → "A member has two subscriptions running. Cancel one in Stripe."; `paid_after_end` → "An invoice was paid after its subscription ended. Refund it in Stripe.". The old store, tip, Connect and dispute branches are not carried.

- [ ] **Step 1 (red):** carried tests and stubs. Add to `events.test.ts`: a `charge.dispute.created` event calls no handler and does not throw. Add to `inbox.pg.test.ts`, for Review Focus 1: storing the same event twice leaves one row and answers the same id; processing it twice calls `handle` once. Push. Expected: `verify` fails in `webhook.test.ts` and `events.test.ts`, `postgres` in `inbox.pg.test.ts`, with "not built yet".
- [ ] **Step 2 (green):** the code. Push. Expected: all pass.

### Task 26: The membership service

**Files:**
- Create: `src/features/membership/sync.ts`, `payments.ts`, `service.ts`, `services.ts`, `membership.ts`
- Modify: `.env.example`
- Test: `tests/features/membership/sync.pg.test.ts`, `payments.pg.test.ts`, `service.pg.test.ts`, `services.test.ts`

**Interfaces:**
- Consumes: Tasks 21 to 25; `RateLimiter` (Task 4), with membership's own `CHECKOUT_STARTS_PER_USER` and `checkoutStartKey(userId)` (`api:checkout-start:<userId>`) declared in `service.ts`; `authServices()` for the Prisma client, the clock and the cookie policy.
- Produces:
  - `type SyncOutcome`, `syncMembership(deps: { db; stripe }, subscriptionId, observedAtMs)`, `lockMembership(tx, userId)` from `OLD/packages/core/src/premium/sync.ts` with `sync.pg.test.ts`, whole but for `dunningStep`.
  - `recordPayment(db, paid: PaidPremiumInvoice): Promise<"recorded" | "duplicate">` in `payments.ts`: inserts one `MembershipPayment` row with `createMany({ skipDuplicates: true })`, and answers `"duplicate"` when the invoice was already there. It throws for `gross === 0n` with the carried message. This replaces `OLD/packages/core/src/premium/payment.ts`, whose ledger posting arrives in slice 5. `paidAfterEnd` is carried whole from `OLD/packages/core/src/premium/paid-after-end.ts` into this file.
  - `createMembershipService(deps: { db; clock; siteOrigin: string; stripe: PremiumStripe; rateLimiter: RateLimiter })` from `OLD/packages/core/src/premium/service.ts`, returning:
    - `startCheckout(input: { userId: string; plan: PremiumPlan; returnTo: string; arrival: Arrival | null }): Promise<{ url: string }>`. New: when `arrival` names a `User` row that exists, the new `CheckoutIntent` gets `broughtByUserId`, `arrivalPath` and `arrivedAt` from it; otherwise all three stay null. Nothing about the arrival goes to Stripe. The rest as carried (rate limit, the member's lock, closing an older open checkout, the customer, the prices), with `successUrl: ${siteOrigin}/join/done?checkout=${ref}`, `cancelUrl: ${siteOrigin}/join?plan=${plan}&next=${encodeURIComponent(returnTo)}`, and the ref from `randomUUID()`.
    - `view(userId): Promise<MembershipView>` where `type MembershipView = { state: "none" | MembershipState; member: boolean; plan: PremiumPlan | null; renewsAt: Date | null; endsAt: Date | null; pausesAt: Date | null }`. `member` is `premiumAccess(row, clock.epochMs())`.
    - `isMember(userId): Promise<boolean>`.
    - `checkoutState(input: { ref: string; userId: string }): Promise<{ state: "open" | "completed" | "expired"; returnTo: string } | null>`: null for a ref that is not this person's.
    - `portalLink(userId): Promise<{ url: string }>`, returning to `${siteOrigin}/me`; `NOT_FOUND` when the person has no `BillingCustomer`.
    - `endNow(userId): Promise<"ended" | "none">`: for a row that has not ended, `stripe.cancelNow`, `stripe.voidPayableInvoices`, then `syncMembership`. Used by "Delete my account".
    - `completeCheckout`, as carried (the old `completePremiumCheckout`: mirror the subscription first, then mark the checkout completed), with one addition: marking the intent completed and inserting its `MembershipStart` row (`checkoutIntentId`, `userId`, `stripeSubscriptionId`, `plan`, `startedAt` from the event's time, and the intent's three arrival columns) happen in one transaction, and only when the intent was not completed before. A repeat adds nothing.
    - the other webhook handlers: `expireCheckout(stripeCheckoutSessionId)`, carried from the old store service (`OLD/packages/core/src/store/service.ts` line 269: an open intent becomes `expired`), since Premium was the old store's neighbour there; `syncSubscription`; and `recordInvoicePaid(invoiceId): Promise<InvoicePaidOutcome>` (`recorded | duplicate | not_premium | not_this_stack | paid_after_end`), as carried, with no receipt and in the carried order: read the invoice; `not_this_stack` for an unknown member; sync; `duplicate` when a `MembershipPayment` row for the invoice already exists (checked before the next step, as the old ledger check was, so a repeat is never reported as paid after the end); `paid_after_end`; then `recordPayment`.
    - Slice 1 only records who brought a member. Nothing reads `MembershipStart` yet but tests; slice 5 does.
  - `class MembershipError` with `code: "INVALID_REQUEST" | "NOT_FOUND" | "ALREADY_MEMBER" | "RATE_LIMITED"` (the carried `PremiumServiceError`, renamed).
  - `membershipServices(): { service; arrival; verify(payload: string, signature: string): StripeEvent; receive(event: StripeEvent): Promise<void> }` in `services.ts`, built once from `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_LIVE` (`"true"` or `"false"`; anything else throws), optional `STRIPE_API_BASE`, and `BETTER_AUTH_URL` as the site origin. `receive` is `storeStripeDelivery` then `processStripeDelivery` with `handleStripeEvent`; `report` writes one line with `console.error` and no personal detail. `STRIPE_API_BASE` together with `STRIPE_LIVE=true` throws at start, so a live site can never be pointed at a stand-in (the carried rule from `OLD/packages/core/src/billing/env.ts`). Also carried from there, `stripeKeyMode` and `stripeModeProblem` without the `RUKEN_ENV` branches: the key's prefix (`sk_live_`, `rk_live_`, `sk_test_`, `rk_test_`) must agree with `STRIPE_LIVE`, and a key with neither prefix is refused, or it throws at start. Without it, a live key left with `STRIPE_LIVE=false` would mark every real payment's events "livemode_mismatch" while Stripe was told they were delivered. CI's `sk_test_fake` is a test key and passes.
  - `arrival` is `{ remember(cookies: Cookies, link: { makerUserId: string; path: string }): void; read(cookies: Cookies): Arrival | null }` (`Cookies` is SvelteKit's). `remember` seals the link with the clock's time and sets `rk_arrival` with `path: "/"`, `httpOnly`, `sameSite: "lax"`, `secure` from the cookie policy and `maxAge: ARRIVAL_MAX_AGE_SECONDS`. `read` is `openArrival` on that cookie. Both use `BETTER_AUTH_SECRET`; no new setting. `remember` is what slice 2's `/g/<game>` and slice 3's `/<handle>` call when a visitor lands on them; nothing in slice 1 calls it.
  - `membership.ts` re-exports `membershipServices`, `MembershipError`, `type MembershipView`, `type PremiumPlan`, `type Arrival`, `PREMIUM_PRICES_CENTS`, `dollars`, `longDate`.
- Trim from the service: the launch switch, `subjectSecret` and the member key, `getPremium`'s creator numbers, cancel and resume, the card-only link, `getPremiumBilling`, the plan switch, chargebacks, the receipt.

- [ ] **Step 1 (red):** carry the matching cases of `service.pg.test.ts` (starting a checkout; already a member; an older open checkout closed first; the earlier one turned out paid; the rate limit; `completeCheckout`; `syncSubscription`; `recordInvoicePaid` with each outcome), driven by `FakePremiumStripe`. Add:

```ts
it("two starts at the same moment leave one open checkout", async () => {           // Review Focus 2
  await Promise.all([start(), start()]);
  expect(await prisma.checkoutIntent.count({ where: { userId, state: "open" } })).toBe(1);
});
it("invoice.paid arriving before the checkout completes still makes one membership and one payment", async () => {  // Review Focus 1
  await service.recordInvoicePaid("in_1");
  await service.completeCheckout({ stripeCheckoutSessionId, subscriptionId, atMs });
  await service.recordInvoicePaid("in_1");
  expect(await prisma.premiumMembership.count({ where: { userId } })).toBe(1);
  expect(await prisma.membershipPayment.count({ where: { stripeInvoiceId: "in_1" } })).toBe(1);
});
it("answers a repeat as a duplicate even after the subscription has ended", async () => {
  await service.recordInvoicePaid("in_1");
  await service.endNow(userId);
  expect(await service.recordInvoicePaid("in_1")).toMatchObject({ outcome: "duplicate" });
});
it("stores what Stripe said was paid, in cents", async () => {
  expect(await prisma.membershipPayment.findUniqueOrThrow({ where: { stripeInvoiceId: "in_1" } }))
    .toMatchObject({ grossCents: 1081n, taxCents: 82n, cardFeeCents: 61n, plan: "monthly" });
});
it("endNow stops the subscription in Stripe and ends the membership, keeping the payments", async () => {   // Review Focus 6
  expect(await service.endNow(userId)).toBe("ended");
  expect(stripe.subscriptions.get(subscriptionId)?.status).toBe("canceled");
  expect((await service.view(userId)).member).toBe(false);
  expect(await prisma.membershipPayment.count({ where: { userId } })).toBe(1);
});
it("a checkout ref belongs to the person who started it", async () => {
  expect(await service.checkoutState({ ref, userId: someoneElse })).toBeNull();
});
it("records the maker whose link the member last arrived through", async () => {
  await service.startCheckout({ userId, plan: "monthly", returnTo: "/", arrival: { makerUserId: maker.id, path: "/g/a-game", atMs } });
  await completeTheOpenCheckout();
  expect(await prisma.membershipStart.findMany({ where: { userId } })).toMatchObject([
    { broughtByUserId: maker.id, arrivalPath: "/g/a-game", arrivedAt: new Date(atMs), plan: "monthly", stripeSubscriptionId: subscriptionId },
  ]);
});
it("records a member nobody brought, with no maker", async () => {
  await service.startCheckout({ userId, plan: "annual", returnTo: "/", arrival: null });
  await completeTheOpenCheckout();
  expect(await prisma.membershipStart.findMany({ where: { userId } })).toMatchObject([
    { broughtByUserId: null, arrivalPath: null, arrivedAt: null, plan: "annual" },
  ]);
});
it("records no maker when the arrival names an account that does not exist", async () => {   // Review Focus 9
  await service.startCheckout({ userId, plan: "monthly", returnTo: "/", arrival: { makerUserId: "nobody", path: "/g/a-game", atMs } });
  await completeTheOpenCheckout();
  expect((await prisma.membershipStart.findFirstOrThrow({ where: { userId } })).broughtByUserId).toBeNull();
});
it("records the last arrival when a person starts paying twice", async () => {               // Review Focus 10
  await service.startCheckout({ userId, plan: "monthly", returnTo: "/", arrival: { makerUserId: maker.id, path: "/g/a-game", atMs } });
  await service.startCheckout({ userId, plan: "monthly", returnTo: "/", arrival: { makerUserId: otherMaker.id, path: "/other", atMs: atMs + 1 } });
  await completeTheOpenCheckout();
  expect(await prisma.membershipStart.findMany({ where: { userId } })).toMatchObject([{ broughtByUserId: otherMaker.id, arrivalPath: "/other" }]);
});
it("a checkout completed twice leaves one membership start", async () => {
  await completeTheOpenCheckout(); await completeTheOpenCheckout();
  expect(await prisma.membershipStart.count({ where: { userId } })).toBe(1);
});
```

  `completeTheOpenCheckout()` is a helper in the test file: it makes the person's open checkout paid at `FakePremiumStripe` and calls `service.completeCheckout` with that session. `maker` and `otherMaker` are two more `User` rows. Every carried `startCheckout` call gains `arrival: null`.

  `services.test.ts`: `arrival.read` answers what `arrival.remember` set, with the clock's time, on a cookie jar made in the test, and the cookie is set with `httpOnly`, `sameSite: "lax"`, `path: "/"` and `maxAge: 34_560_000`; `arrival.read` answers null for a cookie typed by hand; `STRIPE_LIVE=maybe` throws; `STRIPE_API_BASE` with `STRIPE_LIVE=true` throws; `sk_live_x` with `STRIPE_LIVE=false` throws, and so does `sk_test_x` with `STRIPE_LIVE=true` and a key with no known prefix; a missing `STRIPE_WEBHOOK_SECRET` throws "Missing setting STRIPE_WEBHOOK_SECRET". Stubs. Push. Expected: `postgres` fails in the three `.pg.test.ts` files and `verify` in `services.test.ts`, with "not built yet".
- [ ] **Step 2 (green):** the code and the new names in `.env.example`. Push. Expected: all pass, including the layer test (`membership` imports `accounts` only through `accounts.ts`). Branch G is ready to merge.

---

# Branch H: `slice-1/paywall`

### Task 27: A stand-in Stripe for the journeys, and the paywall card

**Files:**
- Create: `tests/browser/support/fake-stripe-server.ts`, `src/routes/join/+page.server.ts`, `src/routes/join/+page.svelte`
- Modify: `playwright.config.ts`
- Test: `tests/browser/join.test.ts`

**The stand-in.** `fake-stripe-server.ts` is a plain `node:http` server on `127.0.0.1:12111`, started by Playwright as a second `webServer` entry (`node tests/browser/support/fake-stripe-server.ts`, ready when `GET /ready` answers 200). It exists only under `tests/`. It keeps state in memory and answers, in Stripe's JSON shapes, exactly the calls `bindPremiumStripe` makes: retrieve and create the product; list and create prices; create a customer; create, retrieve and expire a Checkout session; retrieve and cancel a subscription; list invoices; retrieve an invoice with the expansions `readPaidPremiumInvoice` asks for; create a portal session. Take each shape from the fixtures in the carried unit tests (`checkout.test.ts`, `subscription.test.ts`), so the stand-in and the unit tests agree. It also serves two pages of its own:

- `GET /pay/<session>`: a page with one button, "Pay". Pressing it makes the subscription `active` and a paid invoice (for monthly: $9.99 plus 82 cents tax, $10.81 in all, with a 61-cent fee; made-up numbers that only the stand-in uses), POSTs `checkout.session.completed`, `customer.subscription.created` and `invoice.paid` to `http://localhost:4173/webhooks/stripe`, each signed with `whsec_test_fake` through the Stripe SDK's `webhooks.generateTestHeaderString`, waits for the three answers, then redirects to the session's `success_url`. The same page opened as `/pay/<session>?events=later` redirects first and sends the three events three seconds afterwards, as Stripe sometimes does (Task 29 uses it).
- `GET /portal/<session>`: a page with one button, "Cancel membership". Pressing it sets the subscription to cancel at the period end, POSTs a signed `customer.subscription.updated`, waits, then redirects to the `return_url`.

`playwright.config.ts` passes the app `STRIPE_SECRET_KEY: "sk_test_fake"`, `STRIPE_WEBHOOK_SECRET: "whsec_test_fake"`, `STRIPE_LIVE: "false"`, `STRIPE_API_BASE: "http://127.0.0.1:12111"`.

**The paywall card** (`/join?next=<path>&plan=<monthly|annual>`). Slice 2's Play button sends a person who is not a member here, with `next` set to the game they tapped.

```
Join Ruken to play

$9.99 a month, or $99 a year. Tax is added where it applies.
You pay on the next page, then come straight back.

(•) Monthly   $9.99 a month
( ) Yearly    $99 a year

[ Continue ]

Not now
```

- The prices on the card come from `PREMIUM_PRICES_CENTS` through `dollars`, passed by `load`; they are not typed into the page.
- Signed out, "Continue" goes to `/sign-up?next=` the same card with the plan kept; back on the card, the button reads "Continue to payment". That is the only point where the card asks for sign-in (design 5.2).
- Signed in, "Continue to payment" starts the checkout and sends the browser to Stripe. The checkout takes the arrival from the `rk_arrival` cookie at that moment. The card shows nothing about it and has no field for it.
- A member who opens the card sees instead: "You're already a member." and one button-styled link, "Keep playing", to `next`.
- "Not now" goes to `next` when it is a page that needs no membership, otherwise to `/`. This slice: always `/`.
- Refusals, above the button: rate limit, "You've started a lot of checkouts just now. Try again in a minute."; anything else, "Something went wrong on our side. Try again in a moment."

Grandma: two short lines say what it costs and what happens next; one button; "Not now" is the way back; coming back from Stripe without paying lands on this same card with the plan still chosen.

- [ ] **Step 1 (red):**

```ts
test("the card says the price and what happens next", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
  await expect(page.getByText("$9.99 a month, or $99 a year. Tax is added where it applies.")).toBeVisible();
  await expect(page.getByText("You pay on the next page, then come straight back.")).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(1);
});
test("a signed-out person is asked to sign up only after pressing Continue, and keeps their plan", async ({ page }) => {
  await page.goto("/join?next=/me");
  await page.getByLabel("Yearly").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/sign-up\?next=/);
  /* finish sign-up → back on /join, "Yearly" still checked, button "Continue to payment" */
});
test("Continue to payment opens the payment page", async ({ page }) => {
  await signUp(page); await page.goto("/join");
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByRole("button", { name: "Pay" })).toBeVisible();   // the stand-in's page
});
test("next pointing off the site is ignored", async ({ page }) => { /* /join?next=//evil.example → "Not now" href is "/" */ });
```

  Commit the stand-in with the tests (it is test code; it needs no stub). Push. Expected: `browser` fails in `join.test.ts`: 404 at `/join`.
- [ ] **Step 2 (green):** `load` returns `{ next: safeNextPath(...), plan, prices, signedIn, member }` (`member` from `service.isMember` when signed in). The action `join` reads `plan` and `next`; signed out it redirects (303) to `/sign-up?next=` + the encoded card address; signed in it calls `service.startCheckout({ userId, plan, returnTo: next, arrival: arrival.read(event.cookies) })` and redirects (303) to the answer's `url`; `MembershipError` codes map to the words above (`ALREADY_MEMBER` redirects to `next`). Push. Expected: all pass.

### Task 28: The webhook route

**Files:**
- Create: `src/routes/webhooks/stripe/+server.ts`
- Test: `tests/browser/stripe-webhook.test.ts`

**Interfaces:**
- Produces: `POST /webhooks/stripe`, after `intake` in `OLD/apps/web/src/lib/server/store/handlers.ts` (old lines 95 to 125): read the raw body as text; no `Stripe-Signature` header or a failed `verify` answers 400 "Bad signature" and stores nothing; otherwise `receive(event)`; success answers 200 with no body; a failure in `receive` answers 500 "Not handled yet", so Stripe sends the event again. SvelteKit's cross-site check applies to forms, not to this JSON POST; confirm that in a comment beside the route after reading the framework's rule.

- [ ] **Step 1 (red):**   Review Focus 4.

```ts
test("a delivery with no signature is refused", async ({ request }) => {
  const response = await request.post("/webhooks/stripe", { data: { id: "evt_x", type: "invoice.paid" } });
  expect(response.status()).toBe(400);
});
test("a delivery signed with the wrong secret is refused", async ({ request }) => { /* header made with "whsec_wrong" → 400 */ });
test("a body changed after signing is refused", async ({ request }) => { /* sign one body, send another → 400 */ });
test("a signed event of a kind Ruken does not act on is kept and answered 200", async ({ request }) => {
  /* a signed "charge.dispute.created" → 200 */ });
```

  Push. Expected: `browser` fails in `stripe-webhook.test.ts`: the first three get 404, not 400; the last gets 404, not 200.
- [ ] **Step 2 (green):** the route. Push. Expected: all pass.

### Task 29: Coming back from paying

**Files:**
- Create: `src/routes/join/done/+page.server.ts`, `src/routes/join/done/+page.svelte`, `tests/browser/support/database.ts`
- Test: `tests/browser/pay.test.ts`

**The screen** (`/join/done?checkout=<ref>`), where Stripe sends the person after paying.

- The membership exists already (the usual case: Stripe's events arrive before the browser does): the server redirects straight to the checkout's `returnTo`. The person never sees this page.
- Not yet: heading "Finishing up…", line "Your payment went through. One moment." The page asks again every two seconds (`invalidateAll` from a timer that stops when the page is left) and goes on as soon as the membership exists.
- After thirty seconds of asking: heading "This is taking longer than usual.", line "Your payment went through. Your membership will show on your account in a minute.", and one button-styled link, "Go to my account".
- A ref that is not this person's, or none: redirect to `/join`. An expired checkout: redirect to `/join`.

Grandma: the person does nothing here; if it stalls, the page says their money is safe and gives one place to go.

- [ ] **Step 1 (red):**

```ts
test("a stranger signs up, pays, and lands where they were going as a member", async ({ page }) => {
  await page.goto("/join?next=/me");
  await page.getByRole("button", { name: "Continue" }).click();
  /* fill sign-up, Create account → back on the card */
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(page).toHaveURL("/me");
});
test("someone else's checkout ref goes back to the card", async ({ page }) => { /* /join/done?checkout=<random uuid> → toHaveURL(/\/join/) */ });
test("when Stripe's news is late, the page says so and goes on by itself", async ({ page }) => {
  /* as the first test, but open the stand-in's page with ?events=later before pressing "Pay" */
  await expect(page.getByRole("heading", { name: "Finishing up…" })).toBeVisible();
  await expect(page).toHaveURL("/me");                                   // waits on the page, not a sleep
});
test("a member's sign-up records the maker's link they came through", async ({ page, browser }) => {   // design 8
  const maker = await signUpInItsOwnContext(browser);                    // a second account, standing in for a maker
  const makerUserId = await userIdOf(maker.email);
  await page.context().addCookies([arrivalCookie({ makerUserId, path: "/g/a-game" })]);
  const member = await payAsNewMember(page);                             // sign up, then pay: the steps of the first test
  expect(await membershipStartsOf(member.email)).toMatchObject([{ broughtByUserId: makerUserId, arrivalPath: "/g/a-game" }]);
});
test("a member who came through no maker's link has no maker recorded", async ({ page }) => {
  const member = await payAsNewMember(page);
  expect(await membershipStartsOf(member.email)).toMatchObject([{ broughtByUserId: null, arrivalPath: null }]);
});
```

  The two arrival tests pass through sign-up and the stand-in Stripe with the real cookie, and then read the row, because no screen shows who brought a member. `tests/browser/support/database.ts` gives `userIdOf(email): Promise<string>` and `membershipStartsOf(email): Promise<MembershipStart[]>`, each on one Prisma client made from `TEST_DATABASE_URL` (the database the app under test uses) and closed when the worker ends; and `arrivalCookie(link): { name; value; url }`, which seals the link with `sealArrival` from `src/features/membership/arrival.ts`, the secret `playwright.config.ts` gives the app and the time now, for `http://localhost:4173`. It is test code, the only way an arrival exists before slices 2 and 3 bring the links. `payAsNewMember(page): Promise<{ email: string; checkoutSessionId: string }>` (it reads the session id from the stand-in's `/pay/<session>` address) and `signUpInItsOwnContext(browser)` go in `tests/browser/support/account.ts`.

  The thirty-second line is not reached by a journey (it would hold CI for thirty seconds a run); its words are checked by reading the page in review, and the report line says so. Push. Expected: `browser` fails in `pay.test.ts`: after "Pay" the browser is at `/join/done…`, a 404, not `/me`, and the late-news test finds no "Finishing up…". The two arrival tests fail the same way, inside `payAsNewMember`; say in the report line that their own assertion is first reached in the green push.
- [ ] **Step 2 (green):** `load` uses `signedInOnly`, then `service.checkoutState`. Push. Expected: all pass.

### Task 30: Membership on `/me`, cancelling, and deleting a member's account

**Files:**
- Modify: `src/routes/me/+page.server.ts`, `src/routes/me/+page.svelte`, `src/routes/me/delete/+page.server.ts`, `src/routes/me/delete/+page.svelte`, `src/features/membership/format.ts`, `src/features/membership/membership.ts`
- Test: `tests/browser/membership.test.ts`, `tests/features/membership/format.test.ts` (add cases)

**The words on `/me`**, under the email, by `MembershipView.state`:

| State | Line | Button |
|---|---|---|
| `none`, `ended` | You're not a member. | Join Ruken (link to `/join?next=/me`) |
| `active` | You're a member. $9.99 a month. Renews on Monday, December 14. (yearly: "$99 a year") | Manage or cancel |
| `canceling` | Your membership ends on Monday, December 14. You can play until then. | Manage |
| `past_due`, still a member | We couldn't charge your card. Update it by Monday, December 14 to keep playing. | Update card |
| `past_due`, no longer a member (`member` false: the seven days are over) | We couldn't charge your card, so your membership is paused. Update your card to play again. | Update card |

Under each button but "Join Ruken": "Opens Stripe, where you can change your card or cancel." Those buttons post one action, `portal`, which redirects to `service.portalLink(userId)`. The dates come from `longDate` on `renewsAt`, `endsAt` and `pausesAt`; the price from `dollars`. The table is one pure function, `membershipLine(view: MembershipView): { line: string; button: "join" | "manageOrCancel" | "manage" | "updateCard" }` in `format.ts`, re-exported by `membership.ts`, so every row is tested without a browser, including the two `past_due` rows no journey can reach (the stand-in has no failing card).

**On `/me/delete`**, a member also sees: "Your membership ends now. There is no refund for the time left, and signing in again does not bring it back." The action calls `service.endNow(userId)` before `requestDeletion`; if `endNow` throws, nothing is deleted and the page says "Something went wrong on our side. Try again in a moment." `MembershipStart` rows stay, like payment rows, whether the deleted account is the member's or the maker's: they hold account ids and a link's path, and the daily job leaves them alone.

Grandma: one line says where the person stands; one button says what they can do about it; the line under it says where the button goes.

- [ ] **Step 1 (red):**

```ts
test("someone who has not paid is told so and offered the card", async ({ page }) => {
  await signUp(page); await page.goto("/me");
  await expect(page.getByText("You're not a member.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Join Ruken" })).toBeVisible();
});
test("a member sees what they pay and when it renews", async ({ page }) => {
  await payAsNewMember(page);            // the steps of Task 29's first test
  await expect(page.getByText(/^You're a member\. \$9\.99 a month\. Renews on \w+, \w+ \d+\.$/)).toBeVisible();
});
test("a member cancels on Stripe and is told when it ends", async ({ page }) => {      // design 8: "A member can cancel."
  await payAsNewMember(page);
  await page.getByRole("button", { name: "Manage or cancel" }).click();
  await page.getByRole("button", { name: "Cancel membership" }).click();              // the stand-in's portal
  await expect(page).toHaveURL("/me");
  await expect(page.getByText(/^Your membership ends on \w+, \w+ \d+\. You can play until then\.$/)).toBeVisible();
});
test("a member who deletes their account is told the membership ends now", async ({ page }) => {   // Review Focus 6
  const member = await payAsNewMember(page);
  await page.goto("/me/delete");
  await expect(page.getByText("Your membership ends now. There is no refund for the time left, and signing in again does not bring it back.")).toBeVisible();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "You're signed out." })).toBeVisible();
  expect(await subscriptionStatusAtStandIn(member)).toBe("canceled");   // asks the stand-in, by the checkout session id payAsNewMember kept
});
test("a member who opens the card is told they are one", async ({ page }) => { /* "You're already a member." and link "Keep playing" */ });
```

  `payAsNewMember` is Task 29's. `subscriptionStatusAtStandIn(member): Promise<string>` goes in `tests/browser/support/account.ts`; the stand-in gains `GET /state/<checkout session id>` answering the subscription's status. `format.test.ts` gains one case per row of the table above, with its exact line. Stub `membershipLine`. Push. Expected: `browser` fails in `membership.test.ts`: no "You're not a member." on `/me`; `verify` fails in `format.test.ts` with "not built yet".
- [ ] **Step 2 (green):** the page changes. Push. Expected: all pass. The branch is marked ready to merge once S2 is done ("Where execution stops").

### Task 31: Paying and cancelling on the real site

No code unless a check fails. Nothing here is typed into the repository.

- [ ] **Step 1: S2 done.** S2 was asked for at Task 21 and is done before branch H merged. If it is not, this step waits for the Owner's "done".
- [ ] **Step 2: Stripe test mode, on the real site.** A person signs up, opens `/join`, pays with Stripe's test card, lands on `/me` as a member, presses "Manage or cancel", cancels in Stripe's portal, and sees "Your membership ends on …". In Stripe's dashboard the Owner confirms: the product "Ruken membership" and its two prices exist at $9.99 and $99, tax was worked out on the invoice, and the webhook deliveries answered 200. Record in progress.md what was checked, by whom and when. If a step fails, report what the page and Stripe's webhook log say; a fix is a new small branch with its own failing test first.
- [ ] **Step 3: STOP S3.** Report that slice 1 is done in test mode and that live mode waits for the Owner: live keys, the live webhook endpoint, `STRIPE_LIVE=true`, real terms and privacy text, and the Owner's own payment with a real card (design 8). Live mode is not a condition for starting slice 2.
- [ ] **Step 4:** set slice 1's row in progress.md from what is true: "done" only when every branch is merged, main is green, and Step 2 passed.

---

## Notes for the plans that follow

- `isMember` (`membershipServices().service.isMember(userId)`) answers one question: is this person paying. It is not the rule for who may play, and nothing in slice 1 stands between a person and a game. Slice 2 writes that rule in `play`, as its own tested function that asks `isMember` among other things: a game staff marked free (FloorFifty on launch day, with no account), staff, a maker on their own game, and later a free-play code. Those are separate from a membership on purpose, because that play never counts toward pay and a member's does. Free-play codes are not a kind of `PremiumMembership`.
- Slice 2's Play button sends a person who may not play to `/join?next=/g/<game>`. The words on the card ("Join Ruken to play") stay true when one game is free: the card is only reached from a game that is not.
- Slices 2 and 3 call `membershipServices().arrival.remember(cookies, { makerUserId, path })` in the `load` of `/g/<game>` and `/<handle>`, with the maker's account id read from the database and `url.pathname`. Every landing replaces the cookie, so the last arrival wins. The feed at `/` is not an arrival and leaves the cookie alone. The journey for design 8 ("A member's sign-up records the maker's link they came through") is then redone from a real link.
- Slice 5 reads `MembershipStart` for "Bringing a member": the maker, the path, the arrival's time and when paying started are all there, one row per completed checkout, and applies the Owner's rules there, by pure functions: only a person's first join counts, for 12 months, and a maker gets no bonus on their own membership.
- The privacy text (the Owner's, before S3) should say that Ruken remembers which maker's link a visitor came through, in a cookie, to pay that maker.
- Features hold no Svelte components yet. An entry file that mixed server code and components would pull Prisma and Stripe into the browser's bundle, and the layer test allows one entry file per feature. The first slice that needs a shared component decides how a feature exposes one, and changes `tests/architecture.test.ts` in its own task.
- Slice 4 adds what the admin portal needs to `accounts`: admin sessions, the authenticator code, the first-owner command, suspension.
- Slice 5 posts `MembershipPayment` rows and the kept dispute and refund events into the ledger. `LEDGER_SUBJECT_KEY` and the member key arrive then.
- Left out on purpose and worth the Owner's eye before launch: Turnstile and the breached-password check on sign-up; a daily comparison of Stripe's paid invoices against `MembershipPayment` (the old "reconcile"); cleaning old `RateLimit`, `Verification` and `SignInGuard` rows (the old hourly sweep).
- Also worth the Owner's eye, carried as the old code had them: sign-up says "There's already an account with that email", so the sign-up form tells a stranger whether an address has an account (sign-in and the reset do not); and the daily job removes a deleted person's details from Ruken's database only, while the Stripe customer it made (email and billing address) stays in Stripe.
- Slice 5: `MembershipPayment.cardFeeCents` is only the card fee. Design 6 takes "every fee Stripe charges on that payment (card, Billing, Tax)" off the top; Stripe charges the Billing and Tax fees outside the payment, so slice 5's plan says where those facts are read from.
- Netlify answers a request within its function time limit (10 seconds unless the plan raises it). A webhook or a checkout start does a few Stripe calls in the request; if Netlify's log ever shows one timing out, Stripe sends the webhook again and the person presses the button again, and nothing is recorded twice.
