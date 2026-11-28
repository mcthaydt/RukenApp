# Snappier trackpad swipe (#447): implementation audit 1 (lane 2)

Examined: `519cf02` (`519cf02e94664db7faace8c236ec709d0b0612cc`) on `claude/project-thread-9jsisq`, PR #447. Written 2026-11-28 05:04 UTC by a fresh session (Opus 5.5, medium).
Brief: the owner, 2026-11-28 03:04 UTC, after trying #442 on a trackpad: "a bit slow, but it works". Change: each feed tab preloads its neighbour 500 ms after it comes in, and a swipe's first sideways move (wheel or finger) preloads its target. Coordinator's checks: one swipe moves one tab; no wasted or duplicate fetches; preloaded data is not stale or wrong for the signed-in viewer; touch and gamepad LB/RB unaffected; no overlap at 320×568, 375×667, 667×375.

**Verdict: FAIL, 1 red.** The verdict line naming `519cf02` is the PR comment.

## What ran

| Check | Result |
| --- | --- |
| CI on 519cf02 (run 46109376798, quick draft) | verify, postgres, 6 browser shards, gate: all success |
| `trackpad-swipe.test.ts` + `controls-overlap.test.ts`, phone, tablet, computer (Playwright 1.63 docker, local Postgres 16) | 16 passed, 2 skipped (the skips are the overlap file's own), 0 failed |
| Probe: follow a maker on Fresh, then open Followed by tab and by trackpad swipe (copy in project files `audits/2026-11-28-snappier-trackpad-swipe-1-probe.test.ts.txt`), computer + tablet | **PR 519cf02: 4 of 4 fail** (Followed says "You don't follow anyone yet."). **main 3efa80e: 4 of 4 pass** |
| Same probe, tab press, phone (WebKit) | passes on the PR (not every path is stale; see below) |

## Reds

### R1. Followed shows the follows from before the person pressed Follow

- UNIT: `src/features/feed/FeedTop.svelte` (the 500 ms `$effect` that calls `ready()`).
- VERDICT: red.
- REQUIREMENT: coordinator's check "preloaded data isn't stale or wrong for the signed-in viewer"; standing rule that the journeys read back what a user makes (a follow made on Fresh must show on Followed).
- REASON: SvelteKit keeps a preload with no expiry until the next navigation or invalidation, and the clip's Follow (`FollowBadge.svelte`) posts with `fetch` and invalidates nothing. So Followed's data, fetched 500 ms after Fresh came in, is what the swipe, the tab press (hover preload reuses the same entry: `client.js` `_preload_data` returns `load_cache` when `intent.id` matches) and RB all land on, however long the person stays on Fresh and whatever they follow or unfollow there.
- EVIDENCE: probe above. Signed-up player, Fresh, `/followed/__data.json` fetched ahead ("readied ahead: true"), press Follow on the maker's clip (`aria-pressed` turns true), open Followed: the page reads "You don't follow anyone yet." on computer and tablet, by tab and by swipe. On main the same steps show the maker's clip, 4 of 4. The same holds for the other tabs readied ahead: Your turn readied from Followed misses a game a friend sends meanwhile, and Followed readied from Your turn (step -1) keeps a maker just unfollowed there.
- EXPECTED: the tab a swipe, press or LB/RB lands on reflects the person's follows (and sends) as they are at that moment.
- FIX: bounded to `src/features/feed/FeedTop.svelte`, `src/features/feed/FollowBadge.svelte` (or where its `onchange` lands in `Feed.svelte`), and one journey (`trackpad-swipe.test.ts` or `follow-a-maker.test.ts`) that follows on Fresh after the ahead fetch and checks Followed shows the maker. Either drop the idle 500 ms preload and keep only the swipe-start one (data at most one gesture old), or make anything that changes what a neighbour tab holds throw the ahead copy away and ask again. The new journey must fail on 519cf02.

## Notes (not blocking)

- N1, cost: the idle preload makes every visit to Fresh also run Followed's load (followedPage, launch, hasNew, friendsOf), and every visit to Followed also run Your turn's, whether or not the person swipes. Fresh's own load (the private ranker) is only readied on a swipe heading back to it, not idly. If R1 is fixed by dropping the idle preload, this goes too.
- N2, duplicates: `readied` plus SvelteKit's own same-id check stop repeats. A swipe that wobbles left then right on Followed asks for Fresh, then Your turn, then Fresh again (one slot); bounded by the person's own moves.
- N3, one swipe one tab: unchanged. `ready()` never steps; `stepOfWheel` and `stepTab` are untouched; all trackpad journeys pass on three profiles, the new slow-page one included. Touch `touchMoved` only readies; `touchEnded` still decides the step. LB/RB still call `stepTab` → `goto`, and get the ahead copy, so they share R1.
- N4, overlap: the diff draws nothing; `controls-overlap.test.ts` (320×568, 375×667, 667×375, before and after launch) passes on all three profiles.
- N5, phone tab press passed the probe; not dug into (something on the phone path discards the ahead copy first). Not a reason to keep the stale path.
