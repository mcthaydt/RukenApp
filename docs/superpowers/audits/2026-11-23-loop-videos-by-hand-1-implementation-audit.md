# Loop videos by hand (#374): implementation audit, round 1

- Pull request: #374, branch `claude/project-thread-cun7hi`, head `274f44d6cb31b7d0873432a65463fb51eaa84470`. `main` at `8cfacf3` (#372 merged).
- Lane 2 (shared `src/lib/quiet-video.ts`, `src/lib/on-screen-video.ts`). One fresh review, Opus 5.5, medium.
- Where: 4-core cloud container. Journeys in Playwright's image `mcr.microsoft.com/playwright:v1.63.0-noble` (Node 24), Postgres 16 on the host, a fresh database and `.wrangler/state` per batch.

## Verdict

**PASS. No red findings. Two notes, not blocking.**

## Checks run

| Check | Code | Result |
|---|---|---|
| `tests/lib/quiet-video.test.ts` | 274f44d | 18 of 18 passed |
| Feed `feed-controls.test.ts:255` and `make-questions.test.ts:783`, WebKit phone, `--repeat-each=100 --workers=4` | 274f44d | **200 of 200 passed**, 0 freezes (15.8 min) |
| Wall `about.test.ts` "the wall's clips play without jumping…", phone, tablet, computer, `--repeat-each=10 --workers=4` | 274f44d | **30 of 30 passed** |
| `feed-controls`, `about`, `make-questions`, `join`, `feed` journeys, all three devices, `--workers=4` | 274f44d | **303 of 303 passed** |
| Feed loop journey + wall journey, phone ×3, with `src/` from `main` (#372's `loopOnceStarted`) | 8cfacf3 src, PR tests | Feed **3 of 3 failed**: "the browser's own loop was on while the clip played" (line 274). Wall 3 of 3 passed (#372 had already stopped the wall storm). |
| Same, with `src/` from before #372 (fixed `loop`, the storm) | 992c281 src, PR tests | Wall **3 of 3 failed**: 53, 50, 53 jumps for one clip in 4 s (limit 5). Feed **3 of 3 failed**: "the clip's time moves on from its start", 0. |
| CI on 274f44d | GitHub | verify, postgres, browser shards passing; `pr-rules-run` red only for the missing review, which this audit supplies |

## What was checked by reading

- **Correctness of `loopByHand`.** `loop` is set false once and never touched again. On `ended`, or a `timeupdate` within 0.01 s of a known duration, the clip seeks to `restartAt(startOf(src), duration)` and calls `play()`, swallowing a refusal. After the seek the clip is no longer ended or at its end, so the `ended` that follows the last `timeupdate` does nothing (unit test covers it). Unknown duration (`NaN`, `Infinity`, 0) never counts as the end; an `ended` with unknown duration goes back to the named start. A start at or past the end goes back to 0, which is what makes the wall's `#t=2`/`#t=4` clips loop on the 2 s test clip.
- **Callers.** `Feed.svelte` (`use:loopByHand`), `quietVideo` (maker page, game page, join, maker screens), `playOnScreen` (landing wall). `destroy` removes both listeners; `playOnScreen` calls it.
- **Feed interplay.** The feed pauses and rewinds the clip a person left; a queued `ended` after that finds it neither ended nor at its end, so it does not restart it. `onplay → stopIfOffScreen` still stops any start of a clip that is not on screen.
- **No `loop` toggling remains.** `grep -rn loop src` finds only the feed's `<noscript>` `<video loop>` (fallback for browsers without script, left on purpose and named in the body) and unrelated comments.
- **Changed tests.** The wall check per clip (≤5 in 4 s) still fails the storm by a factor of 10 (run above). The feed watcher's `loopWasOn` sample fails #372's code every time (run above); the second watch now stops the first's timer and listeners; the empty-`beforeAll` guard throws a plain message. Both changes are named in the body with their reasons.
- **PR body (pr-rules).** Starts with the attribution comment and "_Requested by **McThayDT** · [project thread](…)_", has "## Lane" and "## Acceptance criteria", and its last line is "Requested by **McThayDT**".
- **CRUD.** The change adds nothing a person makes; no journey is owed.

## Notes (not blocking, not fixed here)

1. UNIT: `src/lib/quiet-video.ts` `loopByHand`. VERDICT: note. REASON: a `timeupdate` sent by `pause()` on a clip paused within 0.01 s of its end restarts it, so a wall clip that scrolls off screen in that 10 ms window plays on off screen until it comes back. EVIDENCE: the guard is `!node.ended && !atEnd(...)` and does not look at `paused`; `pause()` queues a `timeupdate`. Not seen in any run. EXPECTED: a clip paused by the page stays paused. FIX: also return when `node.paused && !node.ended`; touches `src/lib/quiet-video.ts` and its unit test only.
2. UNIT: `tests/browser/about.test.ts` wall check. VERDICT: note. REASON: the wall's journey alone does not notice `loop` being switched on (it passed 3 of 3 on #372's code); only the feed journey does. Both use the same `loopByHand`, so the feed journey covers it today. FIX (if wanted): sample `video.loop` in the wall check too; touches that test only.

Not shown here, as the body says: real Safari on an iPhone. Everything above is Safari's engine on Linux.
