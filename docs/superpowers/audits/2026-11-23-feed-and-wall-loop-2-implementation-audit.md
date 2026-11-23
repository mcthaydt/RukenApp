# #372 Feed and landing wall loop only past their start: lane 2 review, round 2

- Pull request: #372, branch `claude/project-thread-b5qgzu`.
- Verdict: **FAIL: 1 red** at head `5e19e6bb63f9e4a47d27f68430956eb309581661`.
- Examined: the change since round 1's head `66993d2` (`git diff 66993d2 5e19e6b`): only `tests/browser/feed-controls.test.ts` and `docs/superpowers/progress.md`, plus the body. No `src/` file changed, so round 1's reading of the code stands.
- Reviewer: fresh session, Opus 5.5, medium. Finished 2026-11-23 17:21 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran (cloud container, Node 22, Postgres 16, WebKit 26.6 for Playwright 1.63, phone)

| Check | Result |
| --- | --- |
| New feed journey, `--repeat-each=20 --workers=4`, with the fix | 18 passed, **2 failed**, both in the second watch (after away and back) |
| Same, again, with a logging probe (not committed) | 20 passed |
| Same journey, `--repeat-each=3 --workers=3`, `Feed.svelte` as on `main` (`682ef22`) | 3 failed: "how far the clip played" 0.001 (needs > 0.5) |

Lint, typecheck and the other journeys were not re-run: nothing outside the one test file changed since round 1, which ran them.

## Body and rules

- The body starts with the two attribution lines and ends with "Requested by **McThayDT**".
- Acceptance criterion 1 was updated to the new bar, as round 1's fix asked. It says "passes 10 of 10 at four workers"; here it passed 38 of 40.
- Round 1's fix was followed as written: the time is read every 50 ms and on `timeupdate`, "played" is past 0.5 s, "started again" is back under 0.5 s after that, and the journey has 60 s.
- The progress.md entry records round 1's note (loops grow shorter in this engine) under Known issues. Right place, plain words.

## Findings

### 1. The new feed journey still fails now and then, and in the way the bug itself fails

- UNIT: `tests/browser/feed-controls.test.ts:202`, "the clip on screen plays through and starts again, and again after a person comes back to it", its second watch (line 226 on), and what it watches: the feed clip a person comes back to (`Feed.svelte` with `loopOnceStarted`).
- VERDICT: red.
- REQUIREMENT: CLAUDE.md, Verification: "A test that fails once and passes on retry is a defect"; acceptance criterion 1 ("passes 10 of 10").
- REASON: two of 40 runs failed, both after the person swipes away and back. One read the clip at 0 s for the whole five seconds (`again.furthest` 0, needs > 0.5) while it reported not paused. The other never came back from `watchCurrentClip` and hit the 60 s timeout (line 180, called from line 226). The first is the same thing a person would see if the fix failed: a clip on screen that does not move. So the lower bar did not settle it, and it is not shown to be the test's sampling.
- EVIDENCE: run 1 (`--repeat-each=20 --workers=4`, trace off): repeat 1 "Test timeout of 60000ms exceeded" at `locator.evaluate` (1.1 min); repeat 18 "how far the clip played the second time", Received 0 (11.9 s). Run 2, the same with a probe logging the clip just before the second watch: 20 passed. In it, the clip at the start of the second watch was at 0 to 0.98 s, `readyState` 2 (only the current frame) in 18 of 20 and 4 in 2, `networkState` 2 (still loading) in 18; every second watch got past 1.18 s. The first watch never failed in 40 runs. Without the fix the journey fails 3 of 3 at 0.001 s, so the check itself still catches the bug.
- EXPECTED: the clip a person comes back to plays every time, and the journey passes 20 of 20 at four workers, run twice.
- FIX: find out which of two things the failures are, with the trace on (`--repeat-each=20 --workers=4`, default `retain-on-failure`) and the probe above plus `readyState`, `networkState`, `loop`, `seeking` and the count of `seeked`/`waiting`/`stalled` logged through the second watch: (a) the clip stalls for data on a busy machine (`readyState` stays at 2 or under, `waiting` fires, few jumps), in which case the second watch waits for the clip to be playing with data (`readyState` ≥ 3, or a `playing` event after the rewind) before its five seconds start; or (b) the clip sits at 0 because of the loop toggle around the rewind (`seeked` at 0 turns `loop` off) or a seek storm (many jumps), in which case the fix is in `src/lib/quiet-video.ts` (`loopOnceStarted`) or `Feed.svelte`'s rewind, and a unit test in `tests/lib/quiet-video.test.ts` covers it. For the timeout, the trace shows whether `current(page)` stopped matching (the feed moved on) or the page stopped answering. Files: `tests/browser/feed-controls.test.ts`, and only for (b) `src/lib/quiet-video.ts`, `src/features/feed/Feed.svelte`, `tests/lib/quiet-video.test.ts`; the body's criterion 1. Check: the journey alone at `--repeat-each=20 --workers=4` passes 20 of 20 twice, and still fails with `Feed.svelte` as on `main`.

## Notes (not blocking)

- The first watch passed 40 of 40, with `furthest` 1.93 to 2.00 s and 2 to 4 jumps, so the 50 ms reading did what round 1 asked for that watch.
- Two second watches topped out near 1.19 s, which fits round 1's note that loops grow shorter in this engine.
