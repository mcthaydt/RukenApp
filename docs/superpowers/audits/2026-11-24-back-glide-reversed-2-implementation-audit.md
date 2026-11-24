# Back to the feed is the clip move reversed: implementation audit, round 2

- Pull request: #399, head `7373f86` (branch `claude/project-thread-vlnx67`), with `main` at `f6dd76b` (#397) merged in.
- Lane 2 (`src/lib/look.css`, `src/routes/+layout.svelte`). Reviewer: fresh session, Opus 5.5, medium.
- Brief: the owner, 2026-11-24 19:02 UTC: "The transition between in game page to feed doesn't look like the reverse transition". Round 1 (`9966ecc`) failed on one red: the bottom bar did not play backwards (on Back the feed's bar was missing for the whole move and popped in at the end).
- Graphify: not used (two source files; read directly).

## Verdict: FAIL, 1 red, 1 note

The fix works in Chrome's engine (tablet and computer): the bar, the page and the clip are an exact mirror there. In Safari's engine (the phone profile) the round 1 red is still there: the feed's bar is never drawn during Back and pops in when the move ends. The timing and layering the new journey records are right in both engines, so the journey passes, but the picture in Safari's engine does not match it.

## What ran (all at `7373f86`, local Postgres 16, fresh database)

- `pnpm exec playwright test feed-to-game-grow page-moves game-page corners` plus the mirror probe, on phone (WebKit 2359, iPhone SE), tablet and computer (Chromium): **99 passed, 0 failed, 0 skipped.** This confirms the implementer's 3 local failures were a dirty database: on a fresh one these journeys pass.
- `pnpm lint`: passed. `pnpm typecheck`: 0 errors (after removing a stale local `.svelte-kit/cloudflare` build left by the journeys' web server; with it present svelte-check reads the built worker and reports errors that are not in the source). `pnpm test`: 155 files, 2244 tests passed.
- Mirror probe (round 1's, extended to `old(tabs)`, `new(tabs)` and the `tabs` group's z-index): 21 paused frames of the move out and of Back by the arrow, Back at t against out at 1 − t, root, clip and tabs opacities and the clip group's size and offset. Largest difference **0** on all three sizes. The `tabs` group is `z-index: 1` on every Back frame and `auto` going out; the bar's fade numbers are an exact mirror (out t = 0.1: old 0.750, new 0.250; Back t = 0.9: old 0.250, new 0.750).
- Held pictures of both moves at t = 0, 0.2, 0.5, 0.8, 1 (out on top, Back at 1 − t below), with the settled game page and feed at the ends: `audits/2026-11-24-back-glide-reversed-2/tablet-out-over-back-strip.png` (Chromium) and `phone-out-over-back-strip.png` (WebKit), in the project files.
- Live check in WebKit, not paused: every view-transition animation slowed to 1/25 speed and pictured every 600 ms (`phone-live-slowed-strip.png`), so a paused-animation artefact is ruled out.
- Code read: only `[data-way="back"]` selectors were added; the forward rules are untouched and the journey still pins the move out's curve, `page-fades`, `clip-hands-over` and the bar's 0 ms / 250 ms fades. `cubic-bezier(0.75, 0, 0.75, 0.9)` is the exact reverse of the default `ease` (0.25, 0.1, 0.25, 1) the bar's fade uses going out.

## Findings

### 1. red: in Safari's engine the feed's bar still pops in at the end of Back

- UNIT: the `grow` move's `tabs` pictures (`src/lib/look.css`), and `tests/browser/feed-to-game-grow.test.ts`.
- REQUIREMENT: the owner's 19:02 UTC message; round 1's red finding 1 (Back at t looks like out at 1 − t for the bar, with no pop at the end). The phone profile (Safari's engine) is one of the three devices the owner chose.
- REASON: in WebKit the arriving bar's picture, `::view-transition-new(tabs)`, is never drawn, in either direction, even though its computed opacity reaches 1 and its group sits on top with z-index 1.
- EVIDENCE: `phone-out-over-back-strip.png`, bottom row: Back t = 0.2 and 0.5 show the game page's bar (the old picture), t = 0.8 shows it faint, t = 1 shows the feed's clip with **no bar**, and the settled feed straight after has the bar. The same at 1/25 speed live (`phone-live-slowed-strip.png`, bottom row, frames 11 to 12). On tablet (Chromium) the same frames show the feed's bar fading in on top of the clip, as intended (`tablet-out-over-back-strip.png`). The probe read `new(tabs)` opacity 1 and `tabs` group `z1` at WebKit Back t = 1, so the CSS applies; the picture just is not drawn. Turning off the bar's backdrop blur (`phone-no-blur-try.png`) and the icons' `will-change` (`phone-no-will-change-try.png`) did not change it. Going out, WebKit has the same gap (the game page's bar is never drawn during the move and pops in at the end); that is unchanged from `main`.
- EXPECTED: on the phone, Back at t = 1 shows the feed's bar over the feed's clip, as at out t = 0, with no pop when the move ends; and a journey that fails when it does not.
- FIX: find why WebKit does not draw `::view-transition-new(tabs)` (the bar is the same layout element on both pages and only its marked place changes; candidates not yet tried: its `translate: -50% 0` with `position: fixed`, its `z-index: 10`, the `[aria-current]` change mid-capture) and make the feed's bar show on Back in WebKit; or, if no engine-safe way exists, a WebKit-safe stand-in that still reads as the mirror (for example, during `grow` moves, letting the old picture carry the bar and dropping the cross-fade, since both pictures are the same bar). Add a check the journey can fail on in WebKit: a held frame at Back t = 1 on phone whose bar area matches the settled feed's bar area (pixels), not only the computed timing. Files: `src/lib/look.css`, `tests/browser/feed-to-game-grow.test.ts`, and `src/features/feed/Bar.svelte` if the cause is in the bar's own styles. Check: the held-frame probe on phone WebKit shows the bar at Back t = 0.8 and 1.

### 2. note: going out has the same gap in WebKit

On the phone the move out drops the feed's bar over its first 250 ms and the game page's bar appears only when the move ends (`phone-out-over-back-strip.png`, top row, then the settled game page). This is `main`'s behaviour and outside this pull request; whatever fixes finding 1 will likely fix it too, and then out and Back mirror in WebKit as they already do in Chromium.

## CRUD

The change adds nothing a person makes; no CRUD journey applies.
