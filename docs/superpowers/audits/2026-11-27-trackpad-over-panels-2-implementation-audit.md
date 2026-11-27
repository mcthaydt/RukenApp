# Trackpad over panels: implementation audit 2

PR #431, head 38fe3b1 (38fe3b134047e228b642266022c43797be259747). Fresh lane 2 re-review, Opus 5.5, medium. Written 2026-11-27 21:04 UTC.
Follows audit 1 at c72c757 (FAIL: 1 red, the new journey's last step flaky on tablet and computer).

## Verdict

**38fe3b1 PASS.** The red from audit 1 is fixed, and nothing else changed.

## What was checked

1. **Only the test changed since audit 1.** `git diff --stat c72c757 38fe3b1`: `tests/browser/trackpad-swipe.test.ts` only (+104, −26). Against `main` the PR is still the same three files (`FeedTop.svelte`, the test, `progress.md`). PASS.
2. **The feed reads the event's own time.** `src/features/feed/FeedTop.svelte:111` calls `stepOfWheel(wheeling, dx, dy, event.timeStamp)`, and `src/features/feed/tabs.ts:56` measures the rest (`WHEEL_REST = 200`) between those stamps. A real trackpad's moves carry the system's input time, so a busy page does not split one real swipe into two. This holds for #424's third tab too. The double step in #424's audit 6 was the phone journey's own page-made events (stamped when made), which this PR's one-call phone swipe addresses; that is still to be shown on #424's own head. PASS.
3. **The test still proves the fix.** With `FeedTop.svelte` put back to `main` and the 38fe3b1 test, `trackpad-swipe.test.ts:282` failed on all three profiles: `passedOverPanel` 92, expected 0 (line 313). PASS.
4. **At the head, the whole file passes.** 6 of 6 (both tests, phone, tablet, computer), Playwright 1.63 image, fresh database, `--retries 0`. PASS.
5. **Stable under load.** `trackpad-swipe.test.ts:282 --repeat-each=16 --workers=2` with three CPU-bound busy loops on a 4-core machine: 48 of 48 passed (16 each on phone, tablet and computer, 15.0 min). An earlier try with four busy loops lost the local app server midway (`ERR_CONNECTION_REFUSED` on `localhost:4173`); every failure in it was the server gone, and no assertion failed in the 35 runs it reached. Audit 1 saw 5 of 16 fail at c72c757 under similar load. PASS.
6. **The test's approach is sound.** Chromium's moves go through CDP `Input.dispatchMouseEvent` with explicit stamps 8 ms apart and a rest of `2 × WHEEL_REST` between gestures, read from the product's own constant. Close and the push of the swipe are sent together, and the coast is sent after the panel hides, carrying stamps that continue the same gesture, so the check that a swipe spent over a panel steps no tab afterwards is stronger than before. The PR body names the change and says the builder checked that Chromium keeps the given stamps. PASS.
7. **CI.** At 38fe3b1 every quick draft check passed: `verify`, `postgres`, browser shards 1 to 6, `gate`, `commit-authors`, `pr-rules-run`. The full run starts when the PR is marked ready. PASS.

## Notes, not blocking

- Not proven on a physical Mac trackpad or in desktop Safari (as in audit 1).
- The phone path still makes its own events in the page, so the phone does not test the timestamp path; it avoids the split by sending the whole swipe in one call.

Requested by **McThayDT**
