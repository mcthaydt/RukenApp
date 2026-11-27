# Learned feed unit G (Like, Save, Repost): implementation audit 4

Pull request #404, head `6185f346b92db360416291b5ef64cccfa4cdb0e8` (the merge of `main` 5ca7cfb, with #400 and #402, into b4e09e4, which audit 3 passed). Lane 3. A fresh session, Opus 5.5, medium, written 2026-11-27 04:15 UTC.

**Verdict: PASS, 0 red, 1 note.**

## The merge: nothing lost from either side

`git merge-tree` of the two parents names 15 conflicted files. Each resolution was read against both sides (`git show --cc 6185f346`):

- `accounts/deletion.ts`: the purge removes both `gameMark` (the person's and every mark on their games) and `makerFollow` (both sides). `purge.pg.test.ts` keeps both tests and passes.
- `consent/Notice.svelte`, `gate.ts`, `routes/cookies/+page.server.ts`: the reasons are `like`, `repost` and `follow`, each with its own line on the notice. `consent/routes.ts` gates both `/[handle=handle]/follow` and `/api/feed/marks`. `cookies.ts` and the privacy page list both `rk_mark_pressed` and `rk_follow_pressed`.
- `feed/service.ts`: clips carry `maker.following`, `maker.mine` and `marks`; makers and marks are fetched together, follows after. `services.ts` keeps `marks`, `listOf` and `search`, and uses main's `feed.viewerOf` (the branch's exported `viewerOf` is gone, and its two callers, `+page.server.ts` and `api/feed/+server.ts`, use `feed.viewerOf`).
- `Feed.svelte`: both sides' state and markup are kept; the column is credit and plus, Like, Save, Repost, then Share.
- Tests: `feed-controls.test.ts` expects Home, Add a game, You, Fresh, Followed, Search, Sound, then after Play the maker and plus, then Like, Save, Repost, Share, Sound. `ranker.test.ts`, `service.test.ts` keep both sides.

## Forged presses, cookie consent

Probe (`2026-11-27-learned-feed-unit-g-4-probe.test.ts.txt`), phone (WebKit, Playwright docker), tablet and computer, a signed-in player, `Origin: https://elsewhere.example`:

| Request | Answer |
| --- | --- |
| form POST `/<handle>/follow` | 403 |
| text/plain POST `/<handle>/follow` | 403 |
| text/plain POST `/api/feed/marks` | 403 |
| form POST `/api/feed/marks` | 403 |

No follow row was made, Like stayed unpressed after a reload, and signed out the same form left no `rk_follow_pressed` (only `rk_consent`). `/me/press` and `/[handle]/follow`'s GET still need their own pressed notes (unchanged by the merge). The `cookie-consent` journeys pass on all three devices.

## Layout rules

The probe measured the column on phone (375×667), a 320×568 window, tablet, a 1280×600 window and computer, in all three engines' profiles: every piece is on screen, below the top bar and above the bottom bar; Like, Save, Repost, Share and the plus are each at least 48×48; no sideways scroll. `fits-the-screen` passes. Keyboard: the Tab-order journey passes with a visible focus ring on every stop. There is no gamepad layer in the site yet (it is queued as its own piece), so gamepad reach is not something this PR can be held to.

## What ran on `6185f34`

- `pnpm lint`, `pnpm typecheck` (0 errors, 0 warnings), `pnpm test`: 2,270 passed.
- `pnpm test:pg` on Postgres 16: 805 passed.
- Browser, Playwright docker `v1.63.0-noble`, phone (WebKit), tablet, computer: feed-marks, follow-a-maker, feed-controls, feed-top, cookie-consent, fits-the-screen, feed, me: 233 passed, 4 skipped, 0 flaky. Probe: 12 passed.
- CI on this head (quick, draft): verify, postgres, the 6 browser shards and gate all green. The full run starts when the PR is marked ready.
- Not run here: the rest of the browser suite.

## Note (not blocking)

- N1. UNIT: `src/features/feed/Feed.svelte` `.hints`. VERDICT: note. REASON: with the maker credit now on top of Like, Save and Repost, the column is taller, so the first-open hint ("Swipe up for the next game") lies over it: over the maker's name at 375 wide, and over Like at 320 wide. EVIDENCE: the probe's screenshots. It shows once per device, lets presses through (`pointer-events: none`) and goes on the first touch, so nothing is blocked. FIX (follow-up): keep the hint clear of the right column (for example, a max width that stops short of the column).
- Carried from audit 3: the site sends no `frame-ancestors` (older than this PR).
