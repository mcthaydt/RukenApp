# Snappier trackpad swipe (#447): implementation audit 2 (lane 2)

Examined: `1289700` (`12897008ab4bdc396038330793ede9118a484189`) on `claude/project-thread-9jsisq`, PR #447. Written 2026-11-28 05:50 UTC by a fresh session (Opus 5.5, medium).
Brief: the owner, 2026-11-28 03:04 UTC, after trying #442 on a trackpad: "a bit slow, but it works". Change: each feed tab asks for its neighbour 500 ms after it comes in, and a swipe's first sideways move asks for its target. Review 1 (comment 7234438630, audit 3077bf4) failed R1: the copy asked for ahead is never thrown away, so Followed showed the follows from before. Its EXPECTED named follows **and sends**. This round fixes follows (`asked-ahead.svelte.ts`, `FollowBadge.svelte`, FeedTop asks again).

**Verdict: FAIL, 2 red.** The verdict line naming `1289700` is the PR comment.

## What ran

| Check | Result |
| --- | --- |
| CI on 1289700 (run 46112825677, quick draft) | verify, postgres, 6 browser shards, gate: all success |
| `follow-a-maker`, `trackpad-swipe`, `controls-overlap`, phone, tablet, computer (Playwright 1.63 docker, local Postgres 16) | all passed, 2 skipped (the overlap file's own skips), 0 failed |
| The new follow journey ("…though the feed asked for Followed ahead") at 519cf02 (the fix's src left out) | fails 3 of 3 (phone, tablet, computer): it fails by itself, and passes at 1289700 |
| Probe A and B below (copy in project files `audits/2026-11-28-snappier-trackpad-swipe-2-probe.test.ts.txt`) | **PR 1289700: 6 of 6 fail** (A and B on 3 profiles). **main 3efa80e: 6 of 6 pass** |

## Follow fix: verified

- `invalidate("ruken:asked-ahead")` reaches SvelteKit 3.0.0's `_invalidate`, which calls `discard_load_cache()` (client.js:586). No load depends on that name, so `invalid_server_nodes` is all false and the page on screen is not fetched again (client.js:1395-1422): one extra fetch per follow, of the neighbour only.
- `askedAhead.stale` is read in FeedTop's `$effect`, so a follow resets `readied` and asks again after 500 ms. Unfollow is covered by the same journey's second half.

## Reds

### R1. Your turn asked for ahead misses a game a friend sends meanwhile

- UNIT: `src/features/feed/FeedTop.svelte` (the 500 ms `$effect` and `ready()`).
- VERDICT: red.
- REQUIREMENT: review 1 R1 EXPECTED: "the tab a swipe, press or LB/RB lands on reflects the person's follows (and sends) as they are at that moment"; coordinator's check that a preload is never stale for the viewer.
- REASON: the copy asked for ahead has no age limit, and Your turn's list (and its dot, `news`) change by what other people do, which nothing on this screen hears. Throwing it away on the viewer's own presses cannot cover this.
- EVIDENCE: probe A. Sign up, be friends with a maker, open Followed, wait for `/your-turn/__data.json` (asked ahead), a send row is written for this person, 1 s later press Your turn: "Nothing yet. When a friend sends you a game, it shows up here." On main the same steps list the game. 3 of 3 profiles fail on the PR, 3 of 3 pass on main.
- EXPECTED: Your turn opened by press, swipe or LB/RB shows every game sent before the move.
- FIX: bounded to `FeedTop.svelte` (and `asked-ahead.svelte.ts` if used), plus a journey in `sent-to-you.test.ts` or `trackpad-swipe.test.ts` like probe A that fails on 1289700. Either keep only the swipe-start ask (the copy is then at most one gesture old), or let an idle copy live a short, named time and throw it away and ask again at swipe start when it is older.

### R2. A Like, Save or Repost made on Fresh shows undone on Followed

- UNIT: `src/features/feed/FeedTop.svelte` (idle ask), `src/features/feed/Feed.svelte` (`press`, where marks are sent).
- VERDICT: red.
- REQUIREMENT: same as R1; CRUD rule: what a person makes reads back as made.
- REASON: marks live in each page's own `pressed` state (`Feed.svelte:119`) over the page's data, so Followed's copy asked for ahead carries the marks from before the press; `press` throws nothing away.
- EVIDENCE: probe B. Follow a maker, open Fresh, wait for `/followed/__data.json`, press Like on the maker's clip (site answers 200, `aria-pressed="true"`), press Followed: the same clip's Like reads `aria-pressed="false"`. 3 of 3 fail on the PR, 3 of 3 pass on main.
- EXPECTED: the clip shows liked (saved, reposted) on Followed, with the new count.
- FIX: the R1 fix that drops or ages out the idle copy covers it only if the press and the move can't fall inside the copy's life; otherwise also call `followsChanged()` (renamed to fit) after a mark is kept in `Feed.svelte`'s `press`. Add a journey like probe B that fails on 1289700.

## Also checked, no finding

- Sign in, sign out, account switch, block and report: each is a navigation (or `refreshAll`), which drops the copy (`client.js` navigate path, 2128-2134; `_goto` with `refreshAll`). Your turn's Stop uses `refreshAll`.
- Taste sheet and good-pick answers change Fresh only; Fresh is never asked for idly (from Your turn the idle ask is step -1, Followed). Only a swipe start asks for Fresh, right before the move.
- One swipe = one tab: `ready()` never steps; `stepOfWheel`/`stepTab` untouched; trackpad journeys pass on 3 profiles.
- Duplicates: `readied` and SvelteKit's same-id check stop repeats; the follow fix adds one ask per follow.
- Overlap: the diff draws nothing; `controls-overlap.test.ts` (320×568, 375×667, 667×375, before and after launch) passes on 3 profiles.

## Notes (not blocking)

- N1: review 1's N1 cost note stands while the idle ask stays: every visit to Fresh also runs Followed's load.
- N2: Your turn's own "seen" post and the idle ask of Followed 500 ms later race; not seen to fail here, not probed.
