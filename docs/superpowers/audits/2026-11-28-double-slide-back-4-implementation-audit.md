# #454 review 4: a swipe or wheel made while Back slides in

Lane 3 implementation review, round 4, Opus 5.5, medium. Examined **40f4174** (`40f4174bb54a2df82407a2f36503d5fa7aebed93`). Journeys run in the Playwright 1.63 image on a local Postgres 16, in the review's own container.

**Verdict: PASS.** Round 3's one red is gone. CI's two red pieces at this commit are main's flakes, not this change (below); their failed jobs were started again.

## What changed since round 3 (9f88f7d)

`git diff 9f88f7d 40f4174` touches only `tests/browser/back-then-swipe.test.ts` (`drag`) and `docs/superpowers/progress.md` (Flaky tests notes). No app code changed. The drag now starts at 15% (down) or 85% (up) of the screen and goes 65% of it in eight moves, each CDP touch event carrying a `timestamp` 16 ms after the one before. The commit is authored by McThayDT with no Claude trailer.

## What was checked

| Check | Result |
| --- | --- |
| `back-then-swipe` at 40f4174 [phone, Chromium Galaxy S24] | 16 of 16 pass (4 cases × 4) |
| Same, with 55 ms of real wait before each touch move (the slow runner of CI 46131386058) | 16 of 16 pass |
| Same, with 120 ms of real wait before each move | 8 of 8 pass |
| Without the fix (`fingerDown` made a no-op in `src/lib/page-moves.ts`), normal speed | 16 of 16 fail, each at round 1: the feed did not move to the next clip |
| Without the fix, 55 ms waits | 8 of 8 fail the same way |
| `back-then-swipe` in CI 46136880223 at 40f4174 | 4 of 4 pass |
| `back-then-wheel` in CI 46136880223 | 4 of 4 pass |
| `controls-overlap` at 320×568, 375×667, 667×375 (phone, tablet) | 6 of 6 pass |
| Merge with main 0e2e3b2 | clean |

So the journey no longer depends on drag speed, and it still catches the bug.

## CI at 40f4174 (run 46136880223)

verify, postgres and pieces 2–5 green; pieces 1 and 6 red, so the gate is red. `pr-rules` was red only for want of a passing review naming 40f4174 (this one).

- Piece 1: `tabs-show-now.test.ts:128` [phone], expected `tiny-game-e8ff147e`, got `tiny-game-fcd9e9af`. Known main flake (review 3: 6 of 10 fails on main alone), already under Flaky tests.
- Piece 6: `feed-controls.test.ts:536` [phone] "a reload whose kept feed is shorter than the fresh one…", a page error "Fetch API cannot load …/followed/__data.json?x-sveltekit-invalidated=01 due to access control checks." This is WebKit cutting off the Followed tab's data fetch at the reload. It is main's: main's own run 46137690606 at 2bef4f6 (no #454) failed the same test with the same error on its first try and passed on the retry. Locally at 40f4174 it passed 10 of 10. The test uses keys and a reload; #454 only listens for touch, pointer and wheel while a slide runs.

Failed jobs started again at 11:41 UTC. On that try piece 6 passed and piece 1 failed `tabs-show-now.test.ts:128` [phone] again (expected `tiny-game-b92bdde0`, got `tiny-game-43c139aa`; job 140967002709), so the gate is still red at 12:01 UTC. That test fails 6 of 10 on main alone (review 3), so a PR run passes it only by luck; it needs its own fix on main. The merge waits for a green gate.

## Red

None.

## Notes (not blocking)

- `feed-controls.test.ts:536` [phone] is not under Flaky tests yet. It belongs to main (the Followed tab's data fetch from #447 is cut off by a reload in WebKit), so it should be recorded there with run 46137690606 and 46136880223.
- Round 3's note still stands: the journey checks the slide is running before it reads the target clip, not just before the drag. It passed at 120 ms per move, so this does not bite today.
