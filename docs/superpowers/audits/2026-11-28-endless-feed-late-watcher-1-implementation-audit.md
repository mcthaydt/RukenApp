# Endless feed, late watcher: implementation audit 1

- Pull request: #448, `claude/project-thread-85sv54`
- Commit examined: `6df05c4` (merge base with `main` `43d9a3c`)
- Lane: 2 (`src/features/feed/Feed.svelte`, shared by every feed tab). One fresh review.
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-28 06:44 UTC (from `date`).
- Verdict: **FAIL: 2 red.** The app fix is right and its new journey is a real check. The head's CI is red, from a race in a different feed journey's own steps (cause found below, bounded fix proven by a probe), and one sentence in `progress.md` names the wrong cause for that journey's old flake.

## What ran

All browser runs in Playwright's own image (`mcr.microsoft.com/playwright:v1.63.0-noble`, phone = WebKit iPhone SE, tablet and computer = Chromium), Node 24, local Postgres 16, a fresh database for each run.

| Run | Result |
| --- | --- |
| New journey "a page that comes before the browser says the spinner is on screen…" with `Feed.svelte` put back to `main`'s, `--repeat-each 4` | **12 of 12 fail** (4 phone, 4 tablet, 4 computer), all at `feed-controls.test.ts:1246`, `clips.nth(before)` `data-current` "false". It fails by itself, for the reason it claims. |
| New journey and "the feed never ends" (`:1111`) with the fix, `--repeat-each 6` | **36 of 36 pass** |
| Every feed journey file with the fix: `feed-controls`, `feed-caught-up`, `feed-leave-and-return`, `feed-marks`, `feed-shortcuts`, `feed-to-game-grow`, `feed-top`, `feed`, `your-feed`, `trackpad-swipe`, `gamepad`, `controls-overlap`, `browser-tab`, `friend-likes`, `follow-a-maker`, all three devices | **396 passed, 6 skipped, 0 failed** (18.2 min). The skips are the file's own: three Android Chrome top-bar checks on the WebKit phone project, one bar check on phone, two overlap journeys on computer. |
| CI on `6df05c4` (run 46115550409, quick draft) | **red**: `browser shard 6 of 6` failed, `gate` failed; `verify` (lint, typecheck, unit, build), `postgres`, `commit-authors`, `pr-rules-run` and shards 1 and 3 green; 2, 4, 5 cancelled. |

What the asks named, and where it is covered: no double moves or skipped clips (the new journey, `:1111`, `feed-shortcuts`, `trackpad-swipe`, `gamepad`); Back to the right clip (`feed-leave-and-return`, `feed-controls` Back journeys); every feed tab (`your-feed`, `feed-top`, `feed-caught-up`); overlap rule (`controls-overlap`, 320×568, 375×667, 667×375, before launch and after, signed out and signed in with a friend's face). All pass with the fix. CRUD: the change adds and touches nothing a user makes, so no CRUD journey is owed.

## The code

`fillsWindow` measures the spinner screen against the feed's window with the same 60% (`CURRENT_AT`) `currentOf` uses, so the two answers agree; `waiting = current >= had || fillsWindow(moreScreen)` only adds the case where the watcher is late, and leaves every other case as it was. `moreScreen` exists whenever `loadMore` can run (`next !== null && ready`), and a missing one answers false. The comment says why in plain words. Small, readable, nothing extra.

## Findings

**R1**
UNIT: `tests/browser/feed-controls.test.ts:462` "Back from a game opened past the first page comes back to that very clip, not an earlier showing of it".
VERDICT: red.
REQUIREMENT: the PR's own criterion "CI green on this head"; lane 2 merges on green.
REASON: the journey reads the clip count, then swipes to the spinner, but the page the feed asked for on opening can land between the two; the swipe then goes to the spinner past the new page, the feed asks again, and the first new clip is never current. A race in the journey's steps, not in the app and not from this change.
EVIDENCE: CI shard 6 at `6df05c4` [tablet], line 471, `clips.nth(3)` `data-current` "false" for 15 s. Its trace (artifact `playwright-report-6`) in wall time: the first `/api/feed` request started 06:15:13.629 and took 90 ms; the count was read at 13.718; the swipe to `section.more` at 13.746; a second `/api/feed` (`after=…~5~0~1~tiny-game-084c4a23`) at 13.839. Probe A (`2026-11-28-endless-feed-late-watcher-1-probe.test.ts.txt`) forces that order, count, page lands, swipe: **6 of 6 fail** at the same assertion on phone, tablet and computer with the fix in place. This is also the cause of the `:438` entries under "Flaky tests" (same journey, same line, same symptom).
EXPECTED: the journey holds the next page until the spinner is on screen, as "the feed never ends" does, so the count it reads is the count before that page.
FIX: in that journey only, route `**/api/feed?*` behind a promise released after the spinner is visible, as probe B does. Probe B (the whole journey with that change): **9 of 9 pass** on phone, tablet and computer. Files: `tests/browser/feed-controls.test.ts` (that journey), and `docs/superpowers/progress.md` (mark the `:438` entries' cause found).

**R2**
UNIT: `docs/superpowers/progress.md:284`, the `:1113`/`:1111` entry.
VERDICT: red.
REQUIREMENT: Report honestly; findings carry evidence.
REASON: "This is the same order the `:438` entry's trace showed" is not what that journey's trace shows: there the page lands before the swipe to the spinner (R1), not while the person sits on the spinner with a late watcher.
EVIDENCE: the R1 trace timings above.
EXPECTED: the sentence is dropped or says the `:438` journey has its own cause (R1).
FIX: that one sentence in `docs/superpowers/progress.md`.

## Notes (not blocking, not fixed here)

- N1. The other way round is still possible and predates this change: a person on the spinner who swipes back up to the last clip just as the page lands, with the watcher late, still has `current >= had` and is moved forward. `fillsWindow(moreScreen)` alone would answer that case too, but changing it is outside this PR's ask. No journey or report shows it happening.
- N2. The 6 skips in the wide run were not looked into beyond their names; they are the same skips the files declare.

## Probe

`docs/superpowers/audits/2026-11-28-endless-feed-late-watcher-1-probe.test.ts.txt`: probe A (the race, forced) and probe B (the journey with the page held), appended to `feed-controls.test.ts` at `6df05c4` for the runs above and not committed there.
