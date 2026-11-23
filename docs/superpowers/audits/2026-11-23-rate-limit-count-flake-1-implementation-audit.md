# Rate-limit count flake: implementation audit 1 (lane 2)

Examined: `c814116` (`c81411649a790017e4253b96c0b0493cef6bfb85`) on `claude/project-thread-b4dhof-tests`, pull request #365, base `main` at `e0a9fdc`. Written by a fresh session (Opus 5.5, medium).
Brief: the pull request's four acceptance criteria.

**Verdict: PASS, 0 red, 2 notes.** The change is a real isolation, not a weaker assertion.

## What ran

- Read the diff (`tests/browser/support/database.ts`, `docs/superpowers/progress.md`), `tests/browser/support/rate-limits.ts`, the journey at `tests/browser/cookie-consent.test.ts:252-280`, `src/routes/api/v1/api.server.ts` and `src/features/accounts/computer-keys.ts`.
- `pnpm typecheck`: 0 errors, 0 warnings (2177 files). `eslint` and `prettier --check` on the two changed files: clean.
- The new pattern, run in Node on sample keys with address `192.0.2.1`: matches `192.0.2.1|/sign-up`, `api:computer-start:192.0.2.1`, `api:sign-up-code:192.0.2.1`, `x:192.0.2.1:y`; does not match `192.0.2.10|/sign-up`, `api:computer-start:192.0.2.11`, `192.0.2.1x|a`, `1192.0.2.1|a`, `api:v1:u1`.
- Not run here: the journeys (they need CI's database and Worker). CI's quick run on `c814116` was in progress when this was written; the full run, which criterion 3 names, only runs once the pull request is ready.

## Criteria

1. **Exact match: met.** `rateLimitRows()` narrows with `contains: address`, then keeps a row only when the address sits between a start, `:` or `|` and an end, `:` or `|` (database.ts:164-170). This is the same boundary as `keyHolding()` in rate-limits.ts:36, which `forgetRateLimits()` uses to decide what to keep, so the rows counted are exactly the rows other workers leave alone.
2. **Isolation is real: met.** Another worker's `forgetRateLimits()` deletes rows with no journey address (except `api:auth:%`) and rows holding its own address (rate-limits.ts:54-57); `forgetCodeLimits()` deletes rows ending in a phone hash; `forgetAddressCounters()` deletes only its own worker's address. None can delete a row holding this worker's address. Other workers cannot add one either, since each sends its own `CF-Connecting-IP`. Addresses are unique among workers running at once: `TEST_PARALLEL_INDEX` is unique among concurrent workers, and a reused index never runs beside the worker it replaces (rate-limits.ts:15-18). The journey's own worker runs `forgetRateLimits` only in `beforeEach`, never during the test.
3. **Green: open, judged by CI.** Lint and typecheck are clean here. The full browser run must be green before merge (the merge gate already requires it).
4. **Recorded: met.** progress.md "Flaky tests" names the test, the run, the cause, the fix and the gap.

## Other callers and other whole-table counts

- `rateLimitRows()` has one caller, `cookie-consent.test.ts:273` and `:276`; its meaning there ("a refused call writes no row") is kept for this worker's rows.
- No other journey helper counts a whole table another worker clears. The remaining counts are filtered: `feeRowsKept(product)` (only checked `> 0`, and nothing deletes fee rows), `membershipStartsOf(number)`, `playOf(slug)`, and the per-key reads in `auth.pg.test.ts:411` and `:582` (a separate unit database, filtered by address or prefix).

## Notes (not blocking)

- NOTE 1. UNIT: `tests/browser/support/database.ts:164`. REASON: the boundary pattern repeats `keyHolding()` from rate-limits.ts rather than sharing it. EVIDENCE: two copies of `(^|:)…([|:]|$)`. EXPECTED: one copy, so the two cannot drift apart. FIX (optional, later): export `keyHolding` and use it here; files: the two support files.
- NOTE 2. UNIT: the journey's check. REASON: the gap the pull request records is real but narrow: a regression that wrote an address-less row on a refused key (for example a counter keyed by the presented key) would no longer be seen. EVIDENCE: the only limiter keys on this path today are `api:v1:<userId>`, which a made-up key cannot reach because `maker()` answers 401 first (api.server.ts:67-69), and `expect(refused.status()).toBe(401)` still guards that. EXPECTED: nothing for this change; recorded so a later key-counter change knows to extend the check.
