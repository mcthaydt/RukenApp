# #454 implementation audit, round 5: a swipe or wheel made while Back slides in

Commit examined: `ab029a2dcc2da414549848007d98f4f1c5f2db80` (branch `claude/project-thread-mqoqyf`). Lane 2 (`src/lib/page-moves.ts`). Reviewer: Opus 5.5, medium, fresh session. Round 4 PASS was at `40f4174`.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

PASS. No red findings.

## What changed since round 4

- `48fb75b` merged main. The branch's own diff against main is still four files: `src/lib/page-moves.ts` (+18), the two new journeys, progress notes.
- `ab029a2` takes out `9f88f7d`'s "read the target clip during the slide" in both journeys. `git diff 5525e18 ab029a2` on `back-then-wheel.test.ts` is empty; on `back-then-swipe.test.ts` it is only the round 3 drag fix (65% of the screen, timestamped moves 16 ms apart). The revert is right: both journeys again read `clips.nth(...)` before `outAndBack`, and the feed's order did not change between rounds (round 3's evidence).

## Checks run (session container, Postgres 16, Chromium; local config without the WebKit warm-up, which this container cannot launch)

| Check | Result |
| --- | --- |
| back-then-swipe [phone, Chromium Galaxy S24], with the fix, 4 repeats | 16 of 16 passed |
| back-then-wheel [computer], with the fix, 4 repeats | 16 of 16 passed |
| back-then-swipe, 55 ms real wait between touch moves, 2 repeats | 8 of 8 passed |
| back-then-swipe, 120 ms real wait between touch moves, 2 repeats | 8 of 8 passed |
| back-then-swipe without the `touchstart`/`pointerdown`/`wheel` lines, 2 repeats | 8 of 8 failed at round 1 |
| back-then-wheel without those lines, 2 repeats | 8 of 8 failed at round 1 |
| back-then-swipe without those lines, 55 ms waits | 4 of 4 failed at round 1 |
| controls-overlap [tablet, Chromium]: 320x568, 375x667, 667x375, signed out and in, maker screens, about page | 4 passed (computer skips by design) |
| CI run 46147490590 at `ab029a2` (full run: verify, postgres, 6 browser shards, gate) | all green, no retries on a pull request |
| Merge with main `f2849af` | clean (`git merge-tree`); main's 5 new files are look.css and button journeys, nothing #454 touches |

## follow-a-maker.test.ts:294 [phone]: cause found, not #454

From the run 46144343996 trace (playwright-report-2, WebKit): on `/followed`, the quiet refresh from `#447` (`quietRefresh` in `src/features/feed/kept.svelte.ts`, run on mount when the tab came from a page asked for ahead) had `GET /followed/__data.json` in flight (169843 ms). The test's `page.goto("/")` (169973 ms) cancelled it; WebKit reports a cancelled fetch as "Fetch API cannot load … due to access control checks" (page error at 169986 ms). SvelteKit's client treats a failed `__data.json` as a reason to fall back to the server (`native_navigation(url)` in `@sveltejs/kit/src/runtime/client/client.js`, the catch after the server data load), so it set `location.href` to `/followed` (request at 169996 ms), which interrupted `goto("/")`. No touch, pointer or wheel event is involved, and the slide code #454 changes only runs on one.

It is the same mechanism as `feed-controls.test.ts:536` [phone] ("access control checks" on `/followed/__data.json` at reload, round 4), so it belongs to main.

## Notes (not blocking, follow-ups for main)

1. UNIT: `src/features/feed/kept.svelte.ts` `quietRefresh` with SvelteKit's fallback. VERDICT: note (outside this change). REASON: in Safari, a page load that starts while Followed's quiet refresh is loading (a reload, a typed address, or a test's `goto`) can be sent back to `/followed`. EVIDENCE: the trace above; follow-a-maker:294 and feed-controls:536. EXPECTED: leaving the page while a quiet refresh loads goes where the person asked. FIX: its own change on main (for example, skip the fallback when the page is unloading, or abort the refresh on `beforeunload`/`pagehide`), with a WebKit journey that loads `/` during a quiet refresh.
2. UNIT: `tests/browser/back-then-wheel.test.ts` `wheel`. VERDICT: note. REASON: six 120 px DevTools wheel notches with 55 ms between them move the feed zero clips, with or without Back (control run with the Back step skipped: 2 of 2 stayed on the same clip), so a slow-hand wheel is not covered by any journey. Fast notches (the journey as written) are what #454 needed. EXPECTED: unknown whether a real slow mouse wheel on a real Chrome moves the feed; headless DevTools wheels have no smooth scrolling. FIX: none here; worth one manual try with a mouse on the computer during the input-device walk the owner ordered.
3. Not tried on the owner's physical Galaxy (as the pull request says).
