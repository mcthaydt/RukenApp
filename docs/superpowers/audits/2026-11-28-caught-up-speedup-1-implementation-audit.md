# Implementation audit: #440 caught-up journey speedup (cycle 1)

- Pull request: #440, head `d1df840` (d1df840dc4c0a6a1e9c1cba6e3ec29c017145ea2).
- Scope: `git diff 01d2bc7 d1df840 -- tests/ docs/`. The change of its own is commit `d1df840` (`tests/browser/feed-caught-up.test.ts`, one entry under "Flaky tests" in `docs/superpowers/progress.md`); `tests/*/new-version.test.ts` come from main `cea72f3` (#444), merged cleanly, not reviewed here.
- Lane: 2 (the pull request as a whole). This commit touches only a journey and progress notes.
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-28 06:03 UTC.

## Verdict

PASS. No red findings.

## What ran

Local container, Postgres 16, the built app under `wrangler dev`, Chromium only (`tablet` and `computer`, the two projects that timed out in run 46111852995). The `phone` project (WebKit) did not run: this container has no WebKit for Playwright 1.63, so its global setup (`warm-webkit.ts`) was left out with a scratch config not committed. The PR's own CI at `d1df840` (run 46113932079) runs phone.

The database was filled to 302 live games (300 copies of a journey's game, by SQL) to match a busy CI shard.

| Run | Code | Result |
| --- | --- | --- |
| 1 | `d1df840`, 2 games | 4 of 4 pass, keeps-going 3.6 s / 4.1 s |
| 2 | `d1df840`, 302 games | 4 of 4 pass, keeps-going 27.6 s (computer) / 31.8 s (tablet) |
| 3 | the journey at `63e5a2d` (before the fix), 302 games | keeps-going passes in 1.4 min (computer) / 1.5 min (tablet): 3 to 4 times longer, and within 30 s of the 120 s limit on an idle machine, so a loaded CI runner going past it fits |
| 4 | `d1df840`, `.caughtup` moved up over the top bar (`top: … + 0.25rem`) | 4 of 4 fail: `the line covers "Fresh" at 810×1080` / `1280×720` |
| 5 | `d1df840`, `.caughtup` moved over the side column (`top: 50%; left: calc(100% - 8.5rem)`) | 4 of 4 fail: `the line covers "Like"`, `the line covers "Tiny game …"` |

A probe (not committed) measured the first page at 50 clips with 302 games live and 360 buttons and links on the page after it loaded.

## Checks against the brief

1. **The overlap check still catches real overlaps.** Confirmed by runs 4 and 5: the one-go `controlBoxes` finds the top bar's tabs and the side column's controls, in both journeys. Run 2 shows no false finding from controls that are hidden or off screen. The new reader keeps the old filter's meaning: `button, a[href]` with `aria-hidden="true"` dropped only on links (as `a[href]:visible:not([aria-hidden='true'])` did), `checkVisibility({ visibilityProperty: true })` in place of Playwright's `:visible` (both drop `display: none`, `visibility: hidden` and empty boxes), and the same on-screen test against the window.
2. **The six-clip cut keeps what the journey proves.** The line is put on `clips[2]`, which the cut keeps; the journey still checks the two clips before it carry no line, the line is on that clip only (`toHaveCount(1)`), its clip has a video, the line covers no control at every size, the clip after it has no line, and the feed asks exactly once for the stand-in's next address and goes on to the site's page after it. Only clips 6 and on of the stand-in's page are left out, which the journey never looked at. The first page (up to 50 clips) is still stepped in full, so the test's time is bounded, not constant.
3. **Flaky record.** The new entry names the test, the projects, the run, the commit and shard, the cause and the fix, as the "Flaky tests" rule asks. Its line `:69` is the test's line at `63e5a2d`, where it failed (it is `:77` at the head); the `:173` entry follows the same habit.

## Notes (not blocking, not fixed here)

- N1. The first page is still walked clip by clip (50 at most). With 302 games the journey takes about 30 s locally; it no longer grows with the number of games past 50, so no change is needed.
- N2. The `:173` entry was rewritten in this pull request (review 5's reproduction, "cause not found"). It reads as a correct record; it is outside `d1df840`.
- N3. `pr-rules-run` at `d1df840` failed at 05:51 UTC, before any review of this head. Not read here; it is the PR rules check, not this change.
