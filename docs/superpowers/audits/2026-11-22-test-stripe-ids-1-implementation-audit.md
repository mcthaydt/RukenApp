# Implementation audit 1: test Stripe ids start from the clock (PR #287)

- Commit examined: ac88d29 (head of `claude/project-thread-xxz6ir`; parent aedd00d is on `main`)
- Lane 2, fresh review after the build. Reviewer: Opus 5.5, medium.
- Written: 2026-11-22 00:45 UTC
- Verdict: **PASS**, no red findings, one note.

## What changed

One line in `tests/browser/support/fake-stripe-server.ts`: `let counter = 0` became `let counter = Date.now() * 1000`, with a comment saying why. `nextId` still adds 1 per id and keeps one counter for every kind. Diff against `origin/main...pr287`: 1 file, +5 −1. No app code, no test, no golden, no `verify` step touched.

## Checks run

| Check | Result |
|---|---|
| Diff touches only the named file | Yes, `git diff origin/main...pr287 --stat`: 1 file |
| Two starts of the stand-in hand out disjoint ids | Ran it twice in a row (Node 22 with `--experimental-strip-types`), two customers each: run 1 `cus_1795308292281001`, `…002`; run 2 `cus_1795308293521001`, `…002`. Run 2 starts above run 1. |
| Ids stay exact integers | `Date.now()*1000` < `Number.MAX_SAFE_INTEGER`, with about 7.2e12 ms (some 228 years) of headroom; `String()` prints plain digits below 1e21, so no exponent form. |
| Id shape still read by the journeys | `stand-in-payment.ts:12` reads `/^\/pay\/(cs_test_\d+)$/`; longer digit runs still match. |
| No test depends on small ids | No `cus_1`/`cs_test_1`-style literal in `tests/browser`. The `in_1`, `sub_1`, `ch_1` literals in `tests/features/money/*` are Vitest/pg tests that never call the stand-in. |
| Lint of the changed file | `npx eslint tests/browser/support/fake-stripe-server.ts` exit 0 |
| CI on ac88d29 | `pr-rules-run` and `commit-authors` success; `verify`/`postgres` (quick, draft) still running at review time. Merge still waits on `gate`. |

Not rerun here: the builder's two-runs-on-one-database membership journeys (9/9 twice) and the 266/266 wider set. The builder reports them in the PR body; this review checked the mechanism directly instead.

## Can two servers collide?

- **Same time:** no. The stand-in listens on fixed port 12111 and Playwright starts it with `reuseExistingServer: false`, so only one runs on a machine at once. CI's six browser shards each have their own `postgres:16` service (`.github/workflows/ci.yml:314`), so their ids never meet one database.
- **One after another on one database:** run 2 starts at T2 ≥ T1 + run 1's lifetime. Run 1's highest id is T1·1000 + N. It overlaps run 2 only if run 1 made 1,000 or more ids for each millisecond it lived, which is millions of ids a run, far beyond what a journey run makes.
- **Same millisecond:** would need two servers on the same port at once, which the port rules out.

## Does it weaken a test?

No. No assertion, wait or check changed. The journeys still go through checkout, and the unique columns (`stripeCustomerId`, `stripeSubscriptionId`, `stripeCheckoutSessionId`, `stripeInvoiceId` …, `prisma/schema/membership.prisma`) are still exercised; the change only stops the stand-in reusing a number an earlier run already stored.

## CRUD

The change adds or touches nothing a user can make. No CRUD journey applies.

## Findings

- **N1 (note).** UNIT: `tests/browser/support/fake-stripe-server.ts`. VERDICT: note. REASON: the order relies on the wall clock moving forward; a clock set back between two local runs (by hand, or a large NTP step) could restart below old ids. EVIDENCE: `let counter = Date.now() * 1000`. EXPECTED: nothing for now; the risk is local-only and tiny. FIX (only if it ever bites): seed from a random 48-bit offset as well, same file only. Not to be fixed in this PR.
