# Plan audit 2: stream feed videos, and fetch the next 4 ahead

- **Examined:** spec `docs/superpowers/specs/2026-11-28-stream-feed-videos-design.md` on PR #452, head `31d7da8`
  (`31d7da88c59bf2c24965c7dab4ef0e4d9ec7b2b5`, branch `claude/project-thread-wiegfg`), against round 1
  (`2026-11-28-stream-feed-videos-1-plan-audit.md`, FAIL 5 red at `95e2ee2`).
- **Auditor:** fresh session, Opus 5.5, medium. Read-only except this file.
- **Owner's intent checked against:** "Yes, stream" (08:03 UTC), "And preload the next 4 videos too" (08:04 UTC), the
  card pick "Our own, on Cloudflare" (08:09 UTC: Containers on Workers Paid, hls.js, convert stored clips).

## Verdict: PASS

All five reds from round 1 are fixed in the spec, each by the bounded change round 1 asked for. No new red: nothing
below contradicts the owner's pick, needs an approval the card did not give, leaks a removed clip, or breaks a repo
rule. The notes are build details for the implementer and the implementation audit to hold it to.

## Round 1 reds, rechecked

| Red | Fixed? | Where, and what was checked |
| --- | --- | --- |
| R1 next 4 not light on native-HLS browsers | Yes | 7.5: hls.js wherever `MediaSource` or `ManagedMediaSource` exists (Chrome, Safari Mac/iPad/iPhone 17.1+, DuckDuckGo, both Playwright engines); native only where neither exists. 7.6: clips 2 to 4 ahead hold no player; the page `fetch`es main playlist, lightest playlist, init piece and first 2 s piece for each of the 4 ahead, same on every engine; players off screen load nothing (`autoStartLoad: false`). At most 3 players, as today. Criterion 3 runs on phone (WebKit) and computer (Chromium). |
| R2 lightest version too big for the throttle | Yes | 7.1 adds 240×426 at about 0.25 Mbit/s, mono 48 kbit/s, on every clip. Criterion 2 names the rate: 0.8 Mbit/s, 150 ms, via CDP. About 0.3 Mbit/s fits with over twice the room. |
| R3 Firefox named, no hls.js journey | Yes | Criteria now name only phone (WebKit), tablet and computer (Chromium), matching `playwright.config.ts`. Criterion 10 has a journey per path (hls.js on both engines; native forced by hiding Media Source on WebKit; original forced by 404 on all three). Criterion 11 measures both paths. Criterion 13 probes Linux WebKit and Chromium first, with a written fallback if WebKit's own HLS does not play there. |
| R4 pieces outlive a deleted clip | Yes | 7.1 steps 1 and 3 check the original before and after writing, deleting its own output if gone. 7.3 serves `hls/` only while `ready` exists. 7.4 removes `ready` first, then `hls/`, on every removal path and account deletion. Criterion 7 adds the mid-job pg test. One narrow leftover in note 1, not public. |
| R5 queue and ready state unnamed | Yes | No Queues, no table, column or migration (section 5). Marker files `ready` and `failed` (7.2). The existing hourly cron picks up everything without `ready` and under 3 failures, which also streams the stored clips (D3) with no command for anyone. Durable Object is part of Containers, which the card named. |

## Other things the coordinator asked to check

- **First-frame stills:** unchanged (7.7, criterion 5); stills window widened to 1 before, 5 after so a still is always
  ahead of its clip. Fine.
- **Maker's upload:** unchanged; encoding runs in `waitUntil` after the save, and the original plays until `ready`
  (7.1, 7.3, criterion 6). Held clips are encoded while held and cleaned up on refusal (7.1, 7.4, criterion 7). Fine.
- **Gamepad and overlap:** no control is added; criterion 14 keeps both standing journeys untouched. Fine.
- **Cloudflare products:** Containers (with its Durable Object), R2 and Workers, all named on the card or already used.
  No Queues, no Stream. The deploy runs on `ubuntu-latest` (`.github/workflows/deploy.yml:36`), which has Docker for
  the Container image. Deploy-token permissions on ruken.dev are a standing yes. Fine.
