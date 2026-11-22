# Implementation audit 1: feed screen (slice 3 unit D), RukenApp #285

Examined: 23d239e (head of claude/project-thread-u4abc4). Lane 2, one fresh review. Reviewer: Sonnet 5.5, medium.
Verdict: **23d239e FAIL: 2 red**

## What I did
Read the whole diff against D1 to D14 (spec section "Unit D") and CLAUDE.md: Feed.svelte, current.ts, share.ts, Bar.svelte, layout, pages.screens.ts, architecture test, the five new test files and the verify skill edit. Did NOT run the suite: this container has no node_modules, no Postgres and no WebKit, so the journeys were not re-run by me. CI on this head had only `pr-rules-run` (queued) when I looked.

## Criteria walk
D1 yes (`feed.test.ts`). D2 yes (Chromium; WebKit left to CI). D3 yes (request count + preload test). D4 yes. D5 yes (band contrast test). D6 yes (`current.test.ts` + journey). D7 yes (z-index puts band/Share above the Sound button). D8 yes (`share.test.ts`). D9 yes. D10 yes. D11 yes (`bar.test.ts`). D12 yes (`empty.test.ts`). D13 yes. D14 yes (architecture rule; verify edit unrun, as the body says).

## Red findings

UNIT: tests/browser/feed.test.ts (and feed-controls.test.ts)
VERDICT: red
REQUIREMENT: brief ("18+ games stay out of the feed for anyone not known to be 18+"); the owner's 18+ follow-up from #277 ("feed route journey must assert 18+ absent when it ships"); a review fails a change whose feed tests do not check it.
REASON: nothing in the feed screen's tests makes an 18+ game and checks it is absent from `/`.
EVIDENCE: `grep -i "18\|adult\|age"` over tests/browser/feed*.ts and tests/features/feed/{current,empty,share}.test.ts finds nothing. The only 18+ assertion is `tests/features/feed/service.test.ts:105` (the service with stand-ins, from #277). `src/routes/+page.server.ts` is the wiring that could break it, and no test covers that wiring.
EXPECTED: a journey in feed.test.ts that makes a live game, sets it to 18+ with the existing `changeGame(slug, { ageRating: "age_18", contentMarks: [...] })`, opens `/` signed out and asserts `section[data-slug=<slug>]` has count 0 while a normal game's clip is present.
FIX: add that one test (and its setup) in tests/browser/feed.test.ts only.

UNIT: docs/superpowers/history.md ("Flaky tests") and tests/browser/feed-controls.test.ts:87
VERDICT: red
REQUIREMENT: CLAUDE.md Verification: "A test that fails once and passes on retry is a defect: record it under Flaky tests."
REASON: the sighting is only in the PR body, not recorded, and the cause is visible in the test.
EVIDENCE: the journey "each key moves one clip ... within a second" presses a key and then asserts `data-current` on the next clip within `timeout: 1000` plus `Date.now() - before < 1000`. `goTo` scrolls with `behavior: "smooth"` (Feed.svelte `goTo`), and `data-current` only flips once the IntersectionObserver sees 60%. On a runner running three profiles at once, a smooth scroll plus observer callback can pass one second. I did not reproduce it (no browser/db here), so I call it flaky by construction (a wall-clock limit on a smooth scroll), not proven. Its pass of 8 of 8 on rerun is consistent with that.
EXPECTED: the failure is entered under "Flaky tests" with run, commit, symptom and cause. The test waits on the state, not the clock: drop the `Date.now()` assertion and give the `data-current` waits the suite's normal 15 s (or check the smooth scroll arrived, as the reduced-motion test now does). If the "within a second" is a requirement, it should be a measured number in a quiet single-profile check, not in this journey.
FIX: tests/browser/feed-controls.test.ts (that one test) and docs/superpowers/history.md (one entry).

## Notes (not blocking)
- PR is `mergeable_state: dirty` (conflicts with main at aedd00d): resolve before ready; any merge resolution is a new head and makes this review stale for the resolved files.
- Phone/WebKit profile and `verify`'s driver run have not run; CI must pass on phone before merge.
- CRUD: the body says nothing a person makes is added; I agree (the feed only reads games, so no create/update/delete journey is owed by this change).
- Tests changed or deleted are all named in the body (home.test.ts removed, look/look-layout cases removed, make-walk, feed-controls, look.test.ts, architecture); the reasons given hold.

## Re-review
When fixed: I re-review the two files above at the new head.
