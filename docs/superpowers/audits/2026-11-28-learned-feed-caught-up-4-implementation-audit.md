# Learned feed caught-up line: implementation audit 4 (fix for audit 3)

PR #440, examined at 757030342d2b356ddc9d1c78c710ae0aa623e4b7 (7570303), the fix for audit 3's red 1 on top of 1c5f29a.
Lane 2. Reviewer: Opus 5.5, medium. Fresh session. Written 2026-11-28 03:26 UTC.
Prior audit: 2026-11-28-learned-feed-caught-up-3-implementation-audit.md, 1c5f29a FAIL (1 red). Scope: `git diff 1c5f29a 7570303`.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict: PASS (0 red, 3 notes)

## What changed

`git diff --stat 1c5f29a 7570303`: two files, as audit 3's fix allowed.
- `src/features/feed/Feed.svelte`: in `@media (orientation: portrait) and (max-width: 499px)`, a new `.caughtup + .hints`
  rule; in the sideways block, the same rule's top changed from `0.75rem + target + 3.5rem` to the line's own top
  (`max(0.75rem, env(safe-area-inset-top)) + target + 0.75rem`) plus 2.75rem (the line) plus 0.5rem (a gap). Both now
  follow the line's top, so a notch's safe area moves them together.
- `tests/browser/feed-caught-up.test.ts`: a new journey. It stands in for the page's own first page (the HTML's
  `first:{` data), marks its first clip caught up, forgets `rk_seen_hints`, and at the device window, 320×568, 375×667 and
  667×375 (Home Screen mode, `asInstalled` in `beforeEach`) measures the line and the tips apart, and each against every
  visible button and link. The first journey is unchanged but for sharing the size list.
- No live-state file at the head (`docs/superpowers/live/` absent). Commit author McThayDT.

## What ran

Playwright 1.63 in `mcr.microsoft.com/playwright:v1.63.0-noble` (WebKit for phone, Chromium for tablet and computer),
Postgres 16 local, `--retries 0`.

1. **The new journey fails by itself.** With `Feed.svelte` put back to 1c5f29a and the new test kept, `-g "caught up from
   the first clip"`, `--repeat-each 2`: failed 6 of 6 (phone, tablet, computer twice each): "the tips cover the line at
   375×667" on phone, "at 320×568" on tablet and computer.
2. **At 7570303**, `feed-caught-up.test.ts`: both journeys passed on phone, tablet and computer.
3. **Review probe** (not committed): the new journey run before launch (`rk_test_launch=before`, Wishlist) and after
   (Play), logging the boxes and the controls found, on all three profiles: 6 of 6 passed. Every size, both states:
   - 320×568: line {y 72, h 43.9}, tips {x 12, y 124, w 196, h 116.4}: gap 8.1px, tips end at y 240.
   - 375×667: line {y 72, h 43.9}, tips {x 12, y 124, w 251, h 96.1}: gap 8.1px.
   - 667×375: line {y 72, h 43.9}, tips {y 124, h 68.2}: gap 8.1px (audit 3's note 1, 0.1px, is gone).
   - tablet 810×1080 and computer 1280×720 take the base `top: 38%`: far apart (294px, 158px).
   - Controls measured each time: Home, Add a game, You, Sound, Fresh, Followed, Your turn, Search, the maker, Play or
     Wishlist, Like, Save, Repost, Share. None under the line or the tips.
4. `controls-overlap.test.ts` (every screen, three sizes, before and after launch): phone 2/2 passed; computer skipped by
   the test itself; tablet failed some runs, see note 1. Not caused by this change.
5. PR CI at 7570303: all 12 checks green (quick draft run, run 46101839380).
6. Not run locally: lint, typecheck, unit tests (CI's verify job ran them green at this head).

## Notes (not blocking)

1. **Flaky test, not from this change: `controls-overlap.test.ts` on tablet, game page at 667×375.** It failed 2 of 2
   tablet runs once, 2 of 4 the next time, and 1 of 2 with Feed.svelte put back to 1c5f29a, so it is there without this
   change. Probe (the overlap check printing the overlay's HTML) caught it: the overlay is the game page's own
   `<video ... data-loading>`, box [12,12,283.5,355], over "Back to the feed" [20,20,68,68]. While a video loads,
   `use:loads` paints its shimmer background, so the check (since e611fe7, which counts any painted positioned box)
   treats the video as a floating box over Back. Back sits on the video on purpose; once loaded the background goes.
   So no real overlap, but a check that fails by timing. EXPECTED: the check ignores a `[data-loading]` media element
   (or waits for the game page's video to load). FIX: `tests/browser/controls-overlap.test.ts` only, in its own pull
   request. Record under "Flaky tests" in `docs/superpowers/progress.md`.
2. The 2.75rem line height in both rules is written by hand (measured 43.9px = 2.74rem). If the line's words or
   padding change, the gap shrinks; the new journey will catch an overlap, not a smaller gap.
3. The branch is behind `main` (2b777a8, with #442); a merge of main needs only the carry-through rule, unless it
   conflicts outside `progress.md`.