- **Cost:** rough 10× count: about 1.5 million watched minutes × 15 requests ≈ 22 million Worker requests and, with the
  ready-mark head on each, about 45 million R2 reads, past the free 10 million each: about $4 to $6 Workers plus
  about $13 R2, plus about $2 storage. That lands near $20 to $25, inside the spec's "$20 to $50" and the card's
  "$30-50". Launch stays inside included amounts. Fine.
- **Privacy / private split:** no new company, no viewer data anywhere new; nothing touches the private Worker. Fine.
- **Merge:** lane 3; the 2026-11-21 19:16 UTC standing permission in `progress.md` covers lane 3 merges once audits pass
  and CI is green. Fine.

## Notes (not blocking)

1. **A tiny race leaves an orphan `ready` mark.** If the clip is removed after 7.1 step 3's check and before step 4
   writes `ready`, cleanup finds no `ready`, deletes `hls/`, and then the job writes `ready` into an empty folder.
   Nothing is served (no piece or playlist is left, and `ready` is not a served key), but criterion 7 promises no mark
   left behind. FIX for the build: after writing `ready`, head the original once more and delete `ready` if it is gone;
   place the pg test's pause between step 3 and step 4 as well.
2. **Every clip starts on the 240 version.** `startLevel: 0` plus warming only the lightest first piece means the first
   2 s of every swipe is 240×426, even on fast Wi-Fi, where today the original plays sharp from the start. On the owner's
   Galaxy that may look blurry for a moment on every clip. Worth a look in the design round; a bounded option is to warm
   and start on the version the last clip settled on (pass the previous measured bandwidth as hls.js's starting
   estimate), keeping 240 only for a cold first clip or a slow line.
3. **iPhone's `ManagedMediaSource` wants remote playback off.** Safari only opens MMS for a `<video>` with
   `disableRemotePlayback` set (or an AirPlay alternative source). Linux WebKit in Playwright may not show this, so the
   criterion 13 probe can pass while real iPhones fall to native HLS. Set `disableRemotePlayback` in `stream-video.ts`.
4. **Counting in criterion 3.** The one after holds an hls.js player, and `loadSource` fetches its main playlist even with
   `autoStartLoad: false`; that read comes from the browser cache. Count network transfers, not cache hits, or the
   "nothing more" check will see an extra request.
5. **The hourly listing is more than "a few calls" at 10×.** About 1,000 games × 2 clips × roughly 50 files each is
   around 100,000 keys, about 100 list pages an hour. Cost is trivial (inside free Class A), but the job's subrequest
   limit is not: list with a delimiter per clip folder, or page across runs.
6. **Crash loops and duplicate jobs.** A Container that dies before writing `failed` never counts a try, so a bad clip is
   retried every hour for good. Write the try count before encoding, not after. And key the Durable Object by clip, so
   the hourly run does not start a second job beside a running `waitUntil` one.
7. **Not-ready clips pay one extra round trip.** Each play of a clip without `ready` first gets the 404 (sent `no-store`
   by `plain`, `gate.ts:63-69`, so it is never cached; good), then the original. Fine at launch; the first hourly runs
   clear it.
8. **CORS headers.** With `access-control-allow-origin` set to a chosen origin, also send `Vary: Origin`.
9. **Model for the build.** Section 9 names Sonnet 5.5 for execution. The owner said "we drop sonnet" at 08:11 UTC
   (project memory); the rule PR is queued. The coordinator should start the build on Opus 5.5, medium, and the spec's
   line can change in the same build.
10. **Section 6 still reads "about $5 at launch".** It is kept as asked, with the correction underneath; fine, the card
    is what was approved.

## What the implementation audit checks

Each criterion runs as written on the two-engine matrix; the probe output (criterion 13) is in the PR; notes 1, 3, 4
and 6 are handled or answered in the PR body; the cleanup and serve rules hold on every removal path.
