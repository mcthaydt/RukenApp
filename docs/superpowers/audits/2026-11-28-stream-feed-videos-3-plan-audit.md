# Plan audit 3: stream feed videos, re-check of the edits after audit 2

- **Examined:** spec `docs/superpowers/specs/2026-11-28-stream-feed-videos-design.md` on PR #452, head `46b2984`
  (`46b298440863c076e8c487fad166faaea4472009`, branch `claude/project-thread-wiegfg`), diff `31d7da8..46b2984` only:
  `23ae819` (spec edits) and the merge of `main` (adds only `docs/superpowers/audits/2026-11-28-slice-3-e2e-walk.md`).
  Round 2 (`2026-11-28-stream-feed-videos-2-plan-audit.md`, PASS at `31d7da8`, commit `879f43e`) stands for the rest.
- **Auditor:** fresh session, Opus 5.5, medium. Read-only except this file.

## Verdict: FAIL, 2 red

The model change, notes 1, 3 and 4 and the main merge are sound. The new starting-version rule (7.5, 7.6, criterion
4) is the right idea but, as written, contradicts itself and can pick a version the line cannot carry.

## What was checked and is fine

| Change | Fine? | Why |
| --- | --- | --- |
| Section 9.2 build on Opus 5.5, medium | Yes | Owner, 2026-11-28 08:11 UTC, "we drop sonnet" (project memory). |
| Note 1: head the original after writing `ready`, delete `ready` and output if gone (7.1.4) | Yes | Closes the orphan-mark race; criterion 7 now pauses between steps 2-3 and 3-4. |
| Note 3: `disableRemotePlayback` on the `<video>` (7.5) | Yes | What Safari needs to open `ManagedMediaSource`. |
| Note 4: criterion 3 counts network transfers, not cache reads | Yes | Matches the one-after player re-reading its main playlist from cache. |
| Merge of `main` | Yes | Only the slice 3 walk audit file; no spec or code change. |
| Criterion "4b" numbering | Yes | Keeps criterion 13's number, which section 9 cites. |

## Reds

1. **The version a clip is warmed at and the version it must start on disagree.**
   - *What is wrong:* 7.6 says each of the 4 ahead is warmed at "the starting version" and "starts on that same
     version". Criterion 4 says a swiped-to clip, from the second of a visit on, starts on the version the clip before
     it *settled on*. These differ whenever the estimate changes after the warm fetch.
   - *Evidence:* first settle of a visit: nothing is measured yet, so 7.5 says clips 2 to 5 are warmed at 240, and the
     one after's player is made then too. Clip 1 then climbs to 720 on Wi-Fi. Swipe to clip 2: criterion 4 wants 720,
     7.6 wants 240 (the warmed one). If the build re-warms at 720, clip 3 now has two versions transferred, which
     criterion 3's "exactly ... and nothing more" fails. Every engine hits this on every visit's second and third clip.
   - *Expected:* one rule that 7.5, 7.6, criterion 3 and criterion 4 all agree on.
   - *Bounded fix (pick one, write it in 7.5/7.6 and the two criteria):* (a) **pin**: a clip starts on the version it was
     warmed at; criterion 4 becomes "starts on the version it was warmed at, which is the estimate at that time; from
     the 5th clip of a visit on, that is above 240 on an unthrottled network". Or (b) **re-warm once**: the version is
     picked at `startLoad()` from the latest estimate; a clip already warmed lower is warmed again at most once when
     the estimate rises; criterion 3 allows at most two sets per clip and says which. (a) is simpler and keeps
     criterion 3 as is.

2. **The stored bandwidth can be inflated by cache reads, and no criterion catches a slow line after clip 1.**
   - *What is wrong:* 7.5 keeps "hls.js's last measured bandwidth". The next clips' first pieces come from the warm
     fetch, that is from the browser cache, and hls.js samples those loads too (its estimator floors a sample at about
     50 ms, so a 0.6 MB cached piece reads as roughly 90 Mbit/s). On a slow line the estimate jumps after the first
     warmed clip plays, and the next clip starts on 720 or 1080.
   - *Evidence:* 7.6 states hls.js "reads them from there" (cache); 7.5 takes hls.js's estimate as is; criterion 2
     only measures "the clip on screen" under 0.8 Mbit/s, so a single clip passes while clips 2 to 5 would stall.
     Whether hls.js 1.x skips cached loads is not stated in the spec; it should be shown, not assumed.
   - *Expected:* on a slow line every clip of the visit stays on 240 or 360.
   - *Bounded fix:* say the kept bandwidth comes only from pieces that crossed the network (for example the page's own
     warm-fetch timings, or Resource Timing entries with `transferSize > 0`), not from hls.js's estimate after a cache
     read; add to the criterion 13 probe whether hls.js samples cached loads; and extend criterion 2 to swipe through
     at least 3 clips under the throttle, each on 240 or 360 with at most 1 s of stall, printed per clip.

## Notes (not blocking)

1. At 720, the 4 ahead cost about 2.4 MB per settle on a phone plan. That is what "preload the next 4" means on a fast
   line; worth one line in the design round, no change asked.
