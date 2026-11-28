# Learned feed, public half 2 (PR #440): implementation audit 1

Examined: `0ed7278` (code and runs), plus the journey-only delta to head `e5fb768` (read). Reviewer: fresh session, Opus 5.5, medium. Lane 2.

Verdict: **FAIL, 2 red.**

## What ran (at 0ed7278, this container)

- `pnpm lint`: pass. `pnpm typecheck`: pass (0 errors).
- `vitest` `tests/features/feed/feed-public.test.ts`, `tests/features/feed/ranker.test.ts`, `tests/features/accounts/` (unit): 288 passed. The `.pg` files there did not run (no `TEST_DATABASE_URL` for vitest).
- `feed-caught-up.test.ts` on tablet and computer against Postgres 16: 2 passed. Run with a local copy of the config without the WebKit warm-up (no WebKit here); the phone did not run.
- A probe (not committed): the line put on a page's first clip, where the first-open hint also is, at 320×568, 375×667 and 667×375 on tablet and computer. Every visible text node and control was measured box against the line. The line is one line (193×44, scrollWidth = clientWidth), top 72px, under the top bar. Nothing overlaps it but the whole-clip link under everything (`a.open`), which the line lets presses through to (`pointer-events: none`). Screens checked by eye.

## Privacy gating (A5): no defect found

- `askingOf` (`src/features/feed/feed-public.ts:91`) returns the crowd before any read when `learned` is off, the person is signed out, or `hasConsent` is false (`rk_consent` at the current version). Tested, with "never read" asserted.
- `learningOf` (`src/features/feed/taste.ts:59`) gives `locked` for a missing user, `adultOn` null, or `isAdultOn` false. `isAdultOn` compares the DATE column's day with today in America/Chicago (`src/features/accounts/age.ts:103`). The cutoff is tested at Chicago midnight (`tests/features/accounts/age.test.ts:11`, `:80`, 04:59:59Z against 05:00:00Z). `locked` maps to `adult: false, parentSaidYes: false`, so a teen is the crowd even with `teenPersonal` on. `off` maps to `learnFromMe: false`, which is the crowd. A read that throws is the crowd.
- Both routes (`src/routes/+page.server.ts:16`, `src/routes/api/feed/+server.ts:11`) use the new path. No other caller of `askingOf`.

## Red findings

### R1. The line is never shown in the most common case

UNIT: `src/features/feed/service.ts:338-342` (and `tests/features/feed/ranker.test.ts:188`).
VERDICT: red.
REQUIREMENT: spec 6.1 "one frosted line at the page's `caughtUpAt`; the feed keeps going under it", and A11.
REASON: when `caughtUpAt` equals the page's item count (caught up right after this page's last clip), the line is dropped, and no later page carries it. The private ranker gives exactly that whenever round 0 ends a page.
EVIDENCE: in RukenPrivate `worker/src/feed/feed.ts:125-153`, `endRound` sets `caughtUpAt = items.length`. The loop then `break`s as soon as the page holds `MORE_AT_LEAST` (10), and the trailing `if (left().length === 0) endRound()` does the same at `FEED_MAX`. Its own comment says "the caught-up line is on the page round 0 ended on". So a viewer with 10 or more new games left in their last round-0 page gets `caughtUpAt === items.length`. `service.ts:340` then does `items.slice(caughtUpAt)`, which is empty, so `caughtUp` is never set. The next page has round ≥ 1 and `caughtUpAt: null`. The unit test asserts that drop on purpose: `for (const caughtUpAt of [null, 3])` on a 3-item page expects `caughtUp` undefined. The line shows only when round 0 ends partway into a page (fewer than 10 left).
EXPECTED: a person who has seen every new game sees "You're all caught up" on the first clip after the last new one, whether that clip is on the same page or the next.
FIX: when no shown clip is at or after `caughtUpAt` (`caughtUpAt === items.length`, or every later item left out), the page says the line goes on the next page's first clip, for example `caughtUp: "next"` or a separate `caughtUpNext: true` on `FeedPage`. `Feed.svelte`'s `loadMore` then puts the line on the first new clip of the page after. Files: `src/features/feed/service.ts`, `src/features/feed/Feed.svelte`, `tests/features/feed/ranker.test.ts` (the `3` case now expects the carry), `tests/browser/feed-caught-up.test.ts` (a case where the stand-in marks the end of a page and the line shows on the next page's first clip). No RukenPrivate change is needed.

### R2. Sideways, the bar column sits on Like, Save and Repost

UNIT: the feed at 667×375, opened from the Home Screen (`asInstalled`).
VERDICT: red. The owner's rule (2026-11-27 23:12 UTC): any overlap of two controls, on any page, at 320×568, 375×667 and 667×375, blocks, new or not.
REASON: on this head, the bar's Home, + and You tiles cover the Like, Save and Repost buttons and their labels.
EVIDENCE: a probe screenshot at 667×375 on tablet: the bar column, about x 592–652 and y 100–275 (CSS px), stands over Like, Save and Repost at the same x. This is on `main` too. It is the overlap the owner reported, and #435 (criteria 10–11, `controls-overlap.test.ts`) fixes it. `feed-caught-up.test.ts` checks only the line against controls, so it passes.
EXPECTED: no two controls overlap at 667×375.
FIX: no code in this PR. Merge `main` after #435 lands, then run `controls-overlap.test.ts` and `feed-caught-up.test.ts` on the merged head. If #435 is still open when this one is otherwise ready, it waits for #435.

## Notes (not blocking)

- N1. The journey was changed at `e5fb768` to hold the stand-in's page until the first page is counted ("with few games live, the screen asks for the next page as soon as it starts"). If that came from a run that failed once and then passed, record it under Flaky tests in `progress.md`.
- N2. `+page.server.ts` now reads `learningOf` twice for a consented signed-in person: once in `askingOf` before the first page, once in parallel for Your feed. The first-page read is serial. It is small, but it could be shared.
- N3. A `caughtUp` key whose clip was dropped as a duplicate in `loadMore` (`!have.has(clip.key)`) would put the line on the earlier copy. Keys carry the round, so this should not happen with the private ranker.
- N4. Nothing private in the diff: no weight, rule or setting value (criterion 6 met).
- CRUD: this change adds nothing a user makes.
