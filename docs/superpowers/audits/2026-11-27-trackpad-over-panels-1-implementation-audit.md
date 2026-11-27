# A sideways trackpad swipe over a panel stays on the page: implementation audit 1

- PR: #431, branch `claude/project-thread-8nigx1`
- Commit examined: `c72c757` (merge of `main` `d2f3897` into `895aeb4`). Review started at `895aeb4`; the head moved during the review and everything below was re-checked or re-run at `c72c757`.
- Lane 2 (`src/features/feed/FeedTop.svelte`). Reviewer: fresh session, Opus 5.5, medium.
- Written 2026-11-27 19:32 UTC (time from `date`).

**Verdict: `c72c757` FAIL: 1 red.**

## What ran

| Check | Where | Result |
| --- | --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` | `895aeb4`, cloud container | pass, 2,397 of 2,397 unit tests |
| Merge `c72c757` | `git diff origin/main...c72c757` | same three files and line counts as at `895aeb4`; `895aeb4..c72c757` brings in only `main`'s `progress.md` rows and `tests/browser/your-feed.test.ts`. No change to `src/` or `trackpad-swipe.test.ts`. Clean |
| `trackpad-swipe.test.ts`, all projects, `--repeat-each 4` (phone in Playwright 1.63 WebKit image) | `895aeb4` | 22 of 24; the new test failed 2 of 4 on computer, at line 281 |
| New test only, computer, `--repeat-each 12 --workers 4`, with wheel timestamps logged | `895aeb4` (probe copy of the test, not committed) | 4 of 12 passed; 8 failed at line 281 |
| New test only, tablet and computer, `--repeat-each 8 --workers 4` | `c72c757` | 11 of 16; failed 3 tablet, 2 computer, all at line 281 |
| New test, all projects, `--workers 1`, with screenshots | `895aeb4` | 3 of 3 |
| Phone runs of both tests | `895aeb4` | 12 of 12 |

Graphify: not used; the change is three files, read in full.

## Weighed points

1. **No Back/Forward while a panel is open or sliding away.** Met in every run: `passedOverPanel` stayed 0 over the dim and the panel, both ways, and `passed` did not change during the close. The early `return` on `dialog[open]` is gone and `preventDefault` now runs first (`FeedTop.svelte` wheel handler). History length never changed.
2. **Sideways scroll inside panels not broken.** `scrollsSideways` lets a box that can still scroll that way keep the move, and holds it back at either end. The journey's injected strip shows both. No box in `src/` has `overflow: auto|scroll` or `overflow-x: auto|scroll` today (grep), so nothing on Fresh, Followed or Search changes behaviour.
3. **Tab swipes still work once panels close.** The first test passed 20 of 20 across my runs.
4. **PR 426 edge rule and PR 427 bar fix untouched.** `onBrowserEdge` and the touch handlers are unchanged; nothing in `src/lib/` or the bar is in the diff.
5. **The phone flake fix is a real cause fix.** Yes: a synthetic `WheelEvent`'s `timeStamp` is its creation time, so one `evaluate` per move let a busy page open a gap past the 200 ms rest. One `evaluate` for the whole swipe removes that, and a real trackpad's events carry the system's time. Note below on what the phone no longer covers.

## Red

**UNIT:** `tests/browser/trackpad-swipe.test.ts`, "a two-finger swipe over a panel, or one sliding away, stays on the page", the closing part (lines ~268-283).
**VERDICT:** red.
**REQUIREMENT:** acceptance criteria 2 and 5 of the PR ("the tab is still Fresh once the panel has gone"; phone, tablet and computer pass), and CLAUDE.md Verification: a test that fails and passes on retry is a defect; PR runs never retry.
**REASON:** the new journey is flaky on tablet and computer, from the same cause the PR fixes on the phone: on Chromium the swipe is sent one `page.mouse.wheel` at a time, and each is stamped when it is dispatched, so a busy moment as the panel finishes closing splits the swipe in two and the second half steps to Followed.
**EVIDENCE:** at `c72c757`, 5 of 16 failed (`--workers 4`), all at line 281, `onFresh()`: Fresh not current. The logged timestamps at `895aeb4` split cleanly: in all 8 failing runs the gap between the last move over the panel and the next move was 209 to 330 ms (above `WHEEL_REST`, 200 ms), and the next part of the swipe added up to 60 px or more; in all 4 passing runs that gap was 142 to 170 ms. Example failing run: `[9268,open,12] [9406,closed,30] [9682,closed,45] [9727,closed,50]` (276 ms gap, then 45 + 50 = 95 px, a step). With one worker it passed 3 of 3, which is why the PR's own runs looked green.
**EXPECTED:** the journey passes every time under CI-like load on all three projects, and still proves that the coast after Close does not step.
**FIX:** in `tests/browser/trackpad-swipe.test.ts` only, send Chromium's swipe without a round trip per move, stamped as a trackpad's are: for example, over CDP (`page.context().newCDPSession(page)`, `Input.dispatchMouseEvent` type `mouseWheel` with an explicit `timestamp` spaced like `SWIPE`), or the phone's one-`evaluate` path for the closing swipe on every project (it still checks `defaultPrevented`). Then show it with `--repeat-each 12 --workers 4` on tablet and computer. The product's 200 ms rest stays as it is. Name the change in the PR body.

## Notes (not blocking)

- With the whole phone swipe sent in one tick, the first test no longer exercises, on the phone, the coast arriving on the new tab after `goto` (all moves land before the move starts). Tablet and computer still cover it with real wheel moves.
- `scrollsSideways` calls `getComputedStyle` for each ancestor on every sideways wheel move. Cheap at today's depth; worth knowing if a deep tree ever sits under the feed.
- Not proven on a physical Mac trackpad, as the PR says.

## Screenshots

On the screens page linked from the PR comment: Share up after four swipes over it, and the feed after Close plus a swipe, still on Fresh, on phone, tablet and computer (`895aeb4`, one worker).
