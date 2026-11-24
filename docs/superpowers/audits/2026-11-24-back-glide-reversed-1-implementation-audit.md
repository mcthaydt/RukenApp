# Back to the feed is the clip move reversed: implementation audit, round 1

- Pull request: #399, head `9966ecc` (branch `claude/project-thread-vlnx67`), base `main` at `e8e2b14`.
- Lane 2 (`src/lib/look.css`, `src/routes/+layout.svelte`). Reviewer: fresh session, Opus 5.5, medium.
- Brief: the owner, 2026-11-24 19:02 UTC: "The transition between in game page to feed doesn't look like the reverse transition". So Back (the browser's or the arrow) must look like feed → game played backwards: path, timing and layering, with feed → game unchanged, direct loads and deep links unaffected and no flash.
- Graphify: not used (the change is two files; read directly).

## Verdict: FAIL, 1 red, 2 notes

The page and the clip are an exact mirror. The bottom bar is not: it plays the browser's own 250 ms cross-fade from the start in both directions, so on Back the feed's bar is missing for the whole move and pops in when it ends, where going out it was on top and faded away.

## What ran

- `pnpm exec playwright test tests/browser/feed-to-game-grow.test.ts tests/browser/page-moves.test.ts tests/browser/game-page.test.ts` on phone (WebKit 2359, iPhone SE), tablet and computer (Chromium), local Postgres 16, at `9966ecc`: 93 passed, 0 skipped, 0 failed. The new journey "going back to the feed plays the move out backwards…" ran and passed on all three.
- Mirror probe (`2026-11-24-back-glide-reversed-1-probe-mirror.test.ts.txt`): holds every view-transition animation and samples 21 frames of the move out and of Back by the arrow, reading the opacity and z-index of old/new root and clip and the clip group's width, height and transform. Back at t against out at 1 − t, all three sizes: largest difference **0** (opacities to 3 places, sizes and offsets to 1/100 px). The clip's path, its curve `cubic-bezier(0.64, 0, 0.78, 0)` (the exact mirror of `0.22, 1, 0.36, 1`), the feed fading in on top (`page-shows`) and the feed clip taking over by 45% (`clip-takes-over`, the mirror of `clip-hands-over`'s 55%) all check out.
- Frame probe (`…-probe-frames.test.ts.txt`), phone WebKit: pictures of the game page, Back held at 0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9 and 1, and the feed settled, on this head and on `main`; and the move out held at 1, 0.8, 0.5, 0.2, 0. Strips in the project files under `audits/2026-11-24-back-glide-reversed-1/` (`pr-back-strip.png`, `main-back-strip.png`, `strip-out-reversed.png`).
- Code read: `data-way` is set only when `grows && to === "/"`, which `clipMoves` allows only for Back to the feed the game was opened from, and is cleared at the start of every move; nothing else reads it. Reduced motion and no view transitions return before it is set. The forward rules are untouched (only `[data-way="back"]` selectors were added), and the journey still checks the out move draws `page-fades`, `clip-hands-over` and the quick-start curve. Direct loads start no move; the existing journey for the back arrow on a game opened another way passed.

## Findings

### 1. red: the bottom bar does not play backwards

- UNIT: `src/lib/look.css`, the `grow` move's `tabs` pictures.
- REQUIREMENT: the owner's 19:02 UTC message: Back looks like the move out reversed; the coordinator's brief: layering mirrored, no flash.
- REASON: the bar's group (`::view-transition-*(tabs)`) keeps the browser's default 250 ms cross-fade from the start in both directions, and on Back the feed's bar is drawn under the full-window clip.
- EVIDENCE: the animations the probe listed on both moves are the same: `old(tabs) -ua-view-transition-fade-out 250`, `new(tabs) -ua-view-transition-fade-in 250`. In `strip-out-reversed.png` the move out at t = 0 shows the feed's clip with the bar on top, fading by t = 0.2. In `pr-back-strip.png` Back at t = 0.9 and 1 shows the feed's clip filling the window with no bar, and the settled feed straight after has the bar, so it pops in at the end. The game page's bar meanwhile fades out over Back's first 250 ms, which the move out never shows. (`main` pops the bar at the end of Back too, so this is not new, but this pull request's job is the mirror.)
- EXPECTED: Back at t looks like the move out at 1 − t for the bar too: the feed's bar on top of the clip, fading in over Back's last 250 ms (out to 200 to 450 ms), with no pop at the end.
- FIX: under `html[data-move="grow"][data-way="back"]`, put the `tabs` group above the clip group and give its old/new pictures the move out's fades reversed (for example the feed's `new(tabs)` fading in with a 200 ms delay over 250 ms), then add the `tabs` pictures to the journey's `drawn` record in `tests/browser/feed-to-game-grow.test.ts` so both directions are checked. Files: `src/lib/look.css`, `tests/browser/feed-to-game-grow.test.ts`. Check with the mirror probe extended to `old(tabs)`/`new(tabs)` and a held frame at Back t = 1 on phone WebKit showing the bar.

### 2. note: the game's name and back arrow vanish the instant Back starts

The clip group sits above the page, so at Back t = 0 the game page's picture of its clip covers the name and arrow drawn over it (`pr-back-strip.png`, frames 1 → 2). It is the mirror of the move out's end whenever the game clip already has a frame, and `main` does the same. Not fixed here; for the owner to judge on the device.

### 3. note: the arriving feed video has no frame at Back's start

At Back's start the feed's current `<video>` had `readyState 0` and no poster in the journey (stills are off under `--local`). The held frames still showed the clip's picture, so no blank was seen here. Live, stills exist; worth a look on a phone, not a blocker.

## CRUD

The change adds nothing a person makes; no CRUD journey applies.
