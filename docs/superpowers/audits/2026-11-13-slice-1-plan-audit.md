# Slice 1 plan audit

Date: 2026-11-13. Stage 3 (plan audit) of slice 1, accounts and membership.

Audited: `docs/superpowers/plans/2026-11-13-slice-1-accounts-membership.md` as merged to `main` at `d9555c0`, against the design (`docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`, mainly 5.2, 5.6, 6, 7 and 8, and the Owner's 2026-11-13 decisions), `CLAUDE.md`, `AGENTS.md`, `docs/superpowers/progress.md`, the code on `main` (`package.json`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `tests/architecture.test.ts`, `vite.config.ts`, `playwright.config.ts`, `tsconfig.json`, `eslint.config.js`), and the archived `mcthaydt/RukenAppFailed` at `188e8a07546ba19c431468ddf2624e3cc4173d4e` (written `OLD/`), read file by file.

What was run: nothing. No test, lint, typecheck, build or Prisma command ran in this session (CLAUDE.md: checks run only on GitHub's runners). Every finding below comes from reading the files. Where a finding rests on how a tool behaves and not on a file, it says so.

Severity: **blocks execution** (the plan as written would stop the execution session, fail for the wrong reason, or do harm); **should fix** (wrong, missing or unsafe, but execution would get past it); **note** (small, or kept on purpose).

Every finding is fixed in the plan in the same commit as this audit, unless its line says why it stays.

## Counts

| Severity | Found | Fixed in the plan | Stays |
|---|---|---|---|
| Blocks execution | 4 | 4 | 0 |
| Should fix | 19 | 19 | 0 |
| Note | 15 | 9 | 6 |

## Checked and found right

- Every dependency the plan adds is pinned at the same version in the old repository: `prisma`, `@prisma/client`, `@prisma/adapter-pg` 7.10.0; `pg`, `@types/pg` 8.23.1; `better-auth` 1.7.7; `stripe` 22.6.2; `nodemailer` 10.0.13; `@types/nodemailer` 8.0.2. The plan's "not added" list (zod, cuid2, Testcontainers, pg-boss, Testing Library, jsdom) is right that each was pinned there and is not needed here.
- Every `OLD/` path the plan names exists at `188e8a0`. The schema line ranges (User 59 to 193, Session 195 to 212, Account 214 to 232, Verification 234 to 243, StaffAssignment 246 to 255, RateLimit 282 to 287, SignInGuard 299 to 306) and the `auth.pg.test.ts` line numbers (141, 154, 172, 195, 210, 216, 231, 320 to 360, 694, 997) point at what the plan says. The `FakeStripe` class sits at lines 50 to 133 of `service.pg.test.ts`, inside the plan's "21 to 135".
- The old drift test ran with the `DeletionRequest` partial unique index in place, so Task 1's drift test is not upset by the hand-written index.
- Every task is test-first: a red push with stubs and a named failing job, then a green push. Each says which job fails and with what.
- Feature folders and layers: `accounts` imports no feature; `membership` imports `accounts` only through `accounts.ts`; both are in `FEATURE_ORDER` in `tests/architecture.test.ts`. Tests live only in `tests/`.
- Money is `bigint` cents everywhere (`PREMIUM_PRICES_CENTS = { monthly: 999n, annual: 9900n }`, `BigInt` columns, `dollars(cents: bigint)`), and every amount is read from Stripe.
- The clock is injected in every carried service; feature code never reads wall time.
- The Owner's 2026-11-13 decisions are all in the plan: the age rule, the 14-day delete, the Netlify deploy, the protected `main`, the new prices with no trials, the arrival recorded from launch day with no time limit, every join recorded as it happened (first-join and no-self-bonus rules left to slice 5), and `arrival.remember` built ahead of its caller.
- The CI change is one commit that quotes the Owner and design 7.4, and no secret is used.
- Every screen has a "Grandma" line (after the fixes below, the error page and the under-13 screen too).

## Findings

### Blocks execution

**B1. The carried clock and age check need Temporal, which the plan neither adds nor carries.** Tasks 2, 4, 5, 7, 17, 20 and every `.pg.test.ts` that uses `TestClock`.
`OLD/packages/core/src/clock/index.ts` declares `Clock.now(): Temporal.Instant`; `system.ts`, `testing.ts` (`TestClock`) and `identity/age.ts` import `@js-temporal/polyfill`; `age.ts` also calls `chicagoDayOf` from `clock/zone.ts`, which Task 2 trimmed. The plan's dependency list leaves the polyfill out and says to stop on anything else, so Task 2 (or Task 7) would stop. The old repository pinned `@js-temporal/polyfill` 0.5.1, so design 7.1 already allows it.
*Fixed:* the polyfill at 0.5.1 is on the dependency list with the reason; Task 2 carries `Clock` whole, `CALENDAR_ZONE` and `chicagoDayOf` (with their `zone.test.ts` cases), and names `TestClock`'s real methods; Task 7 says how `ageCheck` reads the Chicago day.

**B2. Task 1's red push would fail for the wrong reason.** Task 1, steps 1 and 2.
The red commit had `base.prisma` with no models while `db.ts` imports the generated client. Prisma's `generate` makes no client from a schema without models (it says "nothing will be generated"; this is how the tool behaves, not run here), so lint, typecheck and the build would fail on a missing import before the database test ran.
*Fixed:* the red commit holds `accounts.prisma`; only the migration is left for green. The expected red now names all three tests, the drift test included.

**B3. The browser journeys would import a Prisma client that does not exist yet.** Task 1 scripts; first hit at Task 29.
`tests/browser/support/database.ts` (Task 29) imports the generated client. Playwright loads the journey files before its web server runs `pnpm build`, and only the build ran `prisma generate`. The `browser` job would fail to load the files.
*Fixed:* `test:browser` starts with `pnpm generate &&`, like `lint`, `typecheck`, `test` and `build`.

**B4. Linking Netlify as S1 described would let pull requests change the real database.** "Where execution stops", S1.
Netlify builds a deploy preview for every pull request of a linked repository by default, and the build command runs `prisma migrate deploy` with the site's variables. A branch's migration (branch G's, say) would be applied to the real database before review, and before it was green.
*Fixed:* S1 step 3 turns deploy previews and branch deploys off, with the reason.

### Should fix

**S1. The `DeletionRequest` window CHECK was missing.** Task 1, the tables. The old migration adds `DeletionRequest_window_check` (`purgeAfter > requestedAt`) beside the partial index; the plan carried only the index. *Fixed:* both are listed, with the old file and lines.

**S2. The tests for the rolling 30-day session and for mail after the answer were dropped.** Task 9, step 1. The kept groups left out "sessionInfo" (old line 1191 is the only test that a day-old session gets a fresh cookie) and "mail after the answer" (1123, 1154), though the plan keeps both behaviours. *Fixed:* both groups are kept.

**S3. One easy cut would sign everyone out.** Task 9. `sessionInfo` reads `user.status`, which better-auth returns only because `user.additionalFields.status` is declared. The plan trimmed the `displayName` field and the hook beside it without saying `status` stays; cut together, every account reads as not `active` and the hook treats everyone as signed out. *Fixed:* stated as kept, with why; the default `log` is stated too (old `reportWarning` is not carried).

**S4. The entry file's export list was incomplete, so the layer test would fail.** Task 11. The layer test checks every file under `src/`, `hooks.server.ts` and routes included, and they may reach `accounts` only through `accounts.ts`. The list lacked `createHandle` (the hook needs it) and what Tasks 17 to 20 add. And `services.test.ts` must build services from a test environment, which `authServices()` alone cannot; the old file had `createAuthServices(source)`. *Fixed:* the list and `createAuthServices` are in the plan; a global constraint says routes and the hook go through entry files.

**S5. Membership's own rate-limit rule sat in `src/lib/`.** Task 4. `RATE_LIMITS.checkoutStartsPerUser` and `checkoutStartKey` are membership logic; CLAUDE.md keeps `src/lib/` for helpers with no feature logic. *Fixed:* `src/lib/server/rate-limit.ts` keeps only the limiter (and `RATE_LIMIT_ROWS_KEPT_MS`, which the limiter itself checks); the rule and key move to `membership/service.ts` (Tasks 4 and 26).

**S6. `/healthz` would fail when a sign-in setting is missing.** Tasks 10 and 16. The old hook skipped the caller check for `/healthz`; the trim list did not say whether that stays, and without it the health check builds the sign-in services first. *Fixed:* kept, with its test.

**S7. A carried safety check on the Stripe key was left out.** Task 26. `OLD/packages/core/src/billing/env.ts` refuses to start when the key's mode (`sk_live_`/`sk_test_`) disagrees with `STRIPE_LIVE` (old audit H3): a live key left with `STRIPE_LIVE=false` marks every real payment `livemode_mismatch` and tells Stripe it was delivered. S3 is exactly when the Owner changes these. *Fixed:* carried, with three test cases.

**S8. `recordInvoicePaid` had no stated order once the ledger is gone.** Task 26. The old code answered `duplicate` from the ledger before the `paid_after_end` check. With `recordPayment` doing the duplicate check at insert, a repeat of an invoice whose subscription has since ended would be reported for a refund. *Fixed:* the order is written out, and a test pins it.

**S9. `feeCents` named a fact wrongly.** Tasks 21 and 26. The carried reader takes the card fee from the payment's balance transaction. Design 6 takes "every fee Stripe charges on that payment (card, Billing, Tax)" off the top, and Stripe charges the Billing and Tax fees outside the payment. *Fixed:* the column is `cardFeeCents`, the table says what it holds, and the notes for slice 5 say the other fees are still to be found. Sent to the coordinator as a design question for slice 5.

**S10. The goodbye page could name the day before.** Task 19. `/goodbye?on=<yyyy-mm-dd>` formatted through `longDate(Date)` in Chicago: `new Date("2026-11-27")` is UTC midnight, which is the 26th in Chicago. *Fixed:* `on` is `chicagoDayOf(purgeAfter)`; `longDay(day)` formats a calendar day without an instant; `longDate(at)` is `longDay(chicagoDayOf(at))`; tests pin both and a bad day.

**S11. `/me` would tell a lapsed member to act "by" a date already past, and no test reached the `past_due` lines.** Task 30. After the seven days, `past_due` still showed "Update it by <date>". *Fixed:* a row for `past_due` with `member` false, in plain words; the table is one pure function, `membershipLine`, with a unit case per row.

**S12. "Finishing up…" was never tested.** Task 29. The stand-in sent its events before redirecting, so the page's waiting state never showed in a journey. *Fixed:* the stand-in can send them three seconds late, and a journey sees "Finishing up…" and then lands on its own. The thirty-second line stays unreached by a journey (note N13).

**S13. No screen for failures.** Task 12. SvelteKit's default error page has no words a person would use and no way back; AGENTS.md asks for "a plain way back when something fails". *Fixed:* `+error.svelte`, its words, its grandma line and a journey.

**S14. The under-13 screen had no way on.** Task 13. *Fixed:* one link, "Back to Ruken".

**S15. The Owner's steps were not exact.** S1 and S2. Missing: Neon's region and which address is which; Netlify's variable scopes (the build runs migrations, the scheduled function reads `JOBS_SECRET`); the primary domain; the SMTP line's form and verifying the mail domain; the webhook endpoint's API version (the handlers read event fields in the shape of the version `stripe` 22.6.2 pins); a Stripe Tax registration, without which a test invoice shows no tax and Task 31's check cannot pass; the portal's exact switches. *Fixed:* S1 and S2 are numbered steps.

**S16. The real site would break between branch H's merge and S2.** S2 was asked for at Task 31, after branch H merged; Netlify deploys `main` after each merge, and `/me` and `/join` then need Stripe settings that are not there. *Fixed:* S2 is asked for at Task 21, and branch H waits for it before it is marked ready.

**S17. It was unclear whether work stops while the Owner does S1.** *Fixed:* a stop holds only its own check; the next branch starts once the one before is merged. S2 is the one hard wait.

**S18. The `pnpm-workspace.yaml` change was unnamed.** Task 1 listed the file without saying what changes. The old repository pinned two of Prisma 7.10's command-line dependencies for security (`deepmerge-ts` 8.0.2, `mysql2` 3.24.5). *Fixed:* carried as `overrides`, with their comment; they add no package.

**S19. The purge test called a method `TestClock` does not have.** Task 20 used `clock.advanceDays(15)`; the carried `TestClock` has `advance(ms | duration)` and `set(at)`. *Fixed.*

### Notes

**N1.** Task 26 called `expireCheckout` "as carried" from the premium service; it was in `OLD/packages/core/src/store/service.ts` line 269. *Fixed:* named.

**N2.** Task 20 deleted `Verification` rows only where `identifier` is the email. A password-reset row holds the user's id in `value`; the old purge also matched `value`. Harmless (those rows expire in an hour) but the plan's words were not what happens. *Fixed:* the match and a test line.

**N3.** Task 18 set the welcome-back cookie to 60 seconds; the carried value is 5 minutes, "long enough to survive the sign-in redirect", and no reason was given for the change. *Fixed:* carried value; and the comment in `copyAuthCookies` that calls the cookie readable by scripts is corrected.

**N4.** `isStaff` was carried and exported, but nothing in slice 1 reads it (CLAUDE.md: build nothing ahead of its user). *Fixed:* trimmed; slice 4 brings it.

**N5.** `mailFailureCode`'s test cases live in `OLD/apps/web/src/lib/server/auth/mailer.test.ts`, not in the core `mailer.test.ts` Task 4 named. *Fixed:* named.

**N6.** Task 22 said to read the Stripe SDK's options "the way `OLD/packages/billing/src/stripe.test.ts` does"; that file has no such case. *Fixed:* says the case is new and where to look.

**N7.** Task 21's `grep … | head` for the append-only trigger finds five files. *Fixed:* the file and lines (`reject_append_only_change()`, m1_hosting lines 587 to 602).

**N8.** The file map lacked `src/lib/long-date.ts`, the root layout, `/healthz` and the new error page. *Fixed.*

**N9.** The sign-in and sign-up forms' hidden `next` field was implied, not said. *Fixed:* said in Task 11.

**N10. Stays.** The arrival is read when the person presses "Continue to payment", not when the payment lands. A person who pays in a first tab after landing on another maker's link in a second tab is recorded with the first maker. Reading it later is not more right (the return from Stripe may be on another device). The plan now says so under "Bringing a member". Sent to the coordinator.

**N11. Stays.** Carried as the old code had them, and now listed for the Owner's eye: sign-up tells a stranger whether an address has an account ("There's already an account with that email"); the daily job leaves the Stripe customer (email, billing address) in Stripe.

**N12. Stays.** The old Task 6 source `OLD/apps/web/.../sign-in-pause-plugin.ts` has no test file beside it; the core plugin's test covers the merged plugin, and the plan's new case covers the notice mail. Nothing to change.

**N13. Stays.** `/join/done`'s thirty-second line is not reached by a journey, which would hold CI thirty seconds a run. The plan says so and has the report line say so.

**N14. Stays.** Netlify gives a request about ten seconds; the carried transaction timeouts (20 and 30 seconds) are longer. A timed-out webhook is sent again by Stripe and nothing is recorded twice. Written in the notes for later.

**N15. Stays.** Branch G is six tasks. It is still one feature's server code with no screens, and splitting it would leave a branch whose code nothing uses; the plan keeps it whole.

## For the coordinator

Nothing here needs the Owner's decision before execution starts. Sent as information:

1. The Temporal polyfill (B1) is added under design 7.1's rule (the old repository pinned it at 0.5.1). If the Owner would rather not have it, the alternative is to rewrite the carried age check without it, which the design's "carry the proven parts" argues against.
2. Design 6's Billing and Tax fees (S9): Stripe does not put them on the payment, so slice 5 needs a way to read them as facts. A design question for slice 5's spec, not for this slice.
3. Deploy previews off (B4) is an Owner setting in S1, within the Owner's deploy decision.
4. The two-tab arrival case (N10).
