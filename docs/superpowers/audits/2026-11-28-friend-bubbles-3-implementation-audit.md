# Friend bubbles: implementation audit 3

Pull request #435, head **d18d72e** (branch claude/project-thread-cu5tvs; main merged in at fb47e45). Fresh lane 2 review, Opus 5.5, medium.
Verdict: **FAIL, 1 red.** All four reds from audit 2 (35d2cc6) are fixed, and the new checks fail on 35d2cc6. One new overlap: this pull request raised the first-open hint to z-index 3, so it now draws over Like or Save.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

- CI at d18d72e (run 46091067872, quick draft run): verify (lint, typecheck, unit, build), postgres and all six browser pieces green, gate green. `controls-overlap` passed on phone (WebKit) and tablet; `friend-likes` passed on phone, tablet and computer.
- Locally at d18d72e, Playwright in Chromium (no WebKit or Docker here), iPad and iPhone SE profiles, globalSetup skipped: `controls-overlap`, `friend-likes`, `fits-the-screen`: 20 passed, 0 failed.
- At 35d2cc6 with d18d72e's `controls-overlap.test.ts` and `fits-the-screen.test.ts`: 6 failed (both overlap journeys on both profiles, the new game-page check on both). The failures name every red from audit 2: "Your turn / N Night Owl Games Studio", "Search / Follow Night Owl Games Studio" at 320×568 (red 1); "Add a game / Join", "You / Join", "Home / Wishlist" on `/g/<game>` at 320×568 and 375×667 (red 3); `"On" breaks across two lines` on `/settings/feed` at 320×568 (red 4).
- Mutation at d18d72e: Like moved wholly inside Play (20×20 inside it) on `/`: the journey fails with "Play / Like" and "Wishlist / Like" at all three sizes on both profiles (red 2 fixed: containment counts).
- An uncommitted probe with no exemptions but containment and `aria-hidden` measured every link, button, field and `role=img` box, signed in with a friend's like and following the maker, before and after launch, at 320×568, 375×667, 667×375 and also 360×640, 360×780 and 390×844 (Home Screen mode), on `/`, `/followed`, `/g/<game>`, `/settings/feed`, `/me`. Only two pairs were found, both the named exemptions: "N Night Owl Games Studio / Follow Night Owl Games Studio" (48×48; 48×24 at 320×568) and "Watch the video full size / Back to the feed" (48×48). Nothing else touches the game page's video.
- `feed-controls.test.ts:1113` "the feed never ends": not in this pull request's quick run (the picker left it out). On main at 2a1ec22 (run 46085790945, full) it passed on phone (WebKit), tablet and computer, with no retry. Locally at d18d72e with 18 live games it passed on both Chromium profiles. The journey pages at most 4 more times waiting for a repeat, so a shared database with 291 live games can outrun it: the builder's local-data reading fits. It runs in WebKit again in the full run when the pull request is marked ready.
- Screens: /mnt/project-files/audits/2026-11-28-friend-bubbles-3/ (three shots, below).

## The four fixes

1. **Short phone's column (fixed).** At 320×568 the maker's picture now starts at y 65 (below the top bar, which ends at 59), the name is kept for a screen reader, and the column ends above the bar. The media query is `portrait and max-height: 600px`, so 375×667 and up keep the name. The journey now makes its own game with a maker page ("Night Owl Games Studio") and scrolls to that clip on `/` and `/followed`, so the case runs every time.
2. **Containment counts (fixed).** The general `inside` exemption is gone; the mutation above proves a button wholly on another fails. Exemptions now: `[aria-hidden]`/`[inert]` (the whole-clip link `a.open` is `aria-hidden`), `.gamepage .clipopen`, and controls sharing one `.credit`.
   - Judgement on the third, the plus on the maker's picture: it may stay. The plus is a badge drawn as part of the picture (as on Instagram and TikTok), it is not a separate thing on screen that hides another, and the owner already ruled on it (2026-11-27: makers see their own clips with the plus hidden). The exemption is scoped to one `.credit`, so it can hide nothing outside the maker's own credit. See note 1 about its press area.
   - `.gamepage .clipopen` is exempt against every control, not only Back. The probe shows Back is the only one on it at every size, so it hides nothing today (note 2).
3. **Game page above the bar (fixed).** `main.gamepage` is no longer excluded from `--foot`, so its view ends above the bar; `fits-the-screen.test.ts` has a new check that the game page does not scroll the page and its view ends above the bar, before and after launch. The scroll exemption is gone from `controls-overlap`.
4. **"On" stays whole (fixed).** `.state` is `flex: none; white-space: nowrap`; `spilling` now walks each word's line boxes, and fails on 35d2cc6 as above.

## Bubbles: behind the UI, in front of the video

Checked. The faces (28 px, `role=img`, `pointer-events: none`) float just above the game's card at its left, over the clip's picture, and no button, the band, the side column or the bar crosses them at any of the six sizes, before or after launch. Sideways they float above the card, clear of the maker and the column. They sit under the first-open hint, as 35d2cc6's commit intends.

## Findings

1. UNIT: src/features/feed/Feed.svelte (`.hints`, z-index 3, line 1009) and tests/browser/controls-overlap.test.ts. VERDICT: red. REQUIREMENT: the owner, 2026-11-27 23:12 UTC: any overlap is blocking at 320×568, 375×667 and 667×375, new or not; reviewers measure it. REASON: on the feed's first open the "Swipe up for the next game" hint now draws over a round button: on main `.hints` and `.lower` are both z-index 2 and `.lower` comes later, so the column drew over the hint; this pull request raised `.hints` to 3 to keep it over the faces, and that also puts it over the column. EVIDENCE: shots at 2× (in the folder above): at 320×568 the hint (x 31–289, y 217–283) covers Save (x 241–288, y 226–272) and its label; at 375×667 the hint (x 59–317, y 253–321) covers the lower left of Like (x 296–342, y 228–274) and its count. The hint has `pointer-events: none`, so the presses still land, but a person sees the hint sitting on the button. `controls-overlap` misses it because the hint is not a control. EXPECTED: the hint stays over the faces and clear of every button at the three sizes. FIX: in Feed.svelte, keep the hint off the side column at these sizes (for example a `max-width` or `right` that clears the column, or a place higher on the clip), not a lower z-index that puts it under the faces again; in controls-overlap.test.ts, count `.hints` against every control (a floating piece over a button is an overlap). Only those two files.

## Notes (not blocking, not fixed here)

1. The plus's 48 px press area covers the lower half of the maker's picture and the top of their name (48×48 at 375×667), so a press on the lower part of the picture follows the maker instead of opening their page. That is how a badge on a picture works and the exemption is right for the overlap rule; recorded only.
2. `.gamepage .clipopen` is exempt against everything, not only Back. Narrowing it to Back (`.gamepage .clipopen` with a control inside the same clip box) would keep a future button that lands on the video from passing. Recorded only.
3. On a short upright phone the maker's name is no longer shown on a clip (the picture stays, and opens their page). The owner may want to know; it is how the column fits at 320×568.
4. This pull request's quick run did not pick `feed-controls.test.ts`, though Feed.svelte changed; the full run on ready covers it.
