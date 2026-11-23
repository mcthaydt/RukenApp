# #372 Feed and landing wall loop only past their start: lane 2 review, round 1

- Pull request: #372, branch `claude/project-thread-b5qgzu`.
- Verdict: **FAIL: 1 red** at head `66993d2f9c81520486c01e696aa3cd2b4d7e97a0`.
- Examined: the delta beyond #367's head `b29f238`, run at `6191792`. The two commits since (`9c151ef`, `66993d2`) are only main merged in and the live-state file removed: for every file they change other than `progress.md` and the live file, the change equals main's own change from `509aa6e` to `682ef22` (compared file by file), and none of the branch's own files changed.
- Reviewer: fresh session, Opus 5.5, medium. Finished 2026-11-23 17:00 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran (cloud container, Node 22, Postgres 16, WebKit 26.6 for Playwright 1.63)

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck` | passed |
| `tests/lib/quiet-video.test.ts`, `tests/lib/on-screen-video.test.ts` | 12 passed |
| `about` + `feed-controls`, phone, with the fix | 33 passed, **1 failed**: the new feed journey, "how far the clip played the second time" 1.420 (needs > 1.5) |
| New feed journey alone, phone, `--repeat-each=8` | 8 passed |
| `feed-controls`, phone, `--repeat-each=4` (probe logging only) | 104 passed |
| `feed-controls`, phone, `--repeat-each=6 --workers=4` (probe logging only) | 155 passed, **1 failed**: the new feed journey, 30 s test timeout inside `watchCurrentClip` |
| Both new journeys, phone, **without** the fix (`src/` at `b29f238`) | both fail: wall 385 jumps (needs ≤ 12); feed clip got to 0 s (needs > 1.5) |
| Wall journey, phone, `--repeat-each=8` | 8 passed |
| `about`, `feed`, `maker-page`, `game-page`, `join`, `make-questions`, phone | 98 passed |
| `about` + `feed-controls`, tablet and computer | 68 passed |

The full suite was not run; CI runs it.

## Body and rules

- The body starts with the two attribution lines, has `## Lane` and `## Acceptance criteria`, names every changed test under `## Tests changed`, and ends with "Requested by **McThayDT**".
- Lane 2 is right: `src/lib/` shared code. Nothing touches a lane 3 path.

## Code

- `loopOnceStarted` does what the body says: `loop` is off at mount, on a new address (`loadstart`) and on any seek back under the start plus 0.1 s (`seeked`), and on again from `timeupdate` once past it. The feed's rewind of a clip a person left (`Feed.svelte:212-213`) fires `seeked` at 0, so `loop` is off again before that clip plays.
- `quietVideo` changes from #367 in one way: #367 turned `loop` on once and stopped listening; now `loop` goes off for the moment after each wrap (the wrap's `seeked` lands at 0) and back on at 0.1 s. Probe traces show playback carries on through it. The six other `quietVideo` callers (maker page, game page, join, `GameBackdrop`, `FixCard`, `VideoTile`) all set `src` as an attribute or none, so `startOf` reads it; their journeys passed.
- The landing wall (`#t=2`, `#t=6` …): after a wrap to 0, `loop` stays off until 2.1 s, which is harmless because the clip plays on; the wall's real clips are longer than their start (`+page.server.ts:28`).
- `playOnScreen` now returns the looping action's `destroy` on both paths; the observer is disconnected as before.
- Feed paging and resume: the `feed-controls` and `feed` journeys (paging, reload resume, far clips letting go of their address) passed on all three devices. The `<noscript>` copy keeps `loop`, which is right.
- CRUD: the change adds nothing a person makes.

## Findings

### 1. The new feed journey is flaky

- UNIT: `tests/browser/feed-controls.test.ts`, `watchCurrentClip` and the journey "the clip on screen plays through and starts again, and again after a person comes back to it".
- VERDICT: red.
- REQUIREMENT: CLAUDE.md, Verification: "A test that fails once and passes on retry is a defect"; acceptance criterion 1.
- REASON: the journey needs the highest time it sees to pass 1.5 s of a 2 s clip, and two things in this engine pull it under that on a clip that plays and loops: it reads the time only on `timeupdate`, which comes every ~250 ms and further apart under load; and the engine's loops shrink to about 1.2 s after a few wraps (Notes), so the later the watch, the lower the top. It also keeps the default 30 s test timeout while spending over 10 s just watching.
- EVIDENCE: with the fix, it failed 1 of 13 runs one worker at a time (1.420, "the second time") and 1 of 6 at four workers (30 s timeout at `watchCurrentClip`). With 9 to 14 s of extra watching added before a watch, it failed 6 of 6 (1.096 to 1.151), each trace showing loops of ~1.2 s. In the passing probe runs, the highest `timeupdate` time was as low as 1.750 while a 30 ms poll of `currentTime` in the same five seconds saw 1.968; the longest gap between `timeupdate`s was 299 ms. The probe is kept in project files as `audits/2026-11-23-feed-and-wall-loop-1-probe.diff.txt`.
- EXPECTED: the journey passes every time on a clip that plays and loops, and still fails without the fix.
- FIX: in `watchCurrentClip`, read `currentTime` on a short interval (say every 50 ms) as well as on `timeupdate`, judge "played" by a bar no sampling or shorter loop can miss (say furthest > 0.5 s; without the fix it stays at 0), and judge "started again" by a jump back under 0.5 s after that. Give the journey `test.setTimeout(60_000)`, as the wall journey does. Update acceptance criterion 1 in the body to match. Check: the journey alone at `--repeat-each=10 --workers=4` on phone passes 10 of 10, and still fails with `src/` at `b29f238`. Files: `tests/browser/feed-controls.test.ts` and the pull request body only.

## Notes (not blocking, not for this pull request)

- **The loops get shorter in this engine, with or without this change's toggling.** Watched for 14 s, a feed clip's loop shrinks from 2.0 s to about 1.2 s after four or five wraps, so it never shows its last ~0.8 s. The same happens with a variant where `loop` is turned on once and never off (#367's way), so it is the engine's own loop with this clip, not this change. It is why the journey only passes when it watches early, and why criterion 1 holds only for the first few loops. Whether real Safari (not the Linux GStreamer build) or the real clips do this is not known; it would need a check on a device or with a real clip. Reported, not fixed here.
- The test file's `ours[0] ?? ""` gives a selector that matches nothing if `beforeAll` made no game; the failure would then read as "not current" rather than "no game". Minor.
