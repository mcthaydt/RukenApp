# #454 review 3: a swipe or wheel made while Back slides in

Lane 2 fresh review, Opus 5.5, medium. Examined **9f88f7d** (asked at 5525e18; the head moved during the review, and 9f88f7d changes only the two Back journeys and `progress.md` over 5525e18). Journeys run in the Playwright 1.63 image on a local Postgres 16.

**Verdict: FAIL, 1 red.**

## What was checked

| Check | Result |
| --- | --- |
| `back-then-wheel` without the wheel line (5525e18 with the `wheel` listener removed) | 8 of 8 fail |
| `back-then-wheel` at 5525e18 | 71 of 72 pass (one failure, round 4 of "down (browser)", in the first, cold run; then 24 of 24 and 40 of 40) |
| `trackpad-swipe.test.ts:241` with the old listener (6fe194c) [tablet][computer] | 3 of 8 fail (tablet 2 of 4, computer 1 of 4) |
| `trackpad-swipe.test.ts:241` at 5525e18 [tablet][computer] | 12 of 12 pass |
| `back-then-swipe` at 5525e18 [phone] | 12 of 12 pass locally |
| Both Back journeys at 9f88f7d | 16 of 16 pass |
| `controls-overlap` at 320×568, 375×667, 667×375 (phone, tablet) | 6 of 6 pass |
| Diagonal and mixed wheel moves | by reading: the slide ends when `abs(deltaY) > abs(deltaX)`, the exact other side of FeedTop's `abs(dx) > abs(dy)`, where it holds the move back from the browser; `deltaMode` scales both alike. A mostly sideways diagonal is a tab swipe and keeps its slide; a mostly up-and-down one scrolls and ends it. |
| Merge with main 7d058b7 | clean (`progress.md` merges by itself) |
| CI full run 46131386058 at 5525e18 | red: pieces 1, 3, 4 (below) |

## Red

UNIT: `tests/browser/back-then-swipe.test.ts` (`drag`). VERDICT: red. REQUIREMENT: CLAUDE.md Verification: a test that fails once and passes on retry is a defect; pull request runs never retry. REASON: the journey's swipe moves the feed only when it is quick, so on a busy runner it fails though the fix works. EVIDENCE: CI 46131386058, piece 1, `[phone] back-then-swipe.test.ts:79` "a swipe down made as Back (arrow)…", round 2: expected `tiny-game-f25cb2ba`, received `tiny-game-4c1d4552`, the clip Back brought back. The run's recording shows the feed order unchanged all through the test (b3ebf84d, f25cb2ba, 4c1d4552, 2c15bd06, 12937777 at 72.5 s, 74.3 s and 77.9 s), so the order change 9f88f7d reads around was not the cause. The eight touch moves took 461 ms in round 2 against 268 ms in round 1, which passed. The drag goes 45% of the screen, under half a clip, so only its speed carries the feed on. Probe: the same drag with 55 ms between moves fails 8 of 8 at 5525e18, 4 of 4 at 9f88f7d, and 4 of 4 with no Back at all (the feed is just sitting there). EXPECTED: the journey passes whatever the runner's speed, and still fails without the fix. FIX: make the drag carry the feed on by its length or by fixed timing (for example drag past half the screen, or give each touch move a `timestamp` 16 ms after the last, as `trackpad-swipe` does for its wheel), then show it fails 4 of 4 with the `touchstart`/`pointerdown` lines removed and passes with a slowed drag. Files: `tests/browser/back-then-swipe.test.ts` only.

## The two other CI failures: not this change

- `tabs-show-now.test.ts:128` [phone] (piece 4): fails on main 7d058b7 alone, 6 of 10 locally; with this PR merged in, 4 of 10. It came with #447.
- `feed-controls.test.ts:337` [phone] (piece 3), keys pressed faster than the feed slides: 10 of 10 on main, 10 of 10 with this PR merged. By reading, this change only listens for `touchstart`, `pointerdown` and `wheel` while a page move slides; keys never reach it. A one-off on the runner.

Both are now under Flaky tests (9f88f7d), which is right.

## Notes (not blocking)

- `back-then-wheel` failed once in 72 locally (the first, cold run), with the same symptom as the bug. No recording was kept. If CI sees it again, keep the trace.
- 9f88f7d reads the target clip with one `evaluate` after the slide is seen running and before the swipe, so the swipe comes a little later in the slide. Checking that the slide is still running just before the swipe would keep the journey honest on a slow runner.
- A real trackpad's sideways swipe may tail off with moves that are more up-and-down than sideways (for example `dx 0, dy 1`); one would end the tab slide early. This is not proven either way here (emulated wheel only).
- CI at 9f88f7d (run 46135551553) was still running when this was written.
