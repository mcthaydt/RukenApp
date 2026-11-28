# Plan audit 4: stream feed videos, re-check of the fixes for audit 3

- **Examined:** spec `docs/superpowers/specs/2026-11-28-stream-feed-videos-design.md` on PR #452, head `b14c7dd`
  (`b14c7dd9f4d34122d27337f64d8a64df2e4aabca`, branch `claude/project-thread-wiegfg`), diff `46b2984..b14c7dd` only:
  `35a1177` (live state added) and `b14c7dd` (spec fixes, live state removed). Rounds 2 and 3 stand for the rest.
- **Auditor:** fresh session, Opus 5.5, medium. Read-only except this file.

## Verdict: PASS, 0 red

Both reds of audit 3 are closed, and the new text agrees with itself and with the criteria.

## What was checked

| Audit 3 red | Fix at b14c7dd | Closed? | Why |
| --- | --- | --- | --- |
| 1. Warm version and start version disagree | 7.5: one rule, "a clip starts on the version it was last warmed at", used by the player and the warm fetch. 7.6: re-warm upward at most once per clip, never downward. Criterion 3: each of the 4 ahead transferred at most twice, the second only after a rise. Criterion 4: every clip starts on its last-warmed version. | Yes | 7.5, 7.6, criterion 3 and criterion 4 now name the same rule (audit 3's option b). The visit's second and third clips (warmed at 240, then re-warmed once after clip 1 measures fast) fit criterion 3's "at most twice". A fall starts from the cached piece and steps down, so nothing is fetched twice for it. |
| 2. Kept bandwidth inflated by cache reads | 7.5: kept bandwidth only from Resource Timing entries for `hls/` pieces with `transferSize > 0`. 7.3: `hls/` answers carry `timing-allow-origin` for Ruken's own addresses, so cross-origin entries report real sizes and times. Criterion 13: probe whether hls.js samples cached loads; if so, a loader leaves them out. Criterion 2: swipe at least 3 clips from the first of a visit under 0.8 Mbit/s, each on 240 or 360 with at most 1 s of stall, printed per clip. | Yes | Cached reads (`transferSize` 0) cannot count; without `timing-allow-origin` every cross-origin entry would read 0 and the estimate would be empty, which the spec now states and fixes. The probe is shown, not assumed. Criterion 2 now fails the exact case audit 3 described (clips 2 and 3 on a slow line). |

Repo rules: all three commits are authored by McThayDT; no `docs/superpowers/live/` file at `b14c7dd`; the branch
diff against `main` is the spec and one `progress.md` line.

## Notes (not blocking)

1. 7.5 says a clip gets its warmed version as `startLevel` "when a clip gets its player". The one after gets its
   player at settle, before a re-warm can raise it. The builder should set `startLevel` at `startLoad()` (when the clip
   comes on screen), which is what criterion 4 checks, so the criterion already catches a wrong build.
2. Warm fetches run alongside the clip on screen and share the line, so their timings read a little low. That errs
   toward the lighter version, which is the safe side; no change asked.
3. Re-warming adds up to 4 more requests per clip ahead, once a visit. Small next to the piece requests the 10× cost
   already counts; no change asked.
